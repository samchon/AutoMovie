import { automovieFaceWeight } from "./AutomovieFaceWeight";

/**
 * Chin traits of an {@link IautomovieFace}'s jaw ??signed morph weights in `[-2,
 * 2]`, `0`/omitted meaning the template's chin unchanged.
 *
 * @author Samchon
 */
export interface IautomovieFaceChin {
  /** Vertical reach of the chin tip: `+` a longer chin, `-` a short one. */
  length?: automovieFaceWeight;

  /** Forward projection of the chin: `+` protrudes, `-` recedes. */
  protrusion?: automovieFaceWeight;
}
