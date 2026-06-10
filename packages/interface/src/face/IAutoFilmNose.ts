/**
 * Nose traits of an {@link IAutoFilmFace} — signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's nose unchanged.
 *
 * @author Samchon
 */
export interface IAutoFilmNose {
  /** Vertical length of the nose: `+` longer (the tip drops). */
  length?: number;

  /** Width of the nostrils / alar base: `+` broader. */
  width?: number;

  /** Forward projection of the nose tip: `+` more prominent in profile. */
  projection?: number;
}
