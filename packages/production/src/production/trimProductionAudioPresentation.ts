import type { createFile } from "mp4box";

import { residentMp4Box } from "./residentCodecs";

/**
 * Add one ISO edit that removes Opus encoder priming and tail padding while
 * retaining the real duration of every coded packet.
 */
export const trimProductionAudioPresentation = (props: {
  file: ReturnType<typeof createFile>;
  track: number;
  mediaTimescale: number;
  movieTimescale: number;
  primingSamples: number;
  presentationSamples: number;
}): void => {
  const values = [
    props.track,
    props.mediaTimescale,
    props.movieTimescale,
    props.presentationSamples,
  ];
  if (
    values.some(
      (value) => Number.isSafeInteger(value) === false || value <= 0,
    ) ||
    Number.isSafeInteger(props.primingSamples) === false ||
    props.primingSamples < 0
  )
    throw new Error("Audio presentation trim requires finite sample counts.");
  const segmentDuration =
    (props.presentationSamples * props.movieTimescale) / props.mediaTimescale;
  if (Number.isSafeInteger(segmentDuration) === false)
    throw new Error(
      "Audio presentation duration does not land on the movie timescale.",
    );
  const track = props.file.getTrackById(props.track);
  if (track === undefined)
    throw new Error("Audio presentation trim requires an existing track.");
  if (track.edts !== undefined)
    throw new Error("Audio track already has an edit list.");
  const movieHeader = props.file.getBox("mvhd") as
    | { duration: number }
    | undefined;
  if (movieHeader === undefined)
    throw new Error("Audio presentation trim requires a movie header.");
  const boxes = residentMp4Box().BoxParser;
  const edit = track.addBox(new boxes.box.edts());
  const list = edit.addBox(new boxes.box.elst());
  list.entries = [
    {
      segment_duration: segmentDuration,
      media_time: props.primingSamples,
      media_rate_integer: 1,
      media_rate_fraction: 0,
    },
  ];
  track.tkhd.duration = segmentDuration;
  movieHeader.duration = segmentDuration;
};
