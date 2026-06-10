import { AutoFilmHumanoidBone } from "../skeleton/AutoFilmHumanoidBone";

/**
 * One limb's part in a gait cycle ({@link IAutoFilmGait}). The limbs differ only
 * in **when** they swing (`phase`) and **how**: a horse walk is its four legs
 * at phase offsets `0, 0.5, 0.25, 0.75` (lateral sequence), a trot at `0, 0.5,
 * 0.5, 0` (diagonal pairs) — same shape, different phases.
 *
 * @author Samchon
 */
export interface IAutoFilmGaitLimb {
  /** The bone this limb's swing drives (a leg's upper bone). */
  bone: AutoFilmHumanoidBone;

  /**
   * Where in the stride this limb's cycle starts, in `[0, 1)` — the phase
   * offset that distinguishes one gait's footfall sequence from another's.
   */
  phase: number;

  /**
   * Fraction of the stride the limb spends in **stance** (planted, pushing the
   * body back) versus **swing** (lifted, recovering forward), in `(0, 1)`. A
   * walk has a high duty (long ground contact); a gallop a low one.
   */
  duty: number;

  /** Peak flexion swing (degrees) about the limb's neutral. */
  amplitude: number;
}
