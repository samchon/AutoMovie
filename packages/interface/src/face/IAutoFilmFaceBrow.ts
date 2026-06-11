/**
 * Traits of ONE eyebrow — signed morph weights in `[-2, 2]`, `0`/omitted
 * meaning unchanged. Under {@link IAutoFilmFaceBrowSet.both} the traits drive
 * BOTH brows; under `left`/`right` they ADD to that base on one side (a raised
 * single brow). Sides are the subject's left/right.
 *
 * @author Samchon
 */
export interface IAutoFilmFaceBrow {
  /**
   * Vertical position of the brow: `+` raises it off the eye (open, surprised),
   * `-` settles it low and heavy.
   *
   * @default 0
   */
  height?: number;
}
