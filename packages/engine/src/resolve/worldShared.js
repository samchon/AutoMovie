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
 */
export const readWorld = (world, id, role) => {
    const matrix = world.get(id);
    if (matrix === undefined)
        throw new Error(`world driver ${role} node "${id}" was not provided`);
    return matrix;
};
export const readLocal = (localById, id) => {
    const local = localById.get(id);
    if (local === undefined)
        throw new Error(`world driver descendant local transform node "${id}" was not provided`);
    return local;
};
/** Recompute every descendant's world matrix from a node's updated world. */
export const recompose = (id, world, localById, childrenById) => {
    const parentWorld = readWorld(world, id, "recompose parent");
    for (const child of childrenById.get(id) ?? []) {
        const t = readLocal(localById, child);
        const local = Matrix4.compose(t.translation, t.rotation, t.scale);
        world.set(child, Matrix4.multiply(parentWorld, local));
        recompose(child, world, localById, childrenById);
    }
};
export const blendVec = (a, b, t) => Vector3.add(a, Vector3.scale(Vector3.subtract(b, a), t));
export const validateInfluence = (label, influence) => {
    if (!Number.isFinite(influence))
        throw new Error(`world driver ${label} influence must be finite, but was ${influence}`);
    if (influence < 0)
        throw new Error(`world driver ${label} influence must be between 0 and 1, but was ${influence}`);
    if (influence > 1)
        throw new Error(`world driver ${label} influence must be between 0 and 1, but was ${influence}`);
};
//# sourceMappingURL=worldShared.js.map