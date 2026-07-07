import {
  AutoMovieHumanoidBone,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import {
  IAutoMovieImpact,
  IAutoMovieBody as IAutoMovieImpactBody,
  resolveImpact,
} from "./impact";
import {
  IAutoMovieRecoilPush,
  impactRecoil,
  impulseToRecoilPush,
} from "./impactRecoil";

/**
 * A suggested collision response — the abstracted {@link IAutoMovieImpact}, the
 * {@link IAutoMovieRecoilPush} its impulse maps to, and (when a struck chain is
 * given) the ROM-bounded flinch {@link IAutoMoviePose}. It is advice an agent
 * can accept, not an imposed result (see D010): a warning carries this so the
 * model can adopt the plausible bounce or override it as intentional.
 *
 * @author Samchon
 */
export interface IAutoMovieCollisionResponse {
  /** The resolved impact between the two bodies. */
  impact: IAutoMovieImpact;
  /** The recoil deflection its impulse maps to. */
  push: IAutoMovieRecoilPush;
  /** The ROM-bounded flinch pose, or `null` when no struck chain was given. */
  recoil: IAutoMoviePose | null;
}

/**
 * Suggest how a collision resolves: run {@link resolveImpact} for the impulse,
 * bridge it to a recoil push, and — when a struck `chain` + `skeleton` are
 * given — bound that push by joint ROM into a flinch pose via
 * {@link impactRecoil}. This is the reusable core the pipeline (and
 * {@link detectBodyCollision}) attaches to a contact warning; it wires together
 * resolveImpact and impactRecoil, whose consumer was previously missing.
 *
 * @author Samchon
 */
export const suggestCollisionResponse = (props: {
  /** The struck actor's colliding body (mass, velocity, material). */
  a: IAutoMovieImpactBody;
  /** The other colliding body. */
  b: IAutoMovieImpactBody;
  /** Unit contact normal from `a` toward `b`. */
  normal: IAutoMovieVector3;
  /** Degrees of recoil flexion per unit impulse. */
  gainDegPerImpulse: number;
  /** Struck bone chain (contact bone toward the body), for the flinch pose. */
  chain?: AutoMovieHumanoidBone[];
  /** Skeleton the flinch is bounded against. */
  skeleton?: IAutoMovieSkeleton;
  /** Flinch falloff down the chain. Defaults to `impactRecoil`'s default. */
  falloff?: number;
}): IAutoMovieCollisionResponse => {
  const impact = resolveImpact(props.a, props.b, props.normal);
  const push = impulseToRecoilPush(impact.impulse, props.gainDegPerImpulse);
  const recoil =
    props.chain !== undefined && props.skeleton !== undefined
      ? impactRecoil(push, props.chain, props.skeleton, props.falloff)
      : null;
  return { impact, push, recoil };
};
