import type {
  AutoMovieContentDigest,
  IAutoMovieCompiledFilmEffect,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionDesign,
} from "@automovie/interface";

import type { IAutoMovieProductionAudioAssetIdentity } from "./IAutoMovieProductionAudioAssetIdentity";
import type { IAutoMovieProductionRenderChunk } from "./IAutoMovieProductionRenderChunk";
import type { IAutoMovieProductionRenderRuntimeIdentity } from "./IAutoMovieProductionRenderRuntimeIdentity";
import type { IAutoMovieProductionRenderTier } from "./IAutoMovieProductionRenderTier";

/**
 * Persisted plan reopened by every `automovie render` subcommand.
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-product-scope Enumerates every product's expected outputs separately so one product's success never stands in for another's.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Fixes the production revision, edit, range, products, dimensions and runtime profile of one render request as the plan every later phase consumes.
 */
export interface IAutoMovieProductionRenderJobPlan {
  /**
   * Plan schema.
   */
  version: 4;
  /**
   * Exact production namespace that owns every slot and output.
   */
  productionId: string;
  /**
   * Compiler source-input fingerprint used by all captures.
   */
  compileFingerprint: AutoMovieContentDigest;
  /**
   * Digest of the builder-owned film edit.
   */
  editFingerprint: AutoMovieContentDigest;
  /**
   * Homogeneous capture and encoder identity.
   */
  runtimeIdentity: IAutoMovieProductionRenderRuntimeIdentity;
  /**
   * Proxy/final cost policy; both retain the same edit fingerprint.
   */
  tier: IAutoMovieProductionRenderTier;
  /**
   * Compiler-owned full-quality clock and raster before tier sampling.
   */
  sourceFrameFormat: IAutoMovieProductionDesign["frameFormat"];
  /**
   * Exact production raster and frame clock.
   */
  frameFormat: IAutoMovieProductionDesign["frameFormat"];
  /**
   * Exact total film frame count.
   */
  totalFrames: number;
  /**
   * Maximum frames assigned to one independently resumable chunk.
   */
  chunkFrames: number;
  /**
   * Content-addressed video ranges in deterministic order.
   */
  chunks: IAutoMovieProductionRenderChunk[];
  /**
   * Non-video builder tracks used during terminal publication.
   */
  tracks: {
    /** Canonical WebVTT derived from the caption placements. */
    captions: string;
    /** Exact builder-owned audio placements. */
    audio: IAutoMovieFilmTimeline["tracks"]["audio"];
    /** Byte, duration, and format identity for every referenced audio asset. */
    audioAssets: IAutoMovieProductionAudioAssetIdentity[];
    /** Current executable film-global effect runtimes. */
    effects: IAutoMovieCompiledFilmEffect[];
  };
}
