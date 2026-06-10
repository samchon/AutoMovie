import { IAutoFilmLips } from "./IAutoFilmLips";

/**
 * Mouth traits of an {@link IAutoFilmFace} — signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's mouth unchanged.
 *
 * @author Samchon
 */
export interface IAutoFilmMouth {
  /**
   * Width of the mouth: `+` a wider smile line.
   *
   * @default 0
   */
  width?: number;

  /**
   * Vertical position of the whole mouth: `+` higher toward the nose.
   *
   * @default 0
   */
  height?: number;

  /** The lips themselves — see {@link IAutoFilmLips}. */
  lips?: IAutoFilmLips;
}
