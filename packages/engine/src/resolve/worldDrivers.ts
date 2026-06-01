import {
  IMoticaAimDriver,
  IMoticaDriver,
  IMoticaNode,
  IMoticaParentDriver,
  IMoticaQuaternion,
  IMoticaTransform,
  IMoticaVector3,
} from "@motica/interface";

import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";

/**
 * The world-space DRIVE pass: drivers that need the composed hierarchy (a
 * node's world position/orientation) rather than just other channels. It runs
 * **after** the initial compose, reads world matrices, recomputes the owner's
 * world transform, and recomposes the owner's subtree so descendants follow.
 *
 * This step resolves {@link IMoticaAimDriver} (look-at: orient a node so one of
 * its axes points at a target — eyes, head, a camera) and
 * {@link IMoticaParentDriver} (Child-Of: make a node inherit another's world
 * frame, per component — a sword following a hand). The remaining world-space
 * drivers (`ik`, `spring`) are returned untouched for their own dedicated
 * steps; nothing is silently dropped.
 *
 * @author Samchon
 */
export const resolveWorldDrivers = (
  drivers: IMoticaDriver[],
  world: Map<string, number[]>,
  localById: Map<string, IMoticaTransform>,
  childrenById: Map<string, string[]>,
): IMoticaDriver[] => {
  const deferred: IMoticaDriver[] = [];
  for (const d of drivers)
    if (d.type === "aim") applyAim(d, world, localById, childrenById);
    else if (d.type === "parent")
      applyParent(d, world, localById, childrenById);
    else deferred.push(d);
  return deferred;
};

/** Build the parent → children adjacency the recompose walk needs. */
export const childrenIndex = (nodes: IMoticaNode[]): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const n of nodes)
    if (n.parent !== null) {
      const siblings = map.get(n.parent);
      if (siblings !== undefined) siblings.push(n.id);
      else map.set(n.parent, [n.id]);
    }
  return map;
};

const applyAim = (
  d: IMoticaAimDriver,
  world: Map<string, number[]>,
  localById: Map<string, IMoticaTransform>,
  childrenById: Map<string, string[]>,
): void => {
  const dec = Matrix4.decompose(world.get(d.owner)!);
  const dir = Vector3.subtract(
    Matrix4.position(world.get(d.target)!),
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
  d: IMoticaParentDriver,
  world: Map<string, number[]>,
  localById: Map<string, IMoticaTransform>,
  childrenById: Map<string, string[]>,
): void => {
  const own = Matrix4.decompose(world.get(d.owner)!);
  const par = Matrix4.decompose(world.get(d.parent)!);
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

/** Recompute every descendant's world matrix from a node's updated world. */
const recompose = (
  id: string,
  world: Map<string, number[]>,
  localById: Map<string, IMoticaTransform>,
  childrenById: Map<string, string[]>,
): void => {
  const parentWorld = world.get(id)!;
  for (const child of childrenById.get(id) ?? []) {
    const t = localById.get(child)!;
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
  dir: IMoticaVector3,
  aimAxis: IMoticaVector3,
  upAxis: IMoticaVector3,
  worldUp: IMoticaVector3,
): IMoticaQuaternion => {
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
const projectPerp = (v: IMoticaVector3, f: IMoticaVector3): IMoticaVector3 =>
  Vector3.subtract(v, Vector3.scale(f, Vector3.dot(v, f)));

/** Shortest-arc rotation from unit vector `a` to unit vector `b`. */
const quatFromTo = (
  a: IMoticaVector3,
  b: IMoticaVector3,
): IMoticaQuaternion => {
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
