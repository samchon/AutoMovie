/**
 * A blend between two adjacent shots in a sequence — the alternative to the
 * default hard cut. The incoming entry overlaps the previous one for `duration`
 * seconds.
 *
 * @author Samchon
 */
export interface IAutoMovieTransition {
  /** The blend style. */
  kind: "crossDissolve" | "fade";

  /** Overlap length, in seconds. */
  duration: number;
}
