import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";

/**
 * Interaction event categories emitted by the engine while assembling a shot.
 *
 * These are semantic contact points for downstream motion, review, and render
 * systems: a renderer can inspect the same computed hit/fall/attach timing the
 * engine used instead of re-deriving it from raw clips.
 *
 * @author Samchon
 */
export type AutoMovieInteractionEventKind =
  | "contact"
  | "hit"
  | "grab"
  | "release"
  | "attach"
  | "detach"
  | "fall";

/**
 * Where an interaction event came from. The value is intentionally about the
 * producer, not the visual result, so clients can decide how much trust or
 * extra solving they need downstream.
 */
export type AutoMovieInteractionEventSource =
  | "collisionSolver"
  | "scriptedCue"
  | "sampledProximity"
  | "impactOutput";

/**
 * One engine-visible interaction on a shot-local clock.
 *
 * `actor` is the initiator or affected performer when one is known, `target` is
 * the receiver/parent when one is known, and `object` is the prop/projectile
 * involved when the event is object-mediated. `reaction` names the actor whose
 * downstream motion was scheduled from this event, or `null` when the event is
 * only observational.
 *
 * @author Samchon
 */
export interface IAutoMovieInteractionEvent {
  /** Stable id within the shot. */
  id: string;

  /** Semantic event category. */
  kind: AutoMovieInteractionEventKind;

  /** Producer that created the event. */
  source: AutoMovieInteractionEventSource;

  /** Shot-local seconds. */
  time: number;

  /** Initiating or affected actor, when a single node is known. */
  actor: string | null;

  /** Receiving actor/parent, when a single node is known. */
  target: string | null;

  /** Projectile or carried object involved in the interaction. */
  object: string | null;

  /** World point of contact, when the engine computed one. */
  point: IAutoMovieVector3 | null;

  /** Source action index in the performance action list, when available. */
  actionIndex: number | null;

  /** Actor whose reaction was scheduled from this event, when any. */
  reaction: string | null;
}
