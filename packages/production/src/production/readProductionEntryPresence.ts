import path from "node:path";

/**
 * Read presence without conflating an unsafe recovery marker with absent prose.
 *
 */
export const readProductionEntryPresence = (props: {
  /** Absolute physical root belonging to the current production incarnation. */
  root: string;
  /** Project-relative pending entry, never an external pathname. */
  relative: string;
  /** Revalidate the original production incarnation. */
  assertCurrent: () => void;
  /** Reject unsafe parent ancestry while allowing a missing tail. */
  assertParent: (parent: string) => void;
  /** Return true for any entry, including a dangling link or directory. */
  exists: (file: string) => boolean;
}): boolean => {
  props.assertCurrent();
  const file = path.resolve(props.root, props.relative);
  const relative = path.relative(props.root, file);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(
      "Recovery entry must be a path inside the production root.",
    );
  const parent = path.dirname(file);
  props.assertParent(parent);
  const exists = props.exists(file);
  props.assertParent(parent);
  props.assertCurrent();
  return exists;
};
