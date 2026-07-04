import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";
import { IAutoMovieFaceChin } from "./IAutoMovieFaceChin";

/**
 * Jaw traits of an {@link IAutoMovieFace} — signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's jaw unchanged. The chin nests here because
 * it is the front of the same mandible.
 *
 * @author Samchon
 */
export interface IAutoMovieFaceJaw {
  /**
   * Width of the jaw below the cheekbones: `+` square and strong, `-` a slim
   * V-line.
   */
  width?: AutoMovieFaceWeight;

  /** The chin at the jaw's tip — see {@link IAutoMovieFaceChin}. */
  chin?: IAutoMovieFaceChin;
}
