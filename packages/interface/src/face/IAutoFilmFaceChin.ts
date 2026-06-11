import { AutoFilmFaceWeight } from "./AutoFilmFaceWeight";

/**
 * Chin traits of an {@link IAutoFilmFace}'s jaw — signed morph weights in `[-2,
 * 2]`, `0`/omitted meaning the template's chin unchanged.
 *
 * @author Samchon
 */
export interface IAutoFilmFaceChin {
  /** Vertical reach of the chin tip: `+` a longer chin, `-` a short one. */
  length?: AutoFilmFaceWeight;

  /** Forward projection of the chin: `+` protrudes, `-` recedes. */
  protrusion?: AutoFilmFaceWeight;
}
