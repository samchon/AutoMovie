import { IAutoMovieInteractionEvent } from "@automovie/interface";

/**
 * Canonical time key for an interaction event id: six-decimal seconds.
 *
 * @evidence requirements/staging/events-and-timing.md#staging-event-observation eventTimeKey normalizes an interaction instant to six decimals so repeated event construction yields the same observable occurrence id.
 * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output eventTimeKey supplies the stable time component used to order and identify boundary-event output.
 */
export const eventTimeKey = (time: number): string => time.toFixed(6);

/**
 * The four scripted-cue events an `attachTo` handoff emits: the child is
 * grabbed and attached at `start`, then detached and released at `end`. One
 * place for the shared envelope (source, actor/target/object, null point and
 * reaction) the coupling rides, kept in its own module so the mapped-literal
 * construction stays clear of {@link performShot}'s hot body.
 *
 * @evidence requirements/staging/events-and-timing.md#staging-event-observation handoffEvents exposes grab and attach at the authored start, then detach and release at the authored end, on one deterministic event envelope.
 * @evidence requirements/staging/interactions-and-choreography.md#staging-choreography-phases Materializes the handoff's grab and attach phase at `start` and its detach and release phase at `end`, with the child-parent coupling as the observable consequence.
 * @evidence requirements/motion/timing-and-semantic-events.md#motion-event-identity-payload Builds each handoff occurrence from a stable kind/subject/target/time identity and preserves its scripted source, action payload, instant, and observable coupling consequence.
 * @evidence requirements/actors/performance-and-story-binding.md#actor-performance-events-contacts Connects the actor's grab, attach, detach, and release contacts to exact shot-local event instants.
 * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-event-boundary-sampling-output handoffEvents emits the four coupling boundary records in authored clock order with stable source and participant identity.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-interaction-choreography-role Emits distinct attach and release boundary phases with stable participants and the coupling state change they cause.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clock-semantic-event Emits ordered grab, attach, detach, and release records with stable occurrence ids at their exact authored instants.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-story-performance-state Realizes the coupling performance as addressed contact events rather than leaving the prop-state change implicit.
 */
export const handoffEvents = (
  child: string,
  parent: string,
  start: number,
  end: number,
  actionIndex: number,
): IAutoMovieInteractionEvent[] =>
  (
    [
      ["grab", start],
      ["attach", start],
      ["detach", end],
      ["release", end],
    ] as const
  ).map(([kind, time]) => ({
    id: `${kind}:${child}:${parent}:${eventTimeKey(time)}`,
    kind,
    source: "scriptedCue",
    time,
    actor: child,
    target: parent,
    object: child,
    point: null,
    actionIndex,
    reaction: null,
  }));
