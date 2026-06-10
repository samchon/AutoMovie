import {
  IAutoFilmGait,
  IAutoFilmPose,
  IAutoFilmVector3,
} from "@autofilm/interface";

/**
 * The per-actor context the reference {@link makeActorSynthesizer} needs to
 * fatten an actor's verbs deterministically: which skeleton its clips target,
 * the gaits it can perform (a horse's walk/trot/gallop), where it stands at the
 * shot's start (so a `locomote` knows how far to travel), how fast it moves,
 * and the rest pose it holds. The host assembles one of these per actor from
 * the actor's profile and staged rig.
 *
 * @author Samchon
 */
export interface IAutoFilmActorContext {
  /** Skeleton id every synthesised clip targets. */
  skeleton: string;

  /** The gaits this actor can perform, looked up by an action's gait name. */
  gaits: IAutoFilmGait[];

  /** Where the actor stands at the start of the shot (world meters). */
  position: IAutoFilmVector3;

  /** Locomotion speed (m/s) — how fast a `locomote` carries it. */
  speed: number;

  /** Heading the actor faces, degrees about +Y (0 = +Z) — for a `lookAt`'s yaw. */
  facingDeg: number;

  /**
   * Eye height above the actor's position (meters) — where a `lookAt` aims
   * from.
   */
  eyeHeight: number;

  /** The pose the actor settles into for a `hold`. */
  restPose: IAutoFilmPose;
}
