/** One file this report writes, named by the segments it is written under. */
export interface IAutoMovieBuildingSidecar {
  /** Path below the report root, one segment per directory level. */
  segments: readonly string[];
  /** Exactly the bytes to write, newline included. */
  text: string;
}

/**
 * Which files one building's report writes, and what goes in each.
 *
 * Split from the command because none of it is I/O: it is the naming, and the
 * naming is where a building id becomes a path. `deriveBuilding.ts` opens
 * project state at module level and refuses unless it is current, so nothing
 * could load it to see whether an id is encoded before it is joined; and an
 * id is author-chosen text, not a filename.
 *
 * Every segment goes through `encode`, supplied by the caller so this stays a
 * decision about shape rather than a second copy of the encoding. A building
 * called `wing/a` must land in one directory named for it, not in a `wing`
 * directory the author never asked for and never looks in; a view called `..`
 * must not name the report root's parent.
 *
 * The sheets come before the manifest on purpose. A reader watching the log
 * sees each page as it lands and the record of them last, which is the order
 * they would check the directory in.
 */
export const planAutoMovieBuildingSidecars = (props: {
  encode: (segment: string) => string;
  id: string;
  report: { sheets: ReadonlyArray<{ view: { id: string }; svg: string }> };
}): IAutoMovieBuildingSidecar[] => {
  const directory = props.encode(props.id);
  return [
    ...props.report.sheets.map((sheet) => ({
      segments: [directory, `${props.encode(sheet.view.id)}.svg`],
      text: `${sheet.svg}${String.fromCharCode(10)}`,
    })),
    {
      segments: [directory, "report.json"],
      // Indented, and a trailing newline. These files are tracked rather than
      // ignored so a take-off can be diffed across revisions, and a one-line
      // document diffs as one changed line no matter what moved inside it.
      text: `${JSON.stringify(props.report, null, 2)}${String.fromCharCode(10)}`,
    },
  ];
};
