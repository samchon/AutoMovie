import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
/** A fresh, empty spring state. */
export const createSpringState = () => ({
    prev: new Map(),
    centers: new Map(),
    sprung: new Map(),
});
const readWorld = (world, id, role) => {
    const matrix = world.get(id);
    if (matrix === undefined)
        throw new Error(`spring driver ${role} node "${id}" was not provided`);
    return matrix;
};
const readLocal = (localById, id) => {
    const local = localById.get(id);
    if (local === undefined)
        throw new Error(`spring driver local transform node "${id}" was not provided`);
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
 * constraint (the VRM SpringBone order), so a collision can stretch the bone by
 * up to the push distance for that step rather than tunnel through a body.
 *
 * @author Samchon
 */
export const stepSpring = (d, world, state, dt, localById, colliders = []) => {
    validateSpringInputs(d, dt);
    validateSpringColliders(colliders);
    const centerDelta = readCenterDelta(d, world, state);
    const gravity = Vector3.scale(Vector3.normalize(d.gravityDir), d.gravityPower * dt * dt);
    for (let i = 1; i < d.chain.length; ++i) {
        const id = d.chain[i];
        const parentId = d.chain[i - 1];
        const parentM = readWorld(world, parentId, "parent");
        const parentPos = Matrix4.position(parentM);
        const currentM = readWorld(world, id, "joint");
        const cur = Matrix4.position(currentM);
        const prev = Vector3.add(state.prev.get(id) ?? cur, centerDelta);
        const local = readLocal(localById, id);
        const boneDir = Vector3.normalize(local.translation);
        const boneLength = Vector3.length(local.translation);
        // rest target: the bone at its parent-relative rest direction, in world
        const restDir = Quaternion.rotateVector(Matrix4.decompose(parentM).rotation, boneDir);
        const restPos = Vector3.add(parentPos, Vector3.scale(restDir, boneLength));
        // verlet: inertia + gravity, then a stiffness pull toward rest
        const inertia = Vector3.scale(Vector3.subtract(cur, prev), 1 - d.drag);
        let next = Vector3.add(Vector3.add(cur, inertia), gravity);
        next = Vector3.add(next, Vector3.scale(Vector3.subtract(restPos, next), d.stiffness * dt));
        // hard length constraint against the (already-updated) parent
        next = Vector3.add(parentPos, Vector3.scale(Vector3.normalize(Vector3.subtract(next, parentPos)), boneLength));
        // collision: push the joint out of every penetrated sphere (VRM order:
        // after the length constraint, so a hit stretches rather than tunnels)
        for (const sphere of colliders) {
            const minimum = sphere.radius + d.hitRadius;
            const away = Vector3.subtract(next, sphere.center);
            const distance = Vector3.length(away);
            if (distance < minimum)
                next = Vector3.add(sphere.center, Vector3.scale(distance < 1e-12 ? { x: 0, y: 1, z: 0 } : Vector3.normalize(away), minimum));
        }
        state.prev.set(id, cur);
        state.sprung.set(id, next);
        const dec = Matrix4.decompose(currentM);
        world.set(id, Matrix4.compose(next, dec.rotation, dec.scale));
    }
};
const readCenterDelta = (d, world, state) => {
    if (d.center === null)
        return Vector3.create();
    const center = Matrix4.position(readWorld(world, d.center, "center"));
    const prev = state.centers.get(d.center) ?? center;
    state.centers.set(d.center, center);
    return Vector3.subtract(center, prev);
};
const validateSpringInputs = (d, dt) => {
    validateSpringFinite("time step", dt);
    if (dt <= 0)
        throw new Error(`spring driver time step must be > 0, but was ${dt}`);
    validateSpringFinite("stiffness", d.stiffness);
    if (d.stiffness < 0)
        throw new Error(`spring driver stiffness must be non-negative, but was ${d.stiffness}`);
    validateSpringFinite("drag", d.drag);
    if (d.drag < 0)
        throw new Error(`spring driver drag must be between 0 and 1, but was ${d.drag}`);
    if (d.drag > 1)
        throw new Error(`spring driver drag must be between 0 and 1, but was ${d.drag}`);
    validateSpringFinite("hitRadius", d.hitRadius);
    if (d.hitRadius <= 0)
        throw new Error(`spring driver hitRadius must be > 0, but was ${d.hitRadius}`);
    validateSpringFinite("gravityPower", d.gravityPower);
    if (d.gravityPower < 0)
        throw new Error(`spring driver gravityPower must be non-negative, but was ${d.gravityPower}`);
    validateSpringVector("gravityDir", d.gravityDir);
    if (Vector3.length(d.gravityDir) === 0)
        throw new Error("spring driver gravityDir must be non-zero");
};
const validateSpringColliders = (colliders) => {
    colliders.forEach((sphere, i) => {
        validateSpringVector(`colliders[${i}].center`, sphere.center);
        validateSpringFinite(`colliders[${i}].radius`, sphere.radius);
        if (sphere.radius <= 0)
            throw new Error(`spring driver colliders[${i}].radius must be > 0, but was ${sphere.radius}`);
    });
};
const validateSpringVector = (label, value) => {
    validateSpringFinite(`${label}.x`, value.x);
    validateSpringFinite(`${label}.y`, value.y);
    validateSpringFinite(`${label}.z`, value.z);
};
const validateSpringFinite = (label, value) => {
    if (!Number.isFinite(value))
        throw new Error(`spring driver ${label} must be finite, but was ${value}`);
};
//# sourceMappingURL=spring.js.map