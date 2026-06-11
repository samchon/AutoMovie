/**
 * Nose traits of an {@link IAutoFilmFace} — signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's nose unchanged.
 *
 * @author Samchon
 */
export interface IAutoFilmFaceNose {
  /**
   * Vertical length of the nose: `+` longer (the tip drops).
   *
   * @default 0
   */
  length?: number;

  /**
   * Width of the nostrils / alar base: `+` broader.
   *
   * @default 0
   */
  width?: number;

  /**
   * Forward projection of the nose tip: `+` more prominent in profile.
   *
   * @default 0
   */
  projection?: number;
}
