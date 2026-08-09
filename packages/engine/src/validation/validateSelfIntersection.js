import { indexSkeletonTopology, resolvePose, } from "../kinematics";
import { segmentSegmentDistance } from "../math/segments";
import { sampleTimes } from "../motion/sampleClock";
import { sampleMotion } from "../motion/sampleMotion";
import { validateCapsule } from "./capsuleProxy";
import { fkReachableBones } from "./fkReachableBones";
import { ViolationCollector } from "./violation";
const DEFAULT_SAMPLE_RATE = 24;
/**
 * Tier-3 self-intersection check over declared capsule proxy pairs. It samples
 * the motion, resolves FK, and rejects frames where the two capsule centerlines
 * are closer than the sum of their radii.
 *
 * The validator is intentionally proxy-driven: callers choose non-adjacent body
 * parts that should not overlap, while mesh topology remains a later Tier-5
 * concern.
 *
 * Self-intersection is a physical-plausibility **warning**, not a gate: close
 * choreography (a grapple, a near-miss blow, an embrace) legitimately brings
 * body parts into near-contact, so the run still succeeds and the warning
 * surfaces for the orchestrator to restage or acknowledge with `physicsIntent`.
 * Only malformed capsules (bad bone, non-distinct, radius <= 0) are errors.
 *
 * @author Samchon
 */
export const validateSelfIntersection = (props) => {
    const collector = new ViolationCollector();
    const suppressed = props.physicsIntent !== undefined;
    const sampleRate = props.sampleRate === undefined ? DEFAULT_SAMPLE_RATE : props.sampleRate;
    const path = props.path ?? "$input";
    const skeletonBones = new Set(props.skeleton.bones.map((bone) => bone.bone));
    if (!Number.isFinite(sampleRate))
        return rejectSampleRate(collector, path, sampleRate);
    if (sampleRate <= 0)
        return rejectSampleRate(collector, path, sampleRate);
    const topology = indexSkeletonTopology(props.skeleton);
    const reachableBones = fkReachableBones(props.skeleton, topology);
    props.pairs.forEach((pair, pairIndex) => {
        const pp = `${path}.pairs[${pairIndex}]`;
        const firstValid = validateCapsule(pair.first, `${pp}.first`, skeletonBones, reachableBones, collector);
        const secondValid = validateCapsule(pair.second, `${pp}.second`, skeletonBones, reachableBones, collector);
        if (firstValid && secondValid) {
            sampleTimes(props.motion.duration, sampleRate).forEach((time, sampleIndex) => {
                const resolved = new Map(resolvePose(sampleMotion(props.motion, time).pose, props.skeleton, props.jointAxes, props.restFrames, topology).map((bone) => [bone.bone, bone.worldPosition]));
                const first = resolveCapsule(pair.first, resolved);
                const second = resolveCapsule(pair.second, resolved);
                const distance = segmentSegmentDistance(first.from, first.to, second.from, second.to);
                const minimum = pair.first.radius + pair.second.radius;
                if (distance < minimum && !suppressed)
                    collector.warn("physics", `${pp}.samples[${sampleIndex}].distance`, `capsule centerline distance must stay >= ${round(minimum)}m at t=${round(time)}s (body parts may legitimately near-contact in close choreography; mark physicsIntent if it is deliberate)`, distance, minimum - distance);
            });
        }
    });
    return collector.toValidation();
};
const rejectSampleRate = (collector, path, sampleRate) => {
    collector.push("range", `${path}.sampleRate`, `sampleRate must be a finite number > 0, but was ${sampleRate}`, sampleRate);
    return collector.toValidation();
};
const resolveCapsule = (capsule, resolved) => ({
    from: resolved.get(capsule.from),
    to: resolved.get(capsule.to),
});
const round = (value) => Math.round(value * 1_000) / 1_000;
//# sourceMappingURL=validateSelfIntersection.js.map