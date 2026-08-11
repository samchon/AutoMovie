import {
  AutoMovieChannelValueType,
  IAutoMovieColor,
  IAutoMovieLight,
  IAutoMovieQuaternion,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * Every runtime light discriminator, shared by every ingress gate.
 *
 * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Enumerates the light kinds that may enter deterministic authored lighting state.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Keeps runtime light-kind admission aligned with the authored-source branches.
 */
export const AUTO_MOVIE_LIGHT_TYPES = new Set<IAutoMovieLight["type"]>([
  "directional",
  "point",
  "spot",
  "area",
]);

/**
 * Whether an untyped artifact names one of the supported light kinds.
 *
 * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Refuses an unrecognized kind before treating raw input as an authored light.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Validates that an input belongs to one declared light-authority branch.
 */
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

/**
 * A light property a shot's `lightMotions` may animate.
 *
 * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Defines the explicit light values an authored shot may vary over time.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Bounds animation to properties owned by the staged authored light branch.
 */
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
 *
 * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Carries only the explicit authored light-channel values sampled at an instant.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Represents a partial update without replacing the staged light's authority branch.
 * @author Samchon
 */
export interface IAutoMovieLightOverride {
  /**
   * Radiant intensity, when an `intensity` track wrote one.
   *
   * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Carries the sampled authored intensity instead of deriving brightness from appearance.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Applies intensity only when its authored channel owns the value.
   */
  intensity?: number;

  /**
   * Linear colour, when a `color` track wrote one.
   *
   * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Carries the sampled authored linear colour of the light source.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Applies colour within the selected authored light branch.
   */
  color?: IAutoMovieColor;

  /**
   * Falloff range in metres, when a `range` track wrote one.
   *
   * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Carries the sampled range only for authored light kinds that own falloff distance.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Preserves kind-specific range authority in the partial light update.
   */
  range?: number;

  /**
   * Cone half-angle in degrees, when a `coneAngle` track wrote one.
   *
   * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Carries the explicit spot cone angle sampled from its authored channel.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Keeps cone authority confined to the spot-light branch.
   */
  coneAngle?: number;

  /**
   * World translation in metres, when a `position` track wrote one.
   *
   * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Carries the sampled authored placement of a movable light.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Applies position only to light kinds whose authority includes a location.
   */
  position?: IAutoMovieVector3;

  /**
   * World orientation, when a `rotation` track wrote one.
   *
   * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Carries the sampled authored orientation of a directional light source.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Applies rotation only to branches whose illumination has a direction.
   */
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

/**
 * One animatable light property: how it is addressed, and how it is applied.
 *
 * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Binds one authored light property to its explicit channel rule.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Defines one branch-aware light-property contract.
 * @author Samchon
 */
export interface IAutoMovieLightChannelProperty {
  /**
   * The value type the addressing pointer channel must declare, which is also
   * the only place this axis states a value's WIDTH. `sampleClip` already owns
   * the value-type → width mapping and refuses a track that disagrees with it,
   * so restating "vec3 is three numbers" here would be a second copy of a rule
   * that already has an owner, and the two could drift.
   *
   * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input States the typed value shape required from this authored light channel.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Keeps the channel's value representation consistent across admitted light branches.
   */
  valueType: AutoMovieChannelValueType;

  /**
   * The bounds every component of a keyframe value must satisfy: the SAME ones
   * the staged light is held to by the scene gate. Without them a track could
   * state through time what `commitScene` refuses outright (a negative
   * intensity, a 200-degree cone), and the axis would be the one place in the
   * artifact where a documented range is not enforced.
   *
   * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Enforces the numeric domain of an authored light property before playback.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Supplies the numeric domain used to admit sampled writes.
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
   *
   * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Tests whether the staged light kind actually owns the authored property.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Prevents a property from crossing into a light-authority branch that does not carry it.
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
   *
   * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Validates whole-value constraints that component bounds cannot express.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Keeps branch-specific authored values valid before they are written.
   */
  valueFault?: (value: readonly unknown[]) => string | null;

  /**
   * Record the sampled value. Precondition: {@link carries} accepted the light,
   * and `value` is as wide as {@link valueType} resolves to — the gate
   * establishes the first, `sampleClip`'s width check the second, before a
   * value ever reaches here.
   *
   * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Applies the sampled authored value to its matching light property only.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Implements the property write owned by the accepted light branch.
   */
  write: (override: IAutoMovieLightOverride, value: readonly number[]) => void;
}

/**
 * Every animatable light property, keyed by the pointer's last segment.
 *
 * Total over {@link AutoMovieLightProperty}: adding a member to that union
 * without giving it a `carries`/`write` pair does not compile, which is how a
 * widened contract cannot outrun its applier.
 *
 * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Registers each animatable light property in the exhaustive channel table.
 * @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-color-refusal Declares finite scene-linear color channel components valid only inside the inclusive unit interval consumed by the artifact gate.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Makes property support exhaustive across the declared light branches.
 * @evidence specifications/camera-light-and-visibility/light-transport-color-and-budget.md#clv-color-comparison-refusal Supplies the explicit scene-linear color domain that rejects non-finite and out-of-range animated source values before application.
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
    // The two punctual kinds that fall off with distance, named positively.
    // "Not directional" used to say the same thing and stopped being true when
    // the area panel arrived: its falloff follows from its own area, so a
    // `range` track on one would state a second, contradictory falloff.
    carries: (kind) => kind === "point" || kind === "spot",
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

/**
 * A parsed light pointer: which staged light, and which of its properties.
 *
 * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Identifies the authored property address for one staged light.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Carries the stable target identity needed to select the correct light branch.
 * @author Samchon
 */
export interface IAutoMovieLightPointer {
  /**
   * Id of the addressed scene light.
   *
   * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Addresses an authored light by stable identity rather than array position.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Selects the staged source whose authority branch receives the channel.
   */
  light: string;

  /**
   * The animatable property.
   *
   * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Names the explicit authored light axis targeted by the pointer.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Selects the property contract within the addressed light branch.
   */
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
 *
 * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Parses one canonical authored-light property address.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Rejects a pointer that cannot select a declared light-property branch.
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

/**
 * The canonical pointer addressing one light's property.
 *
 * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Encodes one authored light-property address by stable light identity.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Produces the canonical address shared by authored light-channel branches.
 */
export const formatLightPointer = (
  light: string,
  property: AutoMovieLightProperty,
): string => `/lights/${escapePointerSegment(light)}/${property}`;

/**
 * Whether a string names an animatable light property.
 *
 * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Restricts authored animation to the registered light-property surface.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Confirms that a property has an explicit branch-aware application contract.
 */
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
 *
 * @evidence requirements/lighting/scope-and-identity.md#lighting-authored-input Applies sampled properties without changing the staged light kind.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-light-authority-branches Rebuilds each light through its own exhaustive authority branch.
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
    // Shadow casting is a staged renderer policy with no channel, so it is
    // carried rather than rebuilt. Spreading only the animated fields would let
    // dimming a lamp silently stop it casting, and each optional key is kept
    // ABSENT when the staged light omitted it so a folded light and an
    // untouched one serialize to the same bytes.
    ...(light.castShadow === undefined ? {} : { castShadow: light.castShadow }),
    ...(light.shadow === undefined ? {} : { shadow: light.shadow }),
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
    case "area":
      // A panel's extent is staged geometry, not a timeline axis: `width` and
      // `height` carry no channel entry, so no override can reach them and both
      // are carried through from the staged light.
      return {
        ...base,
        type: "area",
        width: light.width,
        height: light.height,
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
