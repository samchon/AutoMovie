import { Vector3 } from "../math/Vector3";
import { closestPointOnSegmentXZ, convexHull2D, nearestHullEdge, pointHullDistance, } from "../math/hull";
import { ViolationCollector } from "./violation";
const DEFAULT_MARGIN = 0.02;
/**
 * Judge whether an object is stably supported: its center of mass, projected
 * onto the ground plane, must fall within the convex hull (plus margin) of its
 * support contact points. When it overhangs, and because a film may be
 * deliberately unphysical, this reports an advisory `warning`, not a hard
 * reject, and suggests the topple (the pivot edge and fall direction). A
 * `physicsIntent` marker (a levitating prop) suppresses the warning and
 * suggestion while still surfacing the event.
 *
 * The support contacts are given as input: the top face of whatever the object
 * rests on. Deriving them from real surface geometry is deferred to #605; full
 * fall-motion synthesis into the shot is deferred to #620.
 *
 * @author Samchon
 */
export const detectSupportToppling = (props) => {
    const collector = new ViolationCollector();
    const path = props.path ?? "$input";
    const margin = props.margin === undefined ? DEFAULT_MARGIN : props.margin;
    const node = props.node ?? null;
    if (props.support.length === 0) {
        collector.push("type", `${path}.support`, "support must contain at least one contact point", props.support);
        return { validation: collector.toValidation(), events: [], toppling: null };
    }
    if (!Number.isFinite(margin) || margin < 0) {
        collector.push("range", `${path}.margin`, `margin must be a finite number >= 0, but was ${margin}`, margin);
        return { validation: collector.toValidation(), events: [], toppling: null };
    }
    const hull = convexHull2D(props.support);
    const distance = pointHullDistance(props.centerOfMass, hull);
    if (distance <= margin)
        return { validation: collector.toValidation(), events: [], toppling: null };
    const edge = nearestHullEdge(props.centerOfMass, hull);
    const nearest = closestPointOnSegmentXZ(props.centerOfMass, edge.start, edge.end);
    const fallDirection = Vector3.normalize({
        x: props.centerOfMass.x - nearest.x,
        y: 0,
        z: props.centerOfMass.z - nearest.z,
    });
    const overshoot = distance - margin;
    const event = {
        id: "fall:0",
        kind: "fall",
        source: "sampledProximity",
        time: 0,
        actor: node,
        target: null,
        object: null,
        point: { x: nearest.x, y: props.centerOfMass.y, z: nearest.z },
        actionIndex: null,
        reaction: null,
    };
    if (props.physicsIntent !== undefined)
        return {
            validation: collector.toValidation(),
            events: [event],
            toppling: null,
        };
    collector.warn("physics", `${path}.support.overshoot`, `object${node === null ? "" : ` "${node}"`} center of mass overhangs its support by ${round(overshoot)}m and would topple`, overshoot, overshoot);
    return {
        validation: collector.toValidation(),
        events: [event],
        toppling: {
            tipEdgeStart: edge.start,
            tipEdgeEnd: edge.end,
            fallDirection,
            overshoot,
        },
    };
};
const round = (value) => Math.round(value * 1_000) / 1_000;
//# sourceMappingURL=validateSupport.js.map