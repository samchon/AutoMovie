/**
 * A request to **load context** instead of writing this turn — AutoBe's
 * "preliminary" pattern. A per-beat stage (blocking, performance) that needs
 * the script, the staged scene, or a sibling shot (for continuity) pulls it
 * rather than guessing; the orchestrator answers and the model writes on a
 * later turn. Keeping these as explicit, exhaustible requests stops the model
 * inventing context it could have asked for.
 *
 * @author Samchon
 */
export type IAutoFilmContextRequest =
  /** The full script (logline, theme, cast, beats). */
  | { type: "getScript" }
  /** The staged scene (placements, cameras, lights, couplings). */
  | { type: "getScene" }
  /** An already-built sibling shot, to match its ending pose/position/energy. */
  | { type: "getShot"; beat: string };
