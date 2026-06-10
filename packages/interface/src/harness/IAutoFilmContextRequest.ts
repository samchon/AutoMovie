/**
 * A request to **load context** instead of writing this turn — AutoBe's
 * "preliminary" pattern. A per-beat stage (blocking, performance) that needs
 * the script, the staged scene, a sibling shot (for continuity), or the open
 * review notes (on a revise pass) pulls it rather than guessing; the
 * orchestrator answers and the model writes on a later turn. Keeping these as
 * explicit, exhaustible requests stops the model inventing context it could
 * have asked for.
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
  | { type: "getNotes"; beat?: string };
