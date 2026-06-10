/**
 * Eyebrow traits of an {@link IAutoFilmFace} — signed morph weights in `[-2,
 * 2]`, `0`/omitted meaning the template's brows unchanged.
 *
 * @author Samchon
 */
export interface IAutoFilmBrows {
  /**
   * Vertical position of the brows: `+` raises them off the eyes (an open,
   * surprised look), `-` settles them low and heavy.
   *
   * @default 0
   */
  height?: number;
}
