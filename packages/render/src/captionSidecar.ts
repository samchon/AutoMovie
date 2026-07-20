/**
 * One caption span: the output frames `[frameStart, frameEnd)` during which one
 * beat's shot is live, with the diffusion caption and the scene slug as
 * context. `caption`/`slug` are `null` for a treeless script or a beat that
 * authored none. A diffusion host skips the span or falls back to its own
 * default prompt.
 *
 * @author Samchon
 */
export interface IAutoMovieCaptionEntry {
  /** First global output frame of the span (inclusive). */
  frameStart: number;

  /** One past the last output frame of the span (exclusive). */
  frameEnd: number;

  /** The beat whose shot is live across the span. */
  beat: string;

  /** The beat node's shot caption, or `null` (treeless / not authored). */
  caption: string | null;

  /** The enclosing scene's slug (`INT. LOCATION - TIMEOFDAY`), or `null`. */
  slug: string | null;
}

/**
 * The per-shot caption track for a sequence render: the machine-readable
 * sidecar a diffusion pass reads next to the guide frames.
 *
 * @author Samchon
 */
export interface IAutoMovieCaptionSidecar {
  /** The sequence this sidecar captions. */
  target: string;

  /** Output frames per second the spans are addressed in. */
  fps: number;

  /** Total output frames (`round(runtime × fps)`, the frame-atomic clock). */
  frameCount: number;

  /** Caption spans in play order, covering every output frame exactly once. */
  entries: IAutoMovieCaptionEntry[];
}

/** Serialize the sidecar for the host to write: pretty JSON, declared order. */
export const renderCaptionSidecar = (
  sidecar: IAutoMovieCaptionSidecar,
): string => `${JSON.stringify(sidecar, null, 2)}\n`;
