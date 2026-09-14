import type {
  IAutoMovieProductionAudioProbe,
  IAutoMovieProductionDeliverable,
  IAutoMovieProductionMediaProbe,
} from "@automovie/interface";
import type { Movie, Track, createFile } from "mp4box";
import { TextDecoder } from "node:util";

import { assertProductionOpusProfile } from "../delivery/assertProductionOpusProfile";
import { productionOpusDescription } from "../delivery/productionOpusDescription";
import { exactProductionClockProduct } from "./exactProductionClockProduct";
import { parseProductionMp4Output } from "./parseProductionMp4Output";
import { probeParsedProductionVideoMp4 } from "./probeParsedProductionVideoMp4";
import { probeProductionPngPicture } from "./probeProductionPngPicture";
import { probeVideoTrack } from "./probeVideoTrack";
import { verifySampleStorage } from "./verifySampleStorage";

/**
 * Parse renderer-encoded picture, caption and MP4 bytes instead of trusting
 * manifest media claims.
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-partial-container Reports a container that opens but lacks a required stream or fact as a refusal rather than as delivered media.
 */
export const probeProductionRenderedMedia = (props: {
  kind: IAutoMovieProductionDeliverable["kind"];
  mediaType: string;
  bytes: Uint8Array;
}): Exclude<
  IAutoMovieProductionMediaProbe,
  { kind: "semantic-mask" | "sound-evidence" }
> => {
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
  const parsed = parseProductionMp4Output(props.bytes);
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
      exactProductionClockProduct(
        video.presentation.movieDuration,
        audio.timebase.movieTimescale,
      ) !==
      exactProductionClockProduct(
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
  // The cue-timing pattern admitted exactly this shape, so the match holds.
  const match = /^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/u.exec(value)!;
  const hours = match[1] === undefined ? 0 : Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);
  return ((hours * 60 + minutes) * 60 + seconds) * 1_000 + milliseconds;
};
