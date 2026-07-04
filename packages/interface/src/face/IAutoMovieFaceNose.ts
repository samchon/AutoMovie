import { automovieFaceWeight } from "./AutomovieFaceWeight";

/**
 * Nose traits of an {@link IautomovieFace} ??signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's nose unchanged.
 *
 * @author Samchon
 */
export interface IautomovieFaceNose {
  /** Vertical length of the nose: `+` longer (the tip drops). */
  length?: automovieFaceWeight;

  /** Width of the nostrils / alar base: `+` broader. */
  width?: automovieFaceWeight;

  /** Forward projection of the nose tip: `+` more prominent in profile. */
  projection?: automovieFaceWeight;
}
