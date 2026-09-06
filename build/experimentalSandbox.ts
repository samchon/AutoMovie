import * as fs from "node:fs";
import * as path from "node:path";

import {
  type IScaffoldFileSnapshot,
  type IScaffoldPhysicalDirectory,
  assertScaffoldFileSnapshot,
  assertScaffoldPhysicalDirectory,
  captureScaffoldFile,
  captureScaffoldPhysicalDirectory,
  ensureScaffoldFileDirectory,
  readScaffoldFileSnapshot,
  writeScaffoldFile,
} from "../packages/template/src/scaffoldFileSnapshot";
import {
  planScaffoldPublication,
  publishScaffoldCandidate,
} from "../packages/template/src/scaffoldPublication";
import { ScaffoldPublicationError } from "../packages/template/src/writeFiles";

/**
 * The existing physical IO primitives used by one sandbox authority session.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-sandbox-write-boundary Separates physical approval and publication from the launcher without granting a second target authority.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-sandbox-physical-ownership Supplies the captured-directory and descriptor-file protocol used at each operation boundary.
 * @author Samchon
 */
export interface IExperimentalSandboxIO {
  assertDirectory: typeof assertScaffoldPhysicalDirectory;
  assertFile: typeof assertScaffoldFileSnapshot;
  captureDirectory: typeof captureScaffoldPhysicalDirectory;
  captureFile: typeof captureScaffoldFile;
  ensureDirectory: typeof ensureScaffoldFileDirectory;
  readDirectory: (directory: string) => readonly string[];
  readFile: typeof readScaffoldFileSnapshot;
  writeFile: typeof writeScaffoldFile;
}

/**
 * Filesystem effects stay in the template's descriptor-bound primitives.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-sandbox-write-boundary Routes launcher effects through ordinary-directory and single-link file validation.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-sandbox-physical-ownership Connects the approval session to the production template's physical IO boundary.
 */
export const experimentalSandboxIO: IExperimentalSandboxIO = {
  assertDirectory: assertScaffoldPhysicalDirectory,
  assertFile: assertScaffoldFileSnapshot,
  captureDirectory: captureScaffoldPhysicalDirectory,
  captureFile: captureScaffoldFile,
  ensureDirectory: ensureScaffoldFileDirectory,
  readDirectory: fs.readdirSync,
  readFile: readScaffoldFileSnapshot,
  writeFile: writeScaffoldFile,
};

/**
 * Captured sandbox ownership retained through preparation and installation.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-sandbox-write-boundary Carries the original sandbox and file approvals through the complete launcher operation.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-sandbox-physical-ownership Gives preparation, publication and install one shared currentness check.
 * @author Samchon
 */
export interface IExperimentalSandbox {
  readonly entries: readonly string[];
  readonly manifest: string | undefined;
  readonly target: string;
  assertCurrent(): void;
  prepare(files: readonly string[]): void;
  publish(files: Record<string, string>): void;
  read(relative: string): string | undefined;
}

/**
 * Bind a sandbox to every ordinary directory from the filesystem root through
 * its direct-child target, and to each observed file generation. Refresh may
 * read an existing project but never creates its missing root or target.
 *
 * Publication consumes the file snapshots approved before packing. A completed
 * writer must return its descriptor's identity, so the installation check
 * cannot adopt a replacement that appeared after the writer closed.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-sandbox-write-boundary Refuses directory aliases and changed file generations before advancing sandbox mutation authority.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-sandbox-physical-ownership Retains ancestor, target and descriptor-file snapshots across preparation and publication.
 */
export const openExperimentalSandbox = (
  props: { create: boolean; overwrite?: boolean; root: string; target: string },
  io: IExperimentalSandboxIO = experimentalSandboxIO,
): IExperimentalSandbox => {
  const root = path.resolve(props.root);
  const target = path.resolve(props.target);
  const overwrite = !props.create || props.overwrite === true;
  if (path.dirname(target) !== root)
    throw new Error(`sandbox must be one direct child of its root: ${target}`);

  const directories = new Map<string, IScaffoldPhysicalDirectory>();
  const files = new Map<string, IScaffoldFileSnapshot | null>();
  const assertDirectories = (): void => {
    for (const directory of directories.values()) io.assertDirectory(directory);
  };
  const captureDirectory = (
    directory: string,
    create: boolean,
  ): IScaffoldPhysicalDirectory => {
    assertDirectories();
    const cached = directories.get(directory);
    if (cached !== undefined) return cached;
    const parent = directories.get(path.dirname(directory));
    let captured: IScaffoldPhysicalDirectory;
    try {
      captured = io.captureDirectory(directory);
    } catch (error) {
      if (!create || !missingFile(error) || parent === undefined) throw error;
      captured = io.ensureDirectory({
        base: parent,
        cache: directories,
        directory,
      });
    }
    assertDirectories();
    if (path.relative(directory, captured.real) !== "")
      throw new Error(
        `sandbox directory resolves outside its declared path: ${directory}`,
      );
    directories.set(directory, captured);
    io.assertDirectory(captured);
    return captured;
  };

  const ancestors: string[] = [];
  for (let cursor = target; ; cursor = path.dirname(cursor)) {
    ancestors.unshift(cursor);
    if (path.dirname(cursor) === cursor) break;
  }
  for (const directory of ancestors)
    captureDirectory(
      directory,
      props.create && (directory === root || directory === target),
    );
  const base = directories.get(target)!;

  const captureFile = (file: string): IScaffoldFileSnapshot | null => {
    try {
      return io.captureFile(file);
    } catch (error) {
      if (!missingFile(error)) throw error;
      return null;
    }
  };
  const assertCurrent = (): void => {
    assertDirectories();
    for (const [file, snapshot] of files) {
      if (snapshot === null) {
        if (captureFile(file) !== null)
          throw new Error(`sandbox file appeared after approval: ${file}`);
      } else io.assertFile(snapshot);
    }
    assertDirectories();
  };
  const fileParent = (
    file: string,
    create: boolean,
  ): IScaffoldPhysicalDirectory => {
    const segments = path
      .relative(target, path.dirname(file))
      .split(path.sep)
      .filter(Boolean);
    let parent = base;
    for (const segment of segments)
      parent = captureDirectory(path.join(parent.path, segment), create);
    return parent;
  };
  const resolveFile = (relative: string): string =>
    planScaffoldPublication({ root: target, files: { [relative]: "" } })[0]!
      .target;
  const read = (relative: string): string | undefined => {
    assertCurrent();
    const file = resolveFile(relative);
    try {
      fileParent(file, false);
      const result = io.readFile(file);
      const previous = files.get(file);
      if (
        previous !== undefined &&
        (previous === null || previous.version !== result.snapshot.version)
      )
        throw new Error(`sandbox file changed while read: ${file}`);
      io.assertFile(result.snapshot);
      files.set(file, result.snapshot);
      assertCurrent();
      return result.bytes.toString("utf8");
    } catch (error) {
      if (!missingFile(error)) throw error;
      assertCurrent();
      return undefined;
    }
  };

  assertCurrent();
  const entries = Object.freeze([...io.readDirectory(target)]);
  assertCurrent();
  const manifest = read("package.json");
  if (manifest === undefined)
    files.set(path.join(target, "package.json"), null);

  return {
    assertCurrent,
    entries,
    manifest,
    target,
    prepare: (relativeFiles) => {
      const candidate = planScaffoldPublication({
        root: target,
        files: Object.fromEntries(
          relativeFiles.map((relative) => [relative, ""]),
        ),
      });
      for (const entry of candidate) {
        assertCurrent();
        fileParent(entry.target, props.create);
        if (!files.has(entry.target))
          files.set(entry.target, captureFile(entry.target));
        if (!overwrite && files.get(entry.target) !== null)
          throw new Error(
            `sandbox file exists without overwrite authority: ${entry.target}`,
          );
      }
      assertCurrent();
    },
    publish: (contents) => {
      const candidate = planScaffoldPublication({
        root: target,
        files: contents,
      });
      for (const entry of candidate)
        if (!files.has(entry.target))
          throw new Error(
            `sandbox publication was not approved before packing: ${entry.target}`,
          );
      const receipt = publishScaffoldCandidate({
        candidate,
        publish: (entry) => {
          let publishedParent: string | undefined;
          try {
            assertCurrent();
            const outcome = io.writeFile({
              base,
              bytes: Uint8Array.from(entry.bytes),
              expected: files.get(entry.target)!,
              force: overwrite,
              parent: fileParent(entry.target, false),
              target: entry.target,
            });
            if (outcome.status !== "completed") return outcome;
            publishedParent = outcome.parentIdentity;
            const current = io.readFile(entry.target);
            if (
              outcome.fileIdentity === undefined ||
              current.identity !== outcome.fileIdentity ||
              !current.bytes.equals(Buffer.from(entry.bytes))
            )
              throw new Error(
                `sandbox publication changed before its receipt was captured: ${entry.target}`,
              );
            files.set(entry.target, current.snapshot);
            assertCurrent();
            return outcome;
          } catch (error) {
            return publishedParent !== undefined
              ? {
                  bytesWritten: entry.bytes.length,
                  error,
                  parentIdentity: publishedParent,
                  status: "partial" as const,
                }
              : {
                  error,
                  reason: "create-failed" as const,
                  status: "refused" as const,
                };
          }
        },
      });
      if (receipt.status !== "completed") {
        const error = new ScaffoldPublicationError(receipt);
        error.message += `: ${error.cause instanceof Error ? error.cause.message : String(error.cause)}`;
        throw error;
      }
    },
    read,
  };
};

const missingFile = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "ENOENT";
