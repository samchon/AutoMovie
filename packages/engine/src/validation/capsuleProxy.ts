import { AutoMovieHumanoidBone } from "@automovie/interface";

import { ViolationCollector } from "./violation";

/**
 * Capsule proxy over two resolved bones.
 *
 * A segment from `from` to `to` with a radius — the coarse volume stand-in both
 * the self-intersection ({@link validateSelfIntersection}) and inter-body
 * collision ({@link detectBodyCollision}) checks resolve their overlap against,
 * before a mesh-level topology validator exists.
 *
 * @author Samchon
 */
export interface IAutoMovieCapsuleProxy {
  /** First endpoint bone. */
  from: AutoMovieHumanoidBone;

  /** Second endpoint bone. */
  to: AutoMovieHumanoidBone;

  /** Capsule radius in meters. */
  radius: number;
}

/**
 * Validate a capsule proxy against the skeleton it addresses: both endpoints
 * must be bones of the rig, the two endpoints must be distinct, and the radius
 * must be finite and positive. Returns whether the capsule is usable; every
 * failure is pushed as an **error** (structural precondition, not a physics
 * warning — you cannot advise on geometry that will not resolve).
 *
 * Shared by both capsule validators so a malformed capsule is rejected the same
 * way in each — where `detectBodyCollision` previously resolved a bad bone to
 * `undefined`, produced a NaN distance, and dropped the overlap in silence
 * (`NaN < minimum === false`).
 *
 * @author Samchon
 */
export const validateCapsule = (
  capsule: IAutoMovieCapsuleProxy,
  path: string,
  skeletonBones: ReadonlySet<AutoMovieHumanoidBone>,
  collector: ViolationCollector,
): boolean => {
  let valid = true;
  if (!skeletonBones.has(capsule.from)) {
    valid = false;
    collector.push(
      "type",
      `${path}.from`,
      `capsule endpoint "${capsule.from}" must exist in the target skeleton`,
      capsule.from,
    );
  }
  if (!skeletonBones.has(capsule.to)) {
    valid = false;
    collector.push(
      "type",
      `${path}.to`,
      `capsule endpoint "${capsule.to}" must exist in the target skeleton`,
      capsule.to,
    );
  }
  if (capsule.from === capsule.to) {
    valid = false;
    collector.push(
      "type",
      path,
      "capsule endpoints must be two distinct bones",
      { from: capsule.from, to: capsule.to },
    );
  }
  if (!Number.isFinite(capsule.radius) || capsule.radius <= 0) {
    valid = false;
    collector.push(
      "range",
      `${path}.radius`,
      `capsule radius must be a finite number > 0, but was ${capsule.radius}`,
      capsule.radius,
    );
  }
  return valid;
};
