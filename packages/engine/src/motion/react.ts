import {
  AutoMovieHumanoidBone,
  IAutoMovieJointPose,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import { IAutoMovieRecoilPush, impactRecoil } from "../physics/impactRecoil";

/**
 * Synthesise the **react** action into a short flinch clip: snap from rest into
 * the impact's recoil and ease back. The flinch pose is the engine's
 * `impactRecoil` (the reactive `push` propagated down the bone `chain` and
 * **clamped to each joint's ROM**), so this is the harness `react` verb turned
 * into motion by the impact engine (the caller maps an `IAutoMovieImpact`'s
 * impulse to the `push`).
 *
 * A three-keyframe clip: rest (0) → flinch (`peak`) → rest (`duration`).
 * Resting axes stay `null`, the pose model's neutral representation, so a rig
 * whose ROM excludes numeric 0 does not receive invented articulation at either
 * edge.
 *
 * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-general-procedural-control Converts an impact-derived recoil into a bounded, ROM-safe flinch and recovery clip.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Applies a deterministic compact procedural rule to the requested reaction.
 * @author Samchon
 */
export const reactMotion = (
  id: string,
  skeleton: IAutoMovieSkeleton,
  push: IAutoMovieRecoilPush,
  chain: AutoMovieHumanoidBone[],
  duration: number,
  // The default peak scales down for a quick flinch: a fixed 0.16 s would
  // reject every legitimate sub-0.16 s duration outright (peak >= duration),
  // while durations >= 0.4 s keep the exact 0.16 s snap.
  peak = Math.min(0.16, duration * 0.4),
): IAutoMovieMotion => {
  if (!Number.isFinite(duration))
    throw new Error("react duration must be finite and positive");
  if (duration <= 0)
    throw new Error("react duration must be finite and positive");
  if (!Number.isFinite(peak))
    throw new Error("react peak must be finite and within duration");
  if (peak <= 0)
    throw new Error("react peak must be finite and within duration");
  if (peak >= duration)
    throw new Error("react peak must be before react duration");

  const neutral: IAutoMovieJointPose[] = chain.map((bone) => ({
    bone,
    flexion: null,
    abduction: null,
    twist: null,
  }));
  const rest: IAutoMoviePose = {
    skeleton: skeleton.id,
    root: null,
    joints: neutral,
  };
  const flinch = impactRecoil(push, chain, skeleton);
  const key = (
    time: number,
    pose: IAutoMoviePose,
    easing: IAutoMovieKeyframe["easing"],
  ): IAutoMovieKeyframe => ({
    time,
    pose,
    expression: null,
    easing,
    bezier: null,
  });
  return {
    id,
    skeleton: skeleton.id,
    duration,
    loop: false,
    keyframes: [
      key(0, rest, "easeOut"),
      key(peak, flinch, "easeOut"),
      key(duration, rest, "easeInOut"),
    ],
  };
};
