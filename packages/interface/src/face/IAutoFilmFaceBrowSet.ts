import { IAutoFilmFaceBrow } from "./IAutoFilmFaceBrow";

/**
 * The eyebrow PAIR of an {@link IAutoFilmFace} — `both` carries the symmetric
 * base, `left`/`right` add per-side asymmetry on top
 * ({@link IAutoFilmFaceBrow}).
 *
 * @author Samchon
 */
export interface IAutoFilmFaceBrowSet {
  /** Traits applied to BOTH brows — see {@link IAutoFilmFaceBrow}. */
  both?: IAutoFilmFaceBrow;

  /** Extra traits on the subject's LEFT brow only, added to `both`. */
  left?: IAutoFilmFaceBrow;

  /** Extra traits on the subject's RIGHT brow only, added to `both`. */
  right?: IAutoFilmFaceBrow;
}
