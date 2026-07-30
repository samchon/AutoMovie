import {
  IAutoMovieProductionDeliverable,
  IAutoMovieProductionMediaProbe,
} from "@automovie/interface";
import { MP4BoxBuffer, Movie, Track, createFile } from "mp4box";
import { TextDecoder } from "node:util";
import { PNG } from "pngjs";

/** Parse renderer-owned bytes instead of trusting manifest media claims. */
export const probeProductionMedia = (props: {
  kind: IAutoMovieProductionDeliverable["kind"];
  mediaType: string;
  bytes: Uint8Array;
}): IAutoMovieProductionMediaProbe => {
  if (
    props.kind === "preview" ||
    (props.kind === "guide-pass" && props.mediaType === "image/png")
  ) {
    if (props.mediaType !== "image/png")
      throw new Error(
        `${props.kind} output declares "${props.mediaType}", but this image requires image/png bytes.`,
      );
    const png = PNG.sync.read(Buffer.from(props.bytes));
    return { kind: "png", width: png.width, height: png.height };
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
    const cues: Array<{ start: number; end: number }> = [];
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
      const cue = parseWebVttCue(lines[timingIndex]!);
      const payload = lines.slice(timingIndex + 1);
      if (payload.some((line) => line.includes("-->")))
        throw new Error(
          `WebVTT cue ${cues.length + 1} contains another timing line without a blank separator. Separate every cue block.`,
        );
      if (payload.some((line) => line.trim().length > 0) === false)
        throw new Error(
          `WebVTT cue ${cues.length + 1} has no non-empty payload. Add observable caption text after its timing line.`,
        );
      cues.push(cue);
    }
    if (cues.length === 0)
      throw new Error(
        "WebVTT captions contain no timed cue. Add at least one observable cue or do not declare this deliverable required.",
      );
    for (let index = 0; index < cues.length; ++index) {
      const cue = cues[index]!;
      if (cue.start >= cue.end)
        throw new Error(
          `WebVTT cue ${index + 1} must end after it starts. Correct the cue timing.`,
        );
      if (index > 0 && cue.start < cues[index - 1]!.start)
        throw new Error(
          `WebVTT cue ${index + 1} starts before the preceding cue. Keep deterministic cue order.`,
        );
    }
    return {
      kind: "webvtt",
      cueCount: cues.length,
      firstCueSeconds: cues[0]!.start,
      lastCueSeconds: cues.reduce(
        (latest, cue) => Math.max(latest, cue.end),
        0,
      ),
    };
  }
  const parsed = parseMp4(props.bytes);
  const movie = parsed.movie;
  if (props.kind === "feature" || props.kind === "guide-pass") {
    if (props.mediaType !== "video/mp4")
      throw new Error(
        `${props.kind} output declares "${props.mediaType}", but encoded video deliverables require video/mp4 bytes.`,
      );
    if (movie.videoTracks.length !== 1)
      throw new Error(
        `MP4 contains ${movie.videoTracks.length} video tracks; exactly one is required.`,
      );
    return probeVideoTrack(props.bytes, parsed.file, movie.videoTracks[0]!);
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
  const track = movie.audioTracks[0]!;
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
  verifySampleStorage(props.bytes, parsed.file, track);
  return {
    kind: "audio",
    container: "mp4",
    codec: track.codec,
    runtimeSeconds: track.duration / track.timescale,
    channels: audio.channel_count,
    sampleRate: audio.sample_rate,
  };
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
    start: webVttTimestampSeconds(match[1]!),
    end: webVttTimestampSeconds(match[2]!),
  };
};

const webVttTimestampSeconds = (value: string): number => {
  const parts = value.split(":");
  const seconds = Number(parts.pop()!);
  const minutes = Number(parts.pop()!);
  const hours = parts.length === 0 ? 0 : Number(parts.pop()!);
  return hours * 3_600 + minutes * 60 + seconds;
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
  const file = createFile();
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
    file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(copy, 0), true);
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
): IAutoMovieProductionMediaProbe => {
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
  return {
    kind: "video",
    container: "mp4",
    codec: "h264",
    width: track.video.width,
    height: track.video.height,
    runtimeSeconds,
    frameCount: track.nb_samples,
    fps,
  };
};

const verifySampleStorage = (
  bytes: Uint8Array,
  file: ReturnType<typeof createFile>,
  track: Track,
): ReturnType<ReturnType<typeof createFile>["getTrackSamplesInfo"]> => {
  const samples = file.getTrackSamplesInfo(track.id);
  if (
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
