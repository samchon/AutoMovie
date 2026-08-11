/**
 * A blend between two adjacent shots in a sequence: the alternative to the
 * default hard cut. The incoming entry overlaps the previous one for `duration`
 * seconds.
 *
 * @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-handles Exposes `IAutoMovieTransition` as the portable data boundary for the editorial transition handles requirement.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-transition-overlap Types `IAutoMovieTransition` for the spec editorial transition overlap system contract.
 * @author Samchon
 */
export interface IAutoMovieTransition {
  /**
   * The blend style.
   *
   * @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-handles Exposes `kind` as the portable data boundary for the editorial transition handles requirement.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-transition-overlap Types `kind` for the spec editorial transition overlap system contract.
   */
  kind: "crossDissolve" | "fade";

  /**
   * Overlap length, in seconds.
   *
   * @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-handles Exposes `duration` as the portable data boundary for the editorial transition handles requirement.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-transition-overlap Types `duration` for the spec editorial transition overlap system contract.
   */
  duration: number;
}
