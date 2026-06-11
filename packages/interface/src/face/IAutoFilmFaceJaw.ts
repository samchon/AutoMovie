import { AutoFilmFaceWeight } from "./AutoFilmFaceWeight";
import { IAutoFilmFaceChin } from "./IAutoFilmFaceChin";

/**
 * Jaw traits of an {@link IAutoFilmFace} — signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's jaw unchanged. The chin nests here because
 * it is the front of the same mandible.
 *
 * @author Samchon
 */
export interface IAutoFilmFaceJaw {
  /**
   * Width of the jaw below the cheekbones: `+` square and strong, `-` a slim
   * V-line.
   */
  width?: AutoFilmFaceWeight;

  /** The chin at the jaw's tip — see {@link IAutoFilmFaceChin}. */
  chin?: IAutoFilmFaceChin;
}
