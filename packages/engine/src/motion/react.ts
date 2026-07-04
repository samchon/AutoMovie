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
 * `impactRecoil` — the reactive `push` propagated down the bone `chain` and
 * **clamped to each joint's ROM** — so this is the harness `react` verb turned
 * into motion by the impact engine (the caller maps an `IAutoMovieImpact`'s
 * impulse to the `push`).
 *
 * A three-keyframe clip: rest (0) → flinch (`peak`) → rest (`duration`).
 *
 * @author Samchon
 */
export const reactMotion = (
  id: string,
  skeleton: IAutoMovieSkeleton,
  push: IAutoMovieRecoilPush,
  chain: AutoMovieHumanoidBone[],
  duration: number,
  peak = 0.16,
): IAutoMovieMotion => {
  const neutral: IAutoMovieJointPose[] = chain.map((bone) => ({
    bone,
    flexion: 0,
    abduction: 0,
    twist: 0,
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
