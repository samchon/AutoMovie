import {
  AutoMovieHumanoidBone,
  IAutoMovieAngleRange,
  IAutoMovieJointPose,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Vector3 } from "../math/Vector3";

/** A reactive deflection (degrees) the impact pushes a joint toward. */
export interface IAutoMovieRecoilPush {
  flexion?: number;
  abduction?: number;
  twist?: number;
}

/**
 * Bridge an {@link IAutoMovieImpact}'s impulse to a recoil
 * {@link IAutoMovieRecoilPush} — the missing consumer between collision response
 * and flinch. The impulse magnitude (N·s) scaled by `gainDegPerImpulse` becomes
 * the `flexion` the struck body yields; {@link impactRecoil} then bounds that
 * push by joint ROM and spreads it down the chain. Kept deliberately simple
 * (one dominant flexion axis): it is an AI hint, not a solved contact
 * response.
 *
 * @author Samchon
 */
export const impulseToRecoilPush = (
  impulse: IAutoMovieVector3,
  gainDegPerImpulse: number,
): IAutoMovieRecoilPush => {
  if (!Number.isFinite(gainDegPerImpulse))
    throw new RangeError(
      `recoil push gain must be finite, but was ${gainDegPerImpulse}`,
    );
  if (gainDegPerImpulse < 0)
    throw new RangeError(
      `recoil push gain must be >= 0, but was ${gainDegPerImpulse}`,
    );
  return { flexion: Vector3.length(impulse) * gainDegPerImpulse };
};

/**
 * Bound a reactive deflection by the joint's ROM. A **zero push** means the
 * impact did not deflect this axis, so the axis stays neutral (0): the ROM
 * bounds how far the impact _yields_ the joint, not where an un-pushed joint
 * rests. Without this, a joint whose ROM excludes 0 (an always-flexed elbow,
 * `min > 0`) would be dragged to its lower bound by a flinch that never touched
 * that axis — spurious motion the impact never caused. A non-zero push is bound
 * to the range as before.
 */
const clampAxis = (
  value: number,
  range: IAutoMovieAngleRange | null,
): number =>
  value === 0 || range === null
    ? value
    : Math.max(range.min, Math.min(range.max, value));

const readPushAxis = (
  axis: keyof IAutoMovieRecoilPush,
  value: number | undefined,
): number => {
  if (value === undefined) return 0;
  if (!Number.isFinite(value))
    throw new RangeError(
      `impact recoil push ${axis} must be finite, but was ${value}`,
    );
  return value;
};

/**
 * Build the **flinch** a struck body yields under an impact: the reactive
 * `push` (a deflection driven by the impulse) propagates down a `chain` of
 * bones — from the contact bone toward the body — losing strength by `falloff`
 * each link, and **each joint only yields as far as its ROM allows**
 * ({@link IAutoMovieJointConstraint}). So what the hit _does_ to the body is
 * bounded by the same joint ranges the engine already validates against: a neck
 * can only snap so far, a spine only bend so much.
 *
 * This is the ROM-aware half of collision response — the reactive force decides
 * how hard the push is, the joint ROM decides how far the body actually goes.
 * The caller maps an {@link IAutoMovieImpact}'s impulse to the `push`
 * magnitude.
 *
 * @author Samchon
 */
export const impactRecoil = (
  push: IAutoMovieRecoilPush,
  chain: AutoMovieHumanoidBone[],
  skeleton: IAutoMovieSkeleton,
  falloff = 0.6,
): IAutoMoviePose => {
  if (!Number.isFinite(falloff))
    throw new RangeError(
      `impact recoil falloff must be finite, but was ${falloff}`,
    );
  if (falloff < 0 || falloff > 1)
    throw new RangeError(
      `impact recoil falloff must be within [0, 1], but was ${falloff}`,
    );

  const flexion = readPushAxis("flexion", push.flexion);
  const abduction = readPushAxis("abduction", push.abduction);
  const twist = readPushAxis("twist", push.twist);

  const joints: IAutoMovieJointPose[] = chain.map((bone, i) => {
    const constraint =
      skeleton.bones.find((b) => b.bone === bone)?.constraint ?? null;
    const k = Math.pow(falloff, i);
    return {
      bone,
      flexion: clampAxis(flexion * k, constraint?.flexion ?? null),
      abduction: clampAxis(abduction * k, constraint?.abduction ?? null),
      twist: clampAxis(twist * k, constraint?.twist ?? null),
    };
  });
  return { skeleton: skeleton.id, root: null, joints };
};
