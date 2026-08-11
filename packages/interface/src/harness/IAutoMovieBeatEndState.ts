import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMoviePose } from "../pose/IAutoMoviePose";
import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";
import { IAutoMovieMountBinding } from "./IAutoMovieMountBinding";

/**
 * One stance plant carried across a beat boundary: where a foot stood on the
 * ground when the beat ended, as the ground-IK pass pinned it.
 *
 * Mirrors the engine's ground-IK plant output at the interface level so the
 * next beat can keep a planted foot exactly where the previous beat left it
 * instead of letting the first stride re-derive (and shift) the contact.
 *
 * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `IAutoMovieBeatEndFootPlant` as the portable data boundary for the story beat observation plan requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `IAutoMovieBeatEndFootPlant` for the narrative intent beat observation boundary system contract.
 * @author Samchon
 */
export interface IAutoMovieBeatEndFootPlant {
  /**
   * The planted foot bone.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `foot` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `foot` for the narrative intent beat observation boundary system contract.
   */
  foot: AutoMovieHumanoidBone;

  /**
   * Inclusive stance-run start, seconds on the ended beat's local clock.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `start` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `start` for the narrative intent beat observation boundary system contract.
   */
  start: number;

  /**
   * Inclusive stance-run end, seconds on the ended beat's local clock.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `end` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `end` for the narrative intent beat observation boundary system contract.
   */
  end: number;

  /**
   * Pinned world foot position held across the run (`y` = ground plane).
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `position` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `position` for the narrative intent beat observation boundary system contract.
   */
  position: IAutoMovieVector3;
}

/**
 * One actor's resolved state at the end of a compiled beat.
 *
 * `transform` is the actor's world-space root with any sampled pose root folded
 * in. `pose` keeps only the final articulation; its root is cleared to avoid
 * double-applying the same displacement when a later beat uses this as its
 * starting state.
 *
 * Beyond the end pose, the state carries what a _resumable_ simulation needs so
 * the next beat continues instead of resetting: the gait cycle phase, the root
 * velocity, the planted feet, and the persistent mount coupling. Each is `null`
 * when it does not apply, so a static prop and a mid-stride walker share one
 * shape.
 *
 * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `IAutoMovieBeatEndActorState` as the portable data boundary for the story time state review scope requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `IAutoMovieBeatEndActorState` for the narrative intent temporal state handoff system contract.
 */
export interface IAutoMovieBeatEndActorState {
  /**
   * Scene node / cast id of the actor.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `node` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `node` for the narrative intent temporal state handoff system contract.
   */
  node: string;

  /**
   * Final world-space root transform after the beat.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `transform` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `transform` for the narrative intent temporal state handoff system contract.
   */
  transform: IAutoMovieTransform;

  /**
   * Actor forward direction in world space.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `facing` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `facing` for the narrative intent temporal state handoff system contract.
   */
  facing: IAutoMovieVector3;

  /**
   * Final articulation, or `null` when the actor ends in rest pose.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `pose` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `pose` for the narrative intent temporal state handoff system contract.
   */
  pose: IAutoMoviePose | null;

  /**
   * Motion clip sampled for this state, or `null` for a held/static actor.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `motion` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `motion` for the narrative intent temporal state handoff system contract.
   */
  motion: string | null;

  /**
   * Seconds sampled within `motion`, or the shot duration for static actors.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `localTime` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `localTime` for the narrative intent temporal state handoff system contract.
   */
  localTime: number;

  /**
   * Seconds into the looping clip's cycle at beat end (`localTime` wrapped by
   * the clip duration), or `null` for a non-looping clip or a held actor. The
   * next beat resumes the gait mid-stride at this phase instead of resetting to
   * the cycle start: the difference between a continuous walk and a stutter at
   * every cut.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `gaitPhase` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `gaitPhase` for the narrative intent temporal state handoff system contract.
   */
  gaitPhase: number | null;

  /**
   * World-space root velocity at beat end in m/s, finite-differenced over the
   * clip's last instants, or `null` for a held/static actor. At the exact clip
   * end this is the incoming left-hand velocity at the cut; a non-looping clip
   * sampled strictly after its end holds its last pose at zero velocity.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `rootVelocity` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `rootVelocity` for the narrative intent temporal state handoff system contract.
   */
  rootVelocity: IAutoMovieVector3 | null;

  /**
   * The most recent stance plant per foot whose inclusive run contains the beat
   * end (from the ground-IK pass), or `null` when no plant is active at that
   * instant. Ordered by first appearance of each foot in the pass output.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `footPlants` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `footPlants` for the narrative intent temporal state handoff system contract.
   */
  footPlants: IAutoMovieBeatEndFootPlant[] | null;

  /**
   * The persistent coupling this actor rides (a rider on a horse's saddle
   * bone), or `null` when unmounted. Carried rider-side (one rider rides
   * exactly one parent while a parent may carry many riders), so the next beat
   * re-couples without staging having to re-declare it.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `mount` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `mount` for the narrative intent temporal state handoff system contract.
   */
  mount: IAutoMovieMountBinding | null;
}

/**
 * Resolved forward-state produced by one completed beat.
 *
 * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `IAutoMovieBeatEndState` as the portable data boundary for the story time state review scope requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `IAutoMovieBeatEndState` for the narrative intent temporal state handoff system contract.
 */
export interface IAutoMovieBeatEndState {
  /**
   * Beat id whose end-state this describes.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `beat` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `beat` for the narrative intent temporal state handoff system contract.
   */
  beat: string;

  /**
   * Shot id that realized the beat.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `shot` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `shot` for the narrative intent temporal state handoff system contract.
   */
  shot: string;

  /**
   * Per actor end-state, in scene node order.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `actors` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `actors` for the narrative intent temporal state handoff system contract.
   */
  actors: IAutoMovieBeatEndActorState[];
}
