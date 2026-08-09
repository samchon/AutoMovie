import {
  AutoMovieChannelValueType,
  IAutoMovieColor,
  IAutoMovieLight,
  IAutoMovieQuaternion,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

/** Every runtime light discriminator, shared by every ingress gate. */
export const AUTO_MOVIE_LIGHT_TYPES = new Set<IAutoMovieLight["type"]>([
  "directional",
  "point",
  "spot",
]);

/** Whether an untyped artifact names one of the supported light kinds. */
export const isAutoMovieLightType = (
  value: unknown,
): value is IAutoMovieLight["type"] =>
  typeof value === "string" &&
  AUTO_MOVIE_LIGHT_TYPES.has(value as IAutoMovieLight["type"]);

/**
 * Light channels: which light properties a shot may animate, how a track
 * addresses one, and how a sampled value is written onto a light.
 *
 * A light is NOT a scene node. `IAutoMovieScene` keeps `lights` beside `nodes`,
 * and `IAutoMovieNodeChannel` addresses only a node's TRS or morph weights, so
 * no node channel can reach a light's intensity, colour, range, or cone even in
 * principle. That is the same split glTF has: `KHR_lights_punctual` hangs a
 * light on a node so a node animation moves its PLACEMENT, while animating the
 * light itself needs `KHR_animation_pointer`. Hence the pointer form
 * (`/lights/<id>/intensity`), which is also exactly what a benchmark agent
 * reached for unprompted (#1348).
 *
 * That same split is why the light's PLACEMENT is in this table too. glTF gets
 * a moving light by hanging it on a node and animating the node; automovie
 * stages lights outside `nodes`, so there is no node to animate and a light
 * that could not carry `position`/`rotation` channels could not move or turn AT
 * ALL. Its direction would be fixed for the whole film, which is not a
 * limitation any particular subject feels: a shift change, a night watch, a
 * day's work, a procession are all productions whose LENGTH is part of what
 * they are about, and each of them needs the light to travel across it. Rather
 * than a second animation path for placement, placement is two more entries in
 * the one table, so a light's direction is keyed, sampled, gated and applied by
 * exactly the machinery its intensity already was.
 *
 * {@link LIGHT_CHANNEL_PROPERTIES} is the single table both halves read. The
 * artifact gate admits a pointer only when this table has an entry for it AND
 * that entry's `carries` accepts the staged light; the applier
 * ({@link resolveShotLighting}) writes through the same entry's `write`. The
 * admitted set and the applied set are therefore one set by construction, not
 * two lists documented as matching: a validated axis with no applier is #1339's
 * false green, and an applier that silently drops part of its input is #1349.
 *
 * @author Samchon
 */

/** A light property a shot's `lightMotions` may animate. */
export type AutoMovieLightProperty =
  | "intensity"
  | "color"
  | "range"
  | "coneAngle"
  | "position"
  | "rotation";

/**
 * The animatable property values accumulated for one light before they are
 * folded back onto it. Every field absent means the light is returned
 * unchanged, by identity.
 */
export interface IAutoMovieLightOverride {
  /** Radiant intensity, when an `intensity` track wrote one. */
  intensity?: number;

  /** Linear colour, when a `color` track wrote one. */
  color?: IAutoMovieColor;

  /** Falloff range in metres, when a `range` track wrote one. */
  range?: number;

  /** Cone half-angle in degrees, when a `coneAngle` track wrote one. */
  coneAngle?: number;

  /** World translation in metres, when a `position` track wrote one. */
  position?: IAutoMovieVector3;

  /** World orientation, when a `rotation` track wrote one. */
  rotation?: IAutoMovieQuaternion;
}

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
const unitQuaternionFault = (value: readonly unknown[]): string | null => {
  const components = value.filter(
    (component): component is number =>
      typeof component === "number" && Number.isFinite(component),
  );
  if (components.length !== value.length) return null;
  const length = Math.hypot(...components);
  return Math.abs(length - 1) <= UNIT_QUATERNION_EPSILON
    ? null
    : `must be a unit quaternion (length 1), but length was ${length}`;
};

/** One animatable light property: how it is addressed, and how it is applied. */
export interface IAutoMovieLightChannelProperty {
  /**
   * The value type the addressing pointer channel must declare, which is also
   * the only place this axis states a value's WIDTH. `sampleClip` already owns
   * the value-type → width mapping and refuses a track that disagrees with it,
   * so restating "vec3 is three numbers" here would be a second copy of a rule
   * that already has an owner, and the two could drift.
   */
  valueType: AutoMovieChannelValueType;

  /**
   * The bounds every component of a keyframe value must satisfy: the SAME ones
   * the staged light is held to by the scene gate. Without them a track could
   * state through time what `commitScene` refuses outright (a negative
   * intensity, a 200-degree cone), and the axis would be the one place in the
   * artifact where a documented range is not enforced.
   */
  bounds: {
    /** Lower bound. */
    min: number;
    /** Upper bound, `Infinity` for none. */
    max: number;
    /** Whether {@link min} itself is allowed (`false` for the spot cone). */
    inclusiveMin: boolean;
  };

  /**
   * Whether a light of this kind (`IAutoMovieLight["type"]`) carries the
   * property at all: `range` is meaningless on a directional (infinitely
   * distant) light and `coneAngle` exists only on a spot. The gate asks this
   * before admitting a track, so a track the applier could not honor is refused
   * at commit rather than dropped at playback.
   *
   * Placement splits the same way, and along the other axis. A directional
   * light is infinitely distant, so `IAutoMovieLight.transform` documents that
   * "only the orientation matters" and it carries no `position`; a point light
   * radiates equally in every direction, so it carries no `rotation`. A spot
   * carries both, being the one kind that has somewhere to stand AND somewhere
   * to look.
   *
   * The parameter is `unknown` so the gate can ask it of a staged light's raw
   * `type` without first asserting the union it is reading — asserting the
   * value a check is about to doubt is how a validator stops validating. A kind
   * outside the union is a broken scene the scene gate owns, not something this
   * predicate is deciding.
   */
  carries: (kind: unknown) => boolean;

  /**
   * A rule the whole keyframe VALUE must satisfy, beyond the per-component
   * {@link bounds}, as a sentence with no subject, or `null` when the value is
   * sound. Absent when the components are the whole rule, which is every scalar
   * and colour axis.
   *
   * It exists because {@link bounds} is a per-component range and some
   * constraints are not: a rotation's four components are jointly constrained
   * to unit length, and no range over one component can say so. The gate reads
   * it off this table for the same reason it reads everything else here — a
   * rule stated beside the applier cannot drift from what the applier writes.
   */
  valueFault?: (value: readonly unknown[]) => string | null;

  /**
   * Record the sampled value. Precondition: {@link carries} accepted the light,
   * and `value` is as wide as {@link valueType} resolves to — the gate
   * establishes the first, `sampleClip`'s width check the second, before a
   * value ever reaches here.
   */
  write: (override: IAutoMovieLightOverride, value: readonly number[]) => void;
}

/**
 * Every animatable light property, keyed by the pointer's last segment.
 *
 * Total over {@link AutoMovieLightProperty}: adding a member to that union
 * without giving it a `carries`/`write` pair does not compile, which is how a
 * widened contract cannot outrun its applier.
 */
export const LIGHT_CHANNEL_PROPERTIES: Readonly<
  Record<AutoMovieLightProperty, IAutoMovieLightChannelProperty>
> = {
  intensity: {
    valueType: "scalar",
    bounds: { min: 0, max: Infinity, inclusiveMin: true },
    carries: () => true,
    write: (override, value) => {
      override.intensity = value[0]!;
    },
  },
  color: {
    valueType: "vec3",
    bounds: { min: 0, max: 1, inclusiveMin: true },
    carries: () => true,
    write: (override, value) => {
      override.color = {
        r: value[0]!,
        g: value[1]!,
        b: value[2]!,
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
      override.range = value[0]!;
    },
  },
  coneAngle: {
    valueType: "scalar",
    bounds: { min: 0, max: 90, inclusiveMin: false },
    carries: (kind) => kind === "spot",
    write: (override, value) => {
      override.coneAngle = value[0]!;
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
      override.position = { x: value[0]!, y: value[1]!, z: value[2]! };
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
        x: value[0]!,
        y: value[1]!,
        z: value[2]!,
        w: value[3]!,
      };
    },
  },
};

/** A parsed light pointer: which staged light, and which of its properties. */
export interface IAutoMovieLightPointer {
  /** Id of the addressed scene light. */
  light: string;

  /** The animatable property. */
  property: AutoMovieLightProperty;
}

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
export const parseLightPointer = (
  pointer: unknown,
): IAutoMovieLightPointer | null => {
  if (typeof pointer !== "string") return null;
  const segments = pointer.split("/");
  if (segments.length !== 4) return null;
  if (segments[0] !== "" || segments[1] !== "lights") return null;
  const property = segments[3]!;
  if (!isLightProperty(property)) return null;
  const light = unescapePointerSegment(segments[2]!);
  if (light.length === 0) return null;
  if (formatLightPointer(light, property) !== pointer) return null;
  return { light, property };
};

/** The canonical pointer addressing one light's property. */
export const formatLightPointer = (
  light: string,
  property: AutoMovieLightProperty,
): string => `/lights/${escapePointerSegment(light)}/${property}`;

/** Whether a string names an animatable light property. */
export const isLightProperty = (
  property: string,
): property is AutoMovieLightProperty =>
  Object.prototype.hasOwnProperty.call(LIGHT_CHANNEL_PROPERTIES, property);

/** RFC-6901: `~` becomes `~0` and `/` becomes `~1`, in that order. */
const escapePointerSegment = (segment: string): string =>
  segment.replaceAll("~", "~0").replaceAll("/", "~1");

/** RFC-6901: `~1` becomes `/` and `~0` becomes `~`, in that order. */
const unescapePointerSegment = (segment: string): string =>
  segment.replaceAll("~1", "/").replaceAll("~0", "~");

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
export const applyLightOverride = (
  light: IAutoMovieLight,
  override: IAutoMovieLightOverride,
): IAutoMovieLight => {
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
const applyLightTransformOverride = (
  transform: IAutoMovieTransform,
  override: IAutoMovieLightOverride,
): IAutoMovieTransform =>
  override.position === undefined && override.rotation === undefined
    ? transform
    : {
        translation: override.position ?? transform.translation,
        rotation: override.rotation ?? transform.rotation,
        scale: transform.scale,
      };
