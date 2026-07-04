import { automovieFaceWeight } from "./AutomovieFaceWeight";
import { IautomovieFaceLips } from "./IautomovieFaceLips";

/**
 * Mouth traits of an {@link IautomovieFace} ??signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's mouth unchanged.
 *
 * @author Samchon
 */
export interface IautomovieFaceMouth {
  /** Width of the mouth: `+` a wider smile line. */
  width?: automovieFaceWeight;

  /** Vertical position of the whole mouth: `+` higher toward the nose. */
  height?: automovieFaceWeight;

  /** The lips themselves ??see {@link IautomovieFaceLips}. */
  lips?: IautomovieFaceLips;
}
