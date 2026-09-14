import { compareCodeUnits } from "@automovie/engine";
import {
  type IScaffoldFileSnapshot,
  type IScaffoldPhysicalDirectory,
  assertScaffoldFileSnapshot,
  assertScaffoldPhysicalDirectory,
  captureScaffoldPhysicalDirectory,
  readScaffoldFileSnapshot,
} from "@automovie/template";
import * as path from "node:path";

import type { IAutoMovieMaintenanceFile } from "./contractMaintenanceTransaction";

/**
 * Carry a descriptor snapshot into the native maintenance boundary. Handle
 * acquisition itself can advance Windows change time, so the mutation token
 * retains physical identity, size and modification time beside exact bytes.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Preserves the planner's physical file identity and exact bytes without approving later resident content.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Normalizes descriptor observations to the size and modification generation verified by native source handles.
 */
export const autoMovieMaintenanceFileFromSnapshot = (
  snapshot: Pick<IScaffoldFileSnapshot, "identity" | "version">,
  source: string,
): IAutoMovieMaintenanceFile => ({
  identity: snapshot.identity,
  source,
  version: snapshot.version.split(":").slice(0, -1).join(":"),
});

/**
 * Physical observations supplied to maintenance without granting mutation.
 * Every read returns the descriptor-verified generation beside its bytes.
 *
 * @evidence requirements/operations-and-recovery/contract-baseline.md#operations-contract-baseline-identity Requires ordinary physical directories and exact file observations below the selected project root.
 * @evidence specifications/execution-and-recovery/contract-baseline.md#execution-contract-baseline-identity Supplies the physical observations from which the portable baseline inventory is read.
 * @author Samchon
 */
export interface IAutoMovieMaintenanceObservationIO {
  /** Capture one ordinary directory or throw, including on a linked leaf. */
  directory(target: string): IScaffoldPhysicalDirectory;
  /** Revalidate the physical directory after the file descriptor read. */
  assertDirectory(directory: IScaffoldPhysicalDirectory): void;
  /** Check the admitted pathname generation before our own descriptor opens. */
  assertFile(snapshot: IScaffoldFileSnapshot): void;
  /** Read one ordinary file through its captured descriptor. */
  file(target: string): {
    bytes: Uint8Array;
    snapshot: IScaffoldFileSnapshot;
    identity: string;
    version: string;
  };
}

/**
 * Plan-bound physical inventory, including absent targets and every existing
 * ancestor of a rename source even when the plan has no target writes.
 *
 * @evidence requirements/operations-and-recovery/contract-baseline.md#operations-contract-baseline-identity Retains the exact physical root, parent generations and bytes that planning admitted.
 * @evidence specifications/execution-and-recovery/contract-baseline.md#execution-contract-baseline-identity Keeps portable paths associated with their observed physical identities.
 * @author Samchon
 */
export interface IAutoMovieMaintenanceObservation {
  /** Ordinary root and descendant directory generations. */
  directories: readonly IScaffoldPhysicalDirectory[];
  /** Descriptor-verified file identity, or null for an absent target. */
  files: Readonly<Record<string, IScaffoldFileSnapshot | null>>;
  /** Held-descriptor identity and generation, separately from pathname metadata. */
  descriptors: Readonly<
    Record<string, Pick<IScaffoldFileSnapshot, "identity" | "version"> | null>
  >;
  /** Exact UTF-8 sources, with absent targets omitted. */
  sources: Readonly<Record<string, string>>;
  /** Physical project root used throughout this operation. */
  root: IScaffoldPhysicalDirectory;
}

const defaultIO: IAutoMovieMaintenanceObservationIO = {
  directory: captureScaffoldPhysicalDirectory,
  assertDirectory: assertScaffoldPhysicalDirectory,
  assertFile: assertScaffoldFileSnapshot,
  file: readScaffoldFileSnapshot,
};

const missing = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "ENOENT";

const inside = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};

/**
 * Read a closed maintenance population through every physical ancestor.
 * Missing targets are observations, while links, changed parents and read
 * failures are refusals. No directory is created during planning.
 *
 * @evidence requirements/operations-and-recovery/contract-baseline.md#operations-contract-baseline-identity Rejects physical escapes and retains absent destination slots without following a linked ancestor.
 * @evidence specifications/execution-and-recovery/contract-baseline.md#execution-contract-baseline-identity Reads each selected source only under the same captured project root and ordinary directory generations.
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-alias-visible-bytes Observes an input without counting its directory entries, because the publication it feeds replaces entries instead of rewriting the bytes another pathname shows.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-alias-visible-bytes Supplies the observation for the entry-replacing method, whose admission the entry count does not govern.
 */
export const observeAutoMovieMaintenanceFiles = (props: {
  root: string | IScaffoldPhysicalDirectory;
  paths: readonly string[];
  io?: IAutoMovieMaintenanceObservationIO;
}): IAutoMovieMaintenanceObservation => {
  const io = props.io ?? defaultIO;
  const root =
    typeof props.root === "string"
      ? io.directory(path.resolve(props.root))
      : props.root;
  io.assertDirectory(root);
  if (path.relative(root.path, root.real) !== "")
    throw new Error("Maintenance root is reached through a linked ancestor.");
  const directories = new Map<string, IScaffoldPhysicalDirectory>([
    [root.path, root],
  ]);
  const files = Object.create(null) as Record<
    string,
    IScaffoldFileSnapshot | null
  >;
  const sources = Object.create(null) as Record<string, string>;
  const descriptors = Object.create(null) as Record<
    string,
    Pick<IScaffoldFileSnapshot, "identity" | "version"> | null
  >;
  for (const relative of [...new Set(props.paths)].sort(compareCodeUnits)) {
    const segments = relative.split("/");
    if (
      relative.includes("\\") ||
      relative.includes("\0") ||
      relative.includes(":") ||
      segments.some((segment) => ["", ".", ".."].includes(segment))
    )
      throw new Error(`Invalid maintenance path: ${relative}.`);
    const target = path.resolve(root.path, ...segments);
    let parent = root;
    let absent = false;
    for (const segment of segments.slice(0, -1)) {
      const next = path.join(parent.path, segment);
      let directory = directories.get(next);
      if (directory === undefined) {
        try {
          directory = io.directory(next);
        } catch (error) {
          if (!missing(error)) throw error;
          absent = true;
          break;
        }
        if (
          !inside(root.real, directory.real) ||
          path.relative(directory.path, directory.real) !== ""
        )
          throw new Error(
            `Maintenance ancestor escapes its root: ${relative}.`,
          );
        directories.set(next, directory);
      }
      io.assertDirectory(parent);
      io.assertDirectory(directory);
      parent = directory;
    }
    files[relative] = null;
    descriptors[relative] = null;
    if (!absent)
      try {
        const observed = io.file(target);
        if (observed.snapshot.path !== target)
          throw new Error(
            `Maintenance file observation changed path: ${relative}.`,
          );
        files[relative] = Object.freeze({ ...observed.snapshot });
        descriptors[relative] = Object.freeze({
          identity: observed.identity,
          version: observed.version,
        });
        sources[relative] = new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true,
        }).decode(observed.bytes);
      } catch (error) {
        if (!missing(error)) throw error;
      }
    for (const directory of directories.values()) io.assertDirectory(directory);
  }
  io.assertDirectory(root);
  return Object.freeze({
    directories: Object.freeze(
      [...directories.values()].map((directory) =>
        Object.freeze({ ...directory }),
      ),
    ),
    files: Object.freeze(files),
    descriptors: Object.freeze(descriptors),
    sources: Object.freeze(sources),
    root: Object.freeze({ ...root }),
  });
};

/**
 * Reopen the planner's population without adopting a competitor generation.
 * The returned fresh read is useful for publication planning, but only after
 * all original file and ancestor identities have remained equal.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Carries the planner's exact predecessor identities across the final observation instead of approving new resident bytes.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Rejects file, parent and root replacement before the transaction acquires mutation authority.
 */
export const assertAutoMovieMaintenanceObservation = (
  expected: IAutoMovieMaintenanceObservation,
  io: IAutoMovieMaintenanceObservationIO = defaultIO,
): IAutoMovieMaintenanceObservation => {
  for (const directory of expected.directories) io.assertDirectory(directory);
  for (const file of Object.values(expected.files))
    if (file !== null) io.assertFile(file);
  const current = observeAutoMovieMaintenanceFiles({
    root: expected.root,
    paths: Object.keys(expected.files),
    io,
  });
  assertAutoMovieMaintenanceGeneration(expected, current);
  return current;
};

/**
 * Compare an admitted inventory with the result of our own subsequent reads.
 * Current may extend the population, but every expected file and ancestor must
 * still be represented. This pure subset comparison ignores only own-open
 * ctime drift; it does not replace the full snapshot admission before IO.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Retains original metadata authority while a later physical observation extends the planning population.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Compares exact bytes and stable pathname and descriptor generations after separately admitted reads without accepting a changed ancestor.
 */
export const assertAutoMovieMaintenanceGeneration = (
  expected: IAutoMovieMaintenanceObservation,
  current: IAutoMovieMaintenanceObservation,
): void => {
  if (
    expected.root.identity !== current.root.identity ||
    expected.root.path !== current.root.path ||
    expected.root.real !== current.root.real
  )
    throw new Error("Maintenance root changed during extended observation.");
  const directories = new Map(
    current.directories.map((directory) => [directory.path, directory]),
  );
  for (const directory of expected.directories) {
    const observed = directories.get(directory.path);
    if (
      observed?.identity !== directory.identity ||
      observed.real !== directory.real
    )
      throw new Error(
        `Maintenance ancestor changed during extended observation: ${directory.path}.`,
      );
  }
  for (const relative of Object.keys(expected.files)) {
    if (
      !Object.hasOwn(current.files, relative) ||
      !Object.hasOwn(expected.descriptors, relative) ||
      !Object.hasOwn(current.descriptors, relative)
    )
      throw new Error(
        `Maintenance extended observation omitted an input: ${relative}.`,
      );
    const before = expected.files[relative]!;
    const after = current.files[relative]!;
    const beforeDescriptor = expected.descriptors[relative]!;
    const afterDescriptor = current.descriptors[relative]!;
    if (
      (before === null) !== (beforeDescriptor === null) ||
      (after === null) !== (afterDescriptor === null) ||
      (before === null) !== (expected.sources[relative] === undefined) ||
      (after === null) !== (current.sources[relative] === undefined)
    )
      throw new Error(
        `Maintenance extended observation has inconsistent authority: ${relative}.`,
      );
    if (
      (before === null) !== (after === null) ||
      (before !== null &&
        after !== null &&
        (before.identity !== after.identity ||
          autoMovieMaintenanceFileFromSnapshot(before, "").version !==
            autoMovieMaintenanceFileFromSnapshot(after, "").version)) ||
      expected.sources[relative] !== current.sources[relative] ||
      (beforeDescriptor !== null &&
        afterDescriptor !== null &&
        (beforeDescriptor.identity !== afterDescriptor.identity ||
          autoMovieMaintenanceFileFromSnapshot(beforeDescriptor, "").version !==
            autoMovieMaintenanceFileFromSnapshot(afterDescriptor, "").version))
    )
      throw new Error(`Maintenance input changed after planning: ${relative}.`);
  }
};
