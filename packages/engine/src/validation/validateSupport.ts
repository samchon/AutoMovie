import {
  IAutoMovieInteractionEvent,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Vector3 } from "../math/Vector3";
import {
  closestPointOnSegmentXZ,
  convexHull2D,
  nearestHullEdge,
  pointHullDistance,
} from "../math/hull";
import { ViolationCollector } from "./violation";

const DEFAULT_MARGIN = 0.02;

/**
 * A suggested topple: the support hull edge the object tips over (the pivot
 * axis) and the horizontal direction it falls, when its center of mass
 * overhangs the support.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `IAutoMovieToppling` identifies the support edge, fall direction, and overhang associated with one unstable subject.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `IAutoMovieToppling` bounds the suggested correction to the pivot geometry and measured excess discovered by the support check.
 * @author Samchon
 */
export interface IAutoMovieToppling {
  /**
   * One end of the pivot edge (the nearest support hull edge).
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `tipEdgeStart` records one endpoint of the nearest support-hull edge selected as the topple pivot.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `tipEdgeStart` preserves the first world-space point of the affected support relation.
   */
  tipEdgeStart: IAutoMovieVector3;
  /**
   * The other end of the pivot edge.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `tipEdgeEnd` records the other endpoint that completes the unstable subject's pivot axis.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `tipEdgeEnd` preserves the second world-space point needed to reconstruct the chosen hull edge.
   */
  tipEdgeEnd: IAutoMovieVector3;
  /**
   * Unit horizontal direction (XZ, y=0) the object falls toward.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `fallDirection` identifies the horizontal unit direction from the support edge toward the overhanging center of mass.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `fallDirection` carries the XZ correction direction without inventing a vertical component.
   */
  fallDirection: IAutoMovieVector3;
  /**
   * How far past the margin the COM overhangs, in meters.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `overshoot` measures in meters how far the center of mass exceeds the permitted support margin.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `overshoot` retains the correction magnitude separately from the hull points and direction.
   */
  overshoot: number;
}

/**
 * The outcome of a support check: the `warning` envelope, the `fall`
 * interaction event(s), and a suggested topple (or `null` when stably
 * supported).
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `IAutoMovieSupportResult` keeps the support diagnostic, fall event, and topple suggestion attached to one center-and-contact evaluation.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `IAutoMovieSupportResult` separates validation outcome, downstream event scope, and optional physical advice for the subject.
 * @author Samchon
 */
export interface IAutoMovieSupportResult {
  /**
   * Warning-severity feedback (or an error for bad input).
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `validation` locates invalid margin or support inputs and the overhang warning at the caller's support root.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `validation` preserves severity, expected hull margin, observed distance, and excess for the support decision.
   */
  validation: IAutoMovieValidation;
  /**
   * Fall events on the shot clock: "one calculation, two consumers".
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `events` names the unsupported node in the fall event produced by the same support calculation.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `events` retains subject scope even when physics intent suppresses warnings and topple advice.
   */
  events: IAutoMovieInteractionEvent[];
  /**
   * Suggested topple, or `null` when supported.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `toppling` identifies the suggested pivot and direction only for an unsuppressed overhang.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `toppling` remains null for stable or intentionally unphysical support, limiting advice to the invalid relation.
   */
  toppling: IAutoMovieToppling | null;
}

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
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `detectSupportToppling` reports an unstable center against the supplied support root while naming the affected node in its event.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `detectSupportToppling` derives warning, fall event, pivot edge, direction, and overshoot from one convex-hull observation.
 * @author Samchon
 */
export const detectSupportToppling = (props: {
  /** Object node id, used to label the emitted event. */
  node?: string;
  /** Object center of mass (same frame as `support`; e.g. `bodyCenterOfMass`). */
  centerOfMass: IAutoMovieVector3;
  /** Support contact points on the ground plane (XZ used). */
  support: readonly IAutoMovieVector3[];
  /** Allowed COM overhang past the hull, meters. Defaults to `0.02`. */
  margin?: number;
  /** Marker that suppresses the warning/suggestion (intentional levitation). */
  physicsIntent?: string;
  /** JSON path of the annotation being checked. Defaults to `$input`. */
  path?: string;
}): IAutoMovieSupportResult => {
  const collector = new ViolationCollector();
  const path = props.path ?? "$input";
  const margin = props.margin === undefined ? DEFAULT_MARGIN : props.margin;
  const node = props.node ?? null;

  if (props.support.length === 0) {
    collector.push(
      "type",
      `${path}.support`,
      "support must contain at least one contact point",
      props.support,
    );
    return { validation: collector.toValidation(), events: [], toppling: null };
  }
  if (!Number.isFinite(margin) || margin < 0) {
    collector.push(
      "range",
      `${path}.margin`,
      `margin must be a finite number >= 0, but was ${margin}`,
      margin,
    );
    return { validation: collector.toValidation(), events: [], toppling: null };
  }

  const hull = convexHull2D(props.support);
  const distance = pointHullDistance(props.centerOfMass, hull);
  if (distance <= margin)
    return { validation: collector.toValidation(), events: [], toppling: null };

  const edge = nearestHullEdge(props.centerOfMass, hull);
  const nearest = closestPointOnSegmentXZ(
    props.centerOfMass,
    edge.start,
    edge.end,
  );
  const fallDirection = Vector3.normalize({
    x: props.centerOfMass.x - nearest.x,
    y: 0,
    z: props.centerOfMass.z - nearest.z,
  });
  const overshoot = distance - margin;
  const event: IAutoMovieInteractionEvent = {
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

  collector.warn(
    "physics",
    `${path}.support.overshoot`,
    `object${node === null ? "" : ` "${node}"`} center of mass overhangs its support by ${round(overshoot)}m and would topple`,
    overshoot,
    overshoot,
  );
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

const round = (value: number): number => Math.round(value * 1_000) / 1_000;
