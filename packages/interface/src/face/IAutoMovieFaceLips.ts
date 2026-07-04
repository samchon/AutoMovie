import { automovieFaceWeight } from "./AutomovieFaceWeight";

/**
 * Lip traits of an {@link IautomovieFace}'s mouth ??signed morph weights in `[-2,
 * 2]`, `0`/omitted meaning the template's lips unchanged.
 *
 * @author Samchon
 */
export interface IautomovieFaceLips {
  /** Vertical thickness of the lips about the lip seam: `+` fuller, `-` thinner. */
  fullness?: automovieFaceWeight;
}
