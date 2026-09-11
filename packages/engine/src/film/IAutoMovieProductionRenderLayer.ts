/**
 * One source image participating in a film-global output frame.
 *
 * A layer names the compiled shot, the exact shot-local integer frame the edit
 * maps the film frame to, and its compositing weight. The browser film viewer
 * and the headless capture both draw from this record, so one film frame
 * resolves every shot's state at one declared source instant.
 *
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-state-sampling Carries the one exact source frame each drawn shot is resolved at for a film frame.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule Supplies the per-layer source instant a direct seek and a chunked render both read for the same global frame.
 * @author Samchon
 */
export interface IAutoMovieProductionRenderLayer {
  /**
   * Compiler-owned shot id.
   */
  shot: string;
  /**
   * Exact shot-local integer source frame.
   */
  sourceFrame: number;
  /**
   * Linear compositing weight in `[0, 1]`.
   */
  weight: number;
}
