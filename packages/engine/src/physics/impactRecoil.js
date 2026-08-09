import { Vector3 } from "../math/Vector3";
import { clampJointRom } from "../rom/clampPose";
import { getConstraint } from "../rom/humanoidRom";
/**
 * Bridge an {@link IAutoMovieImpact}'s impulse to a recoil
 * {@link IAutoMovieRecoilPush}: the missing consumer between collision response
 * and flinch. The impulse magnitude (N·s) scaled by `gainDegPerImpulse` becomes
 * the `flexion` the struck body yields; {@link impactRecoil} then bounds that
 * push by joint ROM and spreads it down the chain. Kept deliberately simple
 * (one dominant flexion axis): it is an AI hint, not a solved contact
 * response.
 *
 * @author Samchon
 */
export const impulseToRecoilPush = (impulse, gainDegPerImpulse) => {
    if (!Number.isFinite(gainDegPerImpulse))
        throw new RangeError(`recoil push gain must be finite, but was ${gainDegPerImpulse}`);
    if (gainDegPerImpulse < 0)
        throw new RangeError(`recoil push gain must be >= 0, but was ${gainDegPerImpulse}`);
    return { flexion: Vector3.length(impulse) * gainDegPerImpulse };
};
/**
 * Scale one input deflection down the recoil chain. An absent or zero push is
 * represented as `null`, the pose model's resting axis, so a zero-excluding ROM
 * does not drag an untouched axis to its minimum and the resulting pose remains
 * legal under the same validator. A non-zero deflection stays explicit for the
 * shared whole-joint ROM clamp.
 */
const scaledPushAxis = (value, scale) => {
    if (value === null)
        return null;
    const scaled = value * scale;
    return scaled === 0 ? null : scaled;
};
const readPushAxis = (axis, value) => {
    if (value === undefined || value === 0)
        return null;
    if (!Number.isFinite(value))
        throw new RangeError(`impact recoil push ${axis} must be finite, but was ${value}`);
    return value;
};
/**
 * Build the **flinch** a struck body yields under an impact: the reactive
 * `push` (a deflection driven by the impulse) propagates down a `chain` of
 * bones (from the contact bone toward the body) losing strength by `falloff`
 * each link, and **each joint only yields as far as its ROM allows**
 * ({@link IAutoMovieJointConstraint}). So what the hit _does_ to the body is
 * bounded by the same joint ranges the engine already validates against: a neck
 * can only snap so far, a spine only bend so much.
 *
 * This is the ROM-aware half of collision response: the reactive force decides
 * how hard the push is, the joint ROM decides how far the body actually goes.
 * The caller maps an {@link IAutoMovieImpact}'s impulse to the `push`
 * magnitude.
 *
 * @author Samchon
 */
export const impactRecoil = (push, chain, skeleton, falloff = 0.6) => {
    if (!Number.isFinite(falloff))
        throw new RangeError(`impact recoil falloff must be finite, but was ${falloff}`);
    if (falloff < 0 || falloff > 1)
        throw new RangeError(`impact recoil falloff must be within [0, 1], but was ${falloff}`);
    const flexion = readPushAxis("flexion", push.flexion);
    const abduction = readPushAxis("abduction", push.abduction);
    const twist = readPushAxis("twist", push.twist);
    const joints = chain.map((bone, i) => {
        const configured = skeleton.bones.find((entry) => entry.bone === bone);
        const constraint = configured === undefined
            ? null
            : getConstraint(bone, configured.constraint);
        const k = Math.pow(falloff, i);
        const recoil = {
            bone,
            flexion: scaledPushAxis(flexion, k),
            abduction: scaledPushAxis(abduction, k),
            twist: scaledPushAxis(twist, k),
        };
        return constraint === null ? recoil : clampJointRom(recoil, constraint);
    });
    return { skeleton: skeleton.id, root: null, joints };
};
//# sourceMappingURL=impactRecoil.js.map