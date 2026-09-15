import {
  type IScaffoldPhysicalDirectory,
  assertScaffoldPhysicalDirectory,
  captureScaffoldPhysicalDirectory,
} from "@automovie/template";
import * as fs from "node:fs";
import path from "node:path";

/**
 * Directory-only observations used to enumerate a closed maintenance input.
 *
 * @evidence requirements/story/delivery-index.md#story-delivery-index Keeps enumerated inputs physically under the approved project.
 * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Supplies physical directory and child-entry facts rather than trusting lexical paths.
 */
export interface IAutoMovieMaintenanceDirectoryIO {
  /** Capture one ordinary directory and its physical identity. */
  capture: (target: string) => IScaffoldPhysicalDirectory;
  /** Refuse a changed captured directory. */
  assert: (directory: IScaffoldPhysicalDirectory) => void;
  /** Enumerate only entry names and kinds; text is read through the snapshot reader. */
  list: (directory: string) => readonly {
    name: string;
    kind: "directory" | "file" | "link" | "other";
  }[];
}

const directoryIO: IAutoMovieMaintenanceDirectoryIO = {
  capture: captureScaffoldPhysicalDirectory,
  assert: assertScaffoldPhysicalDirectory,
  list: (directory) =>
    fs.readdirSync(directory, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      kind: entry.isSymbolicLink()
        ? "link"
        : entry.isDirectory()
          ? "directory"
          : entry.isFile()
            ? "file"
            : "other",
    })),
};

/**
 * Enumerate Markdown paths without following linked or replaced ancestors.
 *
 * @evidence requirements/story/delivery-index.md#story-delivery-index Rejects a linked input tree before its files can enter a maintenance plan.
 * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Retains the captured root and each visited directory through the read-only walk.
 */
export const readAutoMovieMaintenanceMarkdownPaths = (
  root: IScaffoldPhysicalDirectory,
  relative: string,
  io: IAutoMovieMaintenanceDirectoryIO = directoryIO,
): string[] => {
  const target = path.resolve(root.path, relative);
  const scoped = path.relative(root.path, target);
  if (
    scoped === "" ||
    scoped === ".." ||
    scoped.startsWith(`..${path.sep}`) ||
    path.isAbsolute(scoped)
  )
    throw new Error("Maintenance Markdown directory escapes its root.");
  const output: string[] = [];
  const visit = (directory: string): void => {
    io.assert(root);
    let owned: IScaffoldPhysicalDirectory;
    try {
      owned = io.capture(directory);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        io.assert(root);
        return;
      }
      throw error;
    }
    const physical = path.relative(root.real, owned.real);
    if (
      path.relative(owned.path, owned.real) !== "" ||
      physical === ".." ||
      physical.startsWith(`..${path.sep}`) ||
      path.isAbsolute(physical)
    )
      throw new Error(
        `Maintenance Markdown directory is linked or outside its root: ${directory}.`,
      );
    for (const entry of [...io.list(directory)].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      io.assert(root);
      io.assert(owned);
      if (
        entry.name === "" ||
        entry.name === "." ||
        entry.name === ".." ||
        /[/\\\0]/u.test(entry.name)
      )
        throw new Error(
          "Maintenance directory returned an invalid child name.",
        );
      const child = path.join(directory, entry.name);
      if (entry.kind === "link")
        throw new Error(`Maintenance Markdown entry is linked: ${child}.`);
      if (entry.kind === "directory") visit(child);
      else if (entry.kind === "file" && entry.name.endsWith(".md"))
        output.push(path.relative(root.path, child).split(path.sep).join("/"));
    }
    io.assert(owned);
    io.assert(root);
  };
  visit(target);
  return output;
};

/**
 * Close delivery maintenance over scripts and both screenplay passes.
 *
 * @evidence requirements/story/delivery-index.md#story-delivery-index Binds delivery publication to every participating Markdown population.
 * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Uses the same complete input inventory during planning and admission.
 */
export const readAutoMovieDeliveryMaintenanceMarkdownPaths = (
  root: IScaffoldPhysicalDirectory,
  io: IAutoMovieMaintenanceDirectoryIO = directoryIO,
): string[] =>
  ["docs/scripts", "docs/screenplays", "docs/final/screenplays"].flatMap(
    (relative) => readAutoMovieMaintenanceMarkdownPaths(root, relative, io),
  );

/**
 * Recheck the complete enumerated population, including newly added siblings.
 *
 * @evidence requirements/story/delivery-index.md#story-delivery-index Keeps a maintenance plan bound to the complete input population it observed.
 * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Refuses added, removed, or reordered members before publication admission.
 */
export const assertAutoMovieMaintenanceMarkdownInventory = (
  expected: readonly string[],
  current: readonly string[],
): void => {
  if (
    expected.length !== current.length ||
    expected.some((file, index) => file !== current[index])
  )
    throw new Error(
      "Maintenance Markdown population changed after planning; rediscover before retrying.",
    );
};
