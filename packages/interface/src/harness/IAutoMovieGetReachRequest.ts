import { IAutoMovieActionTarget } from "./IAutoMovieActionCall";

/** A reach-query target the geometry context can resolve successfully. */
export type IAutoMovieReachTarget = Extract<
  IAutoMovieActionTarget,
  { kind: "node" | "bone" | "point" | "group" }
>;

/**
 * Engine query: can `actor`, from where it stands, **reach** `target`? The
 * engine answers with the gap against the actor's rig metrics (shoulder + arm
 * span, stride), so the agent stages a strike/grab at a distance that
 * _connects_ instead of miming at air: the classic failure, here as a
 * deterministic precondition the agent can query before committing. A bone
 * target is sampled from its actor's resolved pose at `t`, optionally under the
 * resident beat's performed shot.
 *
 * @author Samchon
 */
export interface IAutoMovieGetReachRequest {
  type: "getReach";

  /** The actor reaching. */
  actor: string;

  /** What it reaches for: a placement, live bone, literal point, or group. */
  target: IAutoMovieReachTarget;

  /** Optional resident beat selecting the target actor's performed motion. */
  beat?: string;

  /** Shot-local seconds at which a live bone is sampled. Defaults to 0. */
  t?: number;
}
