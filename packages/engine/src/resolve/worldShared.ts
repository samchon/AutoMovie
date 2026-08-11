import { IAutoMovieTransform, IAutoMovieVector3 } from "@automovie/interface";

import { Matrix4 } from "../math/Matrix4";
import { Vector3 } from "../math/Vector3";

// The exact shortest-arc rotation now lives in math/rotationBetween, the single
// shortest-arc primitive both the world-driver/iterative IK path (here) and the
// analytic two-bone path (kinematics/aimRotation) route through, so the two IK
// families cannot diverge (#643, #720). Re-exported so existing callers keep
// their `from "./worldShared"` import.
export { rotationBetween } from "../math/rotationBetween";

/**
 * Shared plumbing for the world-space driver passes ({@link resolveWorldDrivers}
 * and the iterative IK solvers): world/local lookups that fail loudly, the
 * subtree recompose walk, and the small quaternion/vector blends every solver
 * lowers its result through. One home so the analytic and iterative solvers
 * cannot drift apart on the basics.
 *
 * @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Reads the exact world matrix on which ordered driver transforms operate.
 * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-transform-lineage-precision Enforces the resolved-world lookup used throughout the transform chain.
 */
export const readWorld = (
  world: Map<string, number[]>,
  id: string,
  role: string,
): number[] => {
  const matrix = world.get(id);
  if (matrix === undefined)
    throw new Error(`world driver ${role} node "${id}" was not provided`);
  return matrix;
};

/**
 * Read a required node-local transform or fail with its node identity.
 *
 * @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Keeps each descendant's local transform explicit when rebuilding a world chain.
 * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-transform-lineage-precision Supplies the required local step of the ordered transform lineage.
 */
export const readLocal = (
  localById: Map<string, IAutoMovieTransform>,
  id: string,
): IAutoMovieTransform => {
  const local = localById.get(id);
  if (local === undefined)
    throw new Error(
      `world driver descendant local transform node "${id}" was not provided`,
    );
  return local;
};

/**
 * Recompute every descendant's world matrix from a node's updated world.
 *
 * @evidence requirements/map/scope-and-coordinates.md#map-coordinate-transform-precision Reapplies parent-to-child matrix products after a driver changes an ancestor.
 * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-transform-lineage-precision Preserves the ordered transform lineage through the complete descendant subtree.
 */
export const recompose = (
  id: string,
  world: Map<string, number[]>,
  localById: Map<string, IAutoMovieTransform>,
  childrenById: Map<string, string[]>,
): void => {
  const parentWorld = readWorld(world, id, "recompose parent");
  for (const child of childrenById.get(id) ?? []) {
    const t = readLocal(localById, child);
    const local = Matrix4.compose(t.translation, t.rotation, t.scale);
    world.set(child, Matrix4.multiply(parentWorld, local));
    recompose(child, world, localById, childrenById);
  }
};

/**
 * Linearly interpolate two vectors by influence `t`.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Applies a driver's declared influence to a vector-valued transform result.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Implements deterministic influence blending for world-space driver output.
 */
export const blendVec = (
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
  t: number,
): IAutoMovieVector3 =>
  Vector3.add(a, Vector3.scale(Vector3.subtract(b, a), t));

/**
 * Require a finite solver influence within the closed unit interval.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Rejects driver influence values that cannot define a bounded deterministic blend.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Enforces the legal influence domain of world-space driver evaluation.
 */
export const validateInfluence = (label: string, influence: number): void => {
  if (!Number.isFinite(influence))
    throw new Error(
      `world driver ${label} influence must be finite, but was ${influence}`,
    );
  if (influence < 0)
    throw new Error(
      `world driver ${label} influence must be between 0 and 1, but was ${influence}`,
    );
  if (influence > 1)
    throw new Error(
      `world driver ${label} influence must be between 0 and 1, but was ${influence}`,
    );
};
