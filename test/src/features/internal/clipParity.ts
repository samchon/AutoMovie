import {
  IAutoMovieJointAxes,
  IAutoMovieRestFrame,
  Matrix4,
  motionToClip,
  resolveFrame,
  resolvePose,
  sampleMotion,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import { qclose, vclose } from "./predicates";

/**
 * The S1 parity oracle as a reusable boolean: for every queried time, the
 * humanoid FK world (`resolvePose ∘ sampleMotion`) must match the general
 * pipeline world (`resolveFrame` = `composeScene ∘ sampleClip` over the
 * `motionToClip` bridge) on every skeleton bone — position via `vclose`,
 * rotation via `qclose` (sign-insensitive). Builds the boolean for
 * `TestValidator.predicate`; tolerances default to the helpers' 1e-6.
 */
export const clipWorldParity = (props: {
  motion: IAutoMovieMotion;
  skeleton: IAutoMovieSkeleton;
  times: readonly number[];
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
  sampleRate?: number;
  posEps?: number;
  rotEps?: number;
}): boolean => {
  const bridge = motionToClip({
    motion: props.motion,
    skeleton: props.skeleton,
    jointAxes: props.jointAxes,
    restFrames: props.restFrames,
    sampleRate: props.sampleRate,
  });
  for (const time of props.times) {
    const expected = resolvePose(
      sampleMotion(props.motion, time).pose,
      props.skeleton,
      props.jointAxes,
      props.restFrames,
    );
    const world = resolveFrame({
      nodes: bridge.nodes,
      clip: bridge.clip,
      limits: [],
      seconds: time,
    }).world;
    for (const bone of expected) {
      const matrix = world.get(bone.bone);
      if (matrix === undefined) return false;
      const decomposed = Matrix4.decompose(matrix);
      if (
        !vclose(
          Matrix4.position(matrix),
          bone.worldPosition,
          props.posEps ?? 1e-6,
        )
      )
        return false;
      if (
        !qclose(decomposed.rotation, bone.worldRotation, props.rotEps ?? 1e-6)
      )
        return false;
    }
  }
  return true;
};

/** The bridge's bake clock, mirrored for tests: `i / rate`, ending at duration. */
export const bakeTimes = (duration: number, sampleRate = 24): number[] => {
  const frames = Math.max(1, Math.ceil(duration * sampleRate));
  return Array.from({ length: frames + 1 }, (_, index) =>
    Math.min(duration, index / sampleRate),
  );
};
