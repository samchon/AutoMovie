import {
  equalProductionFrameRates,
  resolveProductionFrameRate,
} from "@automovie/engine";
import type { IAutoMovieFilmTimeline } from "@automovie/interface";

import { parseProductionRenditionClip } from "./parseProductionRenditionClip";
import { sameSampleDescription } from "./sameSampleDescription";
import { sampleDescription } from "./sampleDescription";

/**
 * Resolve one film's repaint clips into an ordered, continuous splice plan.
 *
 * The conform writer and the feature proof must agree exactly on the parsed
 * clips, the shared presentation, the sample duration and the media duration, so
 * they read one plan rather than recomputing it twice.
 */
export const productionRenditionVideoPlan = (props: {
  timeline: IAutoMovieFilmTimeline;
  clips: ReadonlyMap<string, Uint8Array>;
}) => {
  const frameRate = resolveProductionFrameRate(props.timeline);
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
    const clip = parseProductionRenditionClip(
      bytes,
      `Repaint clip "${segment.shot}"`,
    );
    if (
      segment.sourceInFrame !== 0 ||
      segment.sourceOutFrame !== clip.probe.frameCount ||
      segment.endFrame - segment.startFrame !== clip.probe.frameCount ||
      equalProductionFrameRates(clip.probe.frameRate, frameRate) === false
    )
      throw new Error(
        `Repainted feature delivery requires one full-shot ${props.timeline.fps}fps clip for segment "${segment.shot}"; partial trims and mismatched media are not representable yet.`,
      );
    return { segment, ...clip };
  });
  const first = parsed[0];
  if (first === undefined)
    throw new Error(
      "Repainted feature delivery requires a non-empty timeline.",
    );
  const description = sampleDescription(first.samples[0]!);
  let nextFrame = 0;
  for (const clip of parsed) {
    if (clip.segment.startFrame !== nextFrame)
      throw new Error(
        `Repaint clip "${clip.segment.shot}" does not begin at the next continuous film frame.`,
      );
    if (
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
    nextFrame = clip.segment.endFrame;
  }
  if (nextFrame !== props.timeline.totalFrames)
    throw new Error(
      "Repaint clips do not cover one continuous current film timeline.",
    );
  const sampleDuration = first.samples[0]!.duration;
  const mediaDuration = props.timeline.totalFrames * sampleDuration;
  if (Number.isSafeInteger(mediaDuration) === false)
    throw new Error(
      "Repainted feature duration exceeds the exact MP4 clock range.",
    );
  return { parsed, first, description, sampleDuration, mediaDuration };
};
