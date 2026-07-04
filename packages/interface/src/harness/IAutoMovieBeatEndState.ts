import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMoviePose } from "../pose/IAutoMoviePose";

/**
 * One actor's resolved state at the end of a compiled beat.
 *
 * `transform` is the actor's world-space root with any sampled pose root folded
 * in. `pose` keeps only the final articulation; its root is cleared to avoid
 * double-applying the same displacement when a later beat uses this as its
 * starting state.
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
