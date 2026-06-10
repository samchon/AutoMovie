/**
 * Eye-region traits of an {@link IAutoFilmFace} — every field a signed morph
 * weight in `[-2, 2]`, `0`/omitted meaning the template's eyes unchanged.
 *
 * Both eyes always move together (the document describes a face, not a wink);
 * per-eye asymmetry is an identity concern baked into the template.
 *
 * @author Samchon
 */
export interface IAutoFilmEyes {
  /**
   * Uniform scale of each eye about its own center: `+` larger eyes.
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
   * Distance between the eyes: `+` wide-set, `-` close-set.
   *
   * @default 0
   */
  spacing?: number;

  /**
   * Vertical position of the eyes on the face: `+` higher.
   *
   * @default 0
   */
  height?: number;

  /**
   * Outer-corner slant: `+` lifts the outer corners (upturned eyes).
   *
   * @default 0
   */
  tilt?: number;
}
