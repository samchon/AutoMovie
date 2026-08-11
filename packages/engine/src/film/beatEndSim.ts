import {
  IAutoMovieBeatEndFootPlant,
  IAutoMovieMotion,
  IAutoMovieSceneNode,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Matrix4 } from "../math/Matrix4";
import { Vector3 } from "../math/Vector3";
import { addPositiveModulo } from "../math/positiveModulo";
import { sampleMotion } from "../motion/sampleMotion";

/**
 * Finite-difference window for the end-velocity estimate, seconds: one frame of
 * the engine's default 24 Hz clock. Shared with {@link resolveBeatEnd}'s
 * baked-follow velocity so a mounted rider's end velocity uses the same
 * window.
 *
 * @evidence requirements/motion/validation-and-determinism.md#motion-fixed-step-baked-state VELOCITY_DT makes sampled motion replay deterministic: Finite-difference window for the end-velocity estimate, seconds: one frame of the engine's default 24 Hz clock. Shared with {@link resolveBeatEnd}'s baked-follow velocity so a mounted rider's end velocity uses the same window.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation VELOCITY_DT realizes deterministic motion sampling: Finite-difference window for the end-velocity estimate, seconds: one frame of the engine's default 24 Hz clock. Shared with {@link resolveBeatEnd}'s baked-follow velocity so a mounted rider's end velocity uses the same window.
 */
export const VELOCITY_DT = 1 / 24;

/**
 * Wrap a non-negative time onto `[0, duration)`, matching the sampler's loop
 * handling. Callers guarantee `seconds >= 0` (a shot's local clock never runs
 * backwards), so no negative-modulo correction is needed.
 */
const wrapTime = (seconds: number, duration: number): number =>
  seconds % duration;

const toMatrix = (transform: IAutoMovieTransform): number[] =>
  Matrix4.compose(transform.translation, transform.rotation, transform.scale);

/**
 * Fold a sampled pose root into a staged base placement, in world space.
 *
 * @evidence requirements/motion/validation-and-determinism.md#motion-fixed-step-baked-state foldRoot makes sampled motion replay deterministic: Fold a sampled pose root into a staged base placement, in world space.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation foldRoot realizes deterministic motion sampling: Fold a sampled pose root into a staged base placement, in world space.
 */
export const foldRoot = (
  base: IAutoMovieTransform,
  root: IAutoMovieTransform | null,
): IAutoMovieTransform => {
  if (root === null) return base;
  const world = Matrix4.multiply(toMatrix(base), toMatrix(root));
  const decomposed = Matrix4.decompose(world);
  return {
    translation: decomposed.position,
    rotation: decomposed.rotation,
    scale: decomposed.scale,
  };
};

/** The clip's root at `t`, folded through the node's staged placement. */
const worldRootAt = (
  node: IAutoMovieSceneNode,
  clip: IAutoMovieMotion,
  t: number,
): IAutoMovieVector3 => {
  const root = sampleMotion(clip, t).pose.root;
  return foldRoot(node.transform, root).translation;
};

/**
 * Finite-difference world root velocity of `clip` over `[t0, t1]`, folded
 * through the node's staged placement; zero for an empty window.
 */
const velocityOver = (
  node: IAutoMovieSceneNode,
  clip: IAutoMovieMotion,
  t0: number,
  t1: number,
): IAutoMovieVector3 => {
  const span = t1 - t0;
  if (span <= 0) return { x: 0, y: 0, z: 0 };
  const p0 = worldRootAt(node, clip, t0);
  const p1 = worldRootAt(node, clip, t1);
  return Vector3.scale(Vector3.subtract(p1, p0), 1 / span);
};

/**
 * Seconds into a looping clip's cycle at `localTime`, or `null` when the clip
 * does not loop (a one-shot clip has no cycle to resume).
 *
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-phases gaitPhaseOf preserves planted contact phases: Seconds into a looping clip's cycle at `localTime`, or `null` when the clip does not loop (a one-shot clip has no cycle to resume).
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support gaitPhaseOf realizes contact-phase support: Seconds into a looping clip's cycle at `localTime`, or `null` when the clip does not loop (a one-shot clip has no cycle to resume).
 */
export const gaitPhaseOf = (
  clip: IAutoMovieMotion,
  localTime: number,
): number | null => {
  // A carried gait cycle is authoritative: it is how a NON-looping composite
  // (the film ladder's arranged performance) still knows its stride phase.
  // Without it, compiled shots always answered null and the mid-stride resume
  // never fired in the real ladder. Degenerate meta yields null, matching the
  // degenerate-duration rule below.
  const cycle = clip.gaitCycle ?? null;
  if (cycle !== null) {
    if (!Number.isFinite(cycle.period) || cycle.period <= 0) return null;
    if (!Number.isFinite(cycle.phaseAt)) return null;
    return addPositiveModulo(cycle.phaseAt, localTime, cycle.period);
  }
  if (!clip.loop) return null;
  if (clip.duration <= 0) return null;
  return wrapTime(localTime, clip.duration);
};

/**
 * World root velocity at `localTime`, finite-differenced over the clip's last
 * instants and folded through the node's staged placement.
 *
 * A looping clip's root teleports back at the seam, so the window never spans
 * it: within a cycle the window is the trailing {@link VELOCITY_DT}; in the
 * cycle's opening instants it shrinks to `[0, phase]`; and exactly on the seam
 * the cycle's closing stretch is measured with the clip clamped (un-looped) so
 * sampling `duration` does not wrap to the cycle start. A non-looping clip
 * sampled exactly at its end uses that same incoming left-hand window for the
 * cut; only a sample after the clip has ended holds its last pose at zero
 * velocity.
 *
 * @evidence requirements/motion/validation-and-determinism.md#motion-fixed-step-baked-state rootVelocityOf converts the sampled clip boundary into an explicit staged world-space velocity for deterministic beat-end replay.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation rootVelocityOf realizes deterministic motion sampling: World root velocity at `localTime`, finite-differenced over the clip's last instants and folded through the node's staged placement. A looping clip's root teleports back at the seam, so the window never spans it: within a cycle the window is the trailing {@link VELOCITY_DT}; in the cycle's opening instants it shrinks to `[0, phase]`; and exactly on the seam the cycle's closing stretch is measured with the clip clamped (un-looped) so sampling `duration` does not wrap to the cycle start. A non-looping clip sampled exactly at its end uses that same incoming left-hand window for the cut; only a sample after the clip has ended holds its last pose at zero velocity.
 */
export const rootVelocityOf = (
  node: IAutoMovieSceneNode,
  clip: IAutoMovieMotion,
  localTime: number,
): IAutoMovieVector3 => {
  if (clip.loop && clip.duration > 0) {
    const phase = wrapTime(localTime, clip.duration);
    if (phase >= VELOCITY_DT)
      return velocityOver(node, clip, phase - VELOCITY_DT, phase);
    if (phase > 0) return velocityOver(node, clip, 0, phase);
    const clamped: IAutoMovieMotion = { ...clip, loop: false };
    const start = Math.max(0, clip.duration - VELOCITY_DT);
    return velocityOver(node, clamped, start, clip.duration);
  }

  if (localTime > clip.duration) return { x: 0, y: 0, z: 0 };
  const t1 = Math.min(Math.max(localTime, 0), clip.duration);
  return velocityOver(node, clip, Math.max(0, t1 - VELOCITY_DT), t1);
};

/**
 * The most recent stance plant per foot active at `localTime`, the contact the
 * next beat should keep each foot on. Stance bounds are inclusive; later
 * entries win equal-start ties. Returns `null` when no plant data was supplied
 * or every run is past/future at the cut.
 *
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-phases plantsAtEnd preserves planted contact phases: The most recent stance plant per foot active at `localTime`, the contact the next beat should keep each foot on. Stance bounds are inclusive; later entries win equal-start ties. Returns `null` when no plant data was supplied or every run is past/future at the cut.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support plantsAtEnd realizes contact-phase support: The most recent stance plant per foot active at `localTime`, the contact the next beat should keep each foot on. Stance bounds are inclusive; later entries win equal-start ties. Returns `null` when no plant data was supplied or every run is past/future at the cut.
 */
export const plantsAtEnd = (
  plants: readonly IAutoMovieBeatEndFootPlant[] | undefined,
  localTime: number,
): IAutoMovieBeatEndFootPlant[] | null => {
  if (plants === undefined) return null;
  const byFoot = new Map<
    IAutoMovieBeatEndFootPlant["foot"],
    IAutoMovieBeatEndFootPlant
  >();
  for (const plant of plants) {
    if (plant.start > localTime || plant.end < localTime) continue;
    const held = byFoot.get(plant.foot);
    if (held === undefined || plant.start >= held.start)
      byFoot.set(plant.foot, plant);
  }
  const kept = [...byFoot.values()];
  return kept.length === 0 ? null : kept;
};
