import type { AutoMovieContentDigest } from "@automovie/interface";

/**
 * Byte, clock and channel facts every planned audio asset carries.
 *
 * Split from the discriminated identity so the placeholder and WAVE arms share
 * one description of the fields that do not depend on provenance.
 */
/**
 * Parser/preflight identity for one builder-declared audio source asset.
 */
export interface IAutoMovieProductionAudioAssetIdentityBase {
  /**
   * Project-relative builder-declared asset path.
   */
  path: string;
  /**
   * Digest of the exact current asset bytes.
   */
  digest: AutoMovieContentDigest;
  /**
   * Exact complete source runtime derived from `sourceFrames / sampleRate`.
   */
  durationSeconds: number;
  /**
   * Exact number of source sample frames represented by the asset.
   */
  sourceFrames: number;
  /**
   * Declared PCM clock used by the deterministic adapter.
   */
  sampleRate: number;
  /**
   * Declared channel count used by the deterministic adapter.
   */
  channels: number;
}
