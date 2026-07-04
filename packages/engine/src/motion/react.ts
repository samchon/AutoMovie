import {
  automovieHumanoidBone,
  IautomovieJointPose,
  IautomovieKeyframe,
  IautomovieMotion,
  IautomoviePose,
  IautomovieSkeleton,
} from "@automovie/interface";

import { IautomovieRecoilPush, impactRecoil } from "../physics/impactRecoil";

/**
 * Synthesise the **react** action into a short flinch clip: snap from rest into
 * the impact's recoil and ease back. The flinch pose is the engine's
 * `impactRecoil` ??the reactive `push` propagated down the bone `chain` and
 * **clamped to each joint's ROM** ??so this is the harness `react` verb turned
 * into motion by the impact engine (the caller maps an `IautomovieImpact`'s
 * impulse to the `push`).
 *
 * A three-keyframe clip: rest (0) ??flinch (`peak`) ??rest (`duration`).
 *
 * @author Samchon
 */
export const reactMotion = (
  id: string,
  skeleton: IautomovieSkeleton,
  push: IautomovieRecoilPush,
  chain: automovieHumanoidBone[],
  duration: number,
  peak = 0.16,
): IautomovieMotion => {
  const neutral: IautomovieJointPose[] = chain.map((bone) => ({
    bone,
    flexion: 0,
    abduction: 0,
    twist: 0,
  }));
  const rest: IautomoviePose = {
    skeleton: skeleton.id,
    root: null,
    joints: neutral,
  };
  const flinch = impactRecoil(push, chain, skeleton);
  const key = (
    time: number,
    pose: IautomoviePose,
    easing: IautomovieKeyframe["easing"],
  ): IautomovieKeyframe => ({
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
