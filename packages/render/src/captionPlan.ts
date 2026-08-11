import { playbackCursor, sequenceTimeline } from "@automovie/engine";
import {
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";

import {
  IAutoMovieCaptionEntry,
  IAutoMovieCaptionSidecar,
} from "./captionSidecar";
import { beatCaptions } from "./screenplay";

/**
 * Plan the caption sidecar: lay the cut onto the output clock
 * ({@link sequenceTimeline}, the same frame-atomic arithmetic the render and
 * chunk plans use), resolve which shot is LIVE at every output frame
 * (transitions hand the frame to the incoming shot, exactly as playback does),
 * group consecutive frames of one shot into spans, and join each span's beat
 * (`shot.id = "shot:" + beat`; an unprefixed id passes through as the beat id)
 * to the screenplay tree's beat node for the caption and the enclosing scene's
 * slug. Treeless scripts caption every span `null`. The sidecar still carries
 * the frame→beat map.
 *
 * Planning only: the host writes the file ({@link renderCaptionSidecar}).
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `planCaptionSidecar` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `planCaptionSidecar` exposes that responsibility through the package-independent system contract.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-boundary-convention Uses start-inclusive, end-exclusive frame spans on the render clock.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time Resolves each output frame at its deterministic global sample time.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule Applies the same frame schedule and direct-seek convention as sequence rendering.
 * @evidenceExclude requirements/delivery-and-accessibility/README.md#전달과-접근성-요구사항 Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-coverage Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-presentation-form Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-reading-overlap Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-refusal Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-style-region Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-subtitle-distinction Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-text-language Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude requirements/rendering/README.md#rendering-요구사항 Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-schedule-audio-cues Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-schedule-refusal Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-shutter-samples Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-state-sampling Caption sidecars map supplied cues to deterministic frames; presentation, completeness, and render-job lifecycle remain outside this planner.
 * @evidenceExclude specifications/editorial-render-and-delivery/README.md#editorial-render와-delivery-system-specifications Caption sidecars serialize deterministic cue timing; render budgets, artifact lifecycle, and headless execution remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Caption sidecars serialize deterministic cue timing; render budgets, artifact lifecycle, and headless execution remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Caption sidecars serialize deterministic cue timing; render budgets, artifact lifecycle, and headless execution remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Caption sidecars serialize deterministic cue timing; render budgets, artifact lifecycle, and headless execution remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform Caption sidecars serialize deterministic cue timing; render budgets, artifact lifecycle, and headless execution remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Caption sidecars serialize deterministic cue timing; render budgets, artifact lifecycle, and headless execution remain separate.
 * @author Samchon
 */
export const planCaptionSidecar = (props: {
  /** The script whose tree carries captions and slugs. */
  script: IAutoMovieScript;
  /** The cut being rendered. */
  sequence: IAutoMovieSequence;
  /** The shots the cut references. */
  shots: IAutoMovieShot[];
  /** Output frames per second (the render clock, not necessarily sequence.fps). */
  fps: number;
}): IAutoMovieCaptionSidecar => {
  const { script, sequence, shots, fps } = props;
  if (!Number.isFinite(fps) || fps <= 0)
    throw new Error(`fps must be a finite number > 0, but was ${fps}`);

  const timeline = sequenceTimeline(sequence, shots);
  const frameCount = Math.round(timeline.runtime * fps);
  // Match planSequenceRender's zero-frame policy: a degenerate runtime that
  // rounds to no output frames is an error on both the render and the caption
  // side, so a host never gets a render throw beside a silently-empty sidecar.
  if (frameCount === 0)
    throw new Error(
      `planCaptionSidecar requires at least one frame; fps ${fps} and duration ${timeline.runtime} produced zero frames`,
    );
  const captions = beatCaptions(script);

  const cursor = playbackCursor(sequence, timeline);
  const frameBeats = Array.from({ length: frameCount }, (_, frame) =>
    beatOf(cursor(frame / fps).shot),
  );
  const entries = groupSpans(frameBeats).map((span): IAutoMovieCaptionEntry => {
    const authored = captions.get(span.beat);
    return {
      ...span,
      caption: authored?.caption ?? null,
      slug: authored?.slug ?? null,
    };
  });

  return { target: sequence.id, fps, frameCount, entries };
};

/** Group consecutive frames of one beat into `[frameStart, frameEnd)` spans. */
const groupSpans = (
  beats: readonly string[],
): Array<{ frameStart: number; frameEnd: number; beat: string }> => {
  const spans: Array<{ frameStart: number; frameEnd: number; beat: string }> =
    [];
  beats.forEach((beat, frame) => {
    const last = spans[spans.length - 1];
    if (last !== undefined && last.beat === beat) {
      last.frameEnd = frame + 1;
      return;
    }
    spans.push({ frameStart: frame, frameEnd: frame + 1, beat });
  });
  return spans;
};

/** `shot:duel` → `duel`; an unprefixed id is already the beat id. */
const beatOf = (shotId: string): string =>
  shotId.startsWith("shot:") ? shotId.slice("shot:".length) : shotId;
