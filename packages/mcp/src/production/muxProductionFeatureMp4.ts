import {
  IsoFileOptions,
  MP4BoxBuffer,
  Movie,
  Sample,
  Track,
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
