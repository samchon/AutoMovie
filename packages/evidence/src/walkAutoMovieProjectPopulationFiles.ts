import fs from "node:fs";
import path from "node:path";

const projectPopulationBoundaryDiagnostic =
  "project evidence populations contain only real files and directories inside the project root";

interface IAutoMovieEvidencePhysicalFile {
  /** Whether lstat classified the entry as a regular file. */
  isFile(): boolean;
  /** Whether lstat classified the entry as a symbolic link. */
  isSymbolicLink(): boolean;
  /** Number of directory entries naming the same physical inode. */
  nlink: number | bigint;
}

/**
 * Decide whether one lstat entry is an independently owned evidence file.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Refuses a second pathname for the same bytes instead of counting it as an independent contract or source.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Applies one regular-file, non-symlink, single-link predicate before any project evidence bytes are read.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity::physical-population-integrity Centralizes the physical identity decision shared by population and package-manifest readers.
 * @author Samchon
 */
export const isAutoMovieEvidencePhysicalFile = (
  entry: IAutoMovieEvidencePhysicalFile,
): boolean =>
  entry.isFile() &&
  entry.isSymbolicLink() === false &&
  (entry.nlink === 1 || entry.nlink === 1n);

/**
 * Walk one project-local evidence population without following filesystem
 * indirection or accepting an entry the graph cannot inventory.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Refuses linked, special, and project-external entries before a physical population can disappear from or enter the graph inventory.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Enumerates project-local population roots with lstat semantics while leaving the separately resolved shared-contract package outside this boundary.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity::physical-population-integrity Makes active hosts, inactive residue, local contracts, and selected source trees one fail-closed physical inventory.
 * @author Samchon
 */
export const walkAutoMovieProjectPopulationFiles = (
  projectRoot: string,
  populationRoot: string,
  extension: ".md" | ".ts",
): string[] => {
  const project = path.resolve(projectRoot);
  const root = path.resolve(populationRoot);
  const relativeRoot = path.relative(project, root);
  if (outside(relativeRoot)) fail(project, root);

  const projectEntry = fs.lstatSync(project);
  if (!projectEntry.isDirectory()) fail(project, project);

  const components = relativeRoot === "" ? [] : relativeRoot.split(path.sep);
  let ancestor = project;
  let rootEntry = projectEntry;
  for (const [index, component] of components.entries()) {
    ancestor = path.join(ancestor, component);
    const entry = fs.lstatSync(ancestor, { throwIfNoEntry: false });
    if (entry === undefined) return [];
    if (index !== components.length - 1 && !entry.isDirectory())
      fail(project, ancestor);
    rootEntry = entry;
  }

  const output: string[] = [];
  const visit = (location: string, entry: fs.Stats): void => {
    const regularFile = isAutoMovieEvidencePhysicalFile(entry);
    if (!entry.isDirectory() && !regularFile) fail(project, location);
    if (regularFile) {
      if (location.endsWith(extension)) output.push(location);
      return;
    }
    for (const name of fs.readdirSync(location).sort(compareCodeUnits)) {
      if (location === project && name === "node_modules") continue;
      const child = path.join(location, name);
      visit(child, fs.lstatSync(child));
    }
  };
  visit(root, rootEntry);
  return output;
};

const fail = (projectRoot: string, location: string): never => {
  const relative = path.relative(projectRoot, location);
  throw new Error(
    `${posix(relative === "" ? "." : relative)}: ${projectPopulationBoundaryDiagnostic}.`,
  );
};

const outside = (relative: string): boolean =>
  relative === ".." ||
  relative.startsWith(`..${path.sep}`) ||
  path.isAbsolute(relative);

const compareCodeUnits = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);

const posix = (value: string): string => value.replaceAll("\\", "/");
