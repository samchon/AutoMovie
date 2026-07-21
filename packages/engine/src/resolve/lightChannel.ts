import {
  AutoMovieChannelValueType,
  IAutoMovieColor,
  IAutoMovieLight,
} from "@automovie/interface";

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
  | "coneAngle";

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
}

/** One animatable light property: how it is addressed, and how it is applied. */
export interface IAutoMovieLightChannelProperty {
  /**
   * The value type the addressing pointer channel must declare. Pinning it is
   * what makes `sampleClip`'s own width rule (derived from the value type)
   * agree with {@link width} instead of being a second opinion.
   */
  valueType: AutoMovieChannelValueType;

  /** Numbers per keyframe, the width {@link write} consumes. */
  width: number;

  /**
   * Whether a light of this kind (`IAutoMovieLight["type"]`) carries the
   * property at all: `range` is meaningless on a directional (infinitely
   * distant) light and `coneAngle` exists only on a spot. The gate asks this
   * before admitting a track, so a track the applier could not honor is refused
   * at commit rather than dropped at playback.
   *
   * The parameter is `unknown` so the gate can ask it of a staged light's raw
   * `type` without first asserting the union it is reading — asserting the
   * value a check is about to doubt is how a validator stops validating. A kind
   * outside the union is a broken scene the scene gate owns, not something this
   * predicate is deciding.
   */
  carries: (kind: unknown) => boolean;

  /**
   * Record the sampled value. Precondition: {@link carries} accepted the light
   * and `value` is {@link width} long, both established by the gate and by
   * `sampleClip`'s width check before a value ever reaches here.
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
    width: 1,
    carries: () => true,
    write: (override, value) => {
      override.intensity = value[0]!;
    },
  },
  color: {
    valueType: "vec3",
    width: 3,
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
    width: 1,
    carries: (kind) => kind !== "directional",
    write: (override, value) => {
      override.range = value[0]!;
    },
  },
  coneAngle: {
    valueType: "scalar",
    width: 1,
    carries: (kind) => kind === "spot",
    write: (override, value) => {
      override.coneAngle = value[0]!;
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
 */
export const applyLightOverride = (
  light: IAutoMovieLight,
  override: IAutoMovieLightOverride,
): IAutoMovieLight => {
  const base = {
    id: light.id,
    transform: light.transform,
    color: override.color ?? light.color,
    intensity: override.intensity ?? light.intensity,
  };
  switch (light.type) {
    case "directional":
      return { ...base, type: "directional" };
    case "point":
      return { ...base, type: "point", range: override.range ?? light.range };
    default:
      return {
        ...base,
        type: "spot",
        range: override.range ?? light.range,
        coneAngle: override.coneAngle ?? light.coneAngle,
      };
  }
};
