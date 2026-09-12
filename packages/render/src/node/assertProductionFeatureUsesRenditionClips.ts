import type { IAutoMovieFilmTimeline } from "@automovie/interface";
import type { Sample } from "mp4box";

import { neutralTrackPresentation } from "./neutralTrackPresentation";
import { parseMp4 } from "./parseMp4";
import { productionRenditionVideoPlan } from "./productionRenditionVideoPlan";
import { sameSampleDescription } from "./sameSampleDescription";
import { sameSampleFlags } from "./sameSampleFlags";
import { sampleDescription } from "./sampleDescription";

/**
 * Prove a feature directly against immutable repaint clips without rebuilding
 * the expected full-length video in memory.
 */
export const assertProductionFeatureUsesRenditionClips = (props: {
  feature: Uint8Array;
  timeline: IAutoMovieFilmTimeline;
  clips: ReadonlyMap<string, Uint8Array>;
}): void => {
  const plan = productionRenditionVideoPlan(props);
  const actual = parseMp4(props.feature);
  const track = actual.movie.videoTracks[0];
  const samples =
    track === undefined ? [] : actual.file.getTrackSamplesInfo(track.id);
  if (
    track === undefined ||
    track.timescale !== plan.first.track.timescale ||
    track.duration !== plan.mediaDuration ||
    track.movie_timescale !== plan.first.track.timescale ||
    track.movie_duration !== plan.mediaDuration ||
    track.video?.width !== plan.first.probe.width ||
    track.video?.height !== plan.first.probe.height ||
    track.track_width !== plan.first.probe.width ||
    track.track_height !== plan.first.probe.height ||
    samples.length !== props.timeline.totalFrames ||
    neutralTrackPresentation(track, 0) === false
  )
    throw new Error(
      "Feature video presentation does not match the selected repaint timeline.",
    );
  let index = 0;
  for (const clip of plan.parsed) {
    const clipStart = index;
    for (const source of clip.samples) {
      const actualSample = samples[index];
      if (actualSample === undefined)
        throw new Error("Feature video omits a selected repaint sample.");
      const dtsFrame = source.dts / clip.sampleDuration;
      const ctsFrame =
        (source.cts - clip.presentationStart) / clip.sampleDuration;
      const sourceBytes = clip.bytes.subarray(
        source.offset,
        source.offset + source.size,
      );
      const actualBytes = props.feature.subarray(
        actualSample.offset,
        actualSample.offset + actualSample.size,
      );
      if (
        actualSample.duration !== plan.sampleDuration ||
        actualSample.dts !== (clipStart + dtsFrame) * plan.sampleDuration ||
        actualSample.cts !== (clipStart + ctsFrame) * plan.sampleDuration ||
        sameSampleFlags(actualSample, source) === false ||
        sameSampleDescription(
          sampleDescription(actualSample),
          plan.description,
        ) === false ||
        actualBytes.length !== sourceBytes.length ||
        actualBytes.some((value, offset) => value !== sourceBytes[offset])
      )
        throw new Error(
          `Feature video sample ${index} differs from the selected repaint timeline:\n${JSON.stringify(
            {
              timing: {
                actual: {
                  duration: actualSample.duration,
                  dts: actualSample.dts,
                  cts: actualSample.cts,
                },
                expected: {
                  duration: plan.sampleDuration,
                  dts: (clipStart + dtsFrame) * plan.sampleDuration,
                  cts: (clipStart + ctsFrame) * plan.sampleDuration,
                },
              },
              flags: {
                actual: sampleFlagRecord(actualSample),
                expected: sampleFlagRecord(source),
                match: sameSampleFlags(actualSample, source),
              },
              sampleDescriptionMatches: sameSampleDescription(
                sampleDescription(actualSample),
                plan.description,
              ),
              payload: {
                actualBytes: actualBytes.length,
                expectedBytes: sourceBytes.length,
                firstDifferingActualByte: actualBytes.findIndex(
                  (value, byte) => value !== sourceBytes[byte],
                ),
              },
            },
            null,
            2,
          )}`,
        );
      ++index;
    }
  }
};

/** Bounded parser-visible flag evidence for one failed sample comparison. */
const sampleFlagRecord = (sample: Sample) => ({
  isSync: sample.is_sync,
  isLeading: sample.is_leading,
  dependsOn: sample.depends_on,
  isDependedOn: sample.is_depended_on,
  hasRedundancy: sample.has_redundancy,
  degradationPriority: sample.degradation_priority,
});
