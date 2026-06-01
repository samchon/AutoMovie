import {
  IMoticaSpringDriver,
  IMoticaTransform,
  IMoticaVector3,
} from "@motica/interface";

import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";

/**
 * Cross-frame state for the spring driver: each chain joint's world position on
 * the previous step, which the Verlet integrator differences against the
 * current position to recover velocity. The host owns one of these per spring
 * and threads it through {@link stepSpring}; it is why spring lives outside the
 * pure per-frame {@link "./resolveFrame".resolveFrame} (which has no memory).
 *
 * @author Samchon
 */
export interface IMoticaSpringState {
  /** Joint id → its world position last step (empty on the first step). */
  prev: Map<string, IMoticaVector3>;
}

/** A fresh, empty spring state. */
export const createSpringState = (): IMoticaSpringState => ({
  prev: new Map(),
});

/**
 * Advance one spring ({@link IMoticaSpringDriver}) by a fixed timestep with
 * Verlet integration — the deterministic secondary-motion driver (hair, skirt,
 * tail), modelled on VRM SpringBone.
 *
 * For each non-root chain joint: carry inertia from `(current − previous)`
 * damped by `(1 − drag)`, add gravity, pull toward the rest direction by
 * `stiffness`, then hard-constrain the bone length so the joint stays a fixed
 * distance from its (already-stepped) parent. The result is written to the
 * joint's world matrix and the previous-position state is rolled forward, so
 * replaying the same inputs reproduces the motion frame-for-frame.
 *
 * The root joint (`chain[0]`) is kinematic — driven by the animation — and left
 * untouched; orientation of the moved joints is left to the renderer/skin,
 * which derives it from the joint positions.
 *
 * @author Samchon
 */
export const stepSpring = (
  d: IMoticaSpringDriver,
  world: Map<string, number[]>,
  state: IMoticaSpringState,
  dt: number,
  localById: Map<string, IMoticaTransform>,
): void => {
  const gravity = Vector3.scale(
    Vector3.normalize(d.gravityDir),
    d.gravityPower * dt * dt,
  );
  for (let i = 1; i < d.chain.length; ++i) {
    const id = d.chain[i]!;
    const parentId = d.chain[i - 1]!;
    const parentM = world.get(parentId)!;
    const parentPos = Matrix4.position(parentM);
    const cur = Matrix4.position(world.get(id)!);
    const prev = state.prev.get(id) ?? cur;

    const local = localById.get(id)!;
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

    state.prev.set(id, cur);
    const dec = Matrix4.decompose(world.get(id)!);
    world.set(id, Matrix4.compose(next, dec.rotation, dec.scale));
  }
};
