import { convexHull2D, pointHullDistance } from "../math/hull";
import { projectileTrajectory } from "../physics/projectile";
import { ViolationCollector } from "./violation";
const DEFAULT_MARGIN = 0.02;
const DEFAULT_GRAVITY = { x: 0, y: -9.81, z: 0 };
const DEFAULT_VELOCITY = { x: 0, y: 0, z: 0 };
const DEFAULT_FALL_DURATION = 1;
const DEFAULT_FPS = 30;
/**
 * The default physical expectation: a body that is not held up by anything
 * falls.
 *
 * At the given frame, an object with a declared {@link IAutoMovieBody} is
 * expected to fall when it is (a) **unsupported** (its center of mass does not
 * project onto any support contact, reusing #601's hull judgment), (b) **not
 * attached / driven** (`attached`), and (c) **not already falling**
 * (`falling`). Because a film may be deliberately unphysical this is an
 * advisory `warning`, not a hard reject: it suggests the fall arc (via
 * {@link projectileTrajectory}, from rest or an inherited velocity) the model
 * can accept, and emits a `fall` event. A `physicsIntent` marker (e.g.
 * `"defies-gravity"`) opts the body out: the warning and suggestion are
 * suppressed while the event still surfaces. A `body: null` object (no declared
 * physics) is never a fall candidate.
 *
 * Support contacts, `attached`, and `falling` are given as input; deriving them
 * from the full scene is deferred to a later pass, and landing/impact chaining
 * to #600/#601. This is the gravity expectation plus the translational fall
 * arc.
 *
 * @author Samchon
 */
export const detectFreeFall = (props) => {
    const collector = new ViolationCollector();
    const path = props.path ?? "$input";
    const margin = props.margin === undefined ? DEFAULT_MARGIN : props.margin;
    const fallDuration = props.fallDuration === undefined
        ? DEFAULT_FALL_DURATION
        : props.fallDuration;
    const node = props.node ?? null;
    if (!Number.isFinite(margin) || margin < 0) {
        collector.push("range", `${path}.margin`, `margin must be a finite number >= 0, but was ${margin}`, margin);
        return empty(collector);
    }
    if (!Number.isFinite(fallDuration) || fallDuration <= 0) {
        collector.push("range", `${path}.fallDuration`, `fallDuration must be a finite number > 0, but was ${fallDuration}`, fallDuration);
        return empty(collector);
    }
    const supported = props.support.length > 0 &&
        pointHullDistance(props.centerOfMass, convexHull2D(props.support)) <=
            margin;
    const expectedToFall = props.body !== null && !supported && !props.attached && !props.falling;
    if (!expectedToFall)
        return empty(collector);
    const event = {
        id: "fall:0",
        kind: "fall",
        source: "sampledProximity",
        time: 0,
        actor: node,
        target: null,
        object: null,
        point: props.centerOfMass,
        actionIndex: null,
        reaction: null,
    };
    if (props.physicsIntent !== undefined)
        return {
            validation: collector.toValidation(),
            events: [event],
            trajectory: null,
        };
    collector.warn("physics", `${path}.gravity`, `object${node === null ? "" : ` "${node}"`} is unsupported and would fall`, props.centerOfMass);
    const trajectory = projectileTrajectory(node ?? "object", {
        origin: props.centerOfMass,
        velocity: props.velocity ?? DEFAULT_VELOCITY,
        gravity: props.gravity ?? DEFAULT_GRAVITY,
    }, fallDuration, props.fps ?? DEFAULT_FPS);
    return { validation: collector.toValidation(), events: [event], trajectory };
};
const empty = (collector) => ({
    validation: collector.toValidation(),
    events: [],
    trajectory: null,
});
//# sourceMappingURL=validateFreeFall.js.map