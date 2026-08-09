import { HUMANOID_JOINT_AXES } from "../kinematics/humanoidJointAxes";
import { validateJointAxesBasis, } from "../kinematics/jointToQuaternion";
import { resolvePose } from "../kinematics/resolvePose";
import { HUMANOID_REST_FRAME } from "../rom/restFrame";
import { compareCodeUnits } from "../text/compareCodeUnits";
import { validateMotion } from "../validation/validateMotion";
import { validateTransformScalars } from "../validation/validateTransformScalars";
import { ViolationCollector } from "../validation/violation";
import { preserveRetargetContacts, } from "./retargetContacts";
const EPSILON = 1e-6;
/**
 * Retarget a humanoid clip from one normalized skeleton onto another.
 *
 * The clip's joint angles remain **clinical**. Retargeting changes the skeleton
 * id, scales root translation by target/source rest height, validates the
 * result against the target skeleton's ROM policy, and returns the target
 * `jointAxes`/`restFrames` that convert those clinical values into target
 * rig-space during FK or viewer playback.
 *
 * A verbatim angle copy is exact only for a **proportional** target. When the
 * rigs differ in proportion, {@link preserveRetargetContacts} re-pins each
 * contacting limb onto the source contact mapped through the same `rootScale`,
 * so a planted foot lands where the performance put it instead of sliding. The
 * pass runs by default, corrects the clip at its authored keyframe times, and
 * reports a residual it could not reach under the target's ROM as a `warning`,
 * the returned `validation` still succeeds.
 *
 * @author Samchon
 */
export const retargetHumanoidMotion = (props) => {
    const collector = new ViolationCollector();
    const requiredBones = collectRequiredBones(props);
    props.motion.skeleton === props.source.id ||
        collector.push("type", "$input.motion.skeleton", "motion skeleton must match the source skeleton id", props.motion.skeleton);
    validateSkeleton("source", props.source, requiredBones, collector);
    validateSkeleton("target", props.target, requiredBones, collector);
    validateBinding("sourceBinding", props.sourceBinding, requiredBones, collector);
    validateBinding("targetBinding", props.targetBinding, requiredBones, collector);
    validateAxes("sourceJointAxes", props.sourceJointAxes ?? HUMANOID_JOINT_AXES, collector);
    validateAxes("targetJointAxes", props.targetJointAxes ?? HUMANOID_JOINT_AXES, collector);
    validateRestFrames("sourceRestFrames", props.sourceRestFrames ?? HUMANOID_REST_FRAME, collector);
    validateRestFrames("targetRestFrames", props.targetRestFrames ?? HUMANOID_REST_FRAME, collector);
    const sourceSpan = restVerticalSpan(props.source);
    const targetSpan = restVerticalSpan(props.target);
    const sourceHeight = sourceSpan.height;
    const targetHeight = targetSpan.height;
    if (!(sourceHeight > EPSILON))
        collector.push("range", "$input.source.scale", "source skeleton rest height must be finite and > 0 to derive root scale", sourceHeight);
    if (!(targetHeight > EPSILON))
        collector.push("range", "$input.target.scale", "target skeleton rest height must be finite and > 0 to derive root scale", targetHeight);
    const rootScale = props.rootScale ??
        (sourceHeight > EPSILON ? targetHeight / sourceHeight : 0);
    if (!Number.isFinite(rootScale) || !(rootScale > 0))
        collector.push("range", "$input.rootScale", "rootScale must be a finite number > 0", props.rootScale ?? rootScale);
    if (collector.items.length > 0)
        return {
            validation: collector.toValidation(),
            motion: null,
            characterization: null,
        };
    // Resolved once: the characterization, the contact pass's source FK, and the
    // contact pass's target FK must all read the clip through the same tables.
    const sourceJointAxes = props.sourceJointAxes ?? HUMANOID_JOINT_AXES;
    const sourceRestFrames = props.sourceRestFrames ?? HUMANOID_REST_FRAME;
    const targetJointAxes = props.targetJointAxes ?? HUMANOID_JOINT_AXES;
    const targetRestFrames = props.targetRestFrames ?? HUMANOID_REST_FRAME;
    const source = characterizeRig({
        skeleton: props.source,
        binding: props.sourceBinding,
        height: sourceHeight,
        jointAxes: sourceJointAxes,
        restFrames: sourceRestFrames,
    });
    const target = characterizeRig({
        skeleton: props.target,
        binding: props.targetBinding,
        height: targetHeight,
        jointAxes: targetJointAxes,
        restFrames: targetRestFrames,
    });
    const scaled = retargetMotion(props.motion, props.target.id, rootScale, props.id);
    const contactsEnabled = props.contacts?.enabled ?? true;
    const motion = contactsEnabled
        ? preserveRetargetContacts({
            source: props.source,
            target: props.target,
            sourceMotion: props.motion,
            retargeted: scaled,
            rootScale,
            sourceFloor: sourceSpan.floor,
            sourceJointAxes,
            sourceRestFrames,
            targetJointAxes,
            targetRestFrames,
            contacts: props.contacts,
            collector,
        })
        : scaled;
    const targetValidation = validateMotion({ motion, skeleton: props.target });
    if (!targetValidation.success) {
        collector.items.push(...targetValidation.violations);
        return {
            validation: collector.toValidation(),
            motion: null,
            characterization: null,
        };
    }
    return {
        validation: collector.toValidation(),
        motion,
        characterization: {
            source,
            target,
            rootScale,
            facing: "preserve-authored",
            romPolicy: "target-override-then-default-humanoid",
            contactPolicy: contactsEnabled
                ? "pin-source-contacts"
                : "carry-joint-angles",
            requiredBones,
        },
    };
};
const collectRequiredBones = (props) => {
    const bones = new Set(["hips"]);
    for (const kf of props.motion.keyframes)
        for (const joint of kf.pose.joints)
            bones.add(joint.bone);
    for (const bone of props.requiredBones ?? [])
        bones.add(bone);
    return [...bones].sort(compareCodeUnits);
};
const validateSkeleton = (label, skeleton, requiredBones, collector) => {
    const path = `$input.${label}`;
    const byBone = new Map();
    skeleton.bones.forEach((bone, i) => {
        const bonePath = `${path}.bones[${i}]`;
        if (byBone.has(bone.bone))
            collector.push("type", `${bonePath}.bone`, `bone "${bone.bone}" appears more than once in the ${label} skeleton`, bone.bone);
        byBone.set(bone.bone, i);
        validateTransformScalars({
            transform: bone.rest,
            path: `${bonePath}.rest`,
            label: `${label} bone rest transform`,
            collector,
        });
    });
    for (const bone of skeleton.bones)
        if (bone.parent !== null && !byBone.has(bone.parent))
            collector.push("type", `${path}.bones[${byBone.get(bone.bone)}].parent`, `parent bone "${bone.parent}" must be present in the ${label} skeleton`, bone.parent);
    for (const bone of requiredBones)
        if (!byBone.has(bone))
            collector.push("type", `${path}.bones["${bone}"]`, `required bone "${bone}" is missing from the ${label} skeleton`, bone);
};
const validateBinding = (label, binding, requiredBones, collector) => {
    if (binding === undefined)
        return;
    for (const bone of requiredBones) {
        const mapped = binding.boneMap[bone];
        if (mapped === undefined || mapped.trim().length === 0)
            collector.push("type", `$input.${label}.boneMap.${bone}`, `binding must map required humanoid bone "${bone}" to a concrete node id`, mapped);
    }
};
const validateAxes = (label, axes, collector) => {
    for (const [bone, table] of Object.entries(axes))
        for (const issue of validateJointAxesBasis(table, `$input.${label}.${bone}`))
            collector.push("range", issue.path, issue.expected, issue.value);
};
const validateRestFrames = (label, frames, collector) => {
    for (const [bone, frame] of Object.entries(frames))
        for (const axis of ["flexion", "abduction", "twist"]) {
            const axisFrame = frame[axis];
            if (axisFrame === undefined)
                continue;
            if (axisFrame.sign !== 1 && axisFrame.sign !== -1)
                collector.push("type", `$input.${label}.${bone}.${axis}.sign`, "rest-frame sign must be 1 or -1", axisFrame.sign);
            if (!Number.isFinite(axisFrame.neutral))
                collector.push("range", `$input.${label}.${bone}.${axis}.neutral`, "rest-frame neutral angle must be finite", axisFrame.neutral);
        }
};
/**
 * The rig's rest-pose vertical extent: `height` drives the root-motion scale,
 * `floor` is the world Y its lowest bone sits at, the ground plane the contact
 * pass judges stance against, so a rig authored with its feet above the origin
 * is still detected as standing on something.
 */
const restVerticalSpan = (skeleton) => {
    const resolved = resolvePose({ skeleton: skeleton.id, root: null, joints: [] }, skeleton);
    if (resolved.length === 0)
        return { floor: 0, height: 0 };
    let minY = Infinity;
    let maxY = -Infinity;
    for (const bone of resolved) {
        minY = Math.min(minY, bone.worldPosition.y);
        maxY = Math.max(maxY, bone.worldPosition.y);
    }
    return { floor: minY, height: maxY - minY };
};
const characterizeRig = (props) => {
    const slots = new Set(props.skeleton.bones.map((bone) => bone.bone));
    const boneMap = {};
    const jointAxes = {};
    const restFrames = {};
    for (const slot of slots) {
        boneMap[slot] = props.binding?.boneMap[slot] ?? slot;
        if (props.jointAxes[slot] !== undefined)
            jointAxes[slot] = props.jointAxes[slot];
        if (props.restFrames[slot] !== undefined)
            restFrames[slot] = props.restFrames[slot];
    }
    return {
        skeleton: props.skeleton.id,
        boneMap,
        height: props.height,
        jointAxes,
        restFrames,
    };
};
const retargetMotion = (motion, targetSkeleton, rootScale, id) => ({
    ...motion,
    id: id ?? `${motion.id}:to:${targetSkeleton}`,
    skeleton: targetSkeleton,
    keyframes: motion.keyframes.map((kf) => ({
        ...kf,
        pose: {
            ...kf.pose,
            skeleton: targetSkeleton,
            root: kf.pose.root === null
                ? null
                : {
                    ...kf.pose.root,
                    translation: {
                        x: kf.pose.root.translation.x * rootScale,
                        y: kf.pose.root.translation.y * rootScale,
                        z: kf.pose.root.translation.z * rootScale,
                    },
                },
        },
    })),
});
//# sourceMappingURL=retargetHumanoidMotion.js.map