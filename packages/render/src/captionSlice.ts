import {
  IAutoMovieCaptionEntry,
  IAutoMovieCaptionSidecar,
} from "./captionSidecar";

/**
 * Slice the sidecar to one chunk's window `[frameStart, frameEnd)`: the caption
 * mirror of `planChunkedSequenceRender`'s frame-atomic rule: entries clipped to
 * the window and re-based to chunk-local frame indices, so every chunk's render
 * carries its own caption track. (The caption side of what review finding #644
 * asks for guide passes.)
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `sliceCaptionSidecar` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `sliceCaptionSidecar` exposes that responsibility through the package-independent system contract.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-subrange-stability Clips and rebases a chunk without changing which global frames each cue covers.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery Preserves deterministic sidecar content at chunk boundaries.
 * @author Samchon
 */
export const sliceCaptionSidecar = (
  sidecar: IAutoMovieCaptionSidecar,
  frameStart: number,
  frameEnd: number,
): IAutoMovieCaptionSidecar => {
  if (!Number.isInteger(frameStart) || frameStart < 0)
    throw new Error(
      `frameStart must be a non-negative integer, but was ${frameStart}`,
    );
  if (!Number.isInteger(frameEnd) || frameEnd <= frameStart)
    throw new Error(
      `frameEnd must be an integer > frameStart, but was ${frameEnd}`,
    );
  // A window whose start is at or past the sidecar's coverage asks for captions
  // of frames the sidecar does not have, a render/caption frame-count mismatch
  // (e.g. the sidecar was planned at a different fps). Clamping frameEnd alone
  // would leave `end - frameStart` negative and pass a broken slice silently;
  // surface the mismatch instead, the same discipline as the checks above.
  if (frameStart >= sidecar.frameCount)
    throw new Error(
      `frameStart ${frameStart} is at or beyond the sidecar's ${sidecar.frameCount} frames; the render window exceeds caption coverage`,
    );

  const end = clampWindowEnd(frameEnd, sidecar.frameCount);
  const entries: IAutoMovieCaptionEntry[] = [];
  for (const entry of sidecar.entries) {
    const start = Math.max(entry.frameStart, frameStart);
    const stop = Math.min(entry.frameEnd, end);
    if (start >= stop) continue;
    entries.push({
      ...entry,
      frameStart: start - frameStart,
      frameEnd: stop - frameStart,
    });
  }
  return {
    target: sidecar.target,
    fps: sidecar.fps,
    frameCount: end - frameStart,
    entries,
  };
};

/** The window's exclusive end, clamped to the sidecar's frame count. */
const clampWindowEnd = (frameEnd: number, frameCount: number): number =>
  frameEnd < frameCount ? frameEnd : frameCount;
