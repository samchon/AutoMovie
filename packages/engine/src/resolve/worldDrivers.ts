import {
  IAutoMovieAimDriver,
  IAutoMovieDriver,
  IAutoMovieIKDriver,
  IAutoMovieNode,
  IAutoMovieParentDriver,
  IAutoMovieQuaternion,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";

/**
 * The world-space DRIVE pass: drivers that need the composed hierarchy (a
 * node's world position/orientation) rather than just other channels. It runs
 * **after** the initial compose, reads world matrices, recomputes the owner's
 * world transform, and recomposes the owner's subtree so descendants follow.
 *
 * This step resolves {@link IAutoMovieAimDriver} (look-at: orient a node so one
 * of its axes points at a target — eyes, head, a camera),
 * {@link IAutoMovieParentDriver} (Child-Of: make a node inherit another's world
 * frame, per component — a sword following a hand), and the analytic two-bone
 * {@link IAutoMovieIKDriver} (back-solve a 3-node limb so its tip reaches a goal
 * — arms, legs). Iterative IK (`ccd`/`fabrik`) and `spring` are returned
 * untouched for their own dedicated steps; nothing is silently dropped.
 *
 * @author Samchon
 */
export const resolveWorldDrivers = (
  drivers: IAutoMovieDriver[],
  world: Map<string, number[]>,
  localById: Map<string, IAutoMovieTransform>,
  childrenById: Map<string, string[]>,
): IAutoMovieDriver[] => {
  const deferred: IAutoMovieDriver[] = [];
  for (const d of drivers)
    if (d.type === "aim") applyAim(d, world, localById, childrenById);
    else if (d.type === "parent")
      applyParent(d, world, localById, childrenById);
    else if (d.type === "ik" && d.solver === "twoBone" && d.chain.length === 3)
      applyTwoBoneIK(d, world, localById, childrenById);
    else deferred.push(d);
  return deferred;
};

/** Build the parent → children adjacency the recompose walk needs. */
export const childrenIndex = (
  nodes: IAutoMovieNode[],
): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const n of nodes)
    if (n.parent !== null) {
      const siblings = map.get(n.parent);
      if (siblings !== undefined) siblings.push(n.id);
      else map.set(n.parent, [n.id]);
    }
  return map;
};

const readWorld = (
  world: Map<string, number[]>,
  id: string,
  role: string,
): number[] => {
  const matrix = world.get(id);
  if (matrix === undefined)
    throw new Error(`world driver ${role} node "${id}" was not provided`);
  return matrix;
};

const readLocal = (
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

const applyAim = (
  d: IAutoMovieAimDriver,
  world: Map<string, number[]>,
  localById: Map<string, IAutoMovieTransform>,
  childrenById: Map<string, string[]>,
): void => {
  validateInfluence("aim", d.influence);
  const dec = Matrix4.decompose(readWorld(world, d.owner, "aim owner"));
  const dir = Vector3.subtract(
    Matrix4.position(readWorld(world, d.target, "aim target")),
    dec.position,
  );
  const aimed = aimRotation(dir, d.aimAxis, d.upAxis, d.worldUp);
  const blended = Quaternion.slerp(dec.rotation, aimed, d.influence);
  world.set(d.owner, Matrix4.compose(dec.position, blended, dec.scale));
  recompose(d.owner, world, localById, childrenById);
};

/**
 * Child-Of: the owner inherits the parent node's world frame, component by
 * component (translation / rotation / scale), keeping its own value for the
 * components the flags leave off. Then its subtree recomposes.
 */
const applyParent = (
  d: IAutoMovieParentDriver,
  world: Map<string, number[]>,
  localById: Map<string, IAutoMovieTransform>,
  childrenById: Map<string, string[]>,
): void => {
  const own = Matrix4.decompose(readWorld(world, d.owner, "parent owner"));
  const par = Matrix4.decompose(readWorld(world, d.parent, "parent parent"));
  world.set(
    d.owner,
    Matrix4.compose(
      d.translation ? par.position : own.position,
      d.rotation ? par.rotation : own.rotation,
      d.scale ? par.scale : own.scale,
    ),
  );
  recompose(d.owner, world, localById, childrenById);
};

/**
 * Analytic two-bone IK: rotate a 3-node limb (`root → mid → tip`) so the tip
 * reaches `goal`, bending in the plane the pole picks (or the limb's current
 * plane). The interior angles come from the law of cosines over the two bone
 * lengths and the (reach-clamped) root→goal distance; the tip lands on the goal
 * exactly when the goal is reachable. Bone lengths are preserved, the result is
 * blended by `influence`, and the tip's subtree recomposes.
 *
 * Operates directly on the chain's world matrices (the renderer consumes world
 * transforms), so it needs no world→local round-trip.
 */
const applyTwoBoneIK = (
  d: IAutoMovieIKDriver,
  world: Map<string, number[]>,
  localById: Map<string, IAutoMovieTransform>,
  childrenById: Map<string, string[]>,
): void => {
  validateInfluence("two-bone IK", d.influence);
  const rootId = d.chain[0]!;
  const midId = d.chain[1]!;
  const tipId = d.chain[2]!;
  const rootM = readWorld(world, rootId, "two-bone IK root");
  const midM = readWorld(world, midId, "two-bone IK mid");
  const tipM = readWorld(world, tipId, "two-bone IK tip");
  const rootP = Matrix4.position(rootM);
  const midP = Matrix4.position(midM);
  const tipP = Matrix4.position(tipM);
  const goalP = Matrix4.position(readWorld(world, d.goal, "two-bone IK goal"));

  const upper = Vector3.subtract(midP, rootP);
  const lower = Vector3.subtract(tipP, midP);
  const l1 = Vector3.length(upper);
  const l2 = Vector3.length(lower);

  const toGoal = Vector3.subtract(goalP, rootP);
  const goalLen = Vector3.length(toGoal);
  const reach = clamp(goalLen, Math.abs(l1 - l2) + 1e-5, l1 + l2 - 1e-5);
  const dir =
    goalLen < 1e-8
      ? Vector3.normalize(upper)
      : Vector3.scale(toGoal, 1 / goalLen);

  // Bend plane: from the pole (when one is wired) else the limb's current bend.
  const poleRef =
    d.pole !== null && d.pole.node !== null
      ? Vector3.subtract(
          Matrix4.position(readWorld(world, d.pole.node, "two-bone IK pole")),
          rootP,
        )
      : upper;
  let axis = Vector3.cross(dir, poleRef);
  if (Vector3.length(axis) < 1e-8) axis = anyPerp(dir);
  axis = Vector3.normalize(axis);

  const cosRoot = clamp(
    (l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach),
    -1,
    1,
  );
  const bend = Quaternion.fromAxisAngle(
    axis,
    (Math.acos(cosRoot) * 180) / Math.PI,
  );
  const newMid = Vector3.add(
    rootP,
    Vector3.scale(Quaternion.rotateVector(bend, dir), l1),
  );
  const newTip = Vector3.add(rootP, Vector3.scale(dir, reach));

  const rootDelta = quatFromTo(
    Vector3.normalize(upper),
    Vector3.normalize(Vector3.subtract(newMid, rootP)),
  );
  const midDelta = quatFromTo(
    Vector3.normalize(lower),
    Vector3.normalize(Vector3.subtract(newTip, newMid)),
  );
  const rootDec = Matrix4.decompose(rootM);
  const midDec = Matrix4.decompose(midM);
  const tipDec = Matrix4.decompose(tipM);
  const t = d.influence;

  world.set(
    rootId,
    Matrix4.compose(
      rootP,
      Quaternion.slerp(
        rootDec.rotation,
        Quaternion.multiply(rootDelta, rootDec.rotation),
        t,
      ),
      rootDec.scale,
    ),
  );
  world.set(
    midId,
    Matrix4.compose(
      blendVec(midP, newMid, t),
      Quaternion.slerp(
        midDec.rotation,
        Quaternion.multiply(midDelta, midDec.rotation),
        t,
      ),
      midDec.scale,
    ),
  );
  world.set(
    tipId,
    Matrix4.compose(blendVec(tipP, newTip, t), tipDec.rotation, tipDec.scale),
  );
  recompose(tipId, world, localById, childrenById);
};

const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));

const validateInfluence = (label: string, influence: number): void => {
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

const blendVec = (
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
  t: number,
): IAutoMovieVector3 =>
  Vector3.add(a, Vector3.scale(Vector3.subtract(b, a), t));

/** Some unit vector perpendicular to `v` (for a straight limb's free bend). */
const anyPerp = (v: IAutoMovieVector3): IAutoMovieVector3 => {
  const c = Vector3.cross(v, { x: 0, y: 1, z: 0 });
  return Vector3.length(c) > 1e-6
    ? Vector3.normalize(c)
    : Vector3.normalize(Vector3.cross(v, { x: 1, y: 0, z: 0 }));
};

/** Recompute every descendant's world matrix from a node's updated world. */
const recompose = (
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
 * The world-space orientation that points `aimAxis` (owner-local) along `dir`,
 * then twists about `dir` to bring `upAxis` as close as possible to `worldUp`
 * (the standard two-step aim constraint). If `worldUp` (or the rolled up
 * vector) is parallel to `dir` the roll is undefined and skipped.
 */
const aimRotation = (
  dir: IAutoMovieVector3,
  aimAxis: IAutoMovieVector3,
  upAxis: IAutoMovieVector3,
  worldUp: IAutoMovieVector3,
): IAutoMovieQuaternion => {
  const f = Vector3.normalize(dir);
  const r1 = quatFromTo(Vector3.normalize(aimAxis), f);

  const desired = projectPerp(worldUp, f);
  const current = projectPerp(Quaternion.rotateVector(r1, upAxis), f);
  const dl = Vector3.length(desired);
  const cl = Vector3.length(current);
  if (dl < 1e-8 || cl < 1e-8) return r1;

  const du = Vector3.scale(desired, 1 / dl);
  const cu = Vector3.scale(current, 1 / cl);
  const cos = Math.max(-1, Math.min(1, Vector3.dot(cu, du)));
  const sin = Vector3.dot(Vector3.cross(cu, du), f);
  const r2 = Quaternion.fromAxisAngle(
    f,
    (Math.atan2(sin, cos) * 180) / Math.PI,
  );
  return Quaternion.multiply(r2, r1);
};

/** Component of `v` perpendicular to the unit axis `f`. */
const projectPerp = (
  v: IAutoMovieVector3,
  f: IAutoMovieVector3,
): IAutoMovieVector3 =>
  Vector3.subtract(v, Vector3.scale(f, Vector3.dot(v, f)));

/** Shortest-arc rotation from unit vector `a` to unit vector `b`. */
const quatFromTo = (
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
): IAutoMovieQuaternion => {
  const d = Vector3.dot(a, b);
  if (d > 0.999999) return Quaternion.identity();
  if (d < -0.999999) {
    const perp =
      Math.abs(a.x) < 0.9
        ? Vector3.cross(a, { x: 1, y: 0, z: 0 })
        : Vector3.cross(a, { x: 0, y: 1, z: 0 });
    return Quaternion.fromAxisAngle(perp, 180);
  }
  return Quaternion.fromAxisAngle(
    Vector3.cross(a, b),
    (Math.acos(d) * 180) / Math.PI,
  );
};
