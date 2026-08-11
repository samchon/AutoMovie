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
 * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-link-resolution Exposes `IAutoMovieLight` as the portable data boundary for the lighting link resolution requirement.
 * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `IAutoMovieLight` for the clv light link resolution system contract.
 * @author Samchon
 */
export type IAutoMovieLight =
  | IAutoMovieDirectionalLight
  | IAutoMoviePointLight
  | IAutoMovieSpotLight
  | IAutoMovieAreaLight;

/**
 * Fields shared by every light kind.
 *
 * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `IAutoMovieLightBase` as the portable data boundary for the lighting linking requirement.
 * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `IAutoMovieLightBase` for the clv light link resolution system contract.
 */
export interface IAutoMovieLightBase {
  /**
   * Stable id.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `id` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `id` for the clv light link resolution system contract.
   */
  id: string;

  /**
   * World placement. For directional light only the orientation matters.
   *
   * Animatable, like every other field here: a shot's `lightMotions` reaches
   * the translation through `/lights/<id>/position` and the rotation through
   * `/lights/<id>/rotation`, so a light may travel and turn over time. `scale`
   * is the one component no channel writes — a punctual light has no extent for
   * a scale to describe.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `transform` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `transform` for the clv light link resolution system contract.
   */
  transform: IAutoMovieTransform;

  /**
   * Light color (linear).
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `color` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `color` for the clv light link resolution system contract.
   */
  color: IAutoMovieColor;

  /**
   * Radiant intensity, `>= 0`: lux for directional, candela for point/spot, and
   * nits (candela per square metre) for an area panel, whose emitted power is
   * therefore its intensity times its own area.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `intensity` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `intensity` for the clv light link resolution system contract.
   */
  intensity: number;

  /**
   * Whether this source casts a shadow map. Omitted preserves legacy output.
   *
   * What this light WOULD cast, not what the frame renders: a scene's
   * `environment.shadows.enabled` is the master switch and turning it off
   * renders no shadow map for any light, which is also how the render budget
   * prices it. A scene declaring no environment leaves the decision to the host
   * renderer, exactly as it did before environments existed.
   *
   * Only the three punctual kinds can cast one. A rectangular area source is
   * analytically integrated rather than rasterized from a light-space camera,
   * so `three.js` renders no shadow map for it and the engine refuses
   * `castShadow` on an {@link IAutoMovieAreaLight} instead of accepting a flag
   * no frame would honor.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `castShadow` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `castShadow` for the clv light link resolution system contract.
   */
  castShadow?: boolean;

  /**
   * Deterministic shadow-camera tuning, required exactly when `castShadow` is
   * true.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `shadow` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `shadow` for the clv light link resolution system contract.
   */
  shadow?: IAutoMovieLightShadow;
}

/**
 * Renderer-independent shadow map controls shared by physical lights.
 *
 * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `IAutoMovieLightShadow` as the portable data boundary for the lighting linking requirement.
 * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `IAutoMovieLightShadow` for the clv light link resolution system contract.
 */
export interface IAutoMovieLightShadow {
  /**
   * Square shadow-map resolution, a positive safe integer.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `mapSize` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `mapSize` for the clv light link resolution system contract.
   */
  mapSize: number;
  /**
   * Depth bias used to suppress surface acne.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `bias` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `bias` for the clv light link resolution system contract.
   */
  bias: number;
  /**
   * Normal-relative depth bias.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `normalBias` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `normalBias` for the clv light link resolution system contract.
   */
  normalBias: number;
  /**
   * Positive shadow-camera near distance.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `near` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `near` for the clv light link resolution system contract.
   */
  near: number;
  /**
   * Shadow-camera far distance, greater than `near`.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `far` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `far` for the clv light link resolution system contract.
   */
  far: number;
}

/**
 * Infinitely-distant parallel light (sun). No distance falloff.
 *
 * @evidence requirements/lighting/sources-and-photometry.md#lighting-distance-falloff Exposes `IAutoMovieDirectionalLight` as the portable data boundary for the lighting distance falloff requirement.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-source-distribution-color Types `IAutoMovieDirectionalLight` for the clv source distribution color system contract.
 */
export interface IAutoMovieDirectionalLight extends IAutoMovieLightBase {
  /**
   * Discriminator.
   *
   * @evidence requirements/lighting/sources-and-photometry.md#lighting-distance-falloff Exposes `type` as the portable data boundary for the lighting distance falloff requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-source-distribution-color Types `type` for the clv source distribution color system contract.
   */
  type: "directional";
}

/**
 * Omni-directional light radiating from a point, with distance falloff.
 *
 * @evidence requirements/lighting/sources-and-photometry.md#lighting-distance-falloff Exposes `IAutoMoviePointLight` as the portable data boundary for the lighting distance falloff requirement.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-source-distribution-color Types `IAutoMoviePointLight` for the clv source distribution color system contract.
 */
export interface IAutoMoviePointLight extends IAutoMovieLightBase {
  /**
   * Discriminator.
   *
   * @evidence requirements/lighting/sources-and-photometry.md#lighting-distance-falloff Exposes `type` as the portable data boundary for the lighting distance falloff requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-source-distribution-color Types `type` for the clv source distribution color system contract.
   */
  type: "point";

  /**
   * Range in meters beyond which the light contributes nothing. `0` = infinite.
   *
   * @evidence requirements/lighting/sources-and-photometry.md#lighting-distance-falloff Exposes `range` as the portable data boundary for the lighting distance falloff requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-source-distribution-color Types `range` for the clv source distribution color system contract.
   */
  range: number;
}

/**
 * Cone-shaped light from a point in a direction.
 *
 * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `IAutoMovieSpotLight` as the portable data boundary for the lighting linking requirement.
 * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `IAutoMovieSpotLight` for the clv light link resolution system contract.
 */
export interface IAutoMovieSpotLight extends IAutoMovieLightBase {
  /**
   * Discriminator.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `type` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `type` for the clv light link resolution system contract.
   */
  type: "spot";

  /**
   * Range in meters beyond which the light contributes nothing. `0` = infinite.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `range` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `range` for the clv light link resolution system contract.
   */
  range: number;

  /**
   * Half-angle of the cone in degrees, `(0, 90]`.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Exposes `coneAngle` as the portable data boundary for the lighting linking requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `coneAngle` for the clv light link resolution system contract.
   */
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
 *
 * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-link-resolution Exposes `IAutoMovieAreaLight` as the portable data boundary for the lighting link resolution requirement.
 * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `IAutoMovieAreaLight` for the clv light link resolution system contract.
 */
export interface IAutoMovieAreaLight extends IAutoMovieLightBase {
  /**
   * Discriminator.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-link-resolution Exposes `type` as the portable data boundary for the lighting link resolution requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `type` for the clv light link resolution system contract.
   */
  type: "area";

  /**
   * Panel width in meters along its local X axis, finite and `> 0`.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-link-resolution Exposes `width` as the portable data boundary for the lighting link resolution requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `width` for the clv light link resolution system contract.
   */
  width: number;

  /**
   * Panel height in meters along its local Y axis, finite and `> 0`.
   *
   * @evidence requirements/lighting/shape-filters-and-linking.md#lighting-link-resolution Exposes `height` as the portable data boundary for the lighting link resolution requirement.
   * @evidence specifications/camera-light-and-visibility/practical-shaping-and-linking.md#clv-light-link-resolution Types `height` for the clv light link resolution system contract.
   */
  height: number;
}
