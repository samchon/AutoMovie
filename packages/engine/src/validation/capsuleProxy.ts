import { AutoMovieHumanoidBone } from "@automovie/interface";

import { ViolationCollector } from "./violation";

/**
 * Capsule proxy over two resolved bones.
 *
 * A segment from `from` to `to` with a radius: the coarse volume stand-in both
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
 * must be bones of the rig, FK-reachable from a root (#1056), the two endpoints
 * must be distinct, and the radius must be finite and positive. Returns whether
 * the capsule is usable; every failure is pushed as an **error** (structural
 * precondition, not a physics warning: you cannot advise on geometry that will
 * not resolve).
 *
 * Shared by both capsule validators so a malformed capsule is rejected the same
 * way in each, where `detectBodyCollision` previously resolved a bad bone to
 * `undefined`, produced a NaN distance, and dropped the overlap in silence
 * (`NaN < minimum === false`). A declared-but-detached endpoint (its parent
 * chain never reaches a root) is never returned by FK, so reading its resolved
 * position would crash rather than report the malformed rig, the same gate the
 * footskate and balance validators carry.
 *
 * @author Samchon
 */
export const validateCapsule = (
  capsule: IAutoMovieCapsuleProxy,
  path: string,
  skeletonBones: ReadonlySet<AutoMovieHumanoidBone>,
  reachableBones: ReadonlySet<AutoMovieHumanoidBone>,
  collector: ViolationCollector,
): boolean => {
  let valid = true;
  const endpoint = (bone: AutoMovieHumanoidBone, at: string): void => {
    if (!skeletonBones.has(bone)) {
      valid = false;
      collector.push(
        "type",
        `${path}.${at}`,
        `capsule endpoint "${bone}" must exist in the target skeleton`,
        bone,
      );
    } else if (!reachableBones.has(bone)) {
      valid = false;
      collector.push(
        "type",
        `${path}.${at}`,
        `capsule endpoint "${bone}" is declared but not reachable from a root bone via forward kinematics`,
        bone,
      );
    }
  };
  endpoint(capsule.from, "from");
  endpoint(capsule.to, "to");
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
