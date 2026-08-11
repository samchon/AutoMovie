import type {
  AutoMovieHumanoidBone,
  IAutoMovieCapsuleProxy,
} from "@automovie/interface";

import { ViolationCollector } from "./violation";

/** Shared actor-local capsule used by body validation and soft contact. */
export type { IAutoMovieCapsuleProxy } from "@automovie/interface";

/**
 * Validate the shared capsule proxy against the skeleton it addresses: both
 * endpoints must be bones of the rig, FK-reachable from a root, the two
 * endpoints must be distinct, and the radius must be finite and positive.
 * Returns whether the capsule is usable; every failure is pushed as an
 * **error** (structural precondition, not a physics warning: you cannot advise
 * on geometry that will not resolve).
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Refuses malformed shared body collision geometry.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Validates the bounded segment before collision projection.
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-fidelity-boundary Limits collision geometry to an explicit bounded proxy.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-failure-and-fidelity-boundary Refuses malformed bounded collision proxies before simulation.
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
