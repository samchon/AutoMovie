/**
 * Explicit cost/quality tier sharing one builder-owned edit.
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-derivatives Binds the proxy tier to the master frame identity and range it derives from so a derivative never stands in for master verification.
 */
export interface IAutoMovieProductionRenderTier {
  /**
   * Stable tier identity used in slots, chunks, and publication paths.
   */
  kind: "proxy" | "final";
  /**
   * Output raster multiplier in `(0, 1]`; final is exactly one.
   */
  resolutionScale: number;
  /**
   * Keep every Nth source frame; final is exactly one.
   */
  frameStep: number;
}
