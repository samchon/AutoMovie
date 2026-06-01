/**
 * A sequence: an ordered cut-list of shots — the editorial timeline, modelled
 * on OpenTimelineIO. Shots play back to back; a hard cut is the default (two
 * adjacent entries with no transition), an optional transition blends them.
 *
 * Each shot keeps its own local time origin; the sequence composes the global
 * timeline by accumulating trimmed durations (minus transition overlap), so
 * reordering or retiming a shot is a local edit and never forces recomputing
 * downstream timestamps.
 *
 * @author Samchon
 */
export interface IMoticaSequence {
  /** Stable id. */
  id: string;

  /** Human / LLM readable name. Null if unnamed. */
  name: string | null;

  /** Shots in playback order. */
  shots: IMoticaSequenceEntry[];

  /** Nominal playback frame rate; a render spec may override it. */
  fps: number;
}

/** One shot's placement in a sequence: an optional trim and incoming transition. */
export interface IMoticaSequenceEntry {
  /** Id of the {@link IMoticaShot} played here. */
  shot: string;

  /**
   * Trim into the shot (seconds), the OTIO `source_range` analogue, or `null`
   * to play the whole shot.
   */
  trim: { start: number; duration: number } | null;

  /**
   * Blend into this entry from the previous one, or `null` for a hard cut (the
   * default).
   */
  transition: { kind: "crossDissolve" | "fade"; duration: number } | null;
}
