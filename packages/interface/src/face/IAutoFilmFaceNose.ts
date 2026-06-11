import { AutoFilmFaceWeight } from "./AutoFilmFaceWeight";

/**
 * Nose traits of an {@link IAutoFilmFace} — signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's nose unchanged.
 *
 * @author Samchon
 */
export interface IAutoFilmFaceNose {
  /** Vertical length of the nose: `+` longer (the tip drops). */
  length?: AutoFilmFaceWeight;

  /** Width of the nostrils / alar base: `+` broader. */
  width?: AutoFilmFaceWeight;

  /** Forward projection of the nose tip: `+` more prominent in profile. */
  projection?: AutoFilmFaceWeight;
}
