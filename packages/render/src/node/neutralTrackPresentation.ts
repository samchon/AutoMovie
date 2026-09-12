import type { Track } from "mp4box";

import { AUTOMOVIE_MP4_UNITY_MATRIX } from "./AUTOMOVIE_MP4_UNITY_MATRIX";
import { equalRational } from "./equalRational";

/**
 * Whether a track presents its media untransformed.
 *
 * The ISO unity display matrix, a movie duration equal to the media duration
 * across both clocks, and either no edit list or one full-length edit at the
 * clip's presentation origin are what a splice may join; anything else would
 * change reviewed pixels or reviewed timing.
 */
export const neutralTrackPresentation = (
  track: Track,
  presentationStart: number,
): boolean => {
  if (
    Array.from(track.matrix).some(
      (value, index) => value !== AUTOMOVIE_MP4_UNITY_MATRIX[index],
    ) ||
    Number.isSafeInteger(track.movie_timescale) === false ||
    Number.isSafeInteger(track.movie_duration) === false ||
    track.movie_timescale <= 0 ||
    equalRational(
      track.movie_duration,
      track.movie_timescale,
      track.duration,
      track.timescale,
    ) === false
  )
    return false;
  const edits = track.edits ?? [];
  return (
    (edits.length === 0 && presentationStart === 0) ||
    (edits.length === 1 &&
      edits[0]!.media_time === presentationStart &&
      edits[0]!.media_rate_integer === 1 &&
      edits[0]!.media_rate_fraction === 0 &&
      equalRational(
        edits[0]!.segment_duration,
        track.movie_timescale,
        track.duration,
        track.timescale,
      ))
  );
};
