import { AutoFilmFaceWeight } from "./AutoFilmFaceWeight";
import { IAutoFilmFaceLips } from "./IAutoFilmFaceLips";

/**
 * Mouth traits of an {@link IAutoFilmFace} — signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's mouth unchanged.
 *
 * @author Samchon
 */
export interface IAutoFilmFaceMouth {
  /** Width of the mouth: `+` a wider smile line. */
  width?: AutoFilmFaceWeight;

  /** Vertical position of the whole mouth: `+` higher toward the nose. */
  height?: AutoFilmFaceWeight;

  /** The lips themselves — see {@link IAutoFilmFaceLips}. */
  lips?: IAutoFilmFaceLips;
}
