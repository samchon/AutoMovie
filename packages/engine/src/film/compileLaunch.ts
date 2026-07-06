import {
  IAutoMovieClip,
  IAutoMovieInteractionEvent,
  IAutoMovieLaunchAction,
  IAutoMovieReactAction,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Vector3 } from "../math/Vector3";
import { solveBallisticLaunch, solveMovingLaunch } from "../physics/ballistic";
import { projectileAt, projectileTrajectory } from "../physics/projectile";

/** The default fall the launch solves against — Earth gravity, world −Y. */
const DEFAULT_GRAVITY: IAutoMovieVector3 = { x: 0, y: -9.81, z: 0 };

/** What compiling a `launch` yields: the flight, and the hit it schedules. */
export interface IAutoMovieLaunchResult {
  /** The projectile node's baked flight clip (translation + aim rotation). */
  clip: IAutoMovieClip;

  /**
   * The target's recoil, scheduled at the **computed** contact — a synthetic
   * {@link IAutoMovieReactAction} to fold into the action list, or `null` when
   * the launch carried no `onHit` (or aimed at a point/group with no single
   * actor to recoil). Its `start` is the shot-local instant the projectile
   * lands, and its `from` sits upstream along the arrow's incoming velocity, so
   * the reference synthesiser recoils the body **along the shot's travel** (an
   * arrow flying `+x` knocks the target `+x`), lobbed or flat.
   */
  react: IAutoMovieReactAction | null;

  /**
   * Seconds from the launch to impact (shot-local hit = `action.start +
   * hitTime`).
   */
  hitTime: number;

  /** World point of impact (where the solved flight lands). */
  hitPoint: IAutoMovieVector3;

  /** The solved launch velocity (magnitude = `action.speed`). */
  velocity: IAutoMovieVector3;

  /** Engine-visible contact/hit/fall events on the shot-local clock. */
  events: IAutoMovieInteractionEvent[];
}

const eventTimeKey = (time: number): string => time.toFixed(6);

const firstActor = (action: IAutoMovieLaunchAction): string | null =>
  typeof action.actor === "string" ? action.actor : (action.actor[0] ?? null);

/**
 * Compose the `launch` verb's engine primitives into one result — the missing
 * orchestrator that turns the model's thin _"loose the arrow at him"_ into the
 * projectile's motion **and** the struck target's reaction, timed to the
 * engine-computed hit rather than a number the model had to guess.
 *
 * It {@link solveBallisticLaunch solves the aim} that connects `origin` to
 * `target` at `action.speed`, {@link projectileTrajectory bakes the flight} into
 * the projectile node's clip, and — when the launch carries an `onHit` — emits
 * the target's `react` at the detected contact time. This is the reactive event
 * the schema promises ("shoot him off his horse" without hand-timing the fall):
 * the contact time is a computed output, so the reaction is scheduled, not
 * authored. Returns `null` when the target is out of range at that speed
 * (nothing to fly, nothing to hit).
 *
 * `target` is the target's world point resolved by the caller. Pass `targetAt`
 * as well to **lead a moving target** — the aim then solves against where the
 * mover _will be_ (via {@link solveMovingLaunch}) rather than its start point,
 * and `target` is only the fallback origin of the sightline. Feed the returned
 * `clip` to the projectile node and fold `react` into the target's action list
 * before the performance compiles.
 *
 * @author Samchon
 */
export const compileLaunch = (props: {
  /** The launch to compile (its `projectile`, `speed`, `onHit`, `start`). */
  action: IAutoMovieLaunchAction;
  /** Where the projectile launches from (world meters). */
  origin: IAutoMovieVector3;
  /** The struck target's world point (the solved flight lands here). */
  target: IAutoMovieVector3;
  /**
   * The struck scene node — the emitted `react`'s actor — or `null` when the
   * aim is a point/group with no single actor to recoil (the flight still
   * bakes; only the reaction is withheld).
   */
  targetNode: string | null;
  /**
   * The target's world position at flight-time `t`, when it moves during the
   * shot (its animated base plus root travel). Supplied, the aim **leads** the
   * mover to the intercept ({@link solveMovingLaunch}); omitted, the launch is a
   * static intercept on `target`.
   */
  targetAt?: (t: number) => IAutoMovieVector3;
  /** Constant fall; defaults to Earth gravity along world −Y. */
  gravity?: IAutoMovieVector3;
  /** Flat `direct` shot (default) or lobbed `high` arc. */
  arc?: "direct" | "high";
  /** Sample rate of the baked flight clip (default 30). */
  fps?: number;
}): IAutoMovieLaunchResult | null => {
  const { action, origin, target, targetNode } = props;
  const gravity = props.gravity ?? DEFAULT_GRAVITY;
  const arc = props.arc ?? "direct";

  const solution =
    props.targetAt !== undefined
      ? solveMovingLaunch(origin, props.targetAt, action.speed, gravity, arc)
      : solveBallisticLaunch(origin, target, action.speed, gravity, arc);
  if (solution === null) return null; // out of range at this speed

  const projectile = { origin, velocity: solution.velocity, gravity };
  const clip = projectileTrajectory(
    action.projectile,
    projectile,
    solution.hitTime,
    props.fps,
  );
  const landing = projectileAt(projectile, solution.hitTime);

  let react: IAutoMovieReactAction | null = null;
  if (action.onHit !== undefined && targetNode !== null) {
    // Where the blow comes from: one meter upstream along the incoming
    // velocity, so `target − from` points down the arrow's travel and the
    // synthesiser recoils the body that way (up-and-back for a lobbed shot,
    // straight back for a flat one). Degenerate velocity → aim from the origin
    // to the impact point (the met point when leading a mover, else the target).
    const aimRef = props.targetAt !== undefined ? landing.position : target;
    const incoming =
      Vector3.length(landing.velocity) < 1e-9
        ? Vector3.normalize(Vector3.subtract(aimRef, origin))
        : Vector3.normalize(landing.velocity);
    react = {
      verb: "react",
      actor: targetNode,
      start: action.start + solution.hitTime,
      duration: "auto",
      from: {
        kind: "point",
        point: Vector3.subtract(landing.position, incoming),
      },
      force: action.onHit.force,
      unbalance: action.onHit.unbalance,
    };
  }
  const hitAt = action.start + solution.hitTime;
  const sourceActor = firstActor(action);
  const targetKey = targetNode ?? "point";
  const contact: IAutoMovieInteractionEvent = {
    id: `contact:${action.projectile}:${targetKey}:${eventTimeKey(hitAt)}`,
    kind: "contact",
    source: "collisionSolver",
    time: hitAt,
    actor: sourceActor,
    target: targetNode,
    object: action.projectile,
    point: landing.position,
    actionIndex: null,
    reaction: null,
  };
  const events: IAutoMovieInteractionEvent[] = [contact];
  if (targetNode !== null) {
    const hit: IAutoMovieInteractionEvent = {
      id: `hit:${action.projectile}:${targetNode}:${eventTimeKey(hitAt)}`,
      kind: "hit",
      source: "impactOutput",
      time: hitAt,
      actor: sourceActor,
      target: targetNode,
      object: action.projectile,
      point: landing.position,
      actionIndex: null,
      reaction: react === null ? null : targetNode,
    };
    events.push(hit);
    if (react?.unbalance === true)
      events.push({
        id: `fall:${targetNode}:${eventTimeKey(hitAt)}`,
        kind: "fall",
        source: "impactOutput",
        time: hitAt,
        actor: targetNode,
        target: null,
        object: action.projectile,
        point: landing.position,
        actionIndex: null,
        reaction: targetNode,
      });
  }

  return {
    clip,
    react,
    hitTime: solution.hitTime,
    hitPoint: landing.position,
    velocity: solution.velocity,
    events,
  };
};
