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
 * ({@link sequenceTimeline} — the same frame-atomic arithmetic the render and
 * chunk plans use), resolve which shot is LIVE at every output frame
 * (transitions hand the frame to the incoming shot, exactly as playback does),
 * group consecutive frames of one shot into spans, and join each span's beat
 * (`shot.id = "shot:" + beat`; an unprefixed id passes through as the beat id)
 * to the screenplay tree's beat node for the caption and the enclosing scene's
 * slug. Treeless scripts caption every span `null` — the sidecar still carries
 * the frame→beat map.
 *
 * Planning only: the host writes the file ({@link renderCaptionSidecar}).
 *
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
