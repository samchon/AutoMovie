import { IAutoFilmGait, IAutoFilmPose } from "@autofilm/interface";

/**
 * The per-actor context the reference {@link makeActorSynthesizer} needs to
 * fatten an actor's verbs deterministically: which skeleton its clips target,
 * the gaits it can perform (a horse's walk/trot/gallop), and the rest pose it
 * holds. The host assembles one of these per actor from the actor's profile and
 * staged rig.
 *
 * @author Samchon
 */
export interface IAutoFilmActorContext {
  /** Skeleton id every synthesised clip targets. */
  skeleton: string;

  /** The gaits this actor can perform, looked up by an action's gait name. */
  gaits: IAutoFilmGait[];

  /** The pose the actor settles into for a `hold`. */
  restPose: IAutoFilmPose;
}
