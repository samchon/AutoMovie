import * as fs from "node:fs";
import * as path from "node:path";

import { publishNativeScaffoldFile } from "./nativeScaffoldPublication";
import type { ScaffoldFilePublicationOutcome } from "./scaffoldPublication";

/**
 * Closed input passed to a platform adapter for one parent-bound new slot.
 *
 * The adapter must open the parent without following a link, prove
 * `expectedParentIdentity`, create `childName` relative to that held native
 * handle with exclusive/no-follow semantics, and own descriptor write, sync,
 * readback, one-link and held-parent-relative resident-identity verification,
 * final-status, and close reporting. It must never retry through `parentPath`,
 * reopen through a mutable absolute child pathname, or delete a reported
 * partial slot.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Binds exact candidate bytes to one captured physical parent generation.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Makes the native parent capability and candidate bytes the closed reuse input.
 * @author Samchon
 */
export interface IScaffoldParentPublicationRequest {
  /**
   * Exact bytes the held descriptor must write and read back.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Pins the complete deterministic value before native creation.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Prevents a retry from rebuilding different bytes after mutation begins.
   */
  bytes: readonly number[];
  /**
   * Single child segment created relative to the held parent handle.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-duplicate-submission Names the exact slot protected by exclusive creation.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-duplicate-submission Keeps competitor refusal inside the captured parent.
   */
  childName: string;
  /**
   * Physical identity the opened parent handle must prove before creation.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Refuses a successor instead of publishing into its inventory.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Allows reuse only of the captured parent generation.
   */
  expectedParentIdentity: string;
  /**
   * Path used only to acquire the parent handle whose identity is then proved.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-duplicate-submission Locates the parent capability without authorizing child creation through the mutable path.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-duplicate-submission Separates capability acquisition from relative exclusive creation.
   */
  parentPath: string;
}

/**
 * Platform boundary for a parent-handle-relative exclusive file publication.
 *
 * A supported adapter returns `refused` only when it knows no slot was
 * created. Once a descriptor is secured, every failure is `partial`, with the
 * exact bound parent identity and byte count; only verified write/readback,
 * one-link and held-parent-relative resident identity, final status, and close
 * may return `completed`.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Reports absence and bound partial state without pathname cleanup.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Supplies the exact one-slot result that candidate recovery consumes.
 * @author Samchon
 */
export interface IScaffoldParentPublicationCapability {
  /**
   * Execute one native parent-bound publication and return its truthful effect.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Preserves the effect boundary across native create, write, verification, and close.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Makes the native outcome explicit rather than reconstructing it from a pathname.
   */
  publish(
    request: IScaffoldParentPublicationRequest,
  ): ScaffoldFilePublicationOutcome;
}

/**
 * Captured physical identity of one ordinary scaffold directory generation.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Keeps repeated scaffold writes bound to the same verified directory generation.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Reuses a write target only while its captured physical identity still matches.
 */
export interface IScaffoldPhysicalDirectory {
  /**
   * Device-and-inode identity of the captured directory.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Prevents a repeated write from silently adopting a replaced directory.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Requires the physical identity to match before reusing the target.
   */
  identity: string;
  /**
   * Absolute lexical path selected for the directory.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Keeps every repeated write addressed to the same explicit target.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Carries the stable target into every reuse check.
   */
  path: string;
  /**
   * Native real path used to reject linked escapes.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Prevents path aliasing from changing a repeated write's destination.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Reuses only a target with the same resolved physical boundary.
   */
  real: string;
}

interface IScaffoldFileSnapshot {
  identity: string;
  path: string;
  version: string;
}

interface IScaffoldDescriptorFailure {
  error: unknown;
}

class ScaffoldDescriptorCleanupError extends AggregateError {}

/**
 * Publish one new scaffold file through an explicit parent-bound capability.
 *
 * This pure boundary closes and freezes the exact parent identity, child
 * segment, and bytes before entering the platform adapter. It accepts a
 * completed or partial result only when the adapter names that same parent
 * generation, and accepts a refusal only with one of the three pre-create
 * reasons. It performs no pathname retry and authorizes no cleanup.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Sends one immutable byte sequence to exactly the captured parent generation.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Rejects an adapter result that cannot prove the requested parent identity.
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-duplicate-submission Preserves target-competitor refusal at the native exclusive-create boundary.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-duplicate-submission Makes the exact relative slot the only admissible native create target.
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Returns truthful zero-publication or bound-partial state without deleting either generation.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Carries the native one-slot outcome directly into candidate recovery.
 * @author Samchon
 */
export const publishScaffoldFileToCapturedParent = (props: {
  bytes: readonly number[];
  capability: IScaffoldParentPublicationCapability;
  parent: IScaffoldPhysicalDirectory;
  target: string;
}): ScaffoldFilePublicationOutcome => {
  const target = path.resolve(props.target);
  if (path.dirname(target) !== props.parent.path)
    throw new Error(`scaffold file changed declared parent: ${target}`);
  if (props.parent.identity.length === 0)
    throw new Error(`scaffold parent omitted physical identity: ${target}`);
  if (
    props.bytes.some(
      (byte) => Number.isSafeInteger(byte) === false || byte < 0 || byte > 0xff,
    )
  )
    throw new Error(`scaffold file contains invalid byte values: ${target}`);

  const request = Object.freeze({
    bytes: Object.freeze([...props.bytes]),
    childName: path.basename(target),
    expectedParentIdentity: props.parent.identity,
    parentPath: props.parent.path,
  });
  const outcome = props.capability.publish(request);
  if (outcome.status === "refused") {
    if (
      outcome.reason !== "create-failed" &&
      outcome.reason !== "parent-changed" &&
      outcome.reason !== "target-competitor"
    )
      throw new Error(
        `scaffold parent capability returned an invalid refusal: ${target}`,
      );
    return Object.freeze({ ...outcome });
  }
  if (outcome.status === "completed") {
    if (outcome.parentIdentity !== props.parent.identity)
      throw new Error(
        `completed scaffold publication changed parent identity: ${target}`,
      );
    return Object.freeze({ ...outcome });
  }
  if (outcome.status === "partial") {
    if (
      outcome.parentIdentity !== props.parent.identity ||
      Number.isSafeInteger(outcome.bytesWritten) === false ||
      outcome.bytesWritten < 0 ||
      outcome.bytesWritten > request.bytes.length
    )
      throw new Error(
        `partial scaffold publication has invalid bound state: ${target}`,
      );
    return Object.freeze({ ...outcome });
  }
  throw new Error(
    `scaffold parent capability returned an unknown outcome: ${target}`,
  );
};

/**
 * Create or capture one ordinary scaffold base without following a linked
 * parent.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-duplicate-submission Refuses an existing non-directory or linked target instead of silently changing duplicate-write scope.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-duplicate-submission Resolves repeated creation against one captured physical base.
 */
export const ensureScaffoldBaseDirectory = (
  directory: string,
): IScaffoldPhysicalDirectory => {
  const absolute = path.resolve(directory);
  const missing: string[] = [];
  let cursor = absolute;
  let ownership: IScaffoldPhysicalDirectory;
  while (true) {
    try {
      ownership = captureScaffoldPhysicalDirectory(cursor);
      break;
    } catch (error) {
      if (missingPath(error) === false) throw error;
      missing.unshift(cursor);
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      cursor = parent;
    }
  }
  for (const target of missing) {
    assertScaffoldPhysicalDirectory(ownership);
    fs.mkdirSync(target);
    assertScaffoldPhysicalDirectory(ownership);
    ownership = captureEmptyScaffoldPhysicalDirectory(target);
  }
  return ownership;
};

/**
 * Capture one ordinary physical directory without accepting symlinks or
 * junctions.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Captures the stable target identity required by repeated deterministic writes.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Makes physical identity a precondition of target reuse.
 */
export const captureScaffoldPhysicalDirectory = (
  directory: string,
): IScaffoldPhysicalDirectory => {
  const absolute = path.resolve(directory);
  const status = fs.lstatSync(absolute, { bigint: true });
  if (status.isSymbolicLink() || status.isDirectory() === false)
    throw new Error(
      `scaffold directory is not one ordinary directory: ${absolute}`,
    );
  return {
    identity: physicalIdentity(status),
    path: absolute,
    real: path.resolve(fs.realpathSync.native(absolute)),
  };
};

/**
 * Revalidate one captured scaffold directory generation.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Rejects replacement between repeated write steps.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Requires the resident generation to match the captured reuse identity.
 */
export const assertScaffoldPhysicalDirectory = (
  ownership: IScaffoldPhysicalDirectory,
): void => {
  const current = captureScaffoldPhysicalDirectory(ownership.path);
  if (
    current.identity !== ownership.identity ||
    current.real !== ownership.real
  )
    throw new Error(`scaffold directory changed generation: ${ownership.path}`);
};

const captureEmptyScaffoldPhysicalDirectory = (
  directory: string,
): IScaffoldPhysicalDirectory => {
  const ownership = captureScaffoldPhysicalDirectory(directory);
  const before = fs.lstatSync(ownership.path, { bigint: true });
  if (physicalIdentity(before) !== ownership.identity)
    throw new Error(`scaffold directory changed generation: ${ownership.path}`);
  const entries = fs.readdirSync(ownership.path);
  const after = fs.lstatSync(ownership.path, { bigint: true });
  if (
    physicalIdentity(after) !== ownership.identity ||
    physicalVersion(after) !== physicalVersion(before)
  )
    throw new Error(
      `scaffold directory changed while inspected: ${ownership.path}`,
    );
  assertScaffoldPhysicalDirectory(ownership);
  if (entries.length !== 0)
    throw new Error(
      `new scaffold directory is unexpectedly non-empty: ${ownership.path}`,
    );
  return ownership;
};

/**
 * Resolve and retain every physical descendant directory needed by one file.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Reuses only descendants proven to remain inside the same scaffold base.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Validates cached directory identities before every reuse.
 */
export const ensureScaffoldFileDirectory = (props: {
  base: IScaffoldPhysicalDirectory;
  cache: Map<string, IScaffoldPhysicalDirectory>;
  directory: string;
}): IScaffoldPhysicalDirectory => {
  const absolute = path.resolve(props.directory);
  const relative = path.relative(props.base.path, absolute);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(`scaffold directory escapes its base: ${absolute}`);
  let current = props.base;
  if (relative.length === 0) return current;
  for (const segment of relative.split(path.sep)) {
    const target = path.join(current.path, segment);
    assertScaffoldPhysicalDirectory(props.base);
    assertScaffoldPhysicalDirectory(current);
    let child = props.cache.get(target);
    if (child === undefined) {
      try {
        child = captureScaffoldPhysicalDirectory(target);
      } catch (error) {
        if (missingPath(error) === false) throw error;
        assertScaffoldPhysicalDirectory(props.base);
        assertScaffoldPhysicalDirectory(current);
        fs.mkdirSync(target);
        assertScaffoldPhysicalDirectory(props.base);
        assertScaffoldPhysicalDirectory(current);
        child = captureEmptyScaffoldPhysicalDirectory(target);
      }
      if (inside(props.base.real, child.real) === false)
        throw new Error(
          `scaffold directory escapes its physical base: ${target}`,
        );
      props.cache.set(target, child);
    } else assertScaffoldPhysicalDirectory(child);
    current = child;
  }
  return current;
};

/**
 * Create or explicitly overwrite one exact final file through its bound
 * descriptor.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-duplicate-submission Refuses an existing file unless the caller explicitly authorizes exact-target replacement.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-duplicate-submission Resolves a repeated file write without creating a second logical target.
 */
export const writeScaffoldFile = (props: {
  base: IScaffoldPhysicalDirectory;
  bytes: Uint8Array;
  force: boolean;
  parent: IScaffoldPhysicalDirectory;
  target: string;
}): ScaffoldFilePublicationOutcome => {
  const absolute = path.resolve(props.target);
  if (path.dirname(absolute) !== props.parent.path)
    throw new Error(`scaffold file changed declared parent: ${absolute}`);
  assertScaffoldOwnership(props.base, props.parent);
  if (props.force) {
    let existing: IScaffoldFileSnapshot | null;
    try {
      existing = captureScaffoldFile(absolute);
    } catch (error) {
      if (missingPath(error) === false) throw error;
      existing = null;
    }
    if (existing !== null) {
      return overwriteScaffoldFile({ ...props, existing });
    }
  }
  return publishScaffoldFileToCapturedParent({
    bytes: Array.from(props.bytes),
    capability: { publish: publishNativeScaffoldFile },
    parent: props.parent,
    target: absolute,
  });
};

const overwriteScaffoldFile = (props: {
  base: IScaffoldPhysicalDirectory;
  bytes: Uint8Array;
  existing: IScaffoldFileSnapshot;
  parent: IScaffoldPhysicalDirectory;
  target: string;
}): ScaffoldFilePublicationOutcome => {
  let descriptor: number;
  try {
    descriptor = fs.openSync(props.target, "r+");
  } catch (error) {
    return Object.freeze({
      error,
      reason: "create-failed" as const,
      status: "refused" as const,
    });
  }
  const progress = { bytesWritten: 0 };
  let failure: unknown = undefined;
  let mutated = false;
  let completedSnapshot: IScaffoldFileSnapshot | null = null;
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    assertOrdinarySingleLinkFile(opened, props.target);
    assertScaffoldFileDescriptor(
      props.existing,
      descriptor,
      physicalVersion(opened),
    );
    assertScaffoldOwnership(props.base, props.parent);
    fs.ftruncateSync(descriptor, 0);
    mutated = true;
    writeScaffoldDescriptor(descriptor, props.target, props.bytes, progress);
    const completed = fs.fstatSync(descriptor, { bigint: true });
    if (completed.size !== BigInt(props.bytes.byteLength))
      throw new Error(`scaffold file changed final size: ${props.target}`);
    assertScaffoldFileDescriptor(
      captureScaffoldFile(props.target),
      descriptor,
      physicalVersion(completed),
    );
    assertScaffoldDescriptorBytes(descriptor, props.target, props.bytes);
    const finalStatus = fs.fstatSync(descriptor, { bigint: true });
    if (writtenVersion(finalStatus) !== writtenVersion(completed))
      throw new Error(
        `scaffold file changed after final readback: ${props.target}`,
      );
    completedSnapshot = captureScaffoldFile(props.target);
    assertScaffoldFileDescriptor(
      completedSnapshot,
      descriptor,
      physicalVersion(finalStatus),
    );
    assertScaffoldOwnership(props.base, props.parent);
  } catch (error) {
    failure = error;
  }
  try {
    fs.closeSync(descriptor);
  } catch (closeError) {
    failure = combineScaffoldFailures(
      failure,
      closeError,
      "overwritten scaffold file",
    );
  }
  if (failure === undefined)
    try {
      assertScaffoldFileSnapshot(completedSnapshot!);
      assertScaffoldOwnership(props.base, props.parent);
    } catch (error) {
      failure = error;
    }
  if (failure !== undefined && mutated === false)
    return Object.freeze({
      error: failure,
      reason: "create-failed" as const,
      status: "refused" as const,
    });
  return failure === undefined
    ? Object.freeze({
        parentIdentity: props.parent.identity,
        status: "completed",
      })
    : Object.freeze({
        bytesWritten: progress.bytesWritten,
        error: failure,
        parentIdentity: props.parent.identity,
        status: "partial",
      });
};

const captureScaffoldFile = (file: string): IScaffoldFileSnapshot => {
  const absolute = path.resolve(file);
  const status = fs.lstatSync(absolute, { bigint: true });
  assertOrdinarySingleLinkFile(status, absolute);
  return {
    identity: physicalIdentity(status),
    path: absolute,
    version: physicalVersion(status),
  };
};

const assertScaffoldFileDescriptor = (
  snapshot: IScaffoldFileSnapshot,
  descriptor: number,
  expectedDescriptorVersion: string,
): void => {
  assertScaffoldFileSnapshot(snapshot);
  const opened = fs.fstatSync(descriptor, { bigint: true });
  assertOrdinarySingleLinkFile(opened, snapshot.path);
  if (physicalVersion(opened) !== expectedDescriptorVersion)
    throw new Error(
      `scaffold file descriptor changed generation: ${snapshot.path}`,
    );
  const residentDescriptor = fs.openSync(snapshot.path, "r");
  let failure: IScaffoldDescriptorFailure | undefined;
  try {
    const resident = fs.fstatSync(residentDescriptor, { bigint: true });
    assertOrdinarySingleLinkFile(resident, snapshot.path);
    if (physicalVersion(resident) !== physicalVersion(opened))
      throw new Error(
        `scaffold file descriptor changed resident generation: ${snapshot.path}`,
      );
    assertScaffoldFileSnapshot(snapshot);
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    closeScaffoldDescriptor(
      residentDescriptor,
      failure,
      "resident scaffold file",
    );
  }
};

const assertScaffoldFileSnapshot = (snapshot: IScaffoldFileSnapshot): void => {
  const current = captureScaffoldFile(snapshot.path);
  if (
    current.identity !== snapshot.identity ||
    current.version !== snapshot.version
  )
    throw new Error(
      `scaffold file changed after descriptor close: ${snapshot.path}`,
    );
};

const assertOrdinarySingleLinkFile = (
  status: fs.BigIntStats,
  file: string,
): void => {
  if (
    status.isSymbolicLink() ||
    status.isFile() === false ||
    status.nlink !== 1n
  )
    throw new Error(
      `scaffold file is not one ordinary single-link file: ${file}`,
    );
};

const assertScaffoldOwnership = (
  base: IScaffoldPhysicalDirectory,
  parent: IScaffoldPhysicalDirectory,
): void => {
  assertScaffoldPhysicalDirectory(base);
  assertScaffoldPhysicalDirectory(parent);
  if (inside(base.real, parent.real) === false)
    throw new Error(
      `scaffold file parent escapes its physical base: ${parent.path}`,
    );
};

const writeScaffoldDescriptor = (
  descriptor: number,
  target: string,
  bytes: Uint8Array,
  progress?: { bytesWritten: number },
): void => {
  const source = Buffer.from(bytes);
  let offset = 0;
  while (offset < source.length) {
    const written = fs.writeSync(
      descriptor,
      source,
      offset,
      source.length - offset,
      offset,
    );
    if (written === 0)
      throw new Error(`scaffold file stopped while written: ${target}`);
    offset += written;
    if (progress !== undefined) progress.bytesWritten = offset;
  }
  fs.fsyncSync(descriptor);
  assertScaffoldDescriptorBytes(descriptor, target, source);
};

const combineScaffoldFailures = (
  first: unknown,
  second: unknown,
  resource: string,
): unknown =>
  first === undefined
    ? second
    : new AggregateError(
        [...(first instanceof AggregateError ? first.errors : [first]), second],
        `${resource} close failed after publication failure`,
      );

const assertScaffoldDescriptorBytes = (
  descriptor: number,
  target: string,
  bytes: Uint8Array,
): void => {
  const source = Buffer.from(bytes);
  const readback = Buffer.alloc(source.length);
  let offset = 0;
  while (offset < readback.length) {
    const read = fs.readSync(
      descriptor,
      readback,
      offset,
      readback.length - offset,
      offset,
    );
    if (read === 0)
      throw new Error(`scaffold file stopped during readback: ${target}`);
    offset += read;
  }
  if (readback.equals(source) === false)
    throw new Error(`scaffold file changed during readback: ${target}`);
};

const closeScaffoldDescriptor = (
  descriptor: number,
  failure: IScaffoldDescriptorFailure | undefined,
  resource: string,
): void => {
  try {
    fs.closeSync(descriptor);
  } catch (closeFailure) {
    if (failure === undefined) throw closeFailure;
    throw new ScaffoldDescriptorCleanupError(
      [
        ...(failure.error instanceof ScaffoldDescriptorCleanupError
          ? failure.error.errors
          : [failure.error]),
        closeFailure,
      ],
      `Scaffold descriptor cleanup failed after the operation failed: ${resource}.`,
    );
  }
};

const physicalIdentity = (status: fs.BigIntStats): string =>
  `${status.dev}:${status.ino}`;

const physicalVersion = (status: fs.BigIntStats): string =>
  `${physicalIdentity(status)}:${status.size}:${status.mtimeNs}:${status.ctimeNs}`;

/**
 * The part of a file's identity a writer owns, for comparing two stats of one
 * held descriptor across this module's own verification reads.
 *
 * `ctimeNs` is deliberately absent here and only here. Windows advances a
 * file's change time when _any_ handle opens the path, including the read-only
 * handle `captureScaffoldFile` takes to verify the write, so the check's own
 * probe moved the value the check then compared: measured 20 of 20 with the
 * probe and 0 of 20 without it, `size` and `mtimeNs` steady throughout. That
 * made every scaffold write on such a machine report tampering, which is a
 * false refusal a virus scanner or an indexer can trigger at will.
 *
 * Nothing is given up. A substituted file no longer shares the descriptor's
 * physical identity, a rewrite changes the size or the modification time, and
 * `assertScaffoldDescriptorBytes` has already read the bytes back through the
 * descriptor that never let go. Every other comparison keeps
 * {@link physicalVersion}, including the directory-ownership checks where a
 * rename's `ctime` move is the signal.
 */
const writtenVersion = (status: fs.BigIntStats): string =>
  `${physicalIdentity(status)}:${status.size}:${status.mtimeNs}`;

const inside = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return (
    relative.length === 0 ||
    (relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false &&
      path.isAbsolute(relative) === false)
  );
};

const missingPath = (error: unknown): boolean =>
  (error as NodeJS.ErrnoException).code === "ENOENT" ||
  (error as NodeJS.ErrnoException).code === "ENOTDIR";
