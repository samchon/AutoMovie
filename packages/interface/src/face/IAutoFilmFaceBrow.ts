import { AutoFilmFaceWeight } from "./AutoFilmFaceWeight";

/**
 * Traits of ONE eyebrow — signed morph weights in `[-2, 2]`, `0`/omitted
 * meaning unchanged. Lives under {@link IAutoFilmFaceBrowSet.left} / `right`;
 * when it is the only side defined, it applies to BOTH brows.
 *
 * @author Samchon
 */
export interface IAutoFilmFaceBrow {
  /**
   * Vertical position of the brow: `+` raises it off the eye (open, surprised),
   * `-` settles it low and heavy.
   */
  height?: AutoFilmFaceWeight;
}
