import {
  IAutoMovieBody,
  IAutoMovieClip,
  IAutoMovieInteractionEvent,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { convexHull2D, pointHullDistance } from "../math/hull";
import { projectileTrajectory } from "../physics/projectile";
import { ViolationCollector } from "./violation";

const DEFAULT_MARGIN = 0.02;
const DEFAULT_GRAVITY: IAutoMovieVector3 = { x: 0, y: -9.81, z: 0 };
const DEFAULT_VELOCITY: IAutoMovieVector3 = { x: 0, y: 0, z: 0 };
const DEFAULT_FALL_DURATION = 1;
const DEFAULT_FPS = 30;

/**
 * The outcome of a gravity-expectation check: the `warning` envelope, the
 * `fall` interaction event(s), and a suggested fall trajectory (or `null`).
 *
 * @author Samchon
 */
export interface IAutoMovieFreeFallResult {
  /** Warning-severity feedback (or an error for bad input). */
  validation: IAutoMovieValidation;
  /** Fall events on the shot clock — "one calculation, two consumers". */
  events: IAutoMovieInteractionEvent[];
  /**
   * Suggested free-fall arc from this frame, or `null` when not expected to
   * fall.
   */
  trajectory: IAutoMovieClip | null;
}

/**
 * The default physical expectation: a body that is not held up by anything
 * falls.
 *
 * At the given frame, an object with a declared {@link IAutoMovieBody} is
 * expected to fall when it is (a) **unsupported** — its center of mass does not
 * project onto any support contact (reusing #601's hull judgment), (b) **not
 * attached / driven** (`attached`), and (c) **not already falling**
 * (`falling`). Because a film may be deliberately unphysical (D010) this is an
 * advisory `warning`, not a hard reject: it suggests the fall arc (via
 * {@link projectileTrajectory}, from rest or an inherited velocity) the model
 * can accept, and emits a `fall` event. A `physicsIntent` marker (e.g.
 * `"defies-gravity"`) opts the body out — the warning and suggestion are
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
export const detectFreeFall = (props: {
  /** Object node id, used to label the event and the suggested clip. */
  node?: string;
  /** The object's physical body. `null` → no declared physics, never falls. */
  body: IAutoMovieBody | null;
  /** Center of mass in world space at this frame. */
  centerOfMass: IAutoMovieVector3;
  /** Support contact points on the ground plane (XZ used); empty = unsupported. */
  support: readonly IAutoMovieVector3[];
  /** Whether the body is attached to / driven by something (holds it up). */
  attached: boolean;
  /** Whether the body is already on a falling trajectory. */
  falling: boolean;
  /** Allowed COM overhang past the support hull, meters. Defaults to `0.02`. */
  margin?: number;
  /** Constant acceleration for the arc. Defaults to `{0,-9.81,0}`. */
  gravity?: IAutoMovieVector3;
  /** Inherited initial velocity for the arc. Defaults to rest. */
  velocity?: IAutoMovieVector3;
  /** Seconds of fall arc to bake. Defaults to `1`. */
  fallDuration?: number;
  /** Arc sample rate. Defaults to `30`. */
  fps?: number;
  /** Marker that opts the body out of the gravity expectation. */
  physicsIntent?: string;
  /** JSON path of the annotation being checked. Defaults to `$input`. */
  path?: string;
}): IAutoMovieFreeFallResult => {
  const collector = new ViolationCollector();
  const path = props.path ?? "$input";
  const margin = props.margin === undefined ? DEFAULT_MARGIN : props.margin;
  const fallDuration =
    props.fallDuration === undefined
      ? DEFAULT_FALL_DURATION
      : props.fallDuration;
  const node = props.node ?? null;

  if (!Number.isFinite(margin) || margin < 0) {
    collector.push(
      "range",
      `${path}.margin`,
      `margin must be a finite number >= 0, but was ${margin}`,
      margin,
    );
    return empty(collector);
  }
  if (!Number.isFinite(fallDuration) || fallDuration <= 0) {
    collector.push(
      "range",
      `${path}.fallDuration`,
      `fallDuration must be a finite number > 0, but was ${fallDuration}`,
      fallDuration,
    );
    return empty(collector);
  }

  const supported =
    props.support.length > 0 &&
    pointHullDistance(props.centerOfMass, convexHull2D(props.support)) <=
      margin;
  const expectedToFall =
    props.body !== null && !supported && !props.attached && !props.falling;
  if (!expectedToFall) return empty(collector);

  const event: IAutoMovieInteractionEvent = {
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

  collector.warn(
    "physics",
    `${path}.gravity`,
    `object${node === null ? "" : ` "${node}"`} is unsupported and would fall`,
    props.centerOfMass,
  );
  const trajectory = projectileTrajectory(
    node ?? "object",
    {
      origin: props.centerOfMass,
      velocity: props.velocity ?? DEFAULT_VELOCITY,
      gravity: props.gravity ?? DEFAULT_GRAVITY,
    },
    fallDuration,
    props.fps ?? DEFAULT_FPS,
  );
  return { validation: collector.toValidation(), events: [event], trajectory };
};

const empty = (collector: ViolationCollector): IAutoMovieFreeFallResult => ({
  validation: collector.toValidation(),
  events: [],
  trajectory: null,
});
