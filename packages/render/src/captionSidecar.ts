/**
 * One caption span: the output frames `[frameStart, frameEnd)` during which one
 * beat's shot is live, with the diffusion caption and the scene slug as
 * context. `caption`/`slug` are `null` for a treeless script or a beat that
 * authored none. A diffusion host skips the span or falls back to its own
 * default prompt.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `IAutoMovieCaptionEntry` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `IAutoMovieCaptionEntry` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieCaptionEntry {
  /**
   * First global output frame of the span (inclusive).
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `IAutoMovieCaptionEntry.frameStart` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `IAutoMovieCaptionEntry.frameStart` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameStart: number;

  /**
   * One past the last output frame of the span (exclusive).
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `IAutoMovieCaptionEntry.frameEnd` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `IAutoMovieCaptionEntry.frameEnd` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameEnd: number;

  /**
   * The beat whose shot is live across the span.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `IAutoMovieCaptionEntry.beat` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `IAutoMovieCaptionEntry.beat` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  beat: string;

  /**
   * The beat node's shot caption, or `null` (treeless / not authored).
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `IAutoMovieCaptionEntry.caption` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `IAutoMovieCaptionEntry.caption` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  caption: string | null;

  /**
   * The enclosing scene's slug (`INT. LOCATION - TIMEOFDAY`), or `null`.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `IAutoMovieCaptionEntry.slug` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `IAutoMovieCaptionEntry.slug` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  slug: string | null;
}

/**
 * The per-shot caption track for a sequence render: the machine-readable
 * sidecar a diffusion pass reads next to the guide frames.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `IAutoMovieCaptionSidecar` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `IAutoMovieCaptionSidecar` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieCaptionSidecar {
  /**
   * The sequence this sidecar captions.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `IAutoMovieCaptionSidecar.target` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `IAutoMovieCaptionSidecar.target` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  target: string;

  /**
   * Output frames per second the spans are addressed in.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `IAutoMovieCaptionSidecar.fps` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `IAutoMovieCaptionSidecar.fps` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  fps: number;

  /**
   * Total output frames (`round(runtime × fps)`, the frame-atomic clock).
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `IAutoMovieCaptionSidecar.frameCount` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `IAutoMovieCaptionSidecar.frameCount` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameCount: number;

  /**
   * Caption spans in play order, covering every output frame exactly once.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `IAutoMovieCaptionSidecar.entries` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `IAutoMovieCaptionSidecar.entries` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  entries: IAutoMovieCaptionEntry[];
}

/**
 * Serialize the sidecar for the host to write: pretty JSON, declared order.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness `renderCaptionSidecar` preserves deterministic cue-to-frame mapping in the timed-text sidecar.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues `renderCaptionSidecar` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export const renderCaptionSidecar = (
  sidecar: IAutoMovieCaptionSidecar,
): string => `${JSON.stringify(sidecar, null, 2)}\n`;
