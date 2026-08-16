/**
 * Every sample encoding this decoder accepts, named in each refusal so a
 * rejected asset says what to convert it to instead of only what it is not.
 */
const SUPPORTED_AUDIO =
  'Supported audio assets are RIFF/WAVE ("*.wav") containers carrying 16-bit PCM or 32-bit IEEE float samples, mono or stereo.';

/** Integer PCM samples. */
const WAVE_FORMAT_PCM = 0x0001;

/** IEEE-754 float samples. */
const WAVE_FORMAT_FLOAT = 0x0003;

/** A format whose real encoding is the leading tag of its sub-format GUID. */
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

/**
 * One declared audio asset's container facts and the mono samples the mix
 * plays.
 *
 * The `source*` fields are the container's own, before anything this decoder
 * did to them, because those are what a render plan records as the asset's
 * identity: a plan then states what the file is rather than what the mix wanted
 * it to be, and a cue whose declared source span disagrees with the file is
 * caught at planning instead of surfacing as a silent tail.
 */
export interface IAutoMovieDecodedProductionAudioAsset {
  /**
   * Sample rate the container declares, in Hz, before any resampling.
   */
  sourceSampleRate: number;
  /**
   * Channel count the container declares, before the mono downmix.
   */
  sourceChannels: number;
  /**
   * Sample frames the container carries, before any resampling.
   */
  sourceFrames: number;
  /**
   * Exact source runtime: `sourceFrames / sourceSampleRate` seconds.
   */
  durationSeconds: number;
  /**
   * Mono samples at the requested rate, within `[-1, 1]` for in-range input.
   *
   * This is exactly the buffer shape {@link renderProductionSound} accepts for
   * an asset, so a decoded asset goes straight into the mix.
   */
  samples: Float32Array;
}

/**
 * Decode one declared audio asset's container bytes into mono samples at the
 * sound plan's own rate.
 *
 * ## Why this lives in `mcp`
 *
 * `renderProductionSound` is handed its samples rather than reading them: a mix
 * that must emit the same bytes on every machine can own neither a codec nor a
 * filesystem, which is the same reason synthesized dialogue is handed in. So
 * something outside `engine` has to own both, and the render path already reads
 * every byte a production declares through
 * `AutoMovieProductionProject.contentInputs()` — this package. The owned-file
 * reader and its path fence are here, and so is every other container parser
 * the render path uses: `probeProductionMedia`, `probeProductionVideoMp4`,
 * `muxProductionFeatureMp4`. `@automovie/render` is the other candidate and is
 * the wrong one: it is a pure planner over `engine` and `interface` with no
 * project, no filesystem, and no media dependency at all, so a decoder there
 * would hand it both and duplicate the ownership check that already exists
 * here.
 *
 * ## What it accepts
 *
 * RIFF/WAVE only, and within it the two encodings a production actually ships:
 * 16-bit PCM and 32-bit IEEE float, mono or stereo, including the
 * `WAVE_FORMAT_EXTENSIBLE` spelling of those same two. Anything else — another
 * container, another bit depth, more channels, a truncated or headerless file —
 * is an input violation and throws, naming what was found and
 * {@link SUPPORTED_AUDIO}. Refusing loudly is the point: a decoder that returned
 * silence for an unreadable asset would publish a film whose sound design is
 * missing and whose render succeeded.
 *
 * ## What it produces
 *
 * Mono at `props.sampleRate`. Stereo is folded by averaging the channels, which
 * is the only downmix two facts (a left and a right) support without inventing
 * a pan law. Rate conversion is linear interpolation and runs **only** when the
 * file's rate differs, so an asset already at the plan's rate is copied sample
 * for sample and carries no interpolation error at all.
 *
 * The whole function is a pure function of `bytes` and `sampleRate`: no host
 * codec, no clock, no locale, only IEEE-754 arithmetic. The same asset decodes
 * to the same samples on every machine, which is what lets the mix downstream
 * stay reproducible.
 */
export const decodeProductionAudioAsset = (props: {
  /** Project-relative declared asset path, named in every refusal. */
  path: string;
  /** Exact current compiler-owned container bytes. */
  bytes: Uint8Array;
  /** The sound plan's own rate; the decode resamples only when it differs. */
  sampleRate: number;
}): IAutoMovieDecodedProductionAudioAsset => {
  if (Number.isSafeInteger(props.sampleRate) === false || props.sampleRate <= 0)
    throw new Error(
      `Audio asset "${props.path}" cannot be decoded at ${props.sampleRate} Hz: a decode target rate is a positive whole number of samples per second.`,
    );
  const bytes = props.bytes;
  if (bytes.byteLength < 12)
    throw new Error(
      `Audio asset "${props.path}" is ${bytes.byteLength} bytes, too short to carry a RIFF/WAVE header. ${SUPPORTED_AUDIO}`,
    );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = asciiTag(bytes, 0);
  const form = asciiTag(bytes, 8);
  if (riff !== "RIFF" || form !== "WAVE")
    throw new Error(
      `Audio asset "${props.path}" is not a RIFF/WAVE container: it begins "${riff}" (${leadingHex(bytes)}) and declares form "${form}". ${SUPPORTED_AUDIO}`,
    );
  // Walk the chunk list rather than assuming "fmt " then "data" at fixed
  // offsets: ordinary writers interleave metadata chunks, and a decoder that
  // read by offset would mistake a LIST for a format.
  let cursor = 12;
  let format: { offset: number; size: number } | null = null;
  let data: { offset: number; size: number } | null = null;
  while (cursor + 8 <= bytes.byteLength) {
    const id = asciiTag(bytes, cursor);
    const size = view.getUint32(cursor + 4, true);
    const body = cursor + 8;
    if (body + size > bytes.byteLength)
      throw new Error(
        `Audio asset "${props.path}" is a truncated RIFF/WAVE container: its "${id}" chunk declares ${size} bytes but only ${bytes.byteLength - body} remain.`,
      );
    if (id === "fmt ") format = { offset: body, size };
    else if (id === "data") data = { offset: body, size };
    // RIFF chunks are word aligned, so an odd payload is followed by one pad
    // byte that belongs to no chunk.
    cursor = body + size + (size % 2);
  }
  if (format === null)
    throw new Error(
      `Audio asset "${props.path}" has no RIFF/WAVE "fmt " chunk. ${SUPPORTED_AUDIO}`,
    );
  if (format.size < 16)
    throw new Error(
      `Audio asset "${props.path}" has a ${format.size}-byte "fmt " chunk; a WAVE format chunk is at least 16 bytes.`,
    );
  const declaredTag = view.getUint16(format.offset, true);
  const channels = view.getUint16(format.offset + 2, true);
  const sourceSampleRate = view.getUint32(format.offset + 4, true);
  const bitsPerSample = view.getUint16(format.offset + 14, true);
  // `WAVE_FORMAT_EXTENSIBLE` is not another encoding: it is the same PCM or
  // float sample spelled through a sub-format GUID, which is how many writers
  // emit 32-bit float. Reading the GUID's leading tag is what keeps an
  // ordinary float stem from being refused for how its header is written.
  const extensible = declaredTag === WAVE_FORMAT_EXTENSIBLE;
  if (extensible && format.size < 40)
    throw new Error(
      `Audio asset "${props.path}" declares an extensible WAVE format in a "fmt " chunk of ${format.size} bytes, which is too small to carry its 40-byte sub-format. ${SUPPORTED_AUDIO}`,
    );
  const sampleTag = extensible
    ? view.getUint16(format.offset + 24, true)
    : declaredTag;
  const float = sampleTag === WAVE_FORMAT_FLOAT && bitsPerSample === 32;
  if (
    float === false &&
    (sampleTag !== WAVE_FORMAT_PCM || bitsPerSample !== 16)
  )
    throw new Error(
      `Audio asset "${props.path}" carries WAVE sample format 0x${hex4(sampleTag)} at ${bitsPerSample} bits per sample. ${SUPPORTED_AUDIO}`,
    );
  if (channels !== 1 && channels !== 2)
    throw new Error(
      `Audio asset "${props.path}" declares ${channels} channels. ${SUPPORTED_AUDIO}`,
    );
  if (sourceSampleRate === 0)
    throw new Error(
      `Audio asset "${props.path}" declares a sample rate of 0 Hz; a WAV asset states a positive rate.`,
    );
  if (data === null)
    throw new Error(
      `Audio asset "${props.path}" has no RIFF/WAVE "data" chunk. ${SUPPORTED_AUDIO}`,
    );
  const bytesPerSample = bitsPerSample / 8;
  const blockBytes = channels * bytesPerSample;
  if (data.size % blockBytes !== 0)
    throw new Error(
      `Audio asset "${props.path}" has a ${data.size}-byte "data" chunk, which is not a whole number of ${channels}-channel ${bitsPerSample}-bit sample frames.`,
    );
  const sourceFrames = data.size / blockBytes;
  if (sourceFrames === 0)
    throw new Error(
      `Audio asset "${props.path}" carries no sample frames; a declared cue asset has to contain the sound it is cued for.`,
    );
  const mono = new Float32Array(sourceFrames);
  for (let frame = 0; frame < sourceFrames; ++frame) {
    let sum = 0;
    for (let channel = 0; channel < channels; ++channel) {
      const at = data.offset + (frame * channels + channel) * bytesPerSample;
      // 16-bit PCM is scaled by 32768 rather than 32767: the division is exact
      // in binary, and full-scale negative maps to exactly -1.
      sum += float
        ? view.getFloat32(at, true)
        : view.getInt16(at, true) / 32_768;
    }
    mono[frame] = sum / channels;
  }
  return {
    sourceSampleRate,
    sourceChannels: channels,
    sourceFrames,
    durationSeconds: sourceFrames / sourceSampleRate,
    samples:
      sourceSampleRate === props.sampleRate
        ? mono
        : resampleMono(mono, sourceSampleRate, props.sampleRate),
  };
};

/**
 * Convert a mono buffer from one rate to another by linear interpolation.
 *
 * The output position maps as `index * from / to`, which preserves the source's
 * real playback rate. Stretching the endpoints onto each other instead — the
 * shape used when fitting a buffer into a fixed span — would shift the pitch by
 * one sample over the whole file, which is a different operation than a rate
 * conversion and would make the same asset sound different at every length.
 */
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

/** Four bytes as a printable chunk tag; an unprintable byte reads as ".". */
const asciiTag = (bytes: Uint8Array, offset: number): string => {
  let text = "";
  for (let index = offset; index < offset + 4; ++index) {
    const byte = bytes[index]!;
    text += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
  }
  return text;
};

/** The leading four bytes as hex, for a file whose tag is not readable text. */
const leadingHex = (bytes: Uint8Array): string => {
  let text = "0x";
  for (let index = 0; index < 4; ++index)
    text += bytes[index]!.toString(16).padStart(2, "0");
  return text;
};

/** One WAVE format tag as the four-digit hex its specification writes. */
const hex4 = (value: number): string => value.toString(16).padStart(4, "0");
