import { IAutoFilmActionTarget } from "./IAutoFilmActionCall";

/**
 * A **query tool**: the agent reads instead of writing this turn, and the
 * engine answers. Two families share this union:
 *
 * - **Stored context** (`getScript` / `getScene` / `getShot` / `getNotes` /
 *   `getBeatEnd`) — AutoBe's "preliminary" pattern: pull a slice of the
 *   production state (script, staged scene, a sibling shot, the open review
 *   notes, where a prior beat left everyone) rather than guessing or inventing
 *   it.
 * - **Engine queries** (`getReach` / `getResolvedPose` / `measureDistance`) —
 *   interrogate the engine's _resolved geometry_ so the agent grounds its next
 *   move in fact, not hope. This is the harness's "the engine is the strong
 *   controller" principle as a read surface: before staging a strike the agent
 *   asks whether the actor can actually reach the target (so it _lands_ rather
 *   than mimes at air), and reads where a hand truly ends up before chaining
 *   the next action onto it.
 *
 * In the autonomous toolbox these are tools the agent calls in any order and to
 * any depth — not a fixed pipeline step. Keeping them explicit and exhaustible
 * stops the model inventing context it could have asked the engine for.
 *
 * @author Samchon
 */
export type IAutoFilmContextRequest =
  /** The full script (logline, theme, cast, beats). */
  | { type: "getScript" }

  /** The staged scene (placements, cameras, lights, couplings). */
  | { type: "getScene" }

  /** An already-built sibling shot, to match its ending pose/position/energy. */
  | { type: "getShot"; beat: string }

  /**
   * The open review notes the loop must address — the correction backlog from
   * the last REVIEW. On a revise pass this is how blocking/performance reads
   * _what the reviewer asked to fix_ (closing the review→revise loop) rather
   * than rebuilding blind. Scope to one `beat`, or omit for all open notes.
   */
  | { type: "getNotes"; beat?: string }

  /**
   * The **resolved end-state** of an already-built beat — where it left every
   * actor (final world position, facing, last pose). The forward-state a later
   * beat blocks against (HTN's "effects update the running world"), so a
   * sibling beat starts from where the previous one actually ended rather than
   * from the original staging. (`getShot` returns the built motion; this
   * returns the tidy per-actor end-state precondition.)
   */
  | { type: "getBeatEnd"; beat: string }

  /**
   * Can `actor`, from where it stands, **reach** `target`? The engine answers
   * with the gap against the actor's rig metrics (shoulder + arm span, stride),
   * so the agent stages a strike/grab at a distance that _connects_ instead of
   * miming at air — the classic failure the {@link IAutoFilmStagingApplication}
   * prose check is meant to catch, here as a deterministic precondition the
   * agent can query before committing.
   */
  | { type: "getReach"; actor: string; target: IAutoFilmActionTarget }

  /**
   * The engine-resolved **world pose** of `actor` at shot-local time `t` (the
   * bones' world positions/rotations after FK + drivers + clamps). The agent
   * reads where a hand/foot actually ends up so it can chain the next action
   * onto real geometry (a follow-up that grabs the hand that just landed)
   * rather than re-deriving it.
   */
  | { type: "getResolvedPose"; actor: string; t: number }

  /**
   * World distance between two targets at the current staging — the raw range
   * check behind blocking decisions (is the pursuer close enough to lunge, are
   * the two actors a conversational distance apart). Targets resolve the same
   * way an action's do (a live node, a point, a group's extent).
   */
  | {
      type: "measureDistance";
      from: IAutoFilmActionTarget;
      to: IAutoFilmActionTarget;
    };
