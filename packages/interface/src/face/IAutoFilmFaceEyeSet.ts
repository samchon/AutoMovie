import { IAutoFilmFaceEye } from "./IAutoFilmFaceEye";

/**
 * The eye PAIR of an {@link IAutoFilmFace}. Pair-level traits (the relation
 * between the two eyes) live here; traits of an eye itself live in
 * {@link IAutoFilmFaceEye} — `both` as the symmetric base, `left`/`right` adding
 * per-side asymmetry on top (a side's effective weight is `both` plus its
 * override).
 *
 * The Set/single split is deliberate naming: "EyeSet" vs "Eye" cannot be
 * confused by a tool-calling model the way "Eyes" vs "Eye" can.
 *
 * @author Samchon
 */
export interface IAutoFilmFaceEyeSet {
  /**
   * Distance between the eyes: `+` wide-set, `-` close-set.
   *
   * @default 0
   */
  spacing?: number;

  /** Traits applied to BOTH eyes — see {@link IAutoFilmFaceEye}. */
  both?: IAutoFilmFaceEye;

  /** Extra traits on the subject's LEFT eye only, added to `both`. */
  left?: IAutoFilmFaceEye;

  /** Extra traits on the subject's RIGHT eye only, added to `both`. */
  right?: IAutoFilmFaceEye;
}
