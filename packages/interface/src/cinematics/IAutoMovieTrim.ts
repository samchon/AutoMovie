/**
 * A trim into a shot (seconds), the OpenTimelineIO `source_range` analogue: a
 * start offset and a duration carved out of the shot's local timeline.
 *
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-range-operations Exposes `IAutoMovieTrim` as the portable data boundary for the editorial range operations requirement.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline Types `IAutoMovieTrim` for the spec editorial rational timeline system contract.
 * @author Samchon
 */
export interface IAutoMovieTrim {
  /**
   * Seconds into the shot the trim begins.
   *
   * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-range-operations Exposes `start` as the portable data boundary for the editorial range operations requirement.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline Types `start` for the spec editorial rational timeline system contract.
   */
  start: number;

  /**
   * Length of the trimmed span, in seconds.
   *
   * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-range-operations Exposes `duration` as the portable data boundary for the editorial range operations requirement.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline Types `duration` for the spec editorial rational timeline system contract.
   */
  duration: number;
}
