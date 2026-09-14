/**
 * Whether one entry directly inside a production output root is state some
 * production owns rather than the documentation the scaffold ships.
 *
 * `renders/README.md` is a tracked project document. The scaffold ships it and
 * the generated ignore rules cover `renders/<production>/` rather than the file
 * itself, so version control is where it lives and no production namespace
 * claims it. Every other entry is output a production owns, including a
 * directory or a link that borrows that name, because a name alone is not what
 * makes an entry documentation.
 *
 * One rule answers both questions asked of this judgment: whether a first
 * initialization would strand a namespace that already owns output, and whether
 * a legacy layout migration may carry an entry into the production namespace. A
 * second copy would let those two answers disagree, which is how a migration
 * came to move the one document the namespace resolver had already ruled out.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Separates the output a production namespace owns from the tracked document no namespace produced, so only a result is placed under the namespace that made it.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Keeps the tracked render document among the project's tracked inputs instead of the namespaced derived state, so a new checkout reads it from version control.
 */
export const isAutoMovieProductionArtifactEntry = (props: {
  /** Output root the entry sits directly inside. */
  directory: "productions" | "generated" | "renders";
  /** Entry name exactly as the directory reports it. */
  name: string;
  /** Whether the entry is a regular file. */
  isFile: boolean;
}): boolean =>
  props.directory !== "renders" ||
  props.name !== "README.md" ||
  props.isFile === false;
