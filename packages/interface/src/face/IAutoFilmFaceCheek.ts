/**
 * Traits of ONE cheek — signed morph weights in `[-2, 2]`, `0`/omitted meaning
 * unchanged. Under {@link IAutoFilmFaceCheekSet.both} the traits drive BOTH
 * cheeks; under `left`/`right` they ADD to that base on one side. Sides are the
 * subject's left/right.
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
