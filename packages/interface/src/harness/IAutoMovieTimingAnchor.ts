/**
 * A **timing anchor**: a key moment pinned on the beat's local timeline. A
 * sparse list of these is the coarse temporal skeleton (in-betweening's stage
 * one) the performance stage aligns its verbs to, so the dense action timing
 * follows a committed structure instead of being invented per-verb. Anchors are
 * also where **causality** is fixed: the "looses the arrow" anchor must precede
 * the "is struck" anchor, and the performance stage honours that order.
 *
 * @author Samchon
 */
export interface IAutoMovieTimingAnchor {
  /** Seconds into the beat this moment lands. */
  t: number;

  /**
   * What happens at this instant, in a few words ("twists back in the saddle",
   * "looses the arrow", "the fist connects", "weight lands on the front
   * foot").
   */
  cue: string;
}
