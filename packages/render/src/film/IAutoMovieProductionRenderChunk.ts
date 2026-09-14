import type { IAutoMovieProductionRenderFrame } from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
} from "@automovie/interface";

/**
 * One deterministic, independently lockable render/encode range.
 *
 * This is not `IAutoMovieRenderChunk`, and the two are not consolidation
 * candidates. That one partitions a sequence render into ordinal ranges for
 * reassembly and carries `index`, `frameEnd`, `frameCount` and
 * `startSeconds`. This one is a content-addressed unit of production work: its
 * `id` is a digest over the edit, pass, range, raster and runtime, its `slot`
 * survives an id change so an old output can be recognized as stale, and it
 * names the `deliverable` and `pass` that own it. A range that reassembles and
 * a range that is independently lockable, resumable and verifiable against a
 * receipt are different contracts that happen to share two field names.
 *
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-multipart-channels Plans beauty and each structural pass as separate chunk products with their own identity, receipt and encoded file, so one pass's failure never hides inside another pass's output.
 */
export interface IAutoMovieProductionRenderChunk {
  /**
   * Stable operational slot before content identity changes.
   */
  slot: string;
  /**
   * Content id over edit, pass, frame range, raster, and runtime.
   */
  id: AutoMovieContentDigest;
  /**
   * Production deliverable id that owns the completed range.
   */
  deliverable: string;
  /**
   * Final moving-image deliverable class that owns this video-only chunk.
   */
  kind: "feature" | "guide-pass";
  /**
   * Beauty or the one structural pass declared for this range.
   */
  pass: AutoMovieGuidePass;
  /**
   * Inclusive zero-based film frame.
   */
  frameStart: number;
  /**
   * Exclusive film-frame boundary.
   */
  frameEndExclusive: number;
  /**
   * Exact edit mapping for every frame in the range.
   */
  frames: IAutoMovieProductionRenderFrame[];
}
