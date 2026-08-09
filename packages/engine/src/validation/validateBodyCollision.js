import { indexSkeletonTopology, resolvePose, } from "../kinematics";
import { Vector3 } from "../math/Vector3";
import { closestPointsBetweenSegments } from "../math/segments";
import { sampleTimes } from "../motion/sampleClock";
import { sampleMotion } from "../motion/sampleMotion";
import { suggestCollisionResponse, } from "../physics/collisionResponse";
import { validateCapsule } from "./capsuleProxy";
import { fkReachableBones } from "./fkReachableBones";
import { ViolationCollector } from "./violation";
const DEFAULT_SAMPLE_RATE = 24;
const DEFAULT_MASS = 70; // kg: an unspecified body defaults to a human mass
const DEFAULT_RESTITUTION = 0.2;
const DEFAULT_HARDNESS = 0.5;
const DEFAULT_PENETRABILITY = 0.3;
const DEFAULT_GAIN = 0.05; // recoil flexion degrees per unit impulse
const FALLBACK_NORMAL = { x: 0, y: 1, z: 0 };
/**
 * Detect where two actors' capsule proxies interpenetrate over a shot, and,
 * because a film may be deliberately unphysical, report it as advisory
 * `warning`s, not a hard rejection. At the deepest contact it suggests a
 * plausible response ({@link resolveImpact} + recoil flinch) the model can
 * accept or override, and emits `contact` events so downstream/render see the
 * same computed contact. A `physicsIntent` marker (e.g. a choreographed fight)
 * suppresses the warnings and the suggestion while still surfacing the events.
 *
 * Generalizes {@link validateSelfIntersection} from one body to two. Full
 * synthesis of the suggested react action into `performShot` is deferred (#600
 * follow-up); this returns the response as data.
 *
 * @author Samchon
 */
export const detectBodyCollision = (props) => {
    const collector = new ViolationCollector();
    const path = props.path ?? "$input";
    const sampleRate = props.sampleRate === undefined ? DEFAULT_SAMPLE_RATE : props.sampleRate;
    const gain = props.gainDegPerImpulse === undefined
        ? DEFAULT_GAIN
        : props.gainDegPerImpulse;
    const suppressed = props.physicsIntent !== undefined;
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
        collector.push("range", `${path}.sampleRate`, `sampleRate must be a finite number > 0, but was ${sampleRate}`, sampleRate);
        return { validation: collector.toValidation(), events: [], response: null };
    }
    // Validate every capsule against its actor's rig before sampling, the same
    // precondition validateSelfIntersection enforces on itself. A malformed
    // capsule (bone not on the rig, FK-unreachable, non-distinct endpoints, bad
    // radius) resolves to an undefined world position and a NaN distance (or
    // crashes outright, #1056), and `NaN < minimum` is false, so an unguarded
    // run would drop the overlap in silence. These are structural errors, not
    // physics warnings: return before sampling.
    const topologyA = indexSkeletonTopology(props.a.skeleton);
    const topologyB = indexSkeletonTopology(props.b.skeleton);
    const capsulesValid = [
        validateActorCapsules(props.a, `${path}.a`, topologyA, collector),
        validateActorCapsules(props.b, `${path}.b`, topologyB, collector),
    ].every(Boolean);
    if (!capsulesValid)
        return { validation: collector.toValidation(), events: [], response: null };
    const duration = Math.min(props.a.motion.duration, props.b.motion.duration);
    const times = sampleTimes(duration, sampleRate);
    const mapsA = times.map((time) => resolveMap(props.a, time, topologyA));
    const mapsB = times.map((time) => resolveMap(props.b, time, topologyB));
    const penetrations = [];
    times.forEach((time, frame) => {
        props.a.capsules.forEach((ca) => {
            props.b.capsules.forEach((cb) => {
                const closest = closestPointsBetweenSegments(mapsA[frame].get(ca.from), mapsA[frame].get(ca.to), mapsB[frame].get(cb.from), mapsB[frame].get(cb.to));
                const minimum = ca.radius + cb.radius;
                if (closest.distance < minimum)
                    penetrations.push({
                        frame,
                        time,
                        from: ca.from,
                        otherFrom: cb.from,
                        depth: minimum - closest.distance,
                        pointA: closest.pointA,
                        pointB: closest.pointB,
                    });
            });
        });
    });
    const events = penetrations.map((pen, i) => ({
        id: `contact:${i}`,
        kind: "contact",
        source: "sampledProximity",
        time: pen.time,
        actor: props.a.node,
        target: props.b.node,
        object: null,
        point: Vector3.scale(Vector3.add(pen.pointA, pen.pointB), 0.5),
        actionIndex: null,
        reaction: null,
    }));
    if (suppressed || penetrations.length === 0)
        return { validation: collector.toValidation(), events, response: null };
    penetrations.forEach((pen, i) => {
        collector.warn("physics", `${path}.contacts[${i}].distance`, `bodies "${props.a.node}" and "${props.b.node}" overlap by ${round(pen.depth)}m at t=${round(pen.time)}s`, pen.depth, pen.depth);
    });
    const response = suggestResponse(props, penetrations, sampleRate, mapsA, mapsB, gain);
    return { validation: collector.toValidation(), events, response };
};
/**
 * Validate every capsule of one actor against its own rig, one violation per
 * fault (all capsules are checked so a correction round sees them together).
 * Returns whether the actor's capsules are all usable.
 */
const validateActorCapsules = (actor, path, topology, collector) => {
    const bones = new Set(actor.skeleton.bones.map((bone) => bone.bone));
    const reachable = fkReachableBones(actor.skeleton, topology);
    let valid = true;
    actor.capsules.forEach((capsule, index) => {
        if (!validateCapsule(capsule, `${path}.capsules[${index}]`, bones, reachable, collector))
            valid = false;
    });
    return valid;
};
const suggestResponse = (props, penetrations, rate, mapsA, mapsB, gain) => {
    const deepest = [...penetrations].sort((x, y) => y.depth - x.depth)[0];
    const prev = Math.max(0, deepest.frame - 1);
    const velA = velocity(mapsA, deepest.frame, prev, deepest.from, rate);
    const velB = velocity(mapsB, deepest.frame, prev, deepest.otherFrom, rate);
    const rawNormal = Vector3.subtract(deepest.pointB, deepest.pointA);
    const normal = Vector3.dot(rawNormal, rawNormal) > 0 ? rawNormal : FALLBACK_NORMAL;
    return suggestCollisionResponse({
        a: impactBody(props.a.body, velA),
        b: impactBody(props.b.body, velB),
        normal,
        gainDegPerImpulse: gain,
        chain: [deepest.otherFrom],
        skeleton: props.b.skeleton,
    });
};
const velocity = (maps, frame, prev, bone, rate) => Vector3.scale(Vector3.subtract(maps[frame].get(bone), maps[prev].get(bone)), rate);
const impactBody = (body, vel) => ({
    mass: body === null ? DEFAULT_MASS : body.mass,
    velocity: vel,
    restitution: body === null ? DEFAULT_RESTITUTION : body.restitution,
    hardness: DEFAULT_HARDNESS,
    penetrability: DEFAULT_PENETRABILITY,
});
const resolveMap = (actor, time, topology) => new Map(resolvePose(sampleMotion(actor.motion, time).pose, actor.skeleton, actor.jointAxes, actor.restFrames, topology).map((bone) => [bone.bone, bone.worldPosition]));
const round = (value) => Math.round(value * 1_000) / 1_000;
//# sourceMappingURL=validateBodyCollision.js.map