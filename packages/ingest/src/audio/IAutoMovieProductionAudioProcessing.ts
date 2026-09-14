/**
 * Deterministic conversion from declared WAVE layout/clock to mixer input.
 *
 * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Records the ordered downmix and resample recipe that produced the mixer samples from the source bytes.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Names the exact transform the derived mono buffer carries relative to its parent source.
 * @evidence requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-transformation-record Records the resampling and downmix rules, coefficients and output identity as the transformation record of the derived buffer.
 */
export interface IAutoMovieProductionAudioProcessing {
  /**
   * Exact conversion stages applied in source order.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Names which of channel conversion and resampling ran, in order.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Identifies the transform kind of the derived source.
   */
  kind: "copy" | "downmix" | "resample" | "downmix-resample";
  /**
   * Mixer-facing mono channel count.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure States the channel count the conversion produced.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Records the output layout of the derived source.
   */
  outputChannels: 1;
  /**
   * Mixer-facing sample clock after conversion.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure States the clock the resample stage produced.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Records the output sample rate of the derived source.
   */
  outputSampleRate: number;
  /**
   * Output-by-input downmix coefficients.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Records the exact channel-conversion weights instead of an unstated average.
   * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Makes the downmix transform reproducible from the record alone.
   */
  matrix: readonly (readonly number[])[];
}
