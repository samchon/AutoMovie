/**
 * Cheek traits of an {@link IAutoFilmFace} — signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's cheeks unchanged.
 *
 * @author Samchon
 */
export interface IAutoFilmFaceCheeks {
  /**
   * Cheek volume around the cheekbones: `+` full and round, `-` gaunt.
   *
   * @default 0
   */
  fullness?: number;
}
