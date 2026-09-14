import type { IAutoMovieProductionMediaProbe } from "@automovie/interface";
import type { IsoFileOptions, Track, createFile } from "mp4box";

import { exactProductionClockProduct } from "./exactProductionClockProduct";
import { parseMp4 } from "./parseMp4";
import { probeProductionRenderedMedia } from "./probeProductionRenderedMedia";
import { probeProductionVideoMp4 } from "./probeProductionVideoMp4";
import { residentMp4Box } from "./residentMp4Box";
import { sampleOptions } from "./sampleOptions";
import { trimProductionAudioPresentation } from "./trimProductionAudioPresentation";

/**
 * Mux one parser-verified H.264 stream and one exact-runtime audio stream.
 */
export const muxProductionFeatureMp4 = (props: {
  video: Uint8Array;
  audio: Uint8Array;
}): Uint8Array => {
  const videoProbe = probeProductionVideoMp4(props.video);
  // An audio-mix probe resolves to an audio probe or throws, so the union is
  // narrowed here instead of being re-checked after the fact.
  const audioProbe = probeProductionRenderedMedia({
    kind: "audio-mix",
    mediaType: "audio/mp4",
    bytes: props.audio,
  }) as Extract<IAutoMovieProductionMediaProbe, { kind: "audio" }>;
  const video = parseMp4(props.video);
  const audio = parseMp4(props.audio);
  const videoTrack = video.movie.videoTracks[0]!;
  const audioTrack = audio.movie.audioTracks[0]!;
  if (
    exactProductionClockProduct(
      videoProbe.presentation.movieDuration,
      audioProbe.timebase.movieTimescale,
    ) !==
    exactProductionClockProduct(
      audioProbe.timebase.movieDuration,
      videoProbe.presentation.movieTimescale,
    )
  )
    throw new Error(
      "Feature mux requires byte sources with exactly equal track runtimes.",
    );
  const presentationSamples = exactPresentationTicks(
    audioProbe.timebase.movieDuration,
    audioProbe.timebase.movieTimescale,
    audioProbe.sampleRate,
  );
  const output = residentMp4Box().createFile();
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
    presentationSamples,
  });
  const bytes = new Uint8Array(output.getBuffer().buffer);
  probeProductionRenderedMedia({
    kind: "feature",
    mediaType: "video/mp4",
    bytes,
  });
  return bytes;
};

/**
 * The audio presentation length in 48 kHz samples.
 *
 * The audio-mix probe's Opus profile assertion already proved this presentation
 * an exact safe-integer sample count on its 48 kHz clock, and the runtime
 * comparison proved the movie timescale a positive safe integer, so the exact
 * division needs no second verdict here.
 */
const exactPresentationTicks = (
  duration: number,
  timescale: number,
  destinationTimescale: number,
): number =>
  Number(
    exactProductionClockProduct(duration, destinationTimescale) /
      BigInt(timescale),
  );

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
