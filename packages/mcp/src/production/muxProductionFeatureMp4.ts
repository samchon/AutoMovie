import type { IAutoMovieFilmTimeline } from "@automovie/interface";
import {
  IsoFileOptions,
  MP4BoxBuffer,
  Movie,
  Sample,
  Track,
  boxEqual,
  createFile,
} from "mp4box";

import { probeProductionMedia } from "./probeProductionMedia";
import { trimProductionAudioPresentation } from "./trimProductionAudioPresentation";

/** Mux one parser-verified H.264 stream and one exact-runtime audio stream. */
export const muxProductionFeatureMp4 = (props: {
  video: Uint8Array;
  audio: Uint8Array;
}): Uint8Array => {
  const videoProbe = probeProductionMedia({
    kind: "guide-pass",
    mediaType: "video/mp4",
    bytes: props.video,
  });
  const audioProbe = probeProductionMedia({
    kind: "audio-mix",
    mediaType: "audio/mp4",
    bytes: props.audio,
  });
  const video = parseMp4(props.video);
  const audio = parseMp4(props.audio);
  const videoTrack = video.movie.videoTracks[0]!;
  const audioTrack = audio.movie.audioTracks[0]!;
  if (
    videoProbe.kind !== "video" ||
    audioProbe.kind !== "audio" ||
    videoProbe.runtimeSeconds !== audioProbe.runtimeSeconds
  )
    throw new Error(
      "Feature mux requires byte sources with exactly equal track runtimes.",
    );
  const output = createFile();
  output.init({
    brands: ["isom", "iso2", "mp41", "Opus"],
    timescale: videoTrack.timescale,
    duration: videoTrack.duration,
  });
  copyTrack({
    output,
    source: video.file,
    bytes: props.video,
    track: videoTrack,
    name: "AutoMovie H.264 feature",
  });
  const outputAudioTrack = copyTrack({
    output,
    source: audio.file,
    bytes: props.audio,
    track: audioTrack,
    name: "AutoMovie deterministic mix",
  });
  trimProductionAudioPresentation({
    file: output,
    track: outputAudioTrack,
    mediaTimescale: audioTrack.timescale,
    movieTimescale: videoTrack.timescale,
    primingSamples: audioProbe.primingSamples,
    presentationSamples: Math.round(
      audioProbe.runtimeSeconds * audioProbe.sampleRate,
    ),
  });
  const bytes = new Uint8Array(output.getBuffer().buffer);
  probeProductionMedia({
    kind: "feature",
    mediaType: "video/mp4",
    bytes,
  });
  return bytes;
};

/**
 * Conform immutable per-shot repaint clips into the current cut-only timeline.
 *
 * Repaint delivery deliberately refuses transitions, trims, reordered samples,
 * and changing codec configuration: silently falling back to deterministic
 * pixels would misrepresent the selected product.
 */
export const conformProductionRenditionVideoMp4 = (props: {
  timeline: IAutoMovieFilmTimeline;
  clips: ReadonlyMap<string, Uint8Array>;
}): Uint8Array => {
  const parsed = props.timeline.segments.map((segment) => {
    if (
      segment.transitionIn.kind !== "cut" ||
      segment.transitionOut.kind !== "cut"
    )
      throw new Error(
        `Repainted feature delivery currently requires cut-only editing; shot "${segment.shot}" declares a transition.`,
      );
    const bytes = props.clips.get(segment.shot);
    if (bytes === undefined)
      throw new Error(
        `Repainted feature delivery is missing the current clip for shot "${segment.shot}".`,
      );
    const probe = probeProductionMedia({
      kind: "guide-pass",
      mediaType: "video/mp4",
      bytes,
    });
    const mp4 = parseMp4(bytes);
    const track = mp4.movie.videoTracks[0];
    const samples =
      track === undefined ? [] : mp4.file.getTrackSamplesInfo(track.id);
    if (
      probe.kind !== "video" ||
      track === undefined ||
      samples.length !== probe.frameCount ||
      segment.sourceInFrame !== 0 ||
      segment.sourceOutFrame !== probe.frameCount ||
      segment.endFrame - segment.startFrame !== probe.frameCount ||
      Math.abs(probe.fps - props.timeline.fps) > 1e-9
    )
      throw new Error(
        `Repainted feature delivery requires one full-shot ${props.timeline.fps}fps clip for segment "${segment.shot}"; partial trims and mismatched media are not representable yet.`,
      );
    if (
      samples[0]?.is_sync !== true ||
      samples.some((sample) => sample.cts !== sample.dts)
    )
      throw new Error(
        `Repaint clip "${segment.shot}" must begin on a sync sample and use presentation-order H.264 samples.`,
      );
    return { segment, bytes, probe, mp4, track, samples };
  });
  const first = parsed[0];
  if (first === undefined)
    throw new Error(
      "Repainted feature delivery requires a non-empty timeline.",
    );
  const description = sampleDescription(first.samples[0]!);
  for (const clip of parsed)
    if (
      clip.probe.kind !== "video" ||
      clip.probe.width !== first.probe.width ||
      clip.probe.height !== first.probe.height ||
      sameSampleDescription(
        description,
        sampleDescription(clip.samples[0]!),
      ) === false
    )
      throw new Error(
        `Repaint clip "${clip.segment.shot}" changes dimensions or H.264 decoder configuration within the feature.`,
      );
  const output = createFile();
  output.init({
    brands: ["isom", "iso2", "mp41"],
    timescale: props.timeline.fps,
    duration: props.timeline.totalFrames,
  });
  const trackId = output.addTrack({
    type: description.type,
    hdlr: "vide",
    name: "AutoMovie receipt-bound repaint feature",
    timescale: props.timeline.fps,
    media_duration: props.timeline.totalFrames,
    duration: props.timeline.totalFrames,
    width: first.probe.width,
    height: first.probe.height,
    language: first.track.language,
    description_boxes: description.boxes,
  });
  let frame = 0;
  for (const clip of parsed)
    for (const sample of clip.samples) {
      output.addSample(
        trackId,
        Uint8Array.from(
          clip.bytes.subarray(sample.offset, sample.offset + sample.size),
        ),
        {
          ...sampleOptions(sample),
          duration: 1,
          cts: frame,
          dts: frame,
        },
      );
      ++frame;
    }
  if (frame !== props.timeline.totalFrames)
    throw new Error(
      "Repaint clip samples do not cover the exact current film timeline.",
    );
  const bytes = new Uint8Array(output.getBuffer().buffer);
  const probe = probeProductionMedia({
    kind: "guide-pass",
    mediaType: "video/mp4",
    bytes,
  });
  if (
    probe.kind !== "video" ||
    probe.frameCount !== props.timeline.totalFrames ||
    Math.abs(probe.fps - props.timeline.fps) > 1e-9
  )
    throw new Error(
      "Conformed repaint video failed exact parser verification.",
    );
  return bytes;
};

/** Prove a muxed feature carries exactly the selected rendition video samples. */
export const assertProductionFeatureUsesRenditionVideo = (props: {
  feature: Uint8Array;
  renditionVideo: Uint8Array;
}): void => {
  const actual = parseMp4(props.feature);
  const expected = parseMp4(props.renditionVideo);
  const actualTrack = actual.movie.videoTracks[0];
  const expectedTrack = expected.movie.videoTracks[0];
  if (actualTrack === undefined || expectedTrack === undefined)
    throw new Error(
      "Rendition delivery proof requires one feature video track.",
    );
  const actualSamples = actual.file.getTrackSamplesInfo(actualTrack.id);
  const expectedSamples = expected.file.getTrackSamplesInfo(expectedTrack.id);
  if (
    actualSamples.length !== expectedSamples.length ||
    actualSamples.length === 0 ||
    sameSampleDescription(
      sampleDescription(actualSamples[0]!),
      sampleDescription(expectedSamples[0]!),
    ) === false
  )
    throw new Error(
      "Feature video track does not match the selected rendition track.",
    );
  for (let index = 0; index < actualSamples.length; ++index) {
    const left = actualSamples[index]!;
    const right = expectedSamples[index]!;
    const leftBytes = props.feature.subarray(
      left.offset,
      left.offset + left.size,
    );
    const rightBytes = props.renditionVideo.subarray(
      right.offset,
      right.offset + right.size,
    );
    if (
      leftBytes.length !== rightBytes.length ||
      leftBytes.some((value, offset) => value !== rightBytes[offset])
    )
      throw new Error(
        `Feature video sample ${index} differs from the selected rendition.`,
      );
  }
};

const sampleDescription = (
  sample: Sample,
): {
  type: IsoFileOptions["type"];
  boxes: NonNullable<IsoFileOptions["description_boxes"]>;
} => {
  const description = sample.description as {
    type: IsoFileOptions["type"];
    boxes?: IsoFileOptions["description_boxes"];
  };
  return { type: description.type, boxes: description.boxes ?? [] };
};

const sameSampleDescription = (
  left: ReturnType<typeof sampleDescription>,
  right: ReturnType<typeof sampleDescription>,
): boolean =>
  left.type === right.type &&
  left.boxes.length === right.boxes.length &&
  left.boxes.every((box, index) => boxEqual(box, right.boxes[index]!));

const copyTrack = (props: {
  output: ReturnType<typeof createFile>;
  source: ReturnType<typeof createFile>;
  bytes: Uint8Array;
  track: Track;
  name: string;
}): number => {
  const samples = props.source.getTrackSamplesInfo(props.track.id);
  const description = samples[0]!.description as {
    type: IsoFileOptions["type"];
    boxes?: IsoFileOptions["description_boxes"];
  };
  const options: IsoFileOptions = {
    type: description.type,
    hdlr: props.track.type === "audio" ? "soun" : "vide",
    name: props.name,
    timescale: props.track.timescale,
    media_duration: props.track.duration,
    duration: props.track.duration,
    language: props.track.language,
    description_boxes: description.boxes ?? [],
  };
  if (props.track.video !== undefined) {
    options.width = props.track.video.width;
    options.height = props.track.video.height;
  }
  if (props.track.audio !== undefined) {
    options.samplerate = props.track.audio.sample_rate;
    options.channel_count = props.track.audio.channel_count;
    options.samplesize = props.track.audio.sample_size;
  }
  const id = props.output.addTrack(options);
  for (const sample of samples)
    props.output.addSample(
      id,
      Uint8Array.from(
        props.bytes.subarray(sample.offset, sample.offset + sample.size),
      ),
      sampleOptions(sample),
    );
  return id;
};

const sampleOptions = (
  sample: Sample,
): NonNullable<Parameters<ReturnType<typeof createFile>["addSample"]>[2]> => ({
  duration: sample.duration,
  cts: sample.cts,
  dts: sample.dts,
  is_sync: sample.is_sync,
  is_leading: sample.is_leading,
  depends_on: sample.depends_on,
  is_depended_on: sample.is_depended_on,
  has_redundancy: sample.has_redundancy,
  degradation_priority: sample.degradation_priority,
  subsamples: sample.subsamples,
});

const parseMp4 = (
  bytes: Uint8Array,
): { file: ReturnType<typeof createFile>; movie: Movie } => {
  const file = createFile();
  let movie: Movie | null = null;
  const errors: string[] = [];
  file.onReady = (value) => {
    movie = value;
  };
  file.onError = (module, message) => {
    errors.push(`${module}: ${message}`);
  };
  file.appendBuffer(
    MP4BoxBuffer.fromArrayBuffer(Uint8Array.from(bytes).buffer, 0),
    true,
  );
  file.flush();
  if (errors.length !== 0)
    throw new Error(`MP4 parser rejected mux input: ${errors.join("; ")}`);
  return { file, movie: movie ?? file.getInfo() };
};
