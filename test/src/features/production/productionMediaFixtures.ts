import {
  normalizeProductionH264Mp4,
  trimProductionAudioPresentation,
} from "@automovie/production";
import * as HME from "h264-mp4-encoder";
import { BoxParser, createFile } from "mp4box";
import { PNG } from "pngjs";

interface IProductionMediaEncoderFailure {
  error: unknown;
}

class ProductionMediaEncoderCleanupError extends AggregateError {}

/** Delete one fixture encoder without replacing an earlier generation error. */
export const preserveProductionMediaEncoderCleanup = (
  failure: IProductionMediaEncoderFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionMediaEncoderCleanupError(
      [failure.error, cleanupFailure],
      "Production media encoder cleanup failed after fixture generation failed.",
    );
  }
};

/** Encode a small real H.264/MP4 stream without relying on a host ffmpeg. */
export const productionH264Mp4 = async (props: {
  width: number;
  height: number;
  fps: number;
  frameCount: number;
}): Promise<Uint8Array> => {
  const encoder = await HME.createH264MP4Encoder();
  let failure: IProductionMediaEncoderFailure | undefined;
  try {
    encoder.width = props.width;
    encoder.height = props.height;
    encoder.frameRate = props.fps;
    encoder.speed = 10;
    encoder.groupOfPictures = props.fps;
    encoder.initialize();
    const frame = new Uint8Array(props.width * props.height * 4);
    for (let index = 0; index < props.frameCount; ++index) {
      for (let pixel = 0; pixel < props.width * props.height; ++pixel) {
        const offset = pixel * 4;
        frame[offset] = (index * 7 + pixel) % 256;
        frame[offset + 1] = (index * 11 + pixel * 3) % 256;
        frame[offset + 2] = (index * 13 + pixel * 5) % 256;
        frame[offset + 3] = 255;
      }
      encoder.addFrameRgba(frame);
    }
    encoder.finalize();
    return normalizeProductionH264Mp4(
      Uint8Array.from(encoder.FS.readFile(encoder.outputFilename)),
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveProductionMediaEncoderCleanup(failure, () => encoder.delete());
  }
};

/** One actual AAC-LC audio track in an ISO base-media container. */
export const productionAudioMp4 = (): Uint8Array =>
  Buffer.from(
    [
      "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",
    ].join(""),
    "base64",
  );

/** Encode parser-valid 48 kHz stereo Opus silence at an exact track duration. */
export const productionOpusMp4 = (
  sampleFrames: number,
  channels: 1 | 2 = 2,
): Uint8Array => {
  const primingSamples = 312;
  const codedSampleFrames =
    Math.ceil((sampleFrames + primingSamples) / 960) * 960;
  const description = new BoxParser.box.dOps();
  description.Version = 0;
  description.OutputChannelCount = channels;
  description.PreSkip = primingSamples;
  description.InputSampleRate = 48_000;
  description.OutputGain = 0;
  description.ChannelMappingFamily = 0;
  description.StreamCount = 1;
  description.CoupledCount = channels - 1;
  description.ChannelMapping = [];
  const file = createFile();
  file.init({
    brands: ["isom", "iso2", "mp41", "Opus"],
    timescale: 48_000,
    duration: codedSampleFrames,
  });
  const track = file.addTrack({
    type: "Opus",
    hdlr: "soun",
    timescale: 48_000,
    media_duration: codedSampleFrames,
    duration: codedSampleFrames,
    samplerate: 48_000,
    channel_count: channels,
    samplesize: 16,
    description_boxes: [description],
  });
  for (let dts = 0; dts < codedSampleFrames; dts += 960)
    file.addSample(track, Uint8Array.from([0xf8, 0xff, 0xfe]), {
      duration: 960,
      dts,
      cts: dts,
      is_sync: true,
    });
  trimProductionAudioPresentation({
    file,
    track,
    mediaTimescale: 48_000,
    movieTimescale: 48_000,
    primingSamples,
    presentationSamples: sampleFrames,
  });
  return new Uint8Array(file.getBuffer().buffer);
};

/** One actual MPEG-4 Part 2 video track used to reject non-AVC MP4. */
export const productionMpeg4Part2Mp4 = (): Uint8Array =>
  Buffer.from(
    [
      "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",
    ].join(""),
    "base64",
  );

/** One actual inter-frame H.264 stream whose sync table can be challenged. */
export const productionInterframeH264Mp4 = (): Uint8Array =>
  normalizeProductionH264Mp4(
    Buffer.from(
      [
        "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMpbW9vdgAAAGxtdmhkAAAAAAAA",
        "AAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAA",
        "AAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAlN0cmFrAAAAXHRr",
        "aGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAA",
        "AAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAA",
        "AAEAAAPoAAAAAAABAAAAAAHLbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAQABVxAAA",
        "AAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABdm1pbmYA",
        "AAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAA",
        "AQAAATZzdGJsAAAAtnN0c2QAAAAAAAAAAQAAAKZhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAA",
        "AAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDIgbGlieDI2NAAAAAAAAAAAAAAA",
        "GP//AAAALGF2Y0MBQsAK/+EAFWdCwAraewEQAAADABAAAAMAQPEiagEABGjOD8gAAAAQcGFz",
        "cAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAc2AAAAAAAAAAYc3R0cwAAAAAAAAABAAAAAgAAIAAA",
        "AAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAAAgAAAAEAAAAcc3Rz",
        "egAAAAAAAAAAAAAAAgAAA1wAAAA/AAAAFHN0Y28AAAAAAAAAAQAAA1kAAABidWR0YQAAAFpt",
        "ZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0",
        "b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYyLjEyLjEwMgAAAAhmcmVlAAADo21kYXQAAAJTBgX/",
        "/0/cRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY1IHIzMjIzIDA0ODBjYjAgLSBILjI2",
        "NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDI1IC0gaHR0cDovL3d3dy52",
        "aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MCByZWY9MSBkZWJsb2Nr",
        "PTA6MDowIGFuYWx5c2U9MDowIG1lPWRpYSBzdWJtZT0wIHBzeT0xIHBzeV9yZD0xLjAwOjAu",
        "MDAgbWl4ZWRfcmVmPTAgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0wIDh4OGRj",
        "dD0wIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0",
        "PTAgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0w",
        "IGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9p",
        "bnRyYT0wIGJmcmFtZXM9MCB3ZWlnaHRwPTAga2V5aW50PTMwIGtleWludF9taW49MTYgc2Nl",
        "bmVjdXQ9MCBpbnRyYV9yZWZyZXNoPTAgcmM9Y3JmIG1idHJlZT0wIGNyZj0yMy4wIHFjb21w",
        "PTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTAAgAAA",
        "AQFliIQ6DGAB0AAQZw5QLq2Dy171KxY34ACzZqt/MgJhoC37loKhXHxcGijS3AIgIK9XOVCI",
        "jbfq7EAEARiiIRw5enjzKW7WgEUFKc+EGuU8HCr/iwBAEY4YRRXNQaYe4X5TxAAAgLgACAOD",
        "7g4AgCMACsdgC1VQFDhO/poEZSGnjEPsHAEARgQAQBGAOy4D8RAQaJX9tzkAG9cgBAX1/wYA",
        "AgEAAJYEZ4ALoIVnXzDRpkNUWEIq5lRRwJW5iA+k2QtgHE2044BAIlkvJJAtsAAsHgFAukdZ",
        "NZUlzr3ADgCh9LT1gUowntz0yMAAQDFDX8BwjJHo/9oNwAiH8zw6Ws4E2gAAADtBmiEvDHAB",
        "tR5iVAR182J7zX0wa7KIaKCvvjEwpsnugihEAlHAFssVLPkFe6HIQuwBjB5InOhkNtj06g==",
      ].join(""),
      "base64",
    ),
  );

/** Encode one non-uniform actual PNG raster. */
export const productionPng = (width: number, height: number): Uint8Array => {
  const image = new PNG({ width, height });
  image.gamma = 0.45455;
  image.data.fill(180);
  image.data[0] = 0;
  return PNG.sync.write(image);
};

/**
 * Assemble one RIFF/WAVE container from exactly the header fields asked for.
 *
 * Every malformed variant a decoder has to refuse is BUILT here rather than
 * patched into a valid file afterwards. A byte patched at a computed offset
 * stops landing the moment the layout moves, and a fixture that quietly stops
 * being malformed leaves its refusal case asserting nothing.
 *
 * Samples are given per channel in the container's own units: raw signed codes
 * for 16-bit PCM, unit floats for 32-bit float. That keeps a case's expected
 * decoded value hand-derivable (`16384 / 32768` is `0.5`) instead of taken from
 * whatever the encoder happened to produce.
 */
export const productionWav = (props: {
  /** WAVE format tag; 1 is PCM, 3 is IEEE float, 0xfffe is extensible. */
  formatTag?: number;
  /** Leading tag of an extensible header's sub-format GUID. */
  subFormatTag?: number;
  /** Extensible valid precision; defaults to the container depth. */
  validBitsPerSample?: number;
  /** Extensible extension byte count; defaults to the required 22. */
  extensionBytes?: number;
  /** Extensible speaker mask; defaults to FC mono or FL/FR stereo. */
  channelMask?: number;
  /** Optional replacement for the final fourteen canonical GUID bytes. */
  subFormatGuidTail?: Uint8Array;
  /** Declared bit depth; 32 encodes float samples, anything else int16. */
  bitsPerSample?: number;
  /** Declared channel count; defaults to how many channels were supplied. */
  declaredChannels?: number;
  sampleRate?: number;
  blockAlign?: number;
  averageBytesPerSecond?: number;
  /** One sample array per channel, all of the same length. */
  channels?: readonly (readonly number[])[];
  /** Exact data-chunk payload, replacing the encoded channels. */
  data?: Uint8Array;
  /** Declared "data" chunk size; defaults to the real payload length. */
  declaredDataSize?: number;
  /** Declared "fmt " chunk size; defaults to 16, or 40 when extensible. */
  formatChunkSize?: number;
  /** RIFF form tag; defaults to "WAVE". */
  form?: string;
  /** Write one ignorable metadata chunk ahead of the format chunk. */
  metadata?: boolean;
  omitFormatChunk?: boolean;
  omitDataChunk?: boolean;
  duplicateFormatChunk?: boolean;
  duplicateDataChunk?: boolean;
  declaredRiffSize?: number;
}): Uint8Array => {
  const formatTag = props.formatTag ?? 1;
  const bitsPerSample = props.bitsPerSample ?? 16;
  const channels = props.channels ?? [];
  const declaredChannels = props.declaredChannels ?? channels.length;
  const sampleRate = props.sampleRate ?? 48_000;
  const payload = props.data ?? encodeWavSamples(channels, bitsPerSample);
  const formatChunkSize =
    props.formatChunkSize ?? (formatTag === 0xfffe ? 40 : 16);
  const format = new Uint8Array(formatChunkSize);
  const formatView = new DataView(format.buffer);
  const blockAlign =
    props.blockAlign ?? Math.trunc((declaredChannels * bitsPerSample) / 8);
  // A deliberately short format chunk still carries every declared field that
  // fits in it, so a "too short" case is short and otherwise well formed.
  const put16 = (at: number, value: number): void => {
    if (at + 2 <= formatChunkSize) formatView.setUint16(at, value, true);
  };
  const put32 = (at: number, value: number): void => {
    if (at + 4 <= formatChunkSize) formatView.setUint32(at, value, true);
  };
  put16(0, formatTag);
  put16(2, declaredChannels);
  put32(4, sampleRate);
  put32(8, props.averageBytesPerSecond ?? sampleRate * blockAlign);
  put16(12, blockAlign);
  put16(14, bitsPerSample);
  if (formatTag === 0xfffe) {
    put16(16, props.extensionBytes ?? 22);
    put16(18, props.validBitsPerSample ?? bitsPerSample);
    put32(
      20,
      props.channelMask ?? (declaredChannels === 1 ? 0x0000_0004 : 0x0000_0003),
    );
    put16(24, props.subFormatTag ?? 1);
    const tail =
      props.subFormatGuidTail ??
      Uint8Array.from([
        0, 0, 0, 0, 0x10, 0, 0x80, 0, 0, 0xaa, 0, 0x38, 0x9b, 0x71,
      ]);
    if (formatChunkSize > 26)
      format.set(
        tail.subarray(0, Math.min(tail.length, formatChunkSize - 26)),
        26,
      );
  }
  const chunks: Array<{
    id: string;
    payload: Uint8Array;
    declaredSize?: number;
  }> = [];
  if (props.metadata === true)
    chunks.push({ id: "LIST", payload: Buffer.from("INFOfixture", "utf8") });
  if (props.omitFormatChunk !== true)
    chunks.push({ id: "fmt ", payload: format });
  if (props.duplicateFormatChunk === true)
    chunks.push({ id: "fmt ", payload: format });
  if (props.omitDataChunk !== true)
    chunks.push({
      id: "data",
      payload,
      declaredSize: props.declaredDataSize,
    });
  if (props.duplicateDataChunk === true) chunks.push({ id: "data", payload });
  const padded = (length: number): number => length + (length % 2);
  const riffSize = chunks.reduce(
    (total, chunk) => total + 8 + padded(chunk.payload.length),
    4,
  );
  const bytes = new Uint8Array(8 + riffSize);
  const view = new DataView(bytes.buffer);
  writeWavTag(bytes, 0, "RIFF");
  view.setUint32(4, props.declaredRiffSize ?? riffSize, true);
  writeWavTag(bytes, 8, props.form ?? "WAVE");
  let cursor = 12;
  for (const chunk of chunks) {
    writeWavTag(bytes, cursor, chunk.id);
    view.setUint32(
      cursor + 4,
      chunk.declaredSize ?? chunk.payload.length,
      true,
    );
    bytes.set(chunk.payload, cursor + 8);
    cursor += 8 + padded(chunk.payload.length);
  }
  return bytes;
};

const encodeWavSamples = (
  channels: readonly (readonly number[])[],
  bitsPerSample: number,
): Uint8Array => {
  const frames = channels[0]?.length ?? 0;
  const bytesPerSample = bitsPerSample / 8;
  const payload = new Uint8Array(frames * channels.length * bytesPerSample);
  const view = new DataView(payload.buffer);
  for (let frame = 0; frame < frames; ++frame)
    for (let channel = 0; channel < channels.length; ++channel) {
      const at = (frame * channels.length + channel) * bytesPerSample;
      const value = channels[channel]![frame]!;
      if (bitsPerSample === 32) view.setFloat32(at, value, true);
      else view.setInt16(at, value, true);
    }
  return payload;
};

const writeWavTag = (bytes: Uint8Array, at: number, tag: string): void => {
  for (let index = 0; index < 4; ++index)
    bytes[at + index] = tag.charCodeAt(index);
};

/** Encode one valid WebVTT document with two observable cues. */
export const productionWebVtt = (): Uint8Array =>
  Buffer.from(
    "\uFEFFWEBVTT fixture\n\n00:00:00.000 --> 00:00:00.050\nSignal.\n\n00:00:00.050 --> 00:00:00.100\nAdvance.\n",
    "utf8",
  );
