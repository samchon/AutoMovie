import type {
  AutoMovieAuthoredDocumentLayer,
  IAutoMovieProductionBindRequest,
} from "./AutoMovieProductionBinder";

/**
 * Parse the generated project's reader-edition options before any file access.
 *
 * Film editions default to final audience language; other authored layers keep
 * their construction source. Explicit options remain visible in the request.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-breakdown-deliverables Selects the authored family and pass for one reader-facing deliverable.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-authority-gaps Converts explicit book options into a source-identified binder request without writing.
 */
export const parseAutoMovieProductionBookCommand = (
  args: readonly string[],
): Omit<IAutoMovieProductionBindRequest, "root"> => {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index]!;
    if (
      option !== "--layer" &&
      option !== "--output" &&
      option !== "--pass" &&
      option !== "--title"
    )
      throw new Error(`Unknown book option: ${option}`);
    if (values.has(option))
      throw new Error(`Book option ${option} was provided more than once.`);
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`Book option ${option} requires a value.`);
    values.set(option, value);
    index += 1;
  }
  const title = values.get("--title");
  if (title === undefined)
    throw new Error("Book binding requires an explicit --title.");
  const layer = (values.get("--layer") ??
    "screenplays") as AutoMovieAuthoredDocumentLayer;
  const pass =
    values.get("--pass") ??
    (layer === "screenplays" ? "final" : "construction");
  if (pass !== "construction" && pass !== "final")
    throw new Error("Book option --pass must be construction or final.");
  return {
    title,
    layer,
    output: values.get("--output"),
    pass,
  };
};
