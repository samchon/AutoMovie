/** Every runtime light discriminator, shared by every ingress gate. */
export const AUTO_MOVIE_LIGHT_TYPES = new Set([
    "directional",
    "point",
    "spot",
]);
/** Whether an untyped artifact names one of the supported light kinds. */
export const isAutoMovieLightType = (value) => typeof value === "string" &&
    AUTO_MOVIE_LIGHT_TYPES.has(value);
/** The slack `validateTransformScalars` allows a staged rotation's length. */
const UNIT_QUATERNION_EPSILON = 1e-6;
/**
 * A light `rotation` keyframe must be a unit quaternion, the SAME rule
 * `validateTransformScalars` holds a staged light's `transform.rotation` to.
 *
 * This is a fact about the four components TOGETHER, so it cannot be stated as
 * the per-component range {@link IAutoMovieLightChannelProperty.bounds} carries:
 * `(0, 0, 0, 0.5)` has every component inside `[-1, 1]` and still describes no
 * rotation. Without it, a track could state through time a light `commitScene`
 * would refuse outright, which is exactly what the bounds exist to prevent.
 *
 * A component that is not a finite number yields NO fault: the shared
 * track-shape contract reports that at the offending index, and one mistake
 * earns one violation.
 */
const unitQuaternionFault = (value) => {
    const components = value.filter((component) => typeof component === "number" && Number.isFinite(component));
    if (components.length !== value.length)
        return null;
    const length = Math.hypot(...components);
    return Math.abs(length - 1) <= UNIT_QUATERNION_EPSILON
        ? null
        : `must be a unit quaternion (length 1), but length was ${length}`;
};
/**
 * Every animatable light property, keyed by the pointer's last segment.
 *
 * Total over {@link AutoMovieLightProperty}: adding a member to that union
 * without giving it a `carries`/`write` pair does not compile, which is how a
 * widened contract cannot outrun its applier.
 */
export const LIGHT_CHANNEL_PROPERTIES = {
    intensity: {
        valueType: "scalar",
        bounds: { min: 0, max: Infinity, inclusiveMin: true },
        carries: () => true,
        write: (override, value) => {
            override.intensity = value[0];
        },
    },
    color: {
        valueType: "vec3",
        bounds: { min: 0, max: 1, inclusiveMin: true },
        carries: () => true,
        write: (override, value) => {
            override.color = {
                r: value[0],
                g: value[1],
                b: value[2],
                a: null,
                // `hex` is documented as a derived sRGB label for the linear triple. An
                // animated colour outruns it every frame, so carrying the staged label
                // forward would state a value that is no longer the light's.
                hex: null,
            };
        },
    },
    range: {
        valueType: "scalar",
        bounds: { min: 0, max: Infinity, inclusiveMin: true },
        carries: (kind) => kind !== "directional",
        write: (override, value) => {
            override.range = value[0];
        },
    },
    coneAngle: {
        valueType: "scalar",
        bounds: { min: 0, max: 90, inclusiveMin: false },
        carries: (kind) => kind === "spot",
        write: (override, value) => {
            override.coneAngle = value[0];
        },
    },
    position: {
        valueType: "vec3",
        // A place in the world has no documented range: the scene gate holds a
        // light's translation to finiteness and nothing more, and the shared
        // track-shape contract already refuses a non-finite keyframe. Stating the
        // unbounded interval keeps this column honest rather than inventing a
        // ceiling no artifact is held to.
        bounds: { min: -Infinity, max: Infinity, inclusiveMin: true },
        carries: (kind) => kind !== "directional",
        write: (override, value) => {
            override.position = { x: value[0], y: value[1], z: value[2] };
        },
    },
    rotation: {
        valueType: "quaternion",
        // `quaternion` rather than `vec4` so `sampleClip` SLERPs it: a light
        // swinging through a wide arc under component-wise lerp would slow in the
        // middle and dip off the unit sphere, and the same declaration would then
        // aim differently depending on how far apart its keys sat.
        bounds: { min: -1, max: 1, inclusiveMin: true },
        valueFault: unitQuaternionFault,
        carries: (kind) => kind !== "point",
        write: (override, value) => {
            override.rotation = {
                x: value[0],
                y: value[1],
                z: value[2],
                w: value[3],
            };
        },
    },
};
/**
 * Parse `/lights/<id>/<property>`, or `null` when the string is not one.
 *
 * The light is addressed by its stable **id**, never by its position in
 * `scene.lights`. An index would be read against an array whose order is itself
 * load-bearing elsewhere (the viewer's segmentation mask palette is keyed by
 * top-level child index), so an artifact addressing lights positionally would
 * silently re-target whenever staging inserts one.
 *
 * RFC-6901 escaping applies to the id segment (`~1` is `/`, `~0` is `~`, in
 * that order). A pointer that is not the canonical encoding of what it decodes
 * to is rejected, which also rejects an invalid escape such as `~2`.
 */
export const parseLightPointer = (pointer) => {
    if (typeof pointer !== "string")
        return null;
    const segments = pointer.split("/");
    if (segments.length !== 4)
        return null;
    if (segments[0] !== "" || segments[1] !== "lights")
        return null;
    const property = segments[3];
    if (!isLightProperty(property))
        return null;
    const light = unescapePointerSegment(segments[2]);
    if (light.length === 0)
        return null;
    if (formatLightPointer(light, property) !== pointer)
        return null;
    return { light, property };
};
/** The canonical pointer addressing one light's property. */
export const formatLightPointer = (light, property) => `/lights/${escapePointerSegment(light)}/${property}`;
/** Whether a string names an animatable light property. */
export const isLightProperty = (property) => Object.prototype.hasOwnProperty.call(LIGHT_CHANNEL_PROPERTIES, property);
/** RFC-6901: `~` becomes `~0` and `/` becomes `~1`, in that order. */
const escapePointerSegment = (segment) => segment.replaceAll("~", "~0").replaceAll("/", "~1");
/** RFC-6901: `~1` becomes `/` and `~0` becomes `~`, in that order. */
const unescapePointerSegment = (segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~");
/**
 * Fold the accumulated overrides back onto a light, rebuilding it kind by kind.
 *
 * Written as a total switch rather than a spread so each kind keeps exactly the
 * parameters its discriminator promises: a `range` recorded against a light
 * that later reads as directional cannot leak a field the type does not carry.
 *
 * Every kind is its own `case` and there is no `default`. A `default` arm would
 * silently build a spot for a kind added later, and it would hide that omission
 * from the exhaustiveness check: the switch is what makes adding an
 * `IAutoMovieLight` arm a compile error here rather than a wrong light at
 * runtime.
 */
export const applyLightOverride = (light, override) => {
    const base = {
        id: light.id,
        transform: applyLightTransformOverride(light.transform, override),
        color: override.color ?? light.color,
        intensity: override.intensity ?? light.intensity,
    };
    switch (light.type) {
        case "directional":
            return { ...base, type: "directional" };
        case "point":
            return { ...base, type: "point", range: override.range ?? light.range };
        case "spot":
            return {
                ...base,
                type: "spot",
                range: override.range ?? light.range,
                coneAngle: override.coneAngle ?? light.coneAngle,
            };
    }
};
/**
 * The light's placement at this instant: the staged transform with whichever of
 * its translation and rotation a track wrote.
 *
 * `scale` is deliberately not animatable and is carried through untouched. A
 * punctual light has no extent for a scale to mean anything about — `three.js`
 * reads none of it, and glTF's `KHR_lights_punctual` defines none — so an
 * animatable scale axis would be a channel that validates, applies, and changes
 * no frame, which is the false green #1339 named.
 *
 * A transform no track touched is returned BY IDENTITY, the same guarantee
 * `resolveShotLighting` gives for a whole light: a shot that dims a lamp
 * without moving it leaves the very transform object the scene staged, so
 * nothing downstream can mistake a re-boxed copy for a move.
 */
const applyLightTransformOverride = (transform, override) => override.position === undefined && override.rotation === undefined
    ? transform
    : {
        translation: override.position ?? transform.translation,
        rotation: override.rotation ?? transform.rotation,
        scale: transform.scale,
    };
//# sourceMappingURL=lightChannel.js.map