/**
 * Traits of ONE eye — signed morph weights in `[-2, 2]`, `0`/omitted meaning
 * unchanged.
 *
 * Where the document uses it decides the scope: under
 * {@link IAutoFilmFaceEyeSet.both} the traits drive BOTH eyes (the symmetric
 * base), under `left`/`right` they ADD to that base on one side only (uneven
 * eyes). Sides are the SUBJECT's left/right — her left eye is on the viewer's
 * right. Heterochromia is an iris-color concern, not geometry.
 *
 * @author Samchon
 */
export interface IAutoFilmFaceEye {
  /**
   * Uniform scale of the eye about its own center: `+` larger.
   *
   * @default 0
   */
  size?: number;

  /**
   * Horizontal-only scale of the eye fissure: widens the opening without
   * lifting the lids — use with `size` to control the aspect ratio.
   *
   * @default 0
   */
  width?: number;

  /**
   * Vertical position of the eye on the face: `+` higher.
   *
   * @default 0
   */
  height?: number;

  /**
   * Outer-corner slant: `+` lifts the outer corner (upturned eye).
   *
   * @default 0
   */
  tilt?: number;

  /**
   * Outward shift of the eye, away from the nose: `+` toward the temple. The
   * pair-level distance lives at {@link IAutoFilmFaceEyeSet.spacing}; this moves
   * one eye only.
   *
   * @default 0
   */
  offset?: number;
}
