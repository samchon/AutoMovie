import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMoviePose } from "../pose/IAutoMoviePose";
import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";
import { IAutoMovieMountBinding } from "./IAutoMovieMountBinding";

/**
 * One stance plant carried across a beat boundary — where a foot stood on the
 * ground when the beat ended, as the ground-IK pass pinned it.
 *
 * Mirrors the engine's ground-IK plant output at the interface level so the
 * next beat can keep a planted foot exactly where the previous beat left it
 * instead of letting the first stride re-derive (and shift) the contact.
 *
 * @author Samchon
 */
export interface IAutoMovieBeatEndFootPlant {
  /** The planted foot bone. */
  foot: AutoMovieHumanoidBone;

  /** Inclusive stance-run start, seconds on the ended beat's local clock. */
  start: number;

  /** Inclusive stance-run end, seconds on the ended beat's local clock. */
  end: number;

  /** Pinned world foot position held across the run (`y` = ground plane). */
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
 */
export interface IAutoMovieBeatEndActorState {
  /** Scene node / cast id of the actor. */
  node: string;

  /** Final world-space root transform after the beat. */
  transform: IAutoMovieTransform;

  /** Actor forward direction in world space. */
  facing: IAutoMovieVector3;

  /** Final articulation, or `null` when the actor ends in rest pose. */
  pose: IAutoMoviePose | null;

  /** Motion clip sampled for this state, or `null` for a held/static actor. */
  motion: string | null;

  /** Seconds sampled within `motion`, or the shot duration for static actors. */
  localTime: number;

  /**
   * Seconds into the looping clip's cycle at beat end (`localTime` wrapped by
   * the clip duration), or `null` for a non-looping clip or a held actor. The
   * next beat resumes the gait mid-stride at this phase instead of resetting to
   * the cycle start — the difference between a continuous walk and a stutter at
   * every cut.
   */
  gaitPhase: number | null;

  /**
   * World-space root velocity at beat end in m/s, finite-differenced over the
   * clip's last instants, or `null` for a held/static actor. A clamped
   * (non-looping) clip that has already reached its end holds its last pose, so
   * its velocity is zero.
   */
  rootVelocity: IAutoMovieVector3 | null;

  /**
   * The most recent stance plant per foot at beat end (from the ground-IK
   * pass), or `null` when no plant data accompanied the shot. Ordered by first
   * appearance of each foot in the pass output.
   */
  footPlants: IAutoMovieBeatEndFootPlant[] | null;

  /**
   * The persistent coupling this actor rides (a rider on a horse's saddle
   * bone), or `null` when unmounted. Carried rider-side — one rider rides
   * exactly one parent while a parent may carry many riders — so the next beat
   * re-couples without staging having to re-declare it.
   */
  mount: IAutoMovieMountBinding | null;
}

/** Resolved forward-state produced by one completed beat. */
export interface IAutoMovieBeatEndState {
  /** Beat id whose end-state this describes. */
  beat: string;

  /** Shot id that realized the beat. */
  shot: string;

  /** Per actor end-state, in scene node order. */
  actors: IAutoMovieBeatEndActorState[];
}
