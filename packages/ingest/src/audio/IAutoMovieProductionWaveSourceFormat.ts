/**
 * Exact supported WAVE declaration before processing.
 *
 * These are the file's own facts, read from its format envelope and never
 * inferred from its channel count: an extensible header names its speakers
 * through `dwChannelMask` and its encoding through the full SubFormat GUID,
 * while a legacy header carries the default mono front-center or stereo
 * front-left/front-right semantics and says so in `layout.source`.
 *
 * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Records the container, encoding, channel, rate, and bit-depth facts the decode contract requires to be explicit rather than assumed from the extension.
 * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-channel-layout Keeps ordered speaker labels and the declaration they came from, so two-channel sources with different semantics are not treated as compatible by count alone.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Separates the encoded representation, source rate, and channel layout observed in the bytes from any processing result.
 */
export interface IAutoMovieProductionWaveSourceFormat {
  /**
   * Media-family discriminant.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Names the one container family the supported subset admits.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Dispatches the audio fact envelope by family.
   */
  kind: "wave";
  /**
   * Legacy or extensible format-envelope spelling.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Distinguishes the two header spellings whose fields the decoder reads differently.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Records which envelope the channel layout and encoding facts were read from.
   */
  header: "wave-format-ex" | "wave-format-extensible";
  /**
   * Exact supported expanded-sample encoding.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract States the sample encoding the codec facts resolved to.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Reports the encoded sample representation as a source fact.
   */
  encoding: "pcm-s16le" | "float-f32le";
  /**
   * Bits allocated to each encoded channel sample.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Carries the declared bit depth of the container sample.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Distinguishes the container size from the precision the sample carries.
   */
  containerBits: 16 | 32;
  /**
   * Meaningful bits declared inside the container sample.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Carries the extensible `wValidBitsPerSample` precision that the supported subset requires to fill its container.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Records the declared precision beside the container size instead of collapsing them.
   */
  validBits: 16 | 32;
  /**
   * Source sample clock before resampling.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Carries the declared source rate the decode contract requires to be explicit.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Reports the source sample rate as a fact separate from the resampled output clock.
   */
  sampleRate: number;
  /**
   * Source channel count before downmix.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Carries the declared channel count of the supported mono or stereo subset.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Reports the source channel count as a fact separate from the mono downmix.
   */
  channels: 1 | 2;
  /**
   * Ordered speaker semantics and their declaration source.
   *
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-channel-layout Names the ordered speaker positions and whether a mask or the legacy default declared them.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Reports the channel layout as an observed source fact rather than an assumed stereo pair.
   */
  layout: {
    kind: "mono" | "stereo";
    speakers: ["front-center"] | ["front-left", "front-right"];
    source: "legacy-default" | "channel-mask";
    mask: number | null;
  };
  /**
   * Canonical extensible SubFormat GUID, absent for legacy headers.
   *
   * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Preserves the full sub-format identity that resolved the encoding rather than only its leading tag.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Records the codec identity observed in the extensible envelope.
   */
  subFormatGuid: string | null;
}
