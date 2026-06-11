import { IAutoFilmFaceCheek } from "./IAutoFilmFaceCheek";

/**
 * The cheek PAIR of an {@link IAutoFilmFace} — `both` carries the symmetric
 * base, `left`/`right` add per-side asymmetry on top
 * ({@link IAutoFilmFaceCheek}).
 *
 * @author Samchon
 */
export interface IAutoFilmFaceCheekSet {
  /** Traits applied to BOTH cheeks — see {@link IAutoFilmFaceCheek}. */
  both?: IAutoFilmFaceCheek;

  /** Extra traits on the subject's LEFT cheek only, added to `both`. */
  left?: IAutoFilmFaceCheek;

  /** Extra traits on the subject's RIGHT cheek only, added to `both`. */
  right?: IAutoFilmFaceCheek;
}
