/**
 * A stable id paired with a human / LLM readable name — the minimal identity an
 * authored artifact (a scene, a sequence) carries so later references resolve
 * it and an editor can label it.
 *
 * @author Samchon
 */
export interface IAutoFilmNamedId {
  /** Stable id. */
  id: string;

  /** Display name. */
  name: string;
}
