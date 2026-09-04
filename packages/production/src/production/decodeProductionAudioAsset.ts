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
 * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Carries encoding, precision, source clock, and ordered channel semantics.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Represents source declarations independently from derived audio.
 */
export interface IAutoMovieProductionWaveSourceFormat {
  kind: "wave";
  header: "wave-format-ex" | "wave-format-extensible";
  encoding: "pcm-s16le" | "float-f32le";
  containerBits: 16 | 32;
  validBits: 16 | 32;
  sampleRate: number;
  channels: 1 | 2;
  layout: {
    kind: "mono" | "stereo";
    speakers: ["front-center"] | ["front-left", "front-right"];
    source: "legacy-default" | "channel-mask";
    mask: number | null;
  };
  subFormatGuid: string | null;
}

/**
 * Deterministic conversion from declared WAVE layout/clock to mixer input.
 *
 * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Names the channel matrix and resampling result without rewriting source facts.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Separates processing lineage from the inspected source format.
 */
export interface IAutoMovieProductionAudioProcessing {
  kind: "copy" | "downmix" | "resample" | "downmix-resample";
  outputChannels: 1;
  outputSampleRate: number;
  matrix: readonly (readonly number[])[];
}

/**
 * One WAVE source's declared facts and the exact processing applied to it.
 *
 * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Preserves the supported encoding, precision, sample clock, and ordered channel layout found at adoption.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Keeps declared source facts separate from downmix and resampling results.
 */
export interface IAutoMovieDecodedProductionAudioAsset {
  sourceSampleRate: number;
  sourceChannels: number;
  sourceFrames: number;
  durationSeconds: number;
  sourceFormat: IAutoMovieProductionWaveSourceFormat;
  processing: IAutoMovieProductionAudioProcessing;
  samples: Float32Array;
}

/**
 * Decode one complete supported RIFF/WAVE generation into finite mono PCM.
 *
 * @evidence requirements/sound/sources-and-external-assets.md#sound-decode-contract Refuses malformed, unsupported-layout, unsupported-precision, and non-finite inputs before adoption.
 * @evidence requirements/sound/sources-and-external-assets.md#sound-derived-source-closure Records the exact downmix/resample lineage applied to immutable source bytes.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-audio-inspection Validates RIFF/WAVE relationships and exposes typed source and processing facts.
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
