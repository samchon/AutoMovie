import path from "node:path";

/**
 * Select the loaded module ids that are one project's own code.
 *
 * A module under the project root and outside every `node_modules` directory
 * is authored project code that an edit can change between two builds, while
 * an installed package stays the same for the life of the process. The builder
 * evicts exactly this selection before it evaluates source, so the edit is what
 * runs, and the source status reads exactly this selection after an evaluation
 * to learn which project files the answer executed. One predicate serves both,
 * so the modules one side evicts are the modules the other side accounts for.
 */
export const listAutoMovieProjectModules = (props: {
  /** Absolute project root. */
  root: string;

  /** Absolute ids of every currently loaded module. */
  loaded: readonly string[];
}): string[] =>
  props.loaded.filter((id) => {
    const relative = path.relative(props.root, id);
    return (
      relative !== "" &&
      relative.startsWith("..") === false &&
      path.isAbsolute(relative) === false &&
      relative.split(path.sep).includes("node_modules") === false
    );
  });
