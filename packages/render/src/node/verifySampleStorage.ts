import type { Track, createFile } from "mp4box";

/**
 * Prove every declared sample maps onto resident bytes inside a parsed media box.
 *
 * The video and audio readings both depend on it, because a sample table that
 * points outside the file, or at nothing, would otherwise be reported as
 * delivered media.
 */
export const verifySampleStorage = (
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
