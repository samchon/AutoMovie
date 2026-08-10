import { IAutoMovieColor } from "../color/IAutoMovieColor";
import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";

/**
 * A scene light. Discriminated on `type` so each light kind carries exactly the
 * parameters it needs and no others: directional light has no position-derived
 * falloff, point/spot do.
 *
 * Maps onto glTF `KHR_lights_punctual` / `three.js` light types.
 *
 * These are the light's values at REST; a shot changes them over its own clock
 * through `IAutoMovieShot.lightMotions`, and a production changes them over the
 * whole story clock through {@link IAutoMovieProductionLighting}.
 *
 * @author Samchon
 */
export type IAutoMovieLight =
  | IAutoMovieDirectionalLight
  | IAutoMoviePointLight
  | IAutoMovieSpotLight
  | IAutoMovieAreaLight;

/** Fields shared by every light kind. */
export interface IAutoMovieLightBase {
  /** Stable id. */
  id: string;

  /**
   * World placement. For directional light only the orientation matters.
   *
   * Animatable, like every other field here: a shot's `lightMotions` reaches
   * the translation through `/lights/<id>/position` and the rotation through
   * `/lights/<id>/rotation`, so a light may travel and turn over time. `scale`
   * is the one component no channel writes — a punctual light has no extent for
   * a scale to describe.
   */
  transform: IAutoMovieTransform;

  /** Light color (linear). */
  color: IAutoMovieColor;

  /**
   * Radiant intensity, `>= 0`: lux for directional, candela for point/spot, and
   * nits (candela per square metre) for an area panel, whose emitted power is
   * therefore its intensity times its own area.
   */
  intensity: number;

  /**
   * Whether this source casts a shadow map. Omitted preserves legacy output.
   *
   * Only the three punctual kinds can cast one. A rectangular area source is
   * analytically integrated rather than rasterized from a light-space camera,
   * so `three.js` renders no shadow map for it and the engine refuses
   * `castShadow` on an {@link IAutoMovieAreaLight} instead of accepting a flag
   * no frame would honor.
   */
  castShadow?: boolean;

  /**
   * Deterministic shadow-camera tuning, required exactly when `castShadow` is
   * true.
   */
  shadow?: IAutoMovieLightShadow;
}

/** Renderer-independent shadow map controls shared by physical lights. */
export interface IAutoMovieLightShadow {
  /** Square shadow-map resolution, a positive safe integer. */
  mapSize: number;
  /** Depth bias used to suppress surface acne. */
  bias: number;
  /** Normal-relative depth bias. */
  normalBias: number;
  /** Positive shadow-camera near distance. */
  near: number;
  /** Shadow-camera far distance, greater than `near`. */
  far: number;
}

/** Infinitely-distant parallel light (sun). No distance falloff. */
export interface IAutoMovieDirectionalLight extends IAutoMovieLightBase {
  /** Discriminator. */
  type: "directional";
}

/** Omni-directional light radiating from a point, with distance falloff. */
export interface IAutoMoviePointLight extends IAutoMovieLightBase {
  /** Discriminator. */
  type: "point";

  /** Range in meters beyond which the light contributes nothing. `0` = infinite. */
  range: number;
}

/** Cone-shaped light from a point in a direction. */
export interface IAutoMovieSpotLight extends IAutoMovieLightBase {
  /** Discriminator. */
  type: "spot";

  /** Range in meters beyond which the light contributes nothing. `0` = infinite. */
  range: number;

  /** Half-angle of the cone in degrees, `(0, 90]`. */
  coneAngle: number;
}

/**
 * A rectangular emissive panel: a softbox, a window, a light strip, a luminous
 * ceiling coffer.
 *
 * The one light kind with EXTENT. A punctual source has a position and no size,
 * so its terminator is hard however far away it stands; a built interior is
 * mostly lit by surfaces, and the soft wrap those surfaces give is a function
 * of the panel's width and height, not of an intensity an author could tune to
 * imitate it.
 *
 * The panel occupies its transform's local XY plane and emits from the face its
 * local −Z points at, which is the same convention every aimed light here uses,
 * so one `direction` reads identically on a spot and on a window. It has no
 * distance falloff parameter: the inverse-square term follows from the panel's
 * own area, so a `range` would be a second, contradictory falloff.
 *
 * Maps onto `three.js` `RectAreaLight`, which lights only physically-based
 * materials and casts no shadow map (see
 * {@link IAutoMovieLightBase.castShadow}). It has no glTF `KHR_lights_punctual`
 * counterpart, which is exactly why it is modeled here rather than borrowed.
 */
export interface IAutoMovieAreaLight extends IAutoMovieLightBase {
  /** Discriminator. */
  type: "area";

  /** Panel width in meters along its local X axis, finite and `> 0`. */
  width: number;

  /** Panel height in meters along its local Y axis, finite and `> 0`. */
  height: number;
}
