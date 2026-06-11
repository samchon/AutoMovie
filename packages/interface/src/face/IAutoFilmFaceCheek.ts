/**
 * Traits of ONE cheek — signed morph weights in `[-2, 2]`, `0`/omitted meaning
 * unchanged. Lives under {@link IAutoFilmFaceCheekSet.left} / `right`; when it
 * is the only side defined, it applies to BOTH cheeks.
 *
 * @author Samchon
 */
export interface IAutoFilmFaceCheek {
  /**
   * Volume of the cheek around the cheekbone: `+` full and round, `-` gaunt.
   *
   * @default 0
   */
  fullness?: number;
}
