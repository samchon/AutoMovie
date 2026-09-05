/** Current deterministic source subset accepted by the production decoder. */
const SUPPORTED_AUDIO =
  'Supported audio assets are RIFF/WAVE ("*.wav") containers carrying 16-bit PCM or 32-bit IEEE float samples, mono front-center or stereo front-left/front-right.';

const WAVE_FORMAT_PCM = 0x0001;
const WAVE_FORMAT_FLOAT = 0x0003;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;
const MONO_MASK = 0x0000_0004;
const STEREO_MASK = 0x0000_0003;
const SUBFORMAT_TAIL = Uint8Array.from([
  0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b,
  0x71,
]);

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

/**
 * Decode one complete supported RIFF/WAVE generation into finite mono PCM.
 *
 * The parser walks the RIFF chunks by id, requires the declared RIFF extent,
 * `nBlockAlign`, and `nAvgBytesPerSec` to agree with the format fields, and
 * refuses a duplicate `fmt ` or `data` chunk, an odd chunk without its pad
 * byte, and terminal bytes too short for a chunk header. An extensible header
 * follows the Microsoft WAVEFORMATEXTENSIBLE contract
 * (https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatextensible):
 * "The cbSize member must be at least 22", `wValidBitsPerSample` "can be any
 * value not exceeding the container size", "the channels specified in
 * dwChannelMask must be present in the prescribed order (from least
 * significant bit up)" with SPEAKER_FRONT_LEFT `0x1`, SPEAKER_FRONT_RIGHT
 * `0x2`, and SPEAKER_FRONT_CENTER `0x4`, and "the number of bits set in
 * dwChannelMask should be the same as the number of channels". The SubFormat
 * is admitted only when every byte after its leading 16-bit tag equals the
 * `xxxxxxxx-0000-0010-8000-00aa00389b71` template that Ksmedia.h's
 * `IS_VALID_WAVEFORMATEX_GUID` compares
 * (https://learn.microsoft.com/en-us/windows-hardware/drivers/audio/converting-between-format-tags-and-subformat-guids),
 * so a vendor GUID whose low word happens to read as PCM is not decoded as
 * PCM.
 *
 * The supported subset is deliberately narrow: 16-bit PCM in a 16-bit
 * container, 32-bit IEEE float in a 32-bit container, mono front-center, and
 * stereo front-left/front-right. A legal declaration outside it, such as 20
 * valid bits in a 24-bit container or a front-left/front-center pair, is
 * refused as unsupported by field rather than misread as the nearest
 * supported layout. Every decoded sample is checked finite before the mono
 * fold and before any resampling, so a NaN or infinity in one channel refuses
 * the whole asset at its frame and channel instead of averaging into a
 * plausible number.
 *
 * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Admits only the declared container, encoding, channel, rate, and bit-depth subset and refuses everything else by the field that failed.
 * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-audio Reads the speaker layout from the declared mask or the legacy default rather than assuming an unknown two-channel source is stereo.
 * @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-structure-semantics Checks every decoded sample for finiteness before it can reach the downmix or the resampler.
 * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Returns the exact downmix matrix and resample stages beside the source facts they were derived from.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decoder-input-contract Refuses unsupported or malformed input with the asset identity instead of substituting silence.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-decode-and-derived-source-closure Produces the derived mono buffer together with the transform that made it.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Reports representation, rate, layout, and frame count as source facts and downmix and resample as separate processing.
 * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-downmix Records the exact downmix matrix and resample stages it applied to a source instead of an unstated average, and never duplicates a missing channel.
 * @evidence requirements/sound/sources-and-external-assets.md#sound-source-provider-adapter-boundary Decodes adopted local bytes into provider-neutral source facts so playback and verification never need the provider again.
 */
export const decodeProductionAudioAsset = (props: {
  path: string;
  bytes: Uint8Array;
  sampleRate: number;
}): IAutoMovieDecodedProductionAudioAsset => {
  if (Number.isSafeInteger(props.sampleRate) === false || props.sampleRate <= 0)
    fail(
      props.path,
      "decode-rate",
      `cannot be decoded at ${props.sampleRate} Hz: a decode target rate is a positive whole number of samples per second.`,
    );
  const bytes = props.bytes;
  if (bytes.byteLength < 12)
    fail(
      props.path,
      "riff-header",
      `is ${bytes.byteLength} bytes, too short to carry a RIFF/WAVE header. ${SUPPORTED_AUDIO}`,
    );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = asciiTag(bytes, 0);
  const form = asciiTag(bytes, 8);
  if (riff !== "RIFF" || form !== "WAVE")
    fail(
      props.path,
      "riff-form",
      `is not a RIFF/WAVE container: it begins "${riff}" (${leadingHex(bytes)}) and declares form "${form}". ${SUPPORTED_AUDIO}`,
    );
  const declaredRiffBytes = view.getUint32(4, true) + 8;
  if (declaredRiffBytes !== bytes.byteLength)
    fail(
      props.path,
      "riff-size",
      `declares a RIFF extent of ${declaredRiffBytes} bytes but contains ${bytes.byteLength} bytes.`,
    );

  let cursor = 12;
  let format: { offset: number; size: number } | null = null;
  let data: { offset: number; size: number } | null = null;
  while (cursor < bytes.byteLength) {
    if (cursor + 8 > bytes.byteLength)
      fail(
        props.path,
        "chunk-header",
        `has ${bytes.byteLength - cursor} terminal RIFF bytes that cannot carry a chunk header.`,
      );
    const id = asciiTag(bytes, cursor);
    const size = view.getUint32(cursor + 4, true);
    const body = cursor + 8;
    const paddedEnd = body + size + (size % 2);
    if (body + size > bytes.byteLength || paddedEnd > bytes.byteLength)
      fail(
        props.path,
        "chunk-extent",
        `is a truncated RIFF/WAVE container: its "${id}" chunk declares ${size} bytes but only ${bytes.byteLength - body} remain.`,
      );
    if (id === "fmt ") {
      if (format !== null)
        fail(
          props.path,
          "duplicate-fmt",
          'has more than one RIFF/WAVE "fmt " chunk.',
        );
      format = { offset: body, size };
    } else if (id === "data") {
      if (data !== null)
        fail(
          props.path,
          "duplicate-data",
          'has more than one RIFF/WAVE "data" chunk.',
        );
      data = { offset: body, size };
    }
    cursor = paddedEnd;
  }
  if (format === null)
    fail(
      props.path,
      "missing-fmt",
      `has no RIFF/WAVE "fmt " chunk. ${SUPPORTED_AUDIO}`,
    );
  const formatChunk = format!;
  if (formatChunk.size < 16)
    fail(
      props.path,
      "fmt-size",
      `has a "fmt " chunk of ${formatChunk.size} bytes; a WAVE format chunk is at least 16 bytes.`,
    );

  const declaredTag = view.getUint16(formatChunk.offset, true);
  const channels = view.getUint16(formatChunk.offset + 2, true);
  const sourceSampleRate = view.getUint32(formatChunk.offset + 4, true);
  const averageBytesPerSecond = view.getUint32(formatChunk.offset + 8, true);
  const blockAlign = view.getUint16(formatChunk.offset + 12, true);
  const containerBits = view.getUint16(formatChunk.offset + 14, true);
  const extensible = declaredTag === WAVE_FORMAT_EXTENSIBLE;
  let sampleTag = declaredTag;
  let validBits = containerBits;
  let channelMask: number | null = null;
  let subFormatGuid: string | null = null;
  if (extensible) {
    if (formatChunk.size < 18)
      fail(
        props.path,
        "extensible.cbSize",
        `declares an extensible WAVE format in a "fmt " chunk of ${formatChunk.size} bytes, which cannot carry cbSize.`,
      );
    const extensionBytes = view.getUint16(formatChunk.offset + 16, true);
    if (extensionBytes < 22)
      fail(
        props.path,
        "extensible.cbSize",
        `declares extensible cbSize ${extensionBytes}; at least 22 bytes are required.`,
      );
    if (18 + extensionBytes > formatChunk.size)
      fail(
        props.path,
        "extensible.truncated",
        `declares ${extensionBytes} extensible bytes but its "fmt " chunk carries only ${formatChunk.size - 18}.`,
      );
    validBits = view.getUint16(formatChunk.offset + 18, true);
    channelMask = view.getUint32(formatChunk.offset + 20, true);
    sampleTag = view.getUint16(formatChunk.offset + 24, true);
    const guidBytes = bytes.subarray(
      formatChunk.offset + 24,
      formatChunk.offset + 40,
    );
    subFormatGuid = waveGuid(guidBytes);
    if (SUBFORMAT_TAIL.some((byte, index) => guidBytes[index + 2] !== byte))
      fail(
        props.path,
        "unsupported-wave-subformat",
        `carries unsupported extensible SubFormat ${subFormatGuid}. ${SUPPORTED_AUDIO}`,
      );
    if (sampleTag !== WAVE_FORMAT_PCM && sampleTag !== WAVE_FORMAT_FLOAT)
      fail(
        props.path,
        "unsupported-wave-subformat",
        `carries unsupported extensible SubFormat ${subFormatGuid}. ${SUPPORTED_AUDIO}`,
      );
    if (validBits === 0 || validBits > containerBits)
      fail(
        props.path,
        "extensible.valid-bits",
        `declares ${validBits} valid bits in a ${containerBits}-bit container.`,
      );
  }

  const float = sampleTag === WAVE_FORMAT_FLOAT && containerBits === 32;
  const pcm = sampleTag === WAVE_FORMAT_PCM && containerBits === 16;
  if (float === false && pcm === false)
    fail(
      props.path,
      "unsupported-wave-precision",
      `carries WAVE sample format 0x${hex4(sampleTag)} at ${containerBits} bits per sample. ${SUPPORTED_AUDIO}`,
    );
  if (validBits !== containerBits)
    fail(
      props.path,
      "unsupported-wave-precision",
      `carries ${validBits} valid bits in a ${containerBits}-bit container. ${SUPPORTED_AUDIO}`,
    );
  if (channels !== 1 && channels !== 2)
    fail(
      props.path,
      "unsupported-wave-channels",
      `declares ${channels} channels. ${SUPPORTED_AUDIO}`,
    );
  if (sourceSampleRate === 0)
    fail(
      props.path,
      "sample-rate",
      "declares a sample rate of 0 Hz; a WAV asset states a positive rate.",
    );
  const bytesPerSample = containerBits / 8;
  const expectedBlockAlign = channels * bytesPerSample;
  if (blockAlign !== expectedBlockAlign)
    fail(
      props.path,
      "block-align",
      `declares nBlockAlign ${blockAlign}, expected ${expectedBlockAlign} for ${channels} channels at ${containerBits} bits.`,
    );
  const expectedAverageBytesPerSecond = sourceSampleRate * blockAlign;
  if (averageBytesPerSecond !== expectedAverageBytesPerSecond)
    fail(
      props.path,
      "average-bytes-per-second",
      `declares nAvgBytesPerSec ${averageBytesPerSecond}, expected ${expectedAverageBytesPerSecond}.`,
    );

  const speakers: ["front-center"] | ["front-left", "front-right"] =
    channels === 1 ? ["front-center"] : ["front-left", "front-right"];
  if (extensible) {
    if (channelMask === 0)
      fail(
        props.path,
        "unsupported-wave-layout",
        `declares unsupported channel mask ${hex8(channelMask!)}. ${SUPPORTED_AUDIO}`,
      );
    const count = bitCount(channelMask!);
    if (count !== channels)
      fail(
        props.path,
        "wave-channel-mask-count",
        `declares ${channels} channels but channel mask ${hex8(channelMask!)} names ${count}.`,
      );
    const supportedMask = channels === 1 ? MONO_MASK : STEREO_MASK;
    if (channelMask !== supportedMask)
      fail(
        props.path,
        "unsupported-wave-layout",
        `declares unsupported channel mask ${hex8(channelMask!)}. ${SUPPORTED_AUDIO}`,
      );
  }
  if (data === null)
    fail(
      props.path,
      "missing-data",
      `has no RIFF/WAVE "data" chunk. ${SUPPORTED_AUDIO}`,
    );
  const dataChunk = data!;
  if (dataChunk.size % blockAlign !== 0)
    fail(
      props.path,
      "data-frame",
      `has a "data" chunk of ${dataChunk.size} bytes, which is not a whole number of ${channels}-channel ${containerBits}-bit sample frames.`,
    );
  const sourceFrames = dataChunk.size / blockAlign;
  if (sourceFrames === 0)
    fail(
      props.path,
      "empty-data",
      "carries no sample frames; a declared cue asset has to contain the sound it is cued for.",
    );

  const mono = new Float32Array(sourceFrames);
  for (let frame = 0; frame < sourceFrames; ++frame) {
    let sum = 0;
    let monoSample = 0;
    for (let channel = 0; channel < channels; ++channel) {
      const at =
        dataChunk.offset + (frame * channels + channel) * bytesPerSample;
      const sample = float
        ? view.getFloat32(at, true)
        : view.getInt16(at, true) / 32_768;
      if (Number.isFinite(sample) === false)
        fail(
          props.path,
          "non-finite-pcm",
          `contains a non-finite PCM sample at frame ${frame}, channel ${channel}.`,
        );
      if (channels === 1) monoSample = sample;
      else sum += sample;
    }
    mono[frame] = channels === 1 ? monoSample : sum / channels;
  }
  const resampling = sourceSampleRate !== props.sampleRate;
  const samples = resampling
    ? resampleMono(mono, sourceSampleRate, props.sampleRate)
    : mono;
  return {
    sourceSampleRate,
    sourceChannels: channels,
    sourceFrames,
    durationSeconds: sourceFrames / sourceSampleRate,
    sourceFormat: {
      kind: "wave",
      header: extensible ? "wave-format-extensible" : "wave-format-ex",
      encoding: float ? "float-f32le" : "pcm-s16le",
      containerBits: containerBits as 16 | 32,
      validBits: validBits as 16 | 32,
      sampleRate: sourceSampleRate,
      channels: channels as 1 | 2,
      layout: {
        kind: channels === 1 ? "mono" : "stereo",
        speakers,
        source: extensible ? "channel-mask" : "legacy-default",
        mask: channelMask,
      },
      subFormatGuid,
    },
    processing: {
      kind:
        channels === 1
          ? resampling
            ? "resample"
            : "copy"
          : resampling
            ? "downmix-resample"
            : "downmix",
      outputChannels: 1,
      outputSampleRate: props.sampleRate,
      matrix: channels === 1 ? [[1]] : [[0.5, 0.5]],
    },
    samples,
  };
};

const fail = (asset: string, reason: string, message: string): never => {
  throw new Error(`Audio asset "${asset}" [${reason}] ${message}`);
};

const resampleMono = (
  source: Float32Array,
  from: number,
  to: number,
): Float32Array => {
  const length = Math.round((source.length * to) / from);
  const output = new Float32Array(length);
  const step = from / to;
  for (let index = 0; index < length; ++index) {
    const position = index * step;
    const left = Math.floor(position);
    const right = Math.min(source.length - 1, left + 1);
    const weight = position - left;
    output[index] = source[left]! * (1 - weight) + source[right]! * weight;
  }
  return output;
};

const asciiTag = (bytes: Uint8Array, offset: number): string => {
  let text = "";
  for (let index = offset; index < offset + 4; ++index) {
    const byte = bytes[index]!;
    text += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
  }
  return text;
};

const leadingHex = (bytes: Uint8Array): string => {
  let text = "0x";
  for (let index = 0; index < 4; ++index)
    text += bytes[index]!.toString(16).padStart(2, "0");
  return text;
};

const waveGuid = (bytes: Uint8Array): string =>
  `${hexBytes(Uint8Array.from(bytes.subarray(0, 4)).reverse())}-${hexBytes(Uint8Array.from(bytes.subarray(4, 6)).reverse())}-${hexBytes(Uint8Array.from(bytes.subarray(6, 8)).reverse())}-${hexBytes(bytes.subarray(8, 10))}-${hexBytes(bytes.subarray(10, 16))}`;

const hexBytes = (bytes: Uint8Array): string =>
  [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");

const bitCount = (value: number): number => {
  let remaining = value >>> 0;
  let count = 0;
  while (remaining !== 0) {
    count += remaining & 1;
    remaining >>>= 1;
  }
  return count;
};

const hex4 = (value: number): string => value.toString(16).padStart(4, "0");
const hex8 = (value: number): string =>
  `0x${(value >>> 0).toString(16).padStart(8, "0")}`;
