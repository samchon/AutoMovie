import { jointToQuaternion, } from "../kinematics/jointToQuaternion";
import { Quaternion } from "../math/Quaternion";
import { MOTION_ROOT_NODE_ID, lowerSkeletonNodes, } from "../resolve/skeletonNodes";
import { sampleTimes } from "./sampleClock";
import { sampleMotion } from "./sampleMotion";
export { MOTION_ROOT_NODE_ID };
const DEFAULT_SAMPLE_RATE = 24;
/**
 * Bake a humanoid {@link IAutoMovieMotion} (clinical-angle keyframes) into the
 * general {@link IAutoMovieClip} node-channel form, the bridge that makes "the
 * humanoid motion model and the general clip model are the same thing" a
 * provable fact rather than a doc claim: for every baked sample time,
 * `composeScene` over the returned nodes and clip reproduces `resolvePose`'s
 * world transforms exactly (see the parity tests).
 *
 * **What a rotation track carries.** `composeScene` overrides _replace_ a
 * node's local TRS, so each bone's rotation track holds the bone's full local
 * rotation (`rest.rotation ∘ jointToQuaternion(articulation)`), exactly the
 * `localRotation` {@link resolvePose} computes. Bone translations stay the rest
 * translation (articulation never translates) and node scales are pinned to
 * `1`: `resolvePose` never scales bones (it ignores rest scale and the root
 * scale), so the lowered nodes must too, or a scaled rest pose would shear the
 * composed world apart from FK. The motion's root transform becomes
 * translation/rotation tracks on the synthetic root node, mirroring how
 * `resolvePose` seats root bones under `pose.root`'s rotation/translation.
 *
 * **Sampling parity.** `sampleMotion` interpolates clinical angles per axis and
 * then converts to quaternions; a baked rotation track slerps quaternions. The
 * two agree exactly at bake sample times and differ O(step²) between them, so
 * the bake is dense on a fixed clock (`sampleRate`, default 24, the engine's
 * convention) and every easing/bezier curve is captured by the dense samples
 * (inter-sample interpolation is linear/slerp after the bake). Expression
 * channels (morph `weights` tracks) are deferred.
 *
 * @author Samchon
 */
export const motionToClip = (props) => {
    const { motion, skeleton } = props;
    const prefix = props.nodePrefix ?? "";
    const sampleRate = props.sampleRate ?? DEFAULT_SAMPLE_RATE;
    if (!Number.isFinite(sampleRate) || sampleRate <= 0)
        throw new Error(`motionToClip sampleRate must be a finite number > 0, but was ${sampleRate}`);
    if (!Number.isFinite(motion.duration) || motion.duration <= 0)
        throw new Error(`motionToClip motion "${motion.id}" duration must be a finite number > 0, but was ${motion.duration}`);
    if (motion.keyframes.length === 0)
        throw new Error(`motionToClip motion "${motion.id}" must have keyframes to bake`);
    const boneNames = new Set(skeleton.bones.map((bone) => bone.bone));
    const articulated = new Set();
    let hasRoot = false;
    for (const frame of motion.keyframes) {
        for (const joint of frame.pose.joints) {
            if (!boneNames.has(joint.bone))
                throw new Error(`motionToClip motion "${motion.id}" articulates bone "${joint.bone}" that skeleton "${skeleton.id}" does not have`);
            articulated.add(joint.bone);
        }
        if (frame.pose.root !== null)
            hasRoot = true;
    }
    const nodes = lowerSkeletonNodes({ skeleton, prefix });
    const times = sampleTimes(motion.duration, sampleRate);
    const samples = times.map((time) => sampleMotion(motion, time).pose);
    const tracks = [];
    if (hasRoot) {
        tracks.push(rootTrack(times, samples, "translation", prefix), rootTrack(times, samples, "rotation", prefix));
    }
    // Deterministic track order: skeleton declaration order, articulated only.
    // An unarticulated bone keeps its node rest transform, which already equals
    // resolvePose's identity-articulation local rotation.
    for (const bone of skeleton.bones) {
        if (!articulated.has(bone.bone))
            continue;
        const values = [];
        for (const pose of samples) {
            const joint = pose.joints.find((j) => j.bone === bone.bone);
            const articulation = joint === undefined
                ? Quaternion.identity()
                : jointToQuaternion(joint, props.jointAxes?.[bone.bone], props.restFrames?.[bone.bone]);
            const local = Quaternion.multiply(bone.rest.rotation, articulation);
            values.push(local.x, local.y, local.z, local.w);
        }
        tracks.push({
            channel: {
                kind: "node",
                node: `${prefix}${bone.bone}`,
                path: "rotation",
            },
            times: [...times],
            values,
            interpolation: "linear",
        });
    }
    return {
        clip: {
            id: motion.id,
            name: null,
            duration: motion.duration,
            loop: motion.loop,
            tracks,
        },
        nodes,
    };
};
/** The root node's translation or rotation track from the sampled root. */
const rootTrack = (times, samples, path, prefix) => {
    const values = [];
    for (const pose of samples) {
        if (path === "translation") {
            const t = pose.root?.translation ?? { x: 0, y: 0, z: 0 };
            values.push(t.x, t.y, t.z);
        }
        else {
            const r = pose.root?.rotation ?? Quaternion.identity();
            values.push(r.x, r.y, r.z, r.w);
        }
    }
    return {
        channel: { kind: "node", node: `${prefix}${MOTION_ROOT_NODE_ID}`, path },
        times: [...times],
        values,
        interpolation: "linear",
    };
};
//# sourceMappingURL=motionToClip.js.map