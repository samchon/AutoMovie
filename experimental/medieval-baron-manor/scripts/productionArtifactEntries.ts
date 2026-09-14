/**
 * Root render documentation cannot strand a production namespace. Every other
 * entry, including a directory or link with that name, remains owned state.
 */
export const hasProductionArtifactEntries = (props: {
  directory: "productions" | "generated" | "renders";
  entries: readonly { name: string; isFile: boolean }[];
}): boolean =>
  props.entries.some(
    (entry) =>
      props.directory !== "renders" ||
      entry.name !== "README.md" ||
      entry.isFile === false,
  );
