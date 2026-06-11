/**
 * Traits of ONE eye — signed morph weights in `[-2, 2]`, `0`/omitted meaning
 * unchanged.
 *
 * Lives under {@link IAutoFilmFaceEyeSet.left} / `right`. **Side rule:** when it
 * is the only side defined on the set, these traits apply to BOTH eyes; when
 * both sides are defined, each applies to its own eye only. Sides are the
 * SUBJECT's left/right — her left eye is on the viewer's right. Heterochromia
 * is an iris-color concern, not geometry.
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
   * Outward shift of the eye, away from the nose: `+` toward the temple. Adds
   * to the pair-level {@link IAutoFilmFaceEyeSet.spacing}; use this for one eye,
   * `spacing` for the pair.
   *
   * @default 0
   */
  offset?: number;
}
