import { indexSkeletonTopology, resolvePose, } from "../kinematics";
import { windowSampleTimes } from "../motion/sampleClock";
import { sampleMotion } from "../motion/sampleMotion";
import { fkReachableBones } from "./fkReachableBones";
import { ViolationCollector } from "./violation";
const DEFAULT_SAMPLE_RATE = 24;
const DEFAULT_MAX_HORIZONTAL_SPEED = 0.02;
/**
 * Tier-3 planted-foot skate check. It samples declared contact windows,
 * resolves the foot through FK, and reports any adjacent samples whose
 * horizontal world-space speed exceeds the contact tolerance.
 *
 * This validator is opt-in and contact-window driven: locomotion, jumps, and
 * stylized gestures can all move feet legally unless the caller marks a foot as
 * planted for a particular time span.
 *
 * Foot skate is a physical-plausibility **warning**, not a gate: the run still
 * succeeds and the warning surfaces so the orchestrator can plant the foot
 * (IK), restage, or acknowledge a deliberate slide with `physicsIntent`. Only
 * malformed annotations (bad bone, window, or rate) are errors.
 *
 * @author Samchon
 */
export const validateFootSkate = (props) => {
    const collector = new ViolationCollector();
    const suppressed = props.physicsIntent !== undefined;
    const sampleRate = props.sampleRate ?? DEFAULT_SAMPLE_RATE;
    const path = props.path ?? "$input";
    const skeletonBones = new Set(props.skeleton.bones.map((bone) => bone.bone));
    const topology = indexSkeletonTopology(props.skeleton);
    const reachableBones = fkReachableBones(props.skeleton, topology);
    if (!Number.isFinite(sampleRate) || sampleRate <= 0)
        collector.push("range", `${path}.sampleRate`, `sampleRate must be a finite number > 0, but was ${sampleRate}`, sampleRate);
    props.contacts.forEach((contact, contactIndex) => {
        const cp = `${path}.contacts[${contactIndex}]`;
        const maxHorizontalSpeed = contact.maxHorizontalSpeed ?? DEFAULT_MAX_HORIZONTAL_SPEED;
        if (!skeletonBones.has(contact.bone))
            collector.push("type", `${cp}.bone`, `contact bone "${contact.bone}" must exist in the target skeleton`, contact.bone);
        // A declared-but-detached bone (its parent chain never reaches a root) is
        // never returned by FK, so reading its resolved position would crash rather
        // than report the malformed rig. Gate on FK-reachability, not just
        // declaration, and skip sampling when it is unreachable.
        const boneUnreachable = skeletonBones.has(contact.bone) && !reachableBones.has(contact.bone);
        if (boneUnreachable)
            collector.push("type", `${cp}.bone`, `contact bone "${contact.bone}" is declared but not reachable from a root bone via forward kinematics`, contact.bone);
        if (!Number.isFinite(contact.start) ||
            !Number.isFinite(contact.end) ||
            contact.end <= contact.start)
            collector.push("temporal", cp, `contact window must have finite start/end with end > start, but was [${contact.start}, ${contact.end}]`, { start: contact.start, end: contact.end });
        if (!Number.isFinite(maxHorizontalSpeed) || maxHorizontalSpeed < 0)
            collector.push("range", `${cp}.maxHorizontalSpeed`, `maxHorizontalSpeed must be a finite number >= 0, but was ${maxHorizontalSpeed}`, maxHorizontalSpeed);
        if (!skeletonBones.has(contact.bone) ||
            boneUnreachable ||
            !Number.isFinite(contact.start) ||
            !Number.isFinite(contact.end) ||
            contact.end <= contact.start ||
            !Number.isFinite(maxHorizontalSpeed) ||
            maxHorizontalSpeed < 0 ||
            !Number.isFinite(sampleRate) ||
            sampleRate <= 0)
            return;
        const samples = sampleWindow(props.motion, props.skeleton, contact, sampleRate, props.jointAxes, props.restFrames, topology);
        for (let index = 1; index < samples.length; index++) {
            const previous = samples[index - 1];
            const current = samples[index];
            const speed = horizontalSpeed(previous, current);
            if (speed > maxHorizontalSpeed && !suppressed)
                collector.warn("physics", `${cp}.samples[${index}].${contact.bone}.horizontalSpeed`, `${contact.bone} planted horizontal speed must stay <= ${maxHorizontalSpeed}m/s between t=${round(previous.time)}s and t=${round(current.time)}s (a planted foot usually should not skate; mark physicsIntent if the slide is deliberate)`, speed, speed - maxHorizontalSpeed);
        }
    });
    return collector.toValidation();
};
const sampleWindow = (motion, skeleton, contact, sampleRate, jointAxes, restFrames, topology) => windowSampleTimes(contact.start, contact.end, sampleRate).map((time) => {
    const resolved = resolvePose(sampleMotion(motion, time).pose, skeleton, jointAxes, restFrames, topology).find((bone) => bone.bone === contact.bone);
    return { time, position: resolved.worldPosition };
});
const horizontalSpeed = (previous, current) => {
    const dx = current.position.x - previous.position.x;
    const dz = current.position.z - previous.position.z;
    return Math.hypot(dx, dz) / (current.time - previous.time);
};
const round = (value) => Math.round(value * 1_000) / 1_000;
//# sourceMappingURL=validateFootSkate.js.map