import { automovieFaceWeight } from "./AutomovieFaceWeight";
import { IautomovieFaceChin } from "./IautomovieFaceChin";

/**
 * Jaw traits of an {@link IautomovieFace} ??signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's jaw unchanged. The chin nests here because
 * it is the front of the same mandible.
 *
 * @author Samchon
 */
export interface IautomovieFaceJaw {
  /**
   * Width of the jaw below the cheekbones: `+` square and strong, `-` a slim
   * V-line.
   */
  width?: automovieFaceWeight;

  /** The chin at the jaw's tip ??see {@link IautomovieFaceChin}. */
  chin?: IautomovieFaceChin;
}
