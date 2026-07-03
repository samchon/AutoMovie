import {
  AutoFilmHumanoidBone,
  IAutoFilmGait,
  IAutoFilmPose,
  IAutoFilmSkeleton,
  IAutoFilmVector3,
} from "@autofilm/interface";

import { IAutoFilmRestFrame } from "../rom/restFrame";

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

  /**
   * The actor's resolved skeleton geometry — the rig bones and their ROM
   * constraints. Required only by the physics/IK verbs that measure or clamp
   * against the body (`react` folds a flinch bounded by each joint's ROM); the
   * gait/hold/lookAt/emote verbs need only the `skeleton` id, so a context
   * built for those alone may omit it, and a physics verb with no `rig`
   * synthesises nothing.
   */
  rig?: IAutoFilmSkeleton;

  /**
   * Per-bone rest frames that let the IK/arm verbs (`reach`/`point`/`strike`)
   * emit their arm angles in **clinical** space — lifted by `sign·r + neutral`
   * so a downstream renderer reads them up through the same frames (abduction
   * 180 raises either arm overhead regardless of side). Omit to have those
   * verbs output raw rig-space angles, the historical behaviour; when supplied
   * it must be paired with the same frames on the player ({@link
   * IAutoFilmActorContext} feeds `AutoFilmPlayer`'s `restFrames`).
   */
  restFrames?: Partial<Record<AutoFilmHumanoidBone, IAutoFilmRestFrame>>;
}
