import * as fs from "node:fs";
import * as path from "node:path";

import { publishNativeScaffoldFile } from "./nativeScaffoldPublication";
import type { ScaffoldFilePublicationOutcome } from "./scaffoldPublication";

let fileSystem: typeof fs = fs;

/**
 * @internal Run one synchronous scaffold operation against an injected
 * filesystem, so descriptor-level failures the host cannot be asked to produce
 * on demand (a refused reopen, a failing close, a generation that moves under
 * a held descriptor) are still exercised by semantic unit tests.
 */
export const scaffoldFileSnapshotForTesting = {
  withFileSystem: <T>(injected: typeof fs, task: () => T): T => {
    const previous = fileSystem;
    fileSystem = injected;
    try {
      return task();
    } finally {
      fileSystem = previous;
    }
  },
};

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

/**
 * Captured pathname generation that authorizes a later read or replacement.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Keeps exact predecessor authority across preparation and publication.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Rejects a later resident instead of treating it as the approved input.
 */
export interface IScaffoldFileSnapshot {
  /**
   * Physical file identity reported by pathname metadata.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Pins the approved file generation.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Refuses replacement by another physical file.
   */
  identity: string;
  /**
   * Absolute pathname whose resident was captured.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Addresses the same approved target on retry.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Keeps reuse scoped to one named slot.
   */
  path: string;
  /**
   * Size and timestamp generation together with the physical identity.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Detects changed bytes within the original file.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Refuses in-place changes before a repeated operation.
   */
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
    fileSystem.mkdirSync(target);
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
  const status = fileSystem.lstatSync(absolute, { bigint: true });
  if (status.isSymbolicLink() || status.isDirectory() === false)
    throw new Error(
      `scaffold directory is not one ordinary directory: ${absolute}`,
    );
  return {
    identity: physicalDirectoryIdentity(absolute, status),
    path: absolute,
    real: path.resolve(fileSystem.realpathSync.native(absolute)),
  };
};

/**
 * Derive a directory's physical identity from an opened descriptor.
 *
 * A path-based stat is not a reliable device source everywhere: Node 22 on
 * Windows reports device 0 for a directory reached by path while `fstat` on
 * the opened directory reports the volume serial, which is also what the
 * native parent handle reports at publication. Deriving the identity from the
 * descriptor keeps the captured identity and the held-handle identity on one
 * basis, and the inode equality check pins the descriptor to the very
 * directory the caller just inspected.
 */
const physicalDirectoryIdentity = (
  absolute: string,
  status: fs.BigIntStats,
): string => {
  const descriptor = fileSystem.openSync(
    absolute,
    fileSystem.constants.O_RDONLY,
  );
  try {
    const opened = fileSystem.fstatSync(descriptor, { bigint: true });
    if (opened.isDirectory() === false || opened.ino !== status.ino)
      throw new Error(
        `scaffold directory changed while its identity was captured: ${absolute}`,
      );
    return physicalIdentity(opened);
  } finally {
    fileSystem.closeSync(descriptor);
  }
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
  const before = fileSystem.lstatSync(ownership.path, { bigint: true });
  if (physicalDirectoryIdentity(ownership.path, before) !== ownership.identity)
    throw new Error(`scaffold directory changed generation: ${ownership.path}`);
  const entries = fileSystem.readdirSync(ownership.path);
  const after = fileSystem.lstatSync(ownership.path, { bigint: true });
  if (
    physicalDirectoryIdentity(ownership.path, after) !== ownership.identity ||
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
        fileSystem.mkdirSync(target);
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
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-alias-visible-bytes Rewrites the resident inode only while one entry names it, and otherwise replaces the entry so another pathname keeps the bytes it had.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-alias-visible-bytes Chooses between the two admitted methods from the entry count observed on the descriptor it writes through, and reports a post-removal failure as partial.
 */
export const writeScaffoldFile = (props: {
  base: IScaffoldPhysicalDirectory;
  bytes: Uint8Array;
  expected?: IScaffoldFileSnapshot | null;
  capability?: IScaffoldParentPublicationCapability;
  force: boolean;
  parent: IScaffoldPhysicalDirectory;
  /**
   * Permit replacing the target's directory entry when another entry names it.
   *
   * Absent, a target with a second entry is refused exactly as before, so a
   * caller that means in-place replacement keeps its stricter contract.
   */
  replaceAliasedEntries?: boolean;
  target: string;
}): ScaffoldFilePublicationOutcome => {
  const absolute = path.resolve(props.target);
  if (path.dirname(absolute) !== props.parent.path)
    throw new Error(`scaffold file changed declared parent: ${absolute}`);
  assertScaffoldOwnership(props.base, props.parent);
  if (props.expected !== undefined && props.expected !== null) {
    if (!props.force || props.expected.path !== absolute)
      throw new Error(
        `scaffold replacement lacks exact captured authority: ${absolute}`,
      );
    assertScaffoldFileSnapshot(props.expected);
    return overwriteScaffoldFile({ ...props, existing: props.expected });
  }
  if (props.force && props.expected === undefined) {
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
    capability: props.capability ?? { publish: publishNativeScaffoldFile },
    parent: props.parent,
    target: absolute,
  });
};

/**
 * Replace one existing scaffold file by the method its directory entries permit.
 *
 * The entry count is read from the descriptor this operation writes through
 * rather than from a pathname stat, so the decision and the write cannot be
 * looking at different files. Rewriting the resident inode is admissible only
 * while exactly one entry names it, because that write is precisely what every
 * other pathname naming it would observe. When another entry exists and the
 * caller holds the aliased-entry authority, the directory entry is replaced
 * instead, which leaves any peer pointing at the untouched old inode.
 *
 * A window remains between this stat and the truncation on the in-place branch:
 * a link created inside it is not seen, and the rewrite would then reach the new
 * peer. That window exists today, and this branch neither widens nor narrows it.
 * The replacement branch has no such window, because it never rewrites the
 * resident inode, so a link appearing at any instant still leaves the peer's
 * bytes unchanged.
 */
const overwriteScaffoldFile = (props: {
  base: IScaffoldPhysicalDirectory;
  bytes: Uint8Array;
  capability?: IScaffoldParentPublicationCapability;
  existing: IScaffoldFileSnapshot;
  parent: IScaffoldPhysicalDirectory;
  replaceAliasedEntries?: boolean;
  target: string;
}): ScaffoldFilePublicationOutcome => {
  let descriptor: number;
  try {
    descriptor = fileSystem.openSync(props.target, "r+");
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
  let completedIdentity: string | undefined;
  let completedSnapshot: IScaffoldFileSnapshot | null = null;
  try {
    const opened = fileSystem.fstatSync(descriptor, { bigint: true });
    if (props.replaceAliasedEntries === true)
      assertOrdinaryScaffoldFile(opened, props.target);
    else assertOrdinarySingleLinkFile(opened, props.target);
    if (opened.nlink !== 1n) {
      fileSystem.closeSync(descriptor);
      return replaceScaffoldFileEntry(props);
    }
    assertScaffoldFileDescriptor(
      props.existing,
      descriptor,
      physicalVersion(opened),
      assertOrdinarySingleLinkFile,
    );
    assertScaffoldOwnership(props.base, props.parent);
    fileSystem.ftruncateSync(descriptor, 0);
    mutated = true;
    writeScaffoldDescriptor(descriptor, props.target, props.bytes, progress);
    const completed = fileSystem.fstatSync(descriptor, { bigint: true });
    completedIdentity = physicalIdentity(completed);
    if (completed.size !== BigInt(props.bytes.byteLength))
      throw new Error(`scaffold file changed final size: ${props.target}`);
    assertScaffoldFileDescriptor(
      captureScaffoldFile(props.target),
      descriptor,
      physicalVersion(completed),
      assertOrdinarySingleLinkFile,
    );
    assertScaffoldDescriptorBytes(descriptor, props.target, props.bytes);
    const finalStatus = fileSystem.fstatSync(descriptor, { bigint: true });
    if (writtenVersion(finalStatus) !== writtenVersion(completed))
      throw new Error(
        `scaffold file changed after final readback: ${props.target}`,
      );
    completedSnapshot = captureScaffoldFile(props.target);
    assertScaffoldFileDescriptor(
      completedSnapshot,
      descriptor,
      physicalVersion(finalStatus),
      assertOrdinarySingleLinkFile,
    );
    completedSnapshot = assertOpenedScaffoldFileSnapshot(completedSnapshot);
    assertScaffoldOwnership(props.base, props.parent);
  } catch (error) {
    failure = error;
  }
  try {
    fileSystem.closeSync(descriptor);
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
        fileIdentity: completedIdentity!,
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

/**
 * Replace the target's own directory entry, leaving every peer entry alone.
 *
 * Removing one entry does not touch the inode, so a pathname that shares it
 * keeps the bytes it already had; the successor is then created exclusively at
 * the same name through the ordinary new-file boundary, which owns the write,
 * the sync, the readback and the resident verification.
 *
 * This surface needs no durable journal. `AGENTS.md`, `CLAUDE.md` and
 * `.agents/skills` are ignored generated instructions regenerated from tracked
 * owners (`package.json`, `lint.config.ts`, authored documents, source and
 * `docs/contracts`), so an interrupted attempt is a rerun rather than a
 * recovery, and the next run creates the absent name through the same exclusive
 * path. A contract target would need the journal, because its predecessor bytes
 * are tracked and cannot be regenerated.
 *
 * A publication that refuses after the entry is gone is reported as partial
 * rather than refused: the predecessor no longer exists, so claiming that
 * nothing happened would be untrue.
 *
 * The predecessor is rechecked without its change time, because the caller has
 * already opened this pathname to read the entry count and a Windows host moves
 * change time when any handle opens a path. Comparing it here would refuse the
 * replacement on the strength of this operation's own open. Physical identity,
 * size and modification time are still compared, so a substituted or rewritten
 * predecessor is still refused before its name is detached.
 */
const replaceScaffoldFileEntry = (props: {
  base: IScaffoldPhysicalDirectory;
  bytes: Uint8Array;
  capability?: IScaffoldParentPublicationCapability;
  existing: IScaffoldFileSnapshot;
  parent: IScaffoldPhysicalDirectory;
  target: string;
}): ScaffoldFilePublicationOutcome => {
  try {
    assertOpenedScaffoldFileSnapshot(props.existing);
    assertScaffoldOwnership(props.base, props.parent);
    fileSystem.unlinkSync(props.target);
  } catch (error) {
    return Object.freeze({
      error,
      reason: "create-failed" as const,
      status: "refused" as const,
    });
  }
  const outcome = publishScaffoldFileToCapturedParent({
    bytes: Array.from(props.bytes),
    capability: props.capability ?? { publish: publishNativeScaffoldFile },
    parent: props.parent,
    target: props.target,
  });
  return outcome.status === "refused"
    ? Object.freeze({
        bytesWritten: 0,
        error: outcome.error,
        parentIdentity: props.parent.identity,
        status: "partial" as const,
      })
    : outcome;
};

/**
 * Capture one ordinary file before its bytes authorize an operation.
 *
 * Capturing observes a pathname and changes nothing, so it admits a file that
 * more than one directory entry names. The documented script runner mirrors
 * every root-direct file of a generated project into its own cache for the
 * duration of a command, which made a link count here refuse ordinary inputs
 * such as the project's reference-client configuration. A symbolic link stays
 * refused, and the writer that truncates in place keeps its stricter admission.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Pins the predecessor generation before preparing a repeated write.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Refuses a symbolic link and a non-file target as reusable inputs.
 */
export const captureScaffoldFile = (file: string): IScaffoldFileSnapshot =>
  captureAdmittedScaffoldFile(file, assertOrdinaryScaffoldFile);

/**
 * Capture one ordinary file that exactly one directory entry names.
 *
 * A caller whose own contract refuses an aliased work target uses this instead
 * of {@link captureScaffoldFile}. The repository's experiment launcher is that
 * caller: it promises not to adopt a linked manifest as a work target, and its
 * only enforcement of that promise is the admission it captures through. The
 * relaxed capture exists for a generated project, whose root-direct inputs the
 * documented script runner mirrors while a command runs, and that reason does
 * not transfer to a launcher choosing what to operate on.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Pins a predecessor generation for reuse only while one directory entry names it, so an aliased target never becomes the approved input.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Narrows reusable-input admission past the ordinary judgment by also refusing a target another pathname names.
 */
export const captureSingleLinkScaffoldFile = (
  file: string,
): IScaffoldFileSnapshot =>
  captureAdmittedScaffoldFile(file, assertOrdinarySingleLinkFile);

const captureAdmittedScaffoldFile = (
  file: string,
  admission: (status: fs.BigIntStats, file: string) => void,
): IScaffoldFileSnapshot => {
  const absolute = path.resolve(file);
  const status = fileSystem.lstatSync(absolute, { bigint: true });
  admission(status, absolute);
  return {
    identity: physicalIdentity(status),
    path: absolute,
    version: physicalVersion(status),
  };
};

/**
 * Verify a held descriptor against its captured pathname generation.
 *
 * The caller supplies the admission because the two callers own different
 * promises: the in-place writer requires the single entry its truncation
 * depends on, while a read requires only an ordinary file.
 */
const assertScaffoldFileDescriptor = (
  snapshot: IScaffoldFileSnapshot,
  descriptor: number,
  expectedDescriptorVersion: string,
  admission: (status: fs.BigIntStats, file: string) => void,
): void => {
  assertOpenedScaffoldFileSnapshot(snapshot);
  const opened = fileSystem.fstatSync(descriptor, { bigint: true });
  admission(opened, snapshot.path);
  if (
    withoutChangeTime(physicalVersion(opened)) !==
    withoutChangeTime(expectedDescriptorVersion)
  )
    throw new Error(
      `scaffold file descriptor changed generation: ${snapshot.path}`,
    );
  const residentDescriptor = fileSystem.openSync(snapshot.path, "r");
  let failure: IScaffoldDescriptorFailure | undefined;
  try {
    const resident = fileSystem.fstatSync(residentDescriptor, { bigint: true });
    admission(resident, snapshot.path);
    if (writtenVersion(resident) !== writtenVersion(opened))
      throw new Error(
        `scaffold file descriptor changed resident generation: ${snapshot.path}`,
      );
    assertOpenedScaffoldFileSnapshot(snapshot);
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

// Only while this operation holds/reopens a descriptor: our own Windows opens
// can move ctime. Physical identity, size and mtime still cannot change. The
// public snapshot assertion keeps ctime for later, separately admitted work.
const withoutChangeTime = (version: string): string =>
  version.split(":").slice(0, -1).join(":");
const assertOpenedScaffoldFileSnapshot = (
  snapshot: IScaffoldFileSnapshot,
): IScaffoldFileSnapshot => {
  const current = captureScaffoldFile(snapshot.path);
  if (
    current.identity !== snapshot.identity ||
    withoutChangeTime(current.version) !== withoutChangeTime(snapshot.version)
  )
    throw new Error(
      `scaffold file changed while its descriptor was open: ${snapshot.path}`,
    );
  return current;
};

/**
 * Refuse a pathname whose physical file or content generation has changed.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Keeps reuse tied to the originally approved resident.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Checks both identity and byte-generation metadata before reuse.
 */
export const assertScaffoldFileSnapshot = (
  snapshot: IScaffoldFileSnapshot,
): void => {
  const current = captureScaffoldFile(snapshot.path);
  if (
    current.identity !== snapshot.identity ||
    current.version !== snapshot.version
  )
    throw new Error(
      `scaffold file changed after descriptor close: ${snapshot.path}`,
    );
};

/**
 * Read the descriptor that proves a captured pathname generation. Descriptor
 * identity is separate because Windows path and handle device ids can differ.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Retains exact bytes and observed generation before a repeated write is planned.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Refuses a changed resident before its bytes can authorize reuse.
 */
export const readScaffoldFileSnapshot = (
  file: string,
): {
  snapshot: IScaffoldFileSnapshot;
  bytes: Buffer;
  identity: string;
  version: string;
} => {
  const snapshot = captureScaffoldFile(file);
  const descriptor = fileSystem.openSync(snapshot.path, "r");
  let failure: IScaffoldDescriptorFailure | undefined;
  let result: {
    snapshot: IScaffoldFileSnapshot;
    bytes: Buffer;
    identity: string;
    version: string;
  };
  try {
    const opened = fileSystem.fstatSync(descriptor, { bigint: true });
    const version = physicalVersion(opened);
    assertScaffoldFileDescriptor(
      snapshot,
      descriptor,
      version,
      assertOrdinaryScaffoldFile,
    );
    const bytes = fileSystem.readFileSync(descriptor);
    assertScaffoldFileDescriptor(
      snapshot,
      descriptor,
      version,
      assertOrdinaryScaffoldFile,
    );
    result = { snapshot, bytes, identity: physicalIdentity(opened), version };
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    closeScaffoldDescriptor(descriptor, failure, "read scaffold file");
  }
  // Capture after our final close, not before our own resident reopen.
  const completed = assertOpenedScaffoldFileSnapshot(snapshot);
  assertScaffoldFileSnapshot(completed);
  return { ...result, snapshot: completed };
};

/**
 * Admission for an operation that only observes: a regular file that is not a
 * symbolic link. It asks nothing about directory entries, because reading bytes
 * cannot change what a second entry naming the same inode shows.
 */
const assertOrdinaryScaffoldFile = (
  status: fs.BigIntStats,
  file: string,
): void => {
  if (status.isSymbolicLink() || status.isFile() === false)
    throw new Error(`scaffold file is not one ordinary file: ${file}`);
};

/**
 * Admission for the writer that truncates and rewrites the resident inode.
 *
 * Exactly one directory entry is load-bearing here and nowhere else: this write
 * changes the bytes of the inode itself, so every other pathname naming it would
 * observe the change. Anything that replaces the directory entry instead keeps
 * the peer pointed at the old inode and uses the ordinary admission above.
 */
const assertOrdinarySingleLinkFile = (
  status: fs.BigIntStats,
  file: string,
): void => {
  assertOrdinaryScaffoldFile(status, file);
  if (status.nlink !== 1n)
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
    const written = fileSystem.writeSync(
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
  fileSystem.fsyncSync(descriptor);
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
        [first, second],
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
    const read = fileSystem.readSync(
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
    fileSystem.closeSync(descriptor);
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
 * `ctimeNs` is absent across this operation's own held-descriptor observations. Windows advances a
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
