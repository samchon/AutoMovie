import {
  canonicalProductionFrameRate,
  verifyAutoMovieSemanticMask,
} from "@automovie/engine";
import {
  IAutoMovieProductionAudioProbe,
  IAutoMovieProductionDeliverable,
  IAutoMovieProductionMediaProbe,
  IAutoMovieProductionVideoProbe,
  IAutoMovieSemanticMask,
} from "@automovie/interface";
import type { Box, Movie, Track, createFile } from "mp4box";
import { TextDecoder } from "node:util";

import { parseAutoMovieStructuredJson } from "./duplicateAwareJson";
import {
  assertProductionOpusProfile,
  productionOpusDescription,
} from "./productionMp4Profile";
import { probeProductionPngPicture } from "./productionPngPicture";
import { residentMp4Box } from "./residentCodecs";
import { parseProductionSoundEvidence } from "./verifyProductionNonVideoDeliverables";

/**
 * Media type under which a guide deliverable publishes a semantic-mask sidecar.
 *
 * A mask picture is unreadable without the palette that names its colours, so
 * the sidecar travels beside the frames as its own declared medium rather than
 * as generic JSON, and the probe parses and self-verifies it like any other
 * delivered byte stream.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-provenance Names the delivered semantic dependency of a mask frame as an explicit medium a final reader can reopen.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-provenance-handoff Fixes the media identity under which the palette hand-off is carried in a delivery ledger.
 */
export const AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE =
  "application/vnd.automovie.semantic-mask+json";

/**
 * Parse renderer-owned bytes instead of trusting manifest media claims.
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-partial-container Reports a container that opens but lacks a required stream or fact as a refusal rather than as delivered media.
 */
export const probeProductionMedia = (props: {
  kind: IAutoMovieProductionDeliverable["kind"];
  mediaType: string;
  bytes: Uint8Array;
}): IAutoMovieProductionMediaProbe => {
  if (
    props.kind === "guide-pass" &&
    props.mediaType === AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE
  ) {
    let mask: IAutoMovieSemanticMask;
    try {
      mask = parseAutoMovieStructuredJson({
        record: "semantic-mask-sidecar",
        bytes: props.bytes,
      }) as IAutoMovieSemanticMask;
    } catch {
      throw new Error("Semantic-mask sidecar bytes are not strict UTF-8 JSON.");
    }
    verifyAutoMovieSemanticMask(mask);
    return { kind: "semantic-mask", mask };
  }
  if (
    props.kind === "preview" ||
    ((props.kind === "guide-pass" || props.kind === "audio-mix") &&
      props.mediaType === "image/png")
  ) {
    if (props.mediaType !== "image/png")
      throw new Error(
        `${props.kind} output declares "${props.mediaType}", but this image requires image/png bytes.`,
      );
    const picture = probeProductionPngPicture(props.bytes);
    return {
      kind: "png",
      width: picture.width,
      height: picture.height,
      picture,
    };
  }
  if (props.kind === "audio-mix" && props.mediaType === "application/json") {
    return {
      kind: "sound-evidence",
      evidence: parseProductionSoundEvidence(props.bytes),
    };
  }
  if (props.kind === "captions") {
    if (props.mediaType !== "text/vtt")
      throw new Error(
        `Caption output declares "${props.mediaType}", but caption deliverables require text/vtt bytes.`,
      );
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(props.bytes);
    } catch {
      throw new Error("Caption bytes are not valid UTF-8.");
    }
    if (/^\uFEFF?WEBVTT(?:[ \t][^\r\n]*)?(?:\r\n?|\n|$)/.test(text) === false)
      throw new Error("Caption bytes do not contain a valid WebVTT header.");
    const blocks = text
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?|\n/g, "\n")
      .replace(/^([^\n]*\n)[ \t]+\n/u, "$1\n")
      .split(/\n{2,}/u)
      .slice(1);
    const cues: Extract<
      IAutoMovieProductionMediaProbe,
      { kind: "webvtt" }
    >["cues"] = [];
    for (const block of blocks) {
      if (block.trim().length === 0) continue;
      const lines = block.split("\n");
      const firstLine = lines[0]!;
      const timingIndex = firstLine.includes("-->")
        ? 0
        : lines[1]?.includes("-->")
          ? 1
          : -1;
      if (
        timingIndex < 0 &&
        /^(?:NOTE|STYLE|REGION)(?:[ \t]|$)/.test(firstLine)
      )
        continue;
      if (timingIndex < 0)
        throw new Error(
          `WebVTT block "${firstLine.trim()}" is neither a timed cue nor NOTE, STYLE, or REGION metadata. Remove the stray block or add its cue timing.`,
        );
      const timing = parseWebVttCue(lines[timingIndex]!);
      const payload = lines.slice(timingIndex + 1);
      if (payload.some((line) => line.includes("-->")))
        throw new Error(
          `WebVTT cue ${cues.length + 1} contains another timing line without a blank separator. Separate every cue block.`,
        );
      if (payload.some((line) => line.trim().length > 0) === false)
        throw new Error(
          `WebVTT cue ${cues.length + 1} has no non-empty payload. Add observable caption text after its timing line.`,
        );
      cues.push({
        id: timingIndex === 1 ? firstLine : null,
        text: payload.join("\n"),
        startMilliseconds: timing.start,
        endMilliseconds: timing.end,
      });
    }
    if (cues.length === 0)
      throw new Error(
        "WebVTT captions contain no timed cue. Add at least one observable cue or do not declare this deliverable required.",
      );
    for (let index = 0; index < cues.length; ++index) {
      const cue = cues[index]!;
      if (cue.startMilliseconds >= cue.endMilliseconds)
        throw new Error(
          `WebVTT cue ${index + 1} must end after it starts. Correct the cue timing.`,
        );
      if (
        index > 0 &&
        cue.startMilliseconds < cues[index - 1]!.startMilliseconds
      )
        throw new Error(
          `WebVTT cue ${index + 1} starts before the preceding cue. Keep deterministic cue order.`,
        );
    }
    return {
      kind: "webvtt",
      cueCount: cues.length,
      firstCueSeconds: cues[0]!.startMilliseconds / 1_000,
      lastCueSeconds: cues.reduce(
        (latest, cue) => Math.max(latest, cue.endMilliseconds / 1_000),
        0,
      ),
      cues,
      text,
    };
  }
  const parsed = parseMp4(props.bytes);
  const movie = parsed.movie;
  if (props.kind === "feature" || props.kind === "guide-pass") {
    if (props.mediaType !== "video/mp4")
      throw new Error(
        `${props.kind} output declares "${props.mediaType}", but encoded video deliverables require video/mp4 bytes.`,
      );
    if (props.kind === "guide-pass")
      return probeParsedProductionVideoMp4(props.bytes, parsed);
    if (movie.videoTracks.length !== 1)
      throw new Error(
        `MP4 contains ${movie.videoTracks.length} video tracks; exactly one is required.`,
      );
    if (movie.tracks.length !== 2)
      throw new Error(
        `feature MP4 contains ${movie.tracks.length} total tracks; exactly 2 are required.`,
      );
    if (movie.audioTracks.length !== 1)
      throw new Error(
        `Feature MP4 contains ${movie.audioTracks.length} audio tracks; exactly one is required.`,
      );
    const video = probeVideoTrack(
      props.bytes,
      parsed.file,
      movie.videoTracks[0]!,
    );
    const audio = probeAudioTrack(
      props.bytes,
      parsed.file,
      movie.audioTracks[0]!,
      movie,
    );
    if (
      exactClockProduct(
        video.presentation.movieDuration,
        audio.timebase.movieTimescale,
      ) !==
      exactClockProduct(
        audio.timebase.movieDuration,
        video.presentation.movieTimescale,
      )
    )
      throw new Error(
        "Feature MP4 video and audio tracks do not have exactly equal runtimes.",
      );
    assertProductionAudioProfile(audio, "Feature MP4");
    return { kind: "feature", video, audio };
  }
  if (props.mediaType !== "audio/mp4")
    throw new Error(
      `Audio-mix output declares "${props.mediaType}", but the current deterministic probe requires audio/mp4 bytes.`,
    );
  if (movie.videoTracks.length !== 0)
    throw new Error(
      `Audio-mix MP4 contains ${movie.videoTracks.length} video tracks; none are allowed.`,
    );
  if (movie.audioTracks.length !== 1)
    throw new Error(
      `MP4 contains ${movie.audioTracks.length} audio tracks; exactly one is required.`,
    );
  if (movie.tracks.length !== 1)
    throw new Error(
      `Audio-mix MP4 contains ${movie.tracks.length} total tracks; exactly one is required.`,
    );
  const audio = probeAudioTrack(
    props.bytes,
    parsed.file,
    movie.audioTracks[0]!,
    movie,
  );
  assertProductionAudioProfile(audio, "Audio-mix MP4");
  return audio;
};

/**
 * Parse one H.264-only intermediate production video.
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-stream-identity Identifies each track by its parsed role and codec facts rather than by a probe index.
 */
export const probeProductionVideoMp4 = (
  bytes: Uint8Array,
): Extract<IAutoMovieProductionMediaProbe, { kind: "video" }> =>
  probeParsedProductionVideoMp4(bytes, parseMp4(bytes));

const probeParsedProductionVideoMp4 = (
  bytes: Uint8Array,
  parsed: { file: ReturnType<typeof createFile>; movie: Movie },
): Extract<IAutoMovieProductionMediaProbe, { kind: "video" }> => {
  if (parsed.movie.videoTracks.length !== 1)
    throw new Error(
      `Production video MP4 contains ${parsed.movie.videoTracks.length} video tracks; exactly one is required.`,
    );
  if (parsed.movie.tracks.length !== 1)
    throw new Error(
      `Production video MP4 contains ${parsed.movie.tracks.length} total tracks; exactly one is required.`,
    );
  return probeVideoTrack(bytes, parsed.file, parsed.movie.videoTracks[0]!);
};

const probeAudioTrack = (
  bytes: Uint8Array,
  file: ReturnType<typeof createFile>,
  track: Track,
  movie: Movie,
): IAutoMovieProductionAudioProbe => {
  const audio = track.audio;
  if (
    audio === undefined ||
    track.timescale <= 0 ||
    track.duration <= 0 ||
    track.codec.trim().length === 0
  )
    throw new Error(
      "MP4 audio track lacks codec, duration, or channel metadata.",
    );
  const samples = verifySampleStorage(bytes, file, track);
  const description = samples[0]!.description as unknown as {
    boxes?: Array<{ type?: string } & Record<string, unknown>>;
  };
  const sampleEntry = productionOpusDescription({
    boxes: description.boxes,
    codec: track.codec,
    trackChannels: audio.channel_count,
    trackSampleRate: audio.sample_rate,
  });
  const primingSamples = sampleEntry.preSkip;
  const presentationDuration =
    track.movie_duration > 0 && movie.timescale > 0
      ? track.movie_duration / movie.timescale
      : track.duration / track.timescale;
  return {
    kind: "audio",
    container: "mp4",
    // mp4box reports the sample entry's four-character code as spelled in the
    // file ("Opus"); the probe reports codec identity case-insensitively, the
    // way the video probe reports "h264".
    codec: track.codec.toLowerCase(),
    runtimeSeconds: presentationDuration,
    channels: audio.channel_count,
    sampleRate: audio.sample_rate,
    sampleCount: samples.length,
    primingSamples,
    timebase: {
      movieTimescale: track.movie_timescale,
      mediaTimescale: track.timescale,
      movieDuration: track.movie_duration,
      mediaDuration: track.duration,
      edits: (track.edits ?? []).map((edit) => ({
        segmentDuration: edit.segment_duration,
        mediaTime: edit.media_time,
        mediaRateInteger: edit.media_rate_integer,
        mediaRateFraction: edit.media_rate_fraction,
      })),
    },
    sampleEntry,
  };
};

const assertProductionAudioProfile = (
  audio: IAutoMovieProductionAudioProbe,
  label: string,
): void => {
  if (audio.sampleCount <= 0)
    throw new Error(`${label} audio must contain resident coded samples.`);
  try {
    assertProductionOpusProfile(audio);
  } catch (error) {
    // The Opus profile assertion throws nothing but Error refusals.
    throw new Error(`${label} ${(error as Error).message}`);
  }
};

const parseWebVttCue = (line: string): { start: number; end: number } => {
  const delimiterCount = line.split("-->").length - 1;
  const match =
    delimiterCount === 1
      ? /^[ \t]*((?:\d{2,}:)?[0-5]\d:[0-5]\d\.\d{3})[ \t]+-->[ \t]+((?:\d{2,}:)?[0-5]\d:[0-5]\d\.\d{3})(?:[ \t]+[^\r\n]*)?$/.exec(
          line,
        )
      : null;
  if (match === null)
    throw new Error(
      `WebVTT cue timing "${line.trim()}" is malformed. Use HH:MM:SS.mmm --> HH:MM:SS.mmm.`,
    );
  return {
    start: webVttTimestampMilliseconds(match[1]!),
    end: webVttTimestampMilliseconds(match[2]!),
  };
};

const webVttTimestampMilliseconds = (value: string): number => {
  const match = /^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/u.exec(value);
  if (match === null)
    throw new Error(`WebVTT timestamp "${value}" is malformed.`);
  const hours = match[1] === undefined ? 0 : Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);
  return ((hours * 60 + minutes) * 60 + seconds) * 1_000 + milliseconds;
};

const parseMp4 = (
  bytes: Uint8Array,
): { file: ReturnType<typeof createFile>; movie: Movie } => {
  if (bytes.byteLength < 16)
    throw new Error("MP4 output is too short to contain a media track.");
  const header = Buffer.from(bytes);
  const ftypSize = header.readUInt32BE(0);
  if (
    header.toString("ascii", 4, 8) !== "ftyp" ||
    ftypSize < 16 ||
    ftypSize > bytes.byteLength ||
    header.toString("ascii", 8, 12).trim().length === 0
  )
    throw new Error(
      "MP4 output has no leading ISO base-media compatible brand box.",
    );
  const file = residentMp4Box().createFile();
  const errors: string[] = [];
  let ready: Movie | null = null;
  file.onError = (module, message) => {
    errors.push(`${module}: ${message}`);
  };
  file.onReady = (info) => {
    ready = info;
  };
  try {
    const copy = Uint8Array.from(bytes).buffer;
    file.appendBuffer(
      residentMp4Box().MP4BoxBuffer.fromArrayBuffer(copy, 0),
      true,
    );
    file.flush();
  } catch (error) {
    throw new Error(`MP4 parser rejected output: ${String(error)}`);
  }
  const movie = ready ?? file.getInfo();
  if (errors.length !== 0 || movie.hasMoov === false)
    throw new Error(
      errors.length === 0
        ? "MP4 output has no parsed movie metadata."
        : `MP4 parser rejected output: ${errors.join("; ")}`,
    );
  return { file, movie };
};

const probeVideoTrack = (
  bytes: Uint8Array,
  file: ReturnType<typeof createFile>,
  track: Track,
): IAutoMovieProductionVideoProbe => {
  if (/^(avc1|avc3)(?:\.|$)/i.test(track.codec) === false)
    throw new Error(
      `MP4 video codec "${track.codec}" is not an H.264/AVC sample entry.`,
    );
  if (
    track.video === undefined ||
    track.video.width <= 0 ||
    track.video.height <= 0 ||
    track.timescale <= 0 ||
    track.duration <= 0 ||
    track.nb_samples <= 0
  )
    throw new Error(
      "MP4 video track lacks positive dimensions, duration, timescale, or samples.",
    );
  const samples = verifySampleStorage(bytes, file, track);
  const firstDuration = samples[0]!.duration;
  if (
    firstDuration <= 0 ||
    samples.some((sample) => sample.duration !== firstDuration)
  )
    throw new Error(
      "MP4 video samples do not use one constant deterministic frame duration.",
    );
  const runtimeSeconds = track.duration / track.timescale;
  const fps = track.timescale / firstDuration;
  if (samples.some((sample) => sample.is_sync) === false)
    throw new Error(
      "MP4 video track has no independently decodable sync sample.",
    );
  const ftypBoxes = file.getBoxes("ftyp", false) as Array<
    Box & {
      major_brand: string;
      compatible_brands: string[];
    }
  >;
  if (
    ftypBoxes.length !== 1 ||
    typeof ftypBoxes[0]!.major_brand !== "string" ||
    Array.isArray(ftypBoxes[0]!.compatible_brands) === false ||
    ftypBoxes[0]!.compatible_brands.some(
      (brand) => typeof brand !== "string",
    ) ||
    ftypBoxes[0]!.major_brand.trim().length === 0 ||
    ftypBoxes[0]!.compatible_brands.some((brand) => brand.trim().length === 0)
  )
    throw new Error("MP4 output requires one nonblank file-type brand box.");
  const ftyp = ftypBoxes[0]!;
  const description = samples[0]!.description as unknown as {
    width: number;
    height: number;
    boxes?: Array<{ type?: string } & Record<string, unknown>>;
  };
  if (
    description.width !== track.video.width ||
    description.height !== track.video.height
  )
    throw new Error(
      "MP4 video sample entry raster differs from the parsed video track raster.",
    );
  if (
    samples.some(
      (sample) =>
        sample.timescale !== track.timescale ||
        Number.isSafeInteger(sample.dts) === false ||
        Number.isSafeInteger(sample.cts) === false,
    )
  )
    throw new Error(
      "MP4 video samples do not share one safe integer media clock.",
    );
  const colorBoxes = (description.boxes ?? []).filter(
    (box) => box.type === "colr",
  );
  if (colorBoxes.length > 1)
    throw new Error("MP4 video sample entry contains multiple color boxes.");
  const colorBox = colorBoxes[0] as
    | {
        colour_type: string;
        colour_primaries: number;
        transfer_characteristics: number;
        matrix_coefficients: number;
        full_range_flag: number;
      }
    | undefined;
  const paspBoxes = (description.boxes ?? []).filter(
    (box) => box.type === "pasp",
  ) as Array<{ hSpacing: number; vSpacing: number }>;
  if (paspBoxes.length > 1)
    throw new Error(
      "MP4 video sample entry contains multiple pixel-aspect boxes.",
    );
  if (
    paspBoxes.some(
      (box) =>
        Number.isSafeInteger(box.hSpacing) === false ||
        box.hSpacing <= 0 ||
        Number.isSafeInteger(box.vSpacing) === false ||
        box.vSpacing <= 0,
    )
  )
    throw new Error("MP4 pixel-aspect terms must be positive safe integers.");
  const trackHeaders = file.getBoxes("tkhd", false) as Array<
    Box & {
      track_id: number;
      width: number;
      height: number;
      matrix: number[];
    }
  >;
  const trackHeaderMatches = trackHeaders.filter(
    (header) => header.track_id === track.id,
  );
  if (trackHeaderMatches.length !== 1)
    throw new Error(
      `MP4 video track ${track.id} requires one exact track header.`,
    );
  const trackHeader = trackHeaderMatches[0]!;
  // mp4box materializes the nine fixed-point terms as an Int32Array; a plain
  // array is accepted too so a re-serialized header reads the same way.
  const matrix = isFixedPointMatrix(trackHeader.matrix)
    ? Array.from(trackHeader.matrix)
    : null;
  if (
    Number.isSafeInteger(trackHeader.width) === false ||
    Number.isSafeInteger(trackHeader.height) === false ||
    matrix === null ||
    matrix.length !== 9 ||
    matrix.some((value) => Number.isSafeInteger(value) === false)
  )
    throw new Error(
      `MP4 video track ${track.id} has a malformed fixed-point display transform.`,
    );
  return {
    kind: "video",
    container: "mp4",
    codec: "h264",
    width: track.video.width,
    height: track.video.height,
    runtimeSeconds,
    frameCount: track.nb_samples,
    fps,
    frameRate: canonicalProductionFrameRate({
      numerator: track.timescale,
      denominator: firstDuration,
    }),
    brands: {
      major: ftyp.major_brand,
      compatible: [...ftyp.compatible_brands],
    },
    coded: {
      width: description.width,
      height: description.height,
    },
    trackDisplay: {
      width16_16: trackHeader.width,
      height16_16: trackHeader.height,
    },
    trackMatrix: [
      ...trackHeader.matrix,
    ] as IAutoMovieProductionVideoProbe["trackMatrix"],
    pixelAspect:
      paspBoxes.length === 0
        ? { kind: "implicit-square" }
        : {
            kind: "explicit",
            hSpacing: paspBoxes[0]!.hSpacing,
            vSpacing: paspBoxes[0]!.vSpacing,
          },
    presentation: {
      movieTimescale: track.movie_timescale,
      mediaTimescale: track.timescale,
      movieDuration: track.movie_duration,
      mediaDuration: track.duration,
      edits: (track.edits ?? []).map((edit) => ({
        segmentDuration: edit.segment_duration,
        mediaTime: edit.media_time,
        mediaRateInteger: edit.media_rate_integer,
        mediaRateFraction: edit.media_rate_fraction,
      })),
    },
    samples: {
      count: samples.length,
      duration: firstDuration,
      timescale: track.timescale,
      firstDts: samples[0]!.dts,
      lastDts: samples.at(-1)!.dts,
      firstCts: samples[0]!.cts,
      lastCts: samples.at(-1)!.cts,
    },
    color: {
      container:
        colorBox?.colour_type === "nclx"
          ? {
              kind: "nclx",
              primaries: colorBox.colour_primaries,
              transfer: colorBox.transfer_characteristics,
              matrix: colorBox.matrix_coefficients,
              fullRange: colorBox.full_range_flag === 1,
            }
          : { kind: "absent" },
      resolved:
        colorBox?.colour_type === "nclx" &&
        colorBox.colour_primaries === 1 &&
        colorBox.transfer_characteristics === 13 &&
        colorBox.matrix_coefficients === 1 &&
        colorBox.full_range_flag === 1
          ? { kind: "srgb", source: "container" }
          : { kind: "absent" },
    },
  };
};

/** Whether a parsed track-header matrix is an indexable list of numbers. */
const isFixedPointMatrix = (
  value: unknown,
): value is ArrayLike<number> & Iterable<number> =>
  Array.isArray(value) ||
  (ArrayBuffer.isView(value) && !(value instanceof DataView));

const exactClockProduct = (left: number, right: number): bigint => {
  if (
    Number.isSafeInteger(left) === false ||
    left <= 0 ||
    Number.isSafeInteger(right) === false ||
    right <= 0
  )
    throw new Error("MP4 presentation clocks must be positive safe integers.");
  return BigInt(left) * BigInt(right);
};

const verifySampleStorage = (
  bytes: Uint8Array,
  file: ReturnType<typeof createFile>,
  track: Track,
): ReturnType<ReturnType<typeof createFile>["getTrackSamplesInfo"]> => {
  const samples = file.getTrackSamplesInfo(track.id);
  if (
    samples.length === 0 ||
    samples.length !== track.nb_samples ||
    samples.some(
      (sample) =>
        sample.size <= 0 ||
        sample.offset < 0 ||
        sample.offset + sample.size > bytes.byteLength,
    )
  )
    throw new Error(
      "MP4 sample table does not map every declared sample to non-empty resident bytes.",
    );
  const mediaRanges = file.getBoxes("mdat", false).map((box) => ({
    start: box.start! + box.hdr_size!,
    end: box.start! + box.size,
  }));
  if (
    mediaRanges.length === 0 ||
    samples.some(
      (sample) =>
        mediaRanges.some(
          (range) =>
            sample.offset >= range.start &&
            sample.offset + sample.size <= range.end,
        ) === false,
    )
  )
    throw new Error(
      "MP4 samples are not fully backed by parsed media-data boxes.",
    );
  return samples;
};
