import {
  AutoMovieHumanoidBone,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
} from "@automovie/interface";

import { IAutoMovieJointAxes, resolvePose } from "../kinematics";
import { sampleTimes } from "../motion/sampleClock";
import { sampleMotion } from "../motion/sampleMotion";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { groundFunction } from "../space/ground";
import { ViolationCollector } from "./violation";

const DEFAULT_FOOT_BONES = ["leftFoot", "rightFoot"] as const;

/**
 * Tier-3 ground-contact check for clips whose feet are expected to stay on or
 * above the ground. It samples the motion on a fixed clock, resolves FK, and
 * reports any configured foot bone whose world-space `y` falls below the ground
 * height at that foot's `(x, z)` minus `tolerance`.
 *
 * Ground is a scalar plane or a `(x, z) → y` height source — plug a space in
 * via {@link spaceGround} (#605) to validate contact over ramps and platforms; a
 * plain scalar keeps the exact pre-space behavior.
 *
 * This is intentionally opt-in rather than part of `validateMotion`: jumps,
 * mounts, crawling, and non-humanoid rigs need different contact assumptions.
 * The stable path shape is `$input.samples[i].<bone>.worldPosition.y`, where
 * `i` is the validator sample index, not a source keyframe index.
 *
 * @author Samchon
 */
export const validateGroundContact = (props: {
  /** Motion clip to sample. */
  motion: IAutoMovieMotion;

  /** Skeleton used for forward kinematics. */
  skeleton: IAutoMovieSkeleton;

  /** Bones treated as ground-contact points. Defaults to both humanoid feet. */
  footBones?: readonly AutoMovieHumanoidBone[];

  /** Ground height: plane scalar or `(x, z) → y` source. Defaults to `0`. */
  groundY?: number | ((x: number, z: number) => number);

  /** Allowed penetration depth before violation. Defaults to `0`. */
  tolerance?: number;

  /** Samples per second used by the validator. Defaults to `24`. */
  sampleRate?: number;

  /** JSON path of the motion being checked. Defaults to `$input`. */
  path?: string;

  /** Optional clinical-axis remap for rigs authored in semantic axes. */
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;

  /** Optional rest-frame remap for clinical authoring. */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
}): IAutoMovieValidation => {
  const collector = new ViolationCollector();
  const footBones = props.footBones ?? DEFAULT_FOOT_BONES;
  const tolerance = props.tolerance ?? 0;
  const sampleRate = props.sampleRate ?? 24;
  const path = props.path ?? "$input";
  const groundAt = groundFunction(props.groundY ?? 0);

  sampleTimes(props.motion.duration, sampleRate).forEach((time, index) => {
    const resolved = new Map(
      resolvePose(
        sampleMotion(props.motion, time).pose,
        props.skeleton,
        props.jointAxes,
        props.restFrames,
      ).map((bone) => [bone.bone, bone]),
    );
    for (const bone of footBones) {
      const foot = resolved.get(bone);
      if (foot === undefined) continue;
      const y = foot.worldPosition.y;
      const ground = groundAt(foot.worldPosition.x, foot.worldPosition.z);
      const minY = ground - tolerance;
      if (y < minY)
        collector.push(
          "physics",
          `${path}.samples[${index}].${bone}.worldPosition.y`,
          `${bone} world y must stay >= ${minY} at t=${round(time)}s (ground ${ground}, tolerance ${tolerance})`,
          y,
          minY - y,
        );
    }
  });

  return collector.toValidation();
};

const round = (value: number): number => Math.round(value * 1_000) / 1_000;
