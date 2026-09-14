import { IAutoMovieProductionRenderLayer } from "./IAutoMovieProductionRenderLayer";

/**
 * One exact film-global frame with transitions already resolved.
 *
 * The frame number, the full-rate timeline frame and the derived time are
 * separate fields because a proxy tier renumbers output frames while still
 * sampling the builder-owned timeline.
 *
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time Binds each output frame number to exactly one global film frame so the mapping has no duplicate, gap or off-by-one.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule Records the frame number, timeline frame and time derived by exact integer relation rather than by an accumulated clock.
 * @author Samchon
 */
export interface IAutoMovieProductionRenderFrame {
  /**
   * Exact zero-based output frame in this render tier.
   */
  globalFrame: number;
  /**
   * Exact frame on the builder-owned full-rate film timeline.
   */
  timelineFrame: number;
  /**
   * Derived film time, never an accumulated clock.
   */
  timeSeconds: number;
  /**
   * One hard-cut/fade layer or two dissolve layers, back to front.
   */
  layers: IAutoMovieProductionRenderLayer[];
}
