/**
 * A trim into a shot (seconds) — the OpenTimelineIO `source_range` analogue: a
 * start offset and a duration carved out of the shot's local timeline.
 *
 * @author Samchon
 */
export interface IAutoFilmTrim {
  /** Seconds into the shot the trim begins. */
  start: number;

  /** Length of the trimmed span, in seconds. */
  duration: number;
}
