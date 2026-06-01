import { IMoticaColor } from "../color/IMoticaColor";
import { IMoticaTransform } from "../geometry/IMoticaTransform";

/**
 * A scene light. Discriminated on `type` so each light kind carries exactly the
 * parameters it needs and no others — directional light has no position-derived
 * falloff, point/spot do.
 *
 * Maps onto glTF `KHR_lights_punctual` / `three.js` light types.
 *
 * @author Samchon
 */
export type IMoticaLight =
  | IMoticaDirectionalLight
  | IMoticaPointLight
  | IMoticaSpotLight;

/** Fields shared by every light kind. */
export interface IMoticaLightBase {
  /** Stable id. */
  id: string;

  /** World placement. For directional light only the orientation matters. */
  transform: IMoticaTransform;

  /** Light color (linear). */
  color: IMoticaColor;

  /** Radiant intensity (lux for directional, candela for point/spot), `>= 0`. */
  intensity: number;
}

/** Infinitely-distant parallel light (sun). No distance falloff. */
export interface IMoticaDirectionalLight extends IMoticaLightBase {
  /** Discriminator. */
  type: "directional";
}

/** Omni-directional light radiating from a point, with distance falloff. */
export interface IMoticaPointLight extends IMoticaLightBase {
  /** Discriminator. */
  type: "point";

  /** Range in meters beyond which the light contributes nothing. `0` = infinite. */
  range: number;
}

/** Cone-shaped light from a point in a direction. */
export interface IMoticaSpotLight extends IMoticaLightBase {
  /** Discriminator. */
  type: "spot";

  /** Range in meters beyond which the light contributes nothing. `0` = infinite. */
  range: number;

  /** Half-angle of the cone in degrees, `(0, 90]`. */
  coneAngle: number;
}
