import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";

/**
 * Interaction event categories emitted by the engine while assembling a shot.
 *
 * These are semantic contact points for downstream motion, review, and render
 * systems: a renderer can inspect the same computed hit/fall/attach timing the
 * engine used instead of re-deriving it from raw clips.
 *
 * @evidence requirements/staging/events-and-timing.md#staging-event-observation Exposes `AutoMovieInteractionEventKind` as the portable data boundary for the staging event observation requirement.
 * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Types `AutoMovieInteractionEventKind` for the performance staging event boundary sampling output system contract.
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
 *
 * @evidence requirements/staging/events-and-timing.md#staging-event-observation Exposes `AutoMovieInteractionEventSource` as the portable data boundary for the staging event observation requirement.
 * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Types `AutoMovieInteractionEventSource` for the performance staging event boundary sampling output system contract.
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
 * @evidence requirements/staging/events-and-timing.md#staging-event-observation Exposes `IAutoMovieInteractionEvent` as the portable data boundary for the staging event observation requirement.
 * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Types `IAutoMovieInteractionEvent` for the performance staging event boundary sampling output system contract.
 * @author Samchon
 */
export interface IAutoMovieInteractionEvent {
  /**
   * Stable id within the shot.
   *
   * @evidence requirements/staging/events-and-timing.md#staging-event-observation Exposes `id` as the portable data boundary for the staging event observation requirement.
   * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Types `id` for the performance staging event boundary sampling output system contract.
   */
  id: string;

  /**
   * Semantic event category.
   *
   * @evidence requirements/staging/events-and-timing.md#staging-event-observation Exposes `kind` as the portable data boundary for the staging event observation requirement.
   * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Types `kind` for the performance staging event boundary sampling output system contract.
   */
  kind: AutoMovieInteractionEventKind;

  /**
   * Producer that created the event.
   *
   * @evidence requirements/staging/events-and-timing.md#staging-event-observation Exposes `source` as the portable data boundary for the staging event observation requirement.
   * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Types `source` for the performance staging event boundary sampling output system contract.
   */
  source: AutoMovieInteractionEventSource;

  /**
   * Shot-local seconds.
   *
   * @evidence requirements/staging/events-and-timing.md#staging-event-observation Exposes `time` as the portable data boundary for the staging event observation requirement.
   * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Types `time` for the performance staging event boundary sampling output system contract.
   */
  time: number;

  /**
   * Initiating or affected actor, when a single node is known.
   *
   * @evidence requirements/staging/events-and-timing.md#staging-event-observation Exposes `actor` as the portable data boundary for the staging event observation requirement.
   * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Types `actor` for the performance staging event boundary sampling output system contract.
   */
  actor: string | null;

  /**
   * Receiving actor/parent, when a single node is known.
   *
   * @evidence requirements/staging/events-and-timing.md#staging-event-observation Exposes `target` as the portable data boundary for the staging event observation requirement.
   * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Types `target` for the performance staging event boundary sampling output system contract.
   */
  target: string | null;

  /**
   * Projectile or carried object involved in the interaction.
   *
   * @evidence requirements/staging/events-and-timing.md#staging-event-observation Exposes `object` as the portable data boundary for the staging event observation requirement.
   * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Types `object` for the performance staging event boundary sampling output system contract.
   */
  object: string | null;

  /**
   * World point of contact, when the engine computed one.
   *
   * @evidence requirements/staging/events-and-timing.md#staging-event-observation Exposes `point` as the portable data boundary for the staging event observation requirement.
   * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Types `point` for the performance staging event boundary sampling output system contract.
   */
  point: IAutoMovieVector3 | null;

  /**
   * Source action index in the performance action list, when available.
   *
   * @evidence requirements/staging/events-and-timing.md#staging-event-observation Exposes `actionIndex` as the portable data boundary for the staging event observation requirement.
   * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Types `actionIndex` for the performance staging event boundary sampling output system contract.
   */
  actionIndex: number | null;

  /**
   * Actor whose reaction was scheduled from this event, when any.
   *
   * @evidence requirements/staging/events-and-timing.md#staging-event-observation Exposes `reaction` as the portable data boundary for the staging event observation requirement.
   * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output Types `reaction` for the performance staging event boundary sampling output system contract.
   */
  reaction: string | null;
}
