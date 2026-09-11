import path from "node:path";

/**
 * Select the loaded module ids that are one project's own code.
 *
 * A module under the project root and outside every `node_modules` directory
 * is authored project code that an edit can change between two builds, while
 * an installed package stays the same for the life of the process. Evicting
 * exactly this selection before a gate run makes an edit the code that runs,
 * and the source evaluation reads exactly this selection after the run to learn
 * which project files the answer executed. When both sides use this one
 * predicate, the modules one side evicts are the modules the other accounts for.
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
