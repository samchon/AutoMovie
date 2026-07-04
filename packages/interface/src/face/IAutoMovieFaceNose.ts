import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";

/**
 * Nose traits of an {@link IAutoMovieFace} — signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's nose unchanged.
 *
 * @author Samchon
 */
export interface IAutoMovieFaceNose {
  /** Vertical length of the nose: `+` longer (the tip drops). */
  length?: AutoMovieFaceWeight;

  /** Width of the nostrils / alar base: `+` broader. */
  width?: AutoMovieFaceWeight;

  /** Forward projection of the nose tip: `+` more prominent in profile. */
  projection?: AutoMovieFaceWeight;
}
