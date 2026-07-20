import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";

/**
 * Traits of ONE eyebrow: signed morph weights in `[-2, 2]`, `0`/omitted
 * meaning unchanged. Lives under {@link IAutoMovieFaceBrowSet.left} / `right`;
 * when it is the only side defined, it applies to BOTH brows.
 *
 * @author Samchon
 */
export interface IAutoMovieFaceBrow {
  /**
   * Vertical position of the brow: `+` raises it off the eye (open, surprised),
   * `-` settles it low and heavy.
   */
  height?: AutoMovieFaceWeight;
}
