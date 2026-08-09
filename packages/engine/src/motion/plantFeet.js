import { groundFunction } from "../space/ground";
import { pinStanceTargets } from "./groundPins";
import { HUMANOID_LEG_CHAINS, assemblePlantedFeet, rekeyPlantedFeet, resolveBoneMap, } from "./legPlant";
import { sampleTimes } from "./sampleClock";
import { sampleMotion } from "./sampleMotion";
const DEFAULT_SAMPLE_RATE = 24;
const DEFAULT_GROUND_Y = 0;
const DEFAULT_TOLERANCE = 0.02;
/**
 * The humanoid legs, named from the shared chain table so the ground-IK pass
 * and the retarget contact pass cannot disagree about which bones a leg is.
 */
const DEFAULT_LEGS = HUMANOID_LEG_CHAINS.map((chain) => ({
    foot: chain.effector,
    upper: chain.upper,
    lower: chain.lower,
}));
/**
 * The deterministic ground-IK pass: plant each leg's stance foot so a baked
 * gait no longer skates or sinks. It samples the motion on a fixed clock,
 * detects each foot's **stance runs** (frames where the foot is at or below the
 * ground plane, mirroring {@link validateGroundContact}'s `y <= groundY +
 * tolerance`), pins the foot's world XZ to its stance-start contact, with `y`
 * snapped to the ground plane, across the whole run, and re-solves the leg
 * (thigh/shin via {@link solveTwoBoneIK}, ankle toward the pinned target) so the
 * foot holds still while the hip travels over it. The correction is lowered
 * into the leg's bone-local clinical angles the way {@link reachPose} lowers an
 * arm, rooted at the **current posed hip** (not rest) so it composes on top of
 * the gait's root travel and torso motion. An unreachable pin extends the leg
 * fully toward it (foot stops on the reachable shell) rather than producing
 * NaN.
 *
 * The corrected clip is re-keyed densely at the pass sample rate; sampled at
 * those times a stance foot's world XZ is constant, so it passes
 * {@link validateFootSkate} and {@link validateGroundContact} where the raw gait
 * failed. Swing frames and non-leg joints are carried through unchanged.
 * Imported or non-canonical rigs pass the same `jointAxes` and `restFrames`
 * used for playback: stance detection, IK decomposition, ROM clamping, and
 * residual FK then share one clinical contract.
 *
 * Ground is a scalar plane or a `(x, z) → y` source. Plug a space in via
 * {@link spaceGround} (#605). Path/turning locomotion is #599; the shared
 * two-bone lowering could be factored out of {@link reachPose} (follow-up).
 *
 * @author Samchon
 */
export const plantStanceFeet = (props) => {
    const groundAt = groundFunction(props.groundY ?? DEFAULT_GROUND_Y);
    const tolerance = props.tolerance ?? DEFAULT_TOLERANCE;
    const legs = props.legs ?? DEFAULT_LEGS;
    const sampleRate = props.sampleRate ?? DEFAULT_SAMPLE_RATE;
    if (!Number.isFinite(sampleRate) || sampleRate <= 0)
        throw new Error(`sampleRate must be a finite number > 0, but was ${sampleRate}`);
    const times = sampleTimes(props.motion.duration, sampleRate);
    const poses = times.map((time) => sampleMotion(props.motion, time));
    const resolved = poses.map((sampled) => resolveBoneMap(props.skeleton, sampled.pose, undefined, props.jointAxes, props.restFrames));
    // A stance run per leg pinned to its start contact; per-frame solve targets.
    const { plants, targets } = pinStanceTargets({
        legs,
        resolved,
        times,
        groundAt,
        tolerance,
        openingTargets: new Map((props.openingPlants ?? []).map((plant) => [plant.foot, plant.position])),
    });
    const keyframes = rekeyPlantedFeet({
        skeleton: props.skeleton,
        times,
        poses,
        legs,
        targets,
        jointAxes: props.jointAxes,
        restFrames: props.restFrames,
    });
    return assemblePlantedFeet(props.motion, keyframes, plants);
};
//# sourceMappingURL=plantFeet.js.map