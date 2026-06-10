/**
 * An action/camera target that is **several nodes at once** — a camera frames
 * their collective extent (a two-shot, a crowd).
 *
 * @author Samchon
 */
export interface IAutoFilmGroupTarget {
  kind: "group";

  /** The scene-node ids framed together. */
  nodes: string[];
}
