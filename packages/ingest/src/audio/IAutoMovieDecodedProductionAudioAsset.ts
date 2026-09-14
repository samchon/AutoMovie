import type { IAutoMovieProductionAudioProcessing } from "./IAutoMovieProductionAudioProcessing";
import type { IAutoMovieProductionWaveSourceFormat } from "./IAutoMovieProductionWaveSourceFormat";

/**
 * One WAVE source's declared facts and the exact processing applied to it.
 *
 * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Returns the declared source facts beside the decoded samples so a plan records the file's identity rather than the mix's.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decoder-input-contract Keeps the observed source facts and the bounded decoded buffer as separate outputs of one decode.
 */
export interface IAutoMovieDecodedProductionAudioAsset {
  /**
   * Source sample clock before resampling.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Reports the rate the file declares, not the plan's.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decoder-input-contract Carries the source clock apart from the decoded buffer's clock.
   */
  sourceSampleRate: number;
  /**
   * Source channel count before downmix.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Reports the channel count the file declares.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decoder-input-contract Carries the source layout count apart from the mono output.
   */
  sourceChannels: number;
  /**
   * Complete source sample-frame count.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Reports the exact duration fact the plan verifies a cue's declared source duration against.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decoder-input-contract Carries the whole-asset frame count as an observed source fact.
   */
  sourceFrames: number;
  /**
   * Exact source runtime derived from frames and sample rate.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Derives the runtime from the two declared facts rather than from a metadata field.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decoder-input-contract Reports the exact duration of the source bytes.
   */
  durationSeconds: number;
  /**
   * Parsed immutable source-format facts.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Carries the complete format declaration the decode admitted.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decoder-input-contract Keeps the observed source facts as one typed value.
   */
  sourceFormat: IAutoMovieProductionWaveSourceFormat;
  /**
   * Deterministic processing lineage applied to the source.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Records the recipe that turned the source into the mixer buffer.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Carries the derived source's exact transform beside its parent facts.
   */
  processing: IAutoMovieProductionAudioProcessing;
  /**
   * Finite mono samples at the requested output clock.
   *
   * @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-structure-semantics Holds only samples whose finiteness was checked before any conversion.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decoder-input-contract Carries the bounded decoded buffer separately from the source facts.
   */
  samples: Float32Array;
}
