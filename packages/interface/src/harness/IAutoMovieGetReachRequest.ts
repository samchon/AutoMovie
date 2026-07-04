import { IAutoMovieActionTarget } from "./IAutoMovieActionCall";

/**
 * Engine query: can `actor`, from where it stands, **reach** `target`? The
 * engine answers with the gap against the actor's rig metrics (shoulder + arm
 * span, stride), so the agent stages a strike/grab at a distance that
 * _connects_ instead of miming at air — the classic failure, here as a
 * deterministic precondition the agent can query before committing.
 *
 * @author Samchon
 */
export interface IAutoMovieGetReachRequest {
  type: "getReach";

  /** The actor reaching. */
  actor: string;

  /** What it reaches for. */
  target: IAutoMovieActionTarget;
}
