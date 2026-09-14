import type { IAutoMovieProductionMediaProbe } from "@automovie/interface";
import type { Movie, createFile } from "mp4box";

import { probeVideoTrack } from "./probeVideoTrack";

/**
 * Probe one already-parsed MP4 as a single-track H.264 video.
 *
 * The rendered-media probe's guide-pass arm and the standalone video probe need
 * the same single-video-single-track refusals and differ only in whether the
 * caller has already parsed the bytes, so the parsed form is the shared one.
 */
export const probeParsedProductionVideoMp4 = (
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
