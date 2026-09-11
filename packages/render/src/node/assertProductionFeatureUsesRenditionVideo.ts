import type { Sample, Track } from "mp4box";

import { parseMp4 } from "./parseMp4";
import { sameSampleDescription } from "./sameSampleDescription";
import { sameSampleFlags } from "./sameSampleFlags";
import { sampleDescription } from "./sampleDescription";

/**
 * Prove a muxed feature carries exactly the selected rendition video samples.
 */
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
    actualTrack.timescale !== expectedTrack.timescale ||
    actualTrack.duration !== expectedTrack.duration ||
    actualTrack.movie_timescale !== expectedTrack.movie_timescale ||
    actualTrack.movie_duration !== expectedTrack.movie_duration ||
    sameTrackPresentation(actualTrack, expectedTrack) === false ||
    actualTrack.video?.width !== expectedTrack.video?.width ||
    actualTrack.video?.height !== expectedTrack.video?.height ||
    actualTrack.track_width !== expectedTrack.track_width ||
    actualTrack.track_height !== expectedTrack.track_height ||
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
      sameSampleTiming(left, right) === false ||
      sameSampleDescription(
        sampleDescription(left),
        sampleDescription(right),
      ) === false ||
      leftBytes.length !== rightBytes.length ||
      leftBytes.some((value, offset) => value !== rightBytes[offset])
    )
      throw new Error(
        `Feature video sample ${index} differs from the selected rendition.`,
      );
  }
};

const sameTrackPresentation = (left: Track, right: Track): boolean =>
  Array.from(left.matrix).every(
    (value, index) => value === Array.from(right.matrix)[index],
  ) && JSON.stringify(left.edits ?? []) === JSON.stringify(right.edits ?? []);

const sameSampleTiming = (left: Sample, right: Sample): boolean =>
  left.duration === right.duration &&
  left.cts === right.cts &&
  left.dts === right.dts &&
  sameSampleFlags(left, right);
