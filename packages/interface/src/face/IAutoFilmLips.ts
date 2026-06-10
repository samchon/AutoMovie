/**
 * Lip traits of an {@link IAutoFilmFace}'s mouth — signed morph weights in `[-2,
 * 2]`, `0`/omitted meaning the template's lips unchanged.
 *
 * @author Samchon
 */
export interface IAutoFilmLips {
  /** Vertical thickness of the lips about the lip seam: `+` fuller, `-` thinner. */
  fullness?: number;
}
