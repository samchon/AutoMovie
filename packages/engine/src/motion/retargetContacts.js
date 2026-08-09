import { indexSkeletonTopology, reachableBoneNames, } from "../kinematics/resolvePose";
import { Vector3 } from "../math/Vector3";
import { groundFunction } from "../space/ground";
import { contactMask } from "./groundPins";
import { HUMANOID_LEG_CHAINS, fitChainToTarget, resolveBoneMap, } from "./legPlant";
/** Contact tolerance above the source ground counted as a planted contact. */
const DEFAULT_TOLERANCE = 0.02;
/**
 * Drift below this, in target model units, is floating-point residue rather
 * than a proportion mismatch. Under a uniform rig scale the factor distributes
 * cleanly through the FK walk (rotate is linear and every accumulated sum
 * scales with it), so a target effector sits on its mapped source contact to
 * the last bit, the drift measures zero, and the pass leaves the frame
 * untouched. That is what makes contact preservation a mathematical no-op on a
 * proportional rig, and why it is safe to leave on by default.
 */
const NOOP_EPSILON = 1e-9;
/**
 * The contact-preserving stage of {@link retargetHumanoidMotion}.
 *
 * V1 copied clinical joint angles verbatim and scaled only the root path, which
 * is exact for a proportional rig and wrong for any other: a target whose legs
 * are relatively longer plants its foot somewhere else entirely, and the clip
 * skates. This pass closes that gap without abandoning the clinical-angle
 * contract.
 *
 * For every existing keyframe it FK-resolves the clip on the **source** rig,
 * decides which effectors are in contact (feet via the shared
 * {@link contactMask} ground predicate, hands via the caller's declared
 * windows), maps each contact position into target space by the **same
 * `rootScale` the root path uses** (so the contact and the root stay one
 * consistent frame) and re-solves the target limb onto it with the shared
 * two-bone lowering. The pin is the source effector's position on **that**
 * frame rather than the stance run's first frame: retargeting reproduces the
 * source performance, including a slide the source itself authored;
 * {@link plantStanceFeet} is the pass that removes skate.
 *
 * Three properties make it safe to leave on by default:
 *
 * - **Proportional rigs are untouched.** A frame whose effector already sits on
 *   its mapped contact within {@link NOOP_EPSILON} is skipped outright, so a
 *   uniform scale changes not one angle.
 * - **Keyframes are preserved.** The clip is corrected in place at its authored
 *   times; nothing is re-keyed onto a fixed clock.
 * - **ROM binds the correction.** The IK result is derived data, not authored
 *   intent, so it is clamped into the target's ROM
 *   ({@link clampJointToSkeleton}) instead of being allowed to fail the
 *   retarget. When the clamped chain then cannot hold the contact, the residual
 *   is a `warning`, residual slide is implausible, not impossible.
 *
 * @author Samchon
 */
export const preserveRetargetContacts = (props) => {
    const contacts = props.contacts ?? {};
    const groundAt = groundFunction(contacts.groundY ?? props.sourceFloor);
    const tolerance = contacts.tolerance ?? DEFAULT_TOLERANCE;
    const sourceTopology = indexSkeletonTopology(props.source);
    const targetTopology = indexSkeletonTopology(props.target);
    const sourceBones = reachableBoneNames(props.source, sourceTopology);
    const targetBones = reachableBoneNames(props.target, targetTopology);
    // Only a chain both rigs actually resolve can carry a contact; a rig missing
    // an arm (or a hand contact declared against bones it does not have) is
    // skipped rather than half-solved.
    const windows = [
        ...HUMANOID_LEG_CHAINS.map((chain) => ({ chain, window: null })),
        ...(contacts.hands ?? []).map((hand) => ({
            chain: {
                effector: hand.hand,
                upper: hand.upper,
                lower: hand.lower,
            },
            window: { start: hand.start, end: hand.end },
        })),
    ].filter(({ chain }) => [sourceBones, targetBones].every((bones) => resolvable(chain, bones)));
    if (windows.length === 0)
        return props.retargeted;
    const frames = props.retargeted.keyframes;
    const sourceResolved = props.sourceMotion.keyframes.map((kf) => resolveBoneMap(props.source, kf.pose, sourceTopology, props.sourceJointAxes, props.sourceRestFrames));
    // Per-frame contact pins, already mapped into target space.
    const pins = frames.map(() => new Map());
    const chains = new Map();
    for (const { chain, window } of windows) {
        chains.set(chain.effector, chain);
        const mask = window === null
            ? contactMask({
                effector: chain.effector,
                resolved: sourceResolved,
                groundAt,
                tolerance,
            })
            : frames.map((kf) => kf.time >= window.start && kf.time <= window.end);
        mask.forEach((inContact, index) => {
            if (inContact === false)
                return;
            pins[index].set(chain.effector, Vector3.scale(sourceResolved[index].get(chain.effector).worldPosition, props.rootScale));
        });
    }
    const worst = new Map();
    const keyframes = [];
    let referencePose;
    frames.forEach((keyframe, index) => {
        const corrected = correctFrame({
            keyframe,
            index,
            pins: pins[index],
            chains,
            skeleton: props.target,
            topology: targetTopology,
            jointAxes: props.targetJointAxes,
            restFrames: props.targetRestFrames,
            worst,
            referencePose,
        });
        keyframes.push(corrected);
        referencePose = corrected.pose;
    });
    const budget = tolerance * props.rootScale;
    for (const [effector, entry] of worst)
        if (entry.residual > budget)
            props.collector.warn("physics", `$input.motion.keyframes[${entry.index}].pose.joints["${effector}"]`, `${effector} could not hold its retargeted contact: the target rig's proportions leave it ${round(entry.residual)} from the mapped source contact, beyond the ${round(budget)} contact budget (residual slide is implausible, not impossible, retune the rig proportions or the contact tolerance)`, entry.residual, entry.residual - budget);
    return { ...props.retargeted, keyframes };
};
/** Every bone of the chain resolves on the rig's FK walk. */
const resolvable = (chain, bones) => [chain.effector, chain.upper, chain.lower].every((bone) => bones.has(bone));
/**
 * Re-solve one keyframe's pinned limbs and record each effector's worst
 * residual. A limb already on its pin, or one whose chain is geometrically
 * degenerate, is left exactly as authored.
 */
const correctFrame = (props) => {
    if (props.pins.size === 0)
        return props.keyframe;
    const resolve = (pose) => resolveBoneMap(props.skeleton, pose, props.topology, props.jointAxes, props.restFrames);
    let pose = props.keyframe.pose;
    let resolved = resolve(pose);
    for (const [effector, target] of props.pins) {
        const current = resolved.get(effector).worldPosition;
        if (drift(current, target) <= NOOP_EPSILON)
            continue;
        const chain = props.chains.get(effector);
        const fitted = fitChainToTarget({
            skeleton: props.skeleton,
            pose,
            chain,
            target,
            topology: props.topology,
            jointAxes: props.jointAxes,
            restFrames: props.restFrames,
            referencePose: props.referencePose,
        });
        if (fitted === pose)
            continue;
        pose = fitted;
        resolved = resolve(pose);
    }
    for (const [effector, target] of props.pins) {
        const residual = drift(resolved.get(effector).worldPosition, target);
        const prior = props.worst.get(effector);
        if (prior === undefined || residual > prior.residual)
            props.worst.set(effector, { residual, index: props.index });
    }
    return pose === props.keyframe.pose
        ? props.keyframe
        : { ...props.keyframe, pose };
};
/** Distance between a resolved effector and the contact it must hold. */
const drift = (a, b) => Vector3.length(Vector3.subtract(a, b));
/** Six-decimal rounding so a warning message stays readable and stable. */
const round = (value) => Math.round(value * 1e6) / 1e6;
//# sourceMappingURL=retargetContacts.js.map