import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";

/**
 * One limb's part in a gait cycle ({@link IAutoMovieGait}). The limbs differ
 * only in **when** they swing (`phase`) and **how**: a horse walk is its four
 * legs at phase offsets `0, 0.5, 0.25, 0.75` (lateral sequence), a trot at `0,
 * 0.5, 0.5, 0` (diagonal pairs) — same shape, different phases.
 *
 * @author Samchon
 */
export interface IAutoMovieGaitLimb {
  /** The bone this limb's swing drives (a leg's upper bone). */
  bone: AutoMovieHumanoidBone;

  /**
   * Joint axis this gait channel writes. Omitted means `"flexion"` so existing
   * gait data keeps the original sagittal swing behavior; set `"abduction"` for
   * side-to-side sway/spread or `"twist"` for axial gait details.
   */
  axis?: "flexion" | "abduction" | "twist";

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

  /** Peak swing on `axis` (degrees) about the limb's neutral. */
  amplitude: number;

  /**
   * Center the swing oscillates around (degrees), default `0`. A symmetric limb
   * (a hip, a shoulder) leaves this unset and swings `±amplitude` about zero; a
   * limb that only bends one way needs a nonzero center to keep the whole swing
   * on the anatomical side. A knee, whose flexion ROM is `[0, 150]°` and cannot
   * hyperextend, walks with e.g. `{ neutral: 25, amplitude: 18 }` so its swing
   * stays in `[7, 43]°` instead of crossing zero — the offset the ROM validator
   * forces once you try to bend a knee at all.
   */
  neutral?: number;
}
