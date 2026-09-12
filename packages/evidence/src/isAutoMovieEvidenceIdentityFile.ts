interface IAutoMovieEvidenceIdentityFile {
  /** Whether lstat classified the entry as a regular file. */
  isFile(): boolean;
  /** Whether lstat classified the entry as a symbolic link. */
  isSymbolicLink(): boolean;
}

/**
 * Decide whether one lstat entry may be read as the project identity manifest.
 *
 * This is the admission judgment for a manifest the graph reads once at a fixed
 * path, which is why it asks nothing about directory entries. A path that is
 * never enumerated cannot become a second owner inside the graph, and an alias
 * whose bytes are identical yields the same name and description, so counting
 * entries here would refuse an input that carries exactly one identity. A
 * symbolic link stays refused because it would admit a manifest from outside
 * the project root, and an entry that is not a regular file carries no manifest
 * bytes at all. The population judgment is a different decision and keeps its
 * own single-link requirement.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Admits the identity manifest as a regular non-symlink file without demanding a directory-entry count of it.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Implements the manifest admission half of the two separate physical judgments this unit distinguishes.
 * @author Samchon
 */
export const isAutoMovieEvidenceIdentityFile = (
  entry: IAutoMovieEvidenceIdentityFile,
): boolean => entry.isFile() && entry.isSymbolicLink() === false;
