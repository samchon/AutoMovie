import {
  IAutoMovieQuaternion,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";

/**
 * Shared plumbing for the world-space driver passes ({@link resolveWorldDrivers}
 * and the iterative IK solvers): world/local lookups that fail loudly, the
 * subtree recompose walk, and the small quaternion/vector blends every solver
 * lowers its result through. One home so the analytic and iterative solvers
 * cannot drift apart on the basics.
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

/** Recompute every descendant's world matrix from a node's updated world. */
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
 * Exact shortest-arc rotation from unit (or zero) vector `a` to `b`,
 * `atan2`-based — **no near-parallel identity deadzone**. The predecessor
 * (`quatFromTo`) snapped `cos > 0.999999` to the identity, which put a ~1.9e-3
 * m convergence floor under the iterative IK solvers and made the aim driver
 * ignore its last ~0.08° — sub-0.1° corrections are exactly the moves a late
 * solver sweep (or a slow camera track) is made of. Here every angle down to
 * numerical zero produces its exact rotation; a degenerate input (zero vector,
 * exact parallel) degrades to the identity; exact antiparallel takes a
 * deterministic 180° flip about a perpendicular (the `|a.x| < 0.9` axis
 * split).
 */
export const rotationBetween = (
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
): IAutoMovieQuaternion => {
  const cross = Vector3.cross(a, b);
  const sin = Vector3.length(cross);
  const cos = Vector3.dot(a, b);
  if (sin < 1e-12) {
    if (cos >= 0) return Quaternion.identity();
    const perp =
      Math.abs(a.x) < 0.9
        ? Vector3.cross(a, { x: 1, y: 0, z: 0 })
        : Vector3.cross(a, { x: 0, y: 1, z: 0 });
    return Quaternion.fromAxisAngle(perp, 180);
  }
  return Quaternion.fromAxisAngle(
    cross,
    (Math.atan2(sin, cos) * 180) / Math.PI,
  );
};

export const blendVec = (
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
  t: number,
): IAutoMovieVector3 =>
  Vector3.add(a, Vector3.scale(Vector3.subtract(b, a), t));

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
