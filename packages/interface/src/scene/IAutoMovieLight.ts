import { IAutoMovieColor } from "../color/IAutoMovieColor";
import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";

/**
 * A scene light. Discriminated on `type` so each light kind carries exactly the
 * parameters it needs and no others: directional light has no position-derived
 * falloff, point/spot do.
 *
 * Maps onto glTF `KHR_lights_punctual` / `three.js` light types.
 *
 * The fields here are the light's value at rest. A shot changes them over its
 * own clock through `IAutoMovieShot.lightMotions`, whose tracks address
 * `/lights/<id>/intensity` (and `/color`, `/range`, `/coneAngle`) the way glTF
 * animates a punctual light through `KHR_animation_pointer` rather than through
 * the node the light hangs on.
 *
 * @author Samchon
 */
export type IAutoMovieLight =
  | IAutoMovieDirectionalLight
  | IAutoMoviePointLight
  | IAutoMovieSpotLight;

/** Fields shared by every light kind. */
export interface IAutoMovieLightBase {
  /** Stable id. */
  id: string;

  /** World placement. For directional light only the orientation matters. */
  transform: IAutoMovieTransform;

  /** Light color (linear). */
  color: IAutoMovieColor;

  /** Radiant intensity (lux for directional, candela for point/spot), `>= 0`. */
  intensity: number;
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
