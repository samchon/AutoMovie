import { IAutoFilmColor } from "../color/IAutoFilmColor";
import { IAutoFilmTransform } from "../geometry/IAutoFilmTransform";

/**
 * A scene light. Discriminated on `type` so each light kind carries exactly the
 * parameters it needs and no others — directional light has no position-derived
 * falloff, point/spot do.
 *
 * Maps onto glTF `KHR_lights_punctual` / `three.js` light types.
 *
 * @author Samchon
 */
export type IAutoFilmLight =
  | IAutoFilmDirectionalLight
  | IAutoFilmPointLight
  | IAutoFilmSpotLight;

/** Fields shared by every light kind. */
export interface IAutoFilmLightBase {
  /** Stable id. */
  id: string;

  /** World placement. For directional light only the orientation matters. */
  transform: IAutoFilmTransform;

  /** Light color (linear). */
  color: IAutoFilmColor;

  /** Radiant intensity (lux for directional, candela for point/spot), `>= 0`. */
  intensity: number;
}

/** Infinitely-distant parallel light (sun). No distance falloff. */
export interface IAutoFilmDirectionalLight extends IAutoFilmLightBase {
  /** Discriminator. */
  type: "directional";
}

/** Omni-directional light radiating from a point, with distance falloff. */
export interface IAutoFilmPointLight extends IAutoFilmLightBase {
  /** Discriminator. */
  type: "point";

  /** Range in meters beyond which the light contributes nothing. `0` = infinite. */
  range: number;
}

/** Cone-shaped light from a point in a direction. */
export interface IAutoFilmSpotLight extends IAutoFilmLightBase {
  /** Discriminator. */
  type: "spot";

  /** Range in meters beyond which the light contributes nothing. `0` = infinite. */
  range: number;

  /** Half-angle of the cone in degrees, `(0, 90]`. */
  coneAngle: number;
}
