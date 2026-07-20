import {
  IAutoMovieSpringDriver,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";

/**
 * Cross-frame state for the spring driver: each chain joint's world position on
 * the previous step, which the Verlet integrator differences against the
 * current position to recover velocity. The caller owns one of these per scene
 * and threads it through {@link stepSpring}, either directly, or by handing it
 * to {@link "./resolveFrame".resolveFrame} via its `springs` input, which then
 * steps every spring driver inside the frame pass (S2). Without a state and a
 * `dt` the per-frame resolve has no memory, so springs defer.
 *
 * @author Samchon
 */
export interface IAutoMovieSpringState {
  /** Joint id → its world position last step (empty on the first step). */
  prev: Map<string, IAutoMovieVector3>;
  /** Center node id -> its world position last step for center-relative inertia. */
  centers: Map<string, IAutoMovieVector3>;
  /**
   * Joint id → its **post-spring** world position last step, what a host loop
   * would have left in its carried world map. {@link resolveFrame} composes the
   * scene fresh every frame, so it seeds each chain joint from here before
   * stepping; that is what lets the in-frame spring accumulate sag across
   * frames exactly like the host-loop harness.
   */
  sprung: Map<string, IAutoMovieVector3>;
}

/** A fresh, empty spring state. */
export const createSpringState = (): IAutoMovieSpringState => ({
  prev: new Map(),
  centers: new Map(),
  sprung: new Map(),
});

/**
 * A world-space collision sphere the spring chain keeps out of: a head, a
 * torso, a shoulder pad. A chain joint is pushed to the sphere's surface plus
 * the driver's own `hitRadius` (the joint's physical thickness), completing the
 * VRM SpringBone collision semantics that `hitRadius` always declared.
 *
 * @author Samchon
 */
export interface IAutoMovieSpringSphere {
  /** Sphere center in world space. */
  center: IAutoMovieVector3;
  /** Sphere radius, meters. Strictly positive. */
  radius: number;
}

const readWorld = (
  world: Map<string, number[]>,
  id: string,
  role: string,
): number[] => {
  const matrix = world.get(id);
  if (matrix === undefined)
    throw new Error(`spring driver ${role} node "${id}" was not provided`);
  return matrix;
};

const readLocal = (
  localById: Map<string, IAutoMovieTransform>,
  id: string,
): IAutoMovieTransform => {
  const local = localById.get(id);
  if (local === undefined)
    throw new Error(
      `spring driver local transform node "${id}" was not provided`,
    );
  return local;
};

/**
 * Advance one spring ({@link IAutoMovieSpringDriver}) by a fixed timestep with
 * Verlet integration, the deterministic secondary-motion driver (hair, skirt,
 * tail), modelled on VRM SpringBone.
 *
 * For each non-root chain joint: carry inertia from `(current − previous)`
 * damped by `(1 − drag)`, add gravity, pull toward the rest direction by
 * `stiffness`, then hard-constrain the bone length so the joint stays a fixed
 * distance from its (already-stepped) parent. The result is written to the
 * joint's world matrix and the previous-position state is rolled forward, so
 * replaying the same inputs reproduces the motion frame-for-frame.
 *
 * The root joint (`chain[0]`) is kinematic, driven by the animation, and left
 * untouched; orientation of the moved joints is left to the renderer/skin,
 * which derives it from the joint positions.
 *
 * When `colliders` are given, each stepped joint is pushed out of every sphere
 * it penetrates (surface + the driver's `hitRadius`) **after** the length
 * constraint (the VRM SpringBone order), so a collision can stretch the bone
 * by up to the push distance for that step rather than tunnel through a body.
 *
 * @author Samchon
 */
export const stepSpring = (
  d: IAutoMovieSpringDriver,
  world: Map<string, number[]>,
  state: IAutoMovieSpringState,
  dt: number,
  localById: Map<string, IAutoMovieTransform>,
  colliders: readonly IAutoMovieSpringSphere[] = [],
): void => {
  validateSpringInputs(d, dt);
  validateSpringColliders(colliders);
  const centerDelta = readCenterDelta(d, world, state);
  const gravity = Vector3.scale(
    Vector3.normalize(d.gravityDir),
    d.gravityPower * dt * dt,
  );
  for (let i = 1; i < d.chain.length; ++i) {
    const id = d.chain[i]!;
    const parentId = d.chain[i - 1]!;
    const parentM = readWorld(world, parentId, "parent");
    const parentPos = Matrix4.position(parentM);
    const currentM = readWorld(world, id, "joint");
    const cur = Matrix4.position(currentM);
    const prev = Vector3.add(state.prev.get(id) ?? cur, centerDelta);

    const local = readLocal(localById, id);
    const boneDir = Vector3.normalize(local.translation);
    const boneLength = Vector3.length(local.translation);

    // rest target: the bone at its parent-relative rest direction, in world
    const restDir = Quaternion.rotateVector(
      Matrix4.decompose(parentM).rotation,
      boneDir,
    );
    const restPos = Vector3.add(parentPos, Vector3.scale(restDir, boneLength));

    // verlet: inertia + gravity, then a stiffness pull toward rest
    const inertia = Vector3.scale(Vector3.subtract(cur, prev), 1 - d.drag);
    let next = Vector3.add(Vector3.add(cur, inertia), gravity);
    next = Vector3.add(
      next,
      Vector3.scale(Vector3.subtract(restPos, next), d.stiffness * dt),
    );

    // hard length constraint against the (already-updated) parent
    next = Vector3.add(
      parentPos,
      Vector3.scale(
        Vector3.normalize(Vector3.subtract(next, parentPos)),
        boneLength,
      ),
    );

    // collision: push the joint out of every penetrated sphere (VRM order:
    // after the length constraint, so a hit stretches rather than tunnels)
    for (const sphere of colliders) {
      const minimum = sphere.radius + d.hitRadius;
      const away = Vector3.subtract(next, sphere.center);
      const distance = Vector3.length(away);
      if (distance < minimum)
        next = Vector3.add(
          sphere.center,
          Vector3.scale(
            distance < 1e-12 ? { x: 0, y: 1, z: 0 } : Vector3.normalize(away),
            minimum,
          ),
        );
    }

    state.prev.set(id, cur);
    state.sprung.set(id, next);
    const dec = Matrix4.decompose(currentM);
    world.set(id, Matrix4.compose(next, dec.rotation, dec.scale));
  }
};

const readCenterDelta = (
  d: IAutoMovieSpringDriver,
  world: Map<string, number[]>,
  state: IAutoMovieSpringState,
): IAutoMovieVector3 => {
  if (d.center === null) return Vector3.create();

  const center = Matrix4.position(readWorld(world, d.center, "center"));
  const prev = state.centers.get(d.center) ?? center;
  state.centers.set(d.center, center);
  return Vector3.subtract(center, prev);
};

const validateSpringInputs = (d: IAutoMovieSpringDriver, dt: number): void => {
  validateSpringFinite("time step", dt);
  if (dt <= 0)
    throw new Error(`spring driver time step must be > 0, but was ${dt}`);

  validateSpringFinite("stiffness", d.stiffness);
  if (d.stiffness < 0)
    throw new Error(
      `spring driver stiffness must be non-negative, but was ${d.stiffness}`,
    );
  validateSpringFinite("drag", d.drag);
  if (d.drag < 0)
    throw new Error(
      `spring driver drag must be between 0 and 1, but was ${d.drag}`,
    );
  if (d.drag > 1)
    throw new Error(
      `spring driver drag must be between 0 and 1, but was ${d.drag}`,
    );
  validateSpringFinite("hitRadius", d.hitRadius);
  if (d.hitRadius <= 0)
    throw new Error(
      `spring driver hitRadius must be > 0, but was ${d.hitRadius}`,
    );
  validateSpringFinite("gravityPower", d.gravityPower);
  if (d.gravityPower < 0)
    throw new Error(
      `spring driver gravityPower must be non-negative, but was ${d.gravityPower}`,
    );
  validateSpringVector("gravityDir", d.gravityDir);
  if (Vector3.length(d.gravityDir) === 0)
    throw new Error("spring driver gravityDir must be non-zero");
};

const validateSpringColliders = (
  colliders: readonly IAutoMovieSpringSphere[],
): void => {
  colliders.forEach((sphere, i) => {
    validateSpringVector(`colliders[${i}].center`, sphere.center);
    validateSpringFinite(`colliders[${i}].radius`, sphere.radius);
    if (sphere.radius <= 0)
      throw new Error(
        `spring driver colliders[${i}].radius must be > 0, but was ${sphere.radius}`,
      );
  });
};

const validateSpringVector = (
  label: string,
  value: IAutoMovieVector3,
): void => {
  validateSpringFinite(`${label}.x`, value.x);
  validateSpringFinite(`${label}.y`, value.y);
  validateSpringFinite(`${label}.z`, value.z);
};

const validateSpringFinite = (label: string, value: number): void => {
  if (!Number.isFinite(value))
    throw new Error(`spring driver ${label} must be finite, but was ${value}`);
};
