import {
  AutoMovieHumanoidBone,
  IAutoMovieJointPose,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Vector3 } from "../math/Vector3";
import { clampJointRom } from "../rom/clampPose";
import { getConstraint } from "../rom/humanoidRom";

/**
 * A reactive deflection (degrees) the impact pushes a joint toward.
 *
 * @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-impact-consequence Converts contact impulse into an authored-facing joint reaction cue.
 * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#collision-proxy-and-world-contact-output Carries the bounded reaction derived from the contact output.
 */
export interface IAutoMovieRecoilPush {
  /**
   * Flexion deflection in degrees.
   *
   * @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-impact-consequence Drives the dominant bend response to an impact.
   * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#collision-proxy-and-world-contact-output Carries one joint-axis component of the contact reaction.
   */
  flexion?: number;
  /**
   * Abduction deflection in degrees.
   *
   * @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-impact-consequence Allows the contact reaction to push the joint laterally.
   * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#collision-proxy-and-world-contact-output Carries the lateral joint-axis component of the reaction.
   */
  abduction?: number;
  /**
   * Twist deflection in degrees.
   *
   * @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-impact-consequence Allows the contact reaction to rotate the joint axially.
   * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#collision-proxy-and-world-contact-output Carries the axial joint component of the reaction.
   */
  twist?: number;
}

/**
 * Bridge an {@link IAutoMovieImpact}'s impulse to a recoil
 * {@link IAutoMovieRecoilPush}: the missing consumer between collision response
 * and flinch. The impulse magnitude (N·s) scaled by `gainDegPerImpulse` becomes
 * the `flexion` the struck body yields; {@link impactRecoil} then bounds that
 * push by joint ROM and spreads it down the chain. Kept deliberately simple
 * (one dominant flexion axis): it is an AI hint, not a solved contact
 * response.
 *
 * @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-impact-consequence Maps the computed impulse magnitude into a deterministic recoil cue.
 * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#collision-proxy-and-world-contact-output Bridges the contact output to its bounded pose reaction.
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
 * Scale one input deflection down the recoil chain. An absent or zero push is
 * represented as `null`, the pose model's resting axis, so a zero-excluding ROM
 * does not drag an untouched axis to its minimum and the resulting pose remains
 * legal under the same validator. A non-zero deflection stays explicit for the
 * shared whole-joint ROM clamp.
 */
const scaledPushAxis = (value: number | null, scale: number): number | null => {
  if (value === null) return null;
  const scaled = value * scale;
  return scaled === 0 ? null : scaled;
};

const readPushAxis = (
  axis: keyof IAutoMovieRecoilPush,
  value: number | undefined,
): number | null => {
  if (value === undefined || value === 0) return null;
  if (!Number.isFinite(value))
    throw new RangeError(
      `impact recoil push ${axis} must be finite, but was ${value}`,
    );
  return value;
};

/**
 * Build the **flinch** a struck body yields under an impact: the reactive
 * `push` (a deflection driven by the impulse) propagates down a `chain` of
 * bones (from the contact bone toward the body) losing strength by `falloff`
 * each link, and **each joint only yields as far as its ROM allows**
 * ({@link IAutoMovieJointConstraint}). So what the hit _does_ to the body is
 * bounded by the same joint ranges the engine already validates against: a neck
 * can only snap so far, a spine only bend so much.
 *
 * This is the ROM-aware half of collision response: the reactive force decides
 * how hard the push is, the joint ROM decides how far the body actually goes.
 * The caller maps an {@link IAutoMovieImpact}'s impulse to the `push`
 * magnitude.
 *
 * @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-impact-consequence Applies the contact reaction without exceeding declared joint range.
 * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#collision-proxy-and-world-contact-output Produces the ROM-bounded pose consequence of world contact.
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
    const configured = skeleton.bones.find((entry) => entry.bone === bone);
    const constraint =
      configured === undefined
        ? null
        : getConstraint(bone, configured.constraint);
    const k = Math.pow(falloff, i);
    const recoil: IAutoMovieJointPose = {
      bone,
      flexion: scaledPushAxis(flexion, k),
      abduction: scaledPushAxis(abduction, k),
      twist: scaledPushAxis(twist, k),
    };
    return constraint === null ? recoil : clampJointRom(recoil, constraint);
  });
  return { skeleton: skeleton.id, root: null, joints };
};
