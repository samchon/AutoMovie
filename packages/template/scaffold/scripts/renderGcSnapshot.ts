import {
  type IAutoMovieProductionRenderCleanupReceipt,
  digestAutoMovieBytes,
  parseAutoMovieStructuredJson,
} from "@automovie/production";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const RENDER_GC_PRESERVED_PREFIX = ".gc-preserved-";
export const RENDER_GC_QUARANTINE_EVIDENCE_DIRECTORY = `${RENDER_GC_PRESERVED_PREFIX}quarantine-evidence`;
export const RENDER_GC_REMOVAL_STAGING_DIRECTORY = `${RENDER_GC_PRESERVED_PREFIX}removal-staging`;

/** Keep fail-closed GC evidence outside all later automatic deletion plans. */
export const isRenderGcPreservedPath = (relative: string): boolean =>
  relative
    .replaceAll("\\", "/")
    .split("/")[0]
    ?.startsWith(RENDER_GC_PRESERVED_PREFIX) === true;

/**
 * Recognize the marker directory GC writes at the top of an ownership root.
 *
 * A marker is inventoried once, as a quarantine candidate bound to its
 * evidence. A scan of the same root for ordinary content has to step over the
 * directory, or the marker file is planned a second time under another kind
 * and one physical file receives two dispositions.
 */
export const isRenderGcQuarantineMarkerPath = (relative: string): boolean =>
  relative.replaceAll("\\", "/").split("/")[0] === "quarantine";

export interface IRenderGcTargetSnapshot {
  base: IRenderGcPhysicalDirectory;
  bytes: number;
  contentFingerprint: `sha256:${string}`;
  entries: readonly IRenderGcContentEntry[];
  fileDigest: `sha256:${string}` | null;
  kind: "directory" | "file";
  namespaceFingerprint: `sha256:${string}`;
  target: string;
  targetIdentity: string;
  targetVersion: string;
}

export interface IRenderGcPhysicalDirectory {
  identity: string;
  path: string;
  real: string;
  version: string;
}

export interface IRenderGcContentEntry {
  bytes?: number;
  digest?: `sha256:${string}`;
  identity: string;
  kind: "directory" | "file";
  path: string;
}

interface IRenderQuarantineMarkerBase {
  contentFingerprint: `sha256:${string}`;
  kind: "directory" | "file";
  original: string;
  preserved: string;
  targetIdentity: string;
}

/** Immutable public locator for evidence retained in a private quarantine. */
export type IRenderQuarantineMarker = IRenderQuarantineMarkerBase &
  (
    | { version: 1 }
    | {
        version: 2;
        adjudication: IAutoMovieProductionRenderCleanupReceipt;
        logical: string;
      }
  );

/** Strictly inspected marker and private evidence snapshots. */
export interface IRenderQuarantineEvidence {
  evidence: IRenderGcTargetSnapshot;
  marker: IRenderQuarantineMarker;
}

/** One GC candidate bound to its optional private quarantine evidence. */
export interface IRenderQuarantineGcCandidate {
  adjudication: IAutoMovieProductionRenderCleanupReceipt | null;
  bytes: number;
  evidence: IRenderGcTargetSnapshot | null;
  /** The marker's content identity, folded with its evidence when bound. */
  fingerprint: `sha256:${string}`;
  marker: IRenderGcTargetSnapshot;
}

const RENDER_QUARANTINE_MARKER_MAX_BYTES = 64 * 1024;

interface IRenderGcDescriptorFailure {
  error: unknown;
}

interface IRenderGcFileCapture {
  entry: IRenderGcContentEntry;
  status: fs.BigIntStats;
}

class RenderGcDescriptorCleanupError extends AggregateError {}

/** Close one GC descriptor without discarding operation or cleanup failures. */
const closeRenderGcDescriptor = (
  descriptor: number,
  failure: IRenderGcDescriptorFailure | undefined,
  resource: string,
): void => {
  try {
    fs.closeSync(descriptor);
  } catch (closeFailure) {
    if (failure === undefined) throw closeFailure;
    throw new RenderGcDescriptorCleanupError(
      [
        ...(failure.error instanceof RenderGcDescriptorCleanupError
          ? failure.error.errors
          : [failure.error]),
        closeFailure,
      ],
      `Render GC descriptor cleanup failed after the operation failed: ${resource}.`,
    );
  }
};

/** Capture one physical directory without inventorying its descendants. */
export const captureRenderPhysicalDirectory = (
  directory: string,
  label: string,
): IRenderGcPhysicalDirectory => physicalDirectory(directory, label);

/** Revalidate only a captured directory's physical identity and real path. */
export const assertRenderPhysicalDirectoryIdentity = (
  expected: IRenderGcPhysicalDirectory,
  label: string,
): void => assertPhysicalDirectoryIdentity(expected, label);

/** Capture one exact GC candidate before planning can outlive its identity. */
export const captureRenderGcTarget = (
  base: string,
  target: string,
): IRenderGcTargetSnapshot => {
  const root = physicalDirectory(base, "render GC ownership root");
  const first = captureResidentTarget(root, target);
  const confirmed = captureResidentTarget(root, target);
  if (
    first.contentFingerprint !== confirmed.contentFingerprint ||
    first.namespaceFingerprint !== confirmed.namespaceFingerprint ||
    first.targetIdentity !== confirmed.targetIdentity
  )
    throw new Error(`Render GC target "${target}" changed while inventoried.`);
  return first;
};

/** Create one physical descendant while fencing every prior path segment. */
export const ensureRenderPhysicalDirectory = (
  base: string,
  relative: string,
): string => {
  const segments = relative.split("/");
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\\") ||
        segment.includes("\0"),
    )
  )
    throw new Error(`Render directory path "${relative}" is invalid.`);
  const root = physicalDirectory(base, "render ownership root");
  const ancestry = [root];
  let cursor = root.path;
  for (const segment of segments) {
    for (const directory of ancestry)
      assertPhysicalDirectoryIdentity(directory, "render directory ancestry");
    cursor = path.join(cursor, segment);
    try {
      fs.mkdirSync(cursor);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const current = physicalDirectory(cursor, "render directory ancestry");
    if (inside(root.real, current.real) === false)
      throw new Error("Render directory ancestry escapes its ownership root.");
    ancestry.push(current);
  }
  for (const directory of ancestry)
    assertPhysicalDirectoryIdentity(directory, "render directory ancestry");
  return cursor;
};

/** Create one exact file and bind its published pathname to the write handle. */
export const createRenderGcFileSnapshot = (
  base: string,
  target: string,
  bytes: Uint8Array,
): IRenderGcTargetSnapshot => {
  const root = physicalDirectory(base, "render file ownership root");
  const absolute = path.resolve(target);
  const parent = physicalDirectory(
    path.dirname(absolute),
    "render file directory",
  );
  if (
    parent.path !== path.dirname(absolute) ||
    inside(root.real, parent.real) === false
  )
    throw new Error(`Render file "${target}" escapes its ownership root.`);
  const source = Buffer.from(bytes);
  const descriptor = fs.openSync(absolute, "wx+");
  let failure: IRenderGcDescriptorFailure | undefined;
  try {
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
        throw new Error(`Render file "${target}" stopped while written.`);
      offset += written;
    }
    fs.fsyncSync(descriptor);
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (opened.isFile() === false)
      throw new Error(`Render file "${target}" is not one physical file.`);
    const openedVersion = physicalVersion(opened);
    const snapshot = captureRenderGcTarget(root.path, absolute);
    if (
      snapshot.kind !== "file" ||
      identityFileId(snapshot.targetIdentity) !== physicalFileId(opened) ||
      Buffer.from(readCapturedRenderGcFile(snapshot, source.length)).equals(
        source,
      ) === false
    )
      throw new Error(
        `Render file "${target}" changed after descriptor publication.`,
      );
    const completed = fs.fstatSync(descriptor, { bigint: true });
    if (
      physicalVersion(completed) !== openedVersion &&
      isMetadataSettlement(opened, completed) === false
    )
      throw new Error(`Render file "${target}" changed while published.`);
    if (
      snapshot.base.path !== root.path ||
      snapshot.base.real !== root.real ||
      snapshot.base.identity !== root.identity
    )
      throw new Error(`Render file "${target}" changed ownership root.`);
    assertPhysicalDirectoryIdentity(parent, "render file directory");
    assertRootIdentity(root);
    assertRenderGcTarget(snapshot);
    assertPhysicalDirectoryIdentity(parent, "render file directory");
    assertRootIdentity(root);
    return snapshot;
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    closeRenderGcDescriptor(descriptor, failure, "created render file");
  }
};

/** Quarantine and delete only the exact target captured during GC inventory. */
export const removeCapturedRenderGcTarget = (props: {
  isolated: string;
  quarantine: string;
  snapshot: IRenderGcTargetSnapshot;
}): void => {
  const isolated = isolateCapturedRenderTarget(props);
  assertRenderGcTarget(isolated.moved);
  assertPhysicalDirectoryIdentity(isolated.quarantine, "render GC quarantine");
  fs.rmSync(isolated.moved.target, {
    force: true,
    recursive: isolated.moved.kind === "directory",
  });
};

/**
 * Build the marker that will publicly locate one privately preserved target.
 *
 * A marker written for an explicit GC decision carries that decision's receipt
 * and the logical path it adjudicated; a marker written by render-time recovery
 * has no receipt to carry and stays at version 1.
 */
export const createRenderQuarantineMarker = (
  props: IRenderQuarantineMarkerBase & {
    adjudication?: IAutoMovieProductionRenderCleanupReceipt;
  },
): IRenderQuarantineMarker => {
  const base: IRenderQuarantineMarkerBase = {
    contentFingerprint: props.contentFingerprint,
    kind: props.kind,
    original: props.original,
    preserved: props.preserved,
    targetIdentity: props.targetIdentity,
  };
  return props.adjudication === undefined
    ? { version: 1, ...base }
    : {
        version: 2,
        adjudication: props.adjudication,
        logical: props.adjudication.path,
        ...base,
      };
};

/** The one canonical byte form a marker is written in and read back against. */
export const encodeRenderQuarantineMarker = (
  marker: IRenderQuarantineMarker,
): Buffer => Buffer.from(`${JSON.stringify(marker, null, 2)}\n`);

/** Quarantine only the exact captured target through a private staging path. */
export const quarantineCapturedRenderTarget = (props: {
  adjudication?: IAutoMovieProductionRenderCleanupReceipt;
  destination: string;
  isolated: string;
  quarantine: string;
  snapshot: IRenderGcTargetSnapshot;
}): void => {
  const isolated = isolateCapturedRenderTarget(props);
  const destination = path.resolve(props.destination);
  const destinationParent = physicalDirectory(
    path.dirname(destination),
    "render quarantine destination",
  );
  if (
    path.dirname(destination) !== destinationParent.path ||
    inside(props.snapshot.base.real, destinationParent.real) === false
  )
    throw new Error(
      "Render quarantine destination escapes its ownership root.",
    );
  assertRenderGcTarget(isolated.moved);
  assertPhysicalDirectoryIdentity(isolated.quarantine, "render GC quarantine");
  assertPhysicalDirectoryIdentity(
    destinationParent,
    "render quarantine destination",
  );
  const marker = createRenderQuarantineMarker({
    adjudication: props.adjudication,
    contentFingerprint: isolated.moved.contentFingerprint,
    kind: isolated.moved.kind,
    original: ownedRelativePath(
      props.snapshot.base.path,
      props.snapshot.target,
      "render quarantine original",
    ),
    preserved: ownedRelativePath(
      props.snapshot.base.path,
      isolated.moved.target,
      "render quarantine evidence",
    ),
    targetIdentity: isolated.moved.targetIdentity,
  });
  const published = createRenderGcFileSnapshot(
    props.snapshot.base.path,
    destination,
    encodeRenderQuarantineMarker(marker),
  );
  assertRenderGcTarget(isolated.moved);
  assertRenderGcTarget(published);
  assertPhysicalDirectoryIdentity(isolated.quarantine, "render GC quarantine");
  assertPhysicalDirectoryIdentity(
    destinationParent,
    "render quarantine destination",
  );
};

/**
 * Parse one quarantine marker's exact bytes without touching the filesystem.
 *
 * A version 2 marker carries the cleanup receipt that justified the move, and
 * the receipt must name the same logical target, physical generation, and
 * content fingerprint the marker binds; a receipt for another target is not
 * evidence for this one.
 */
export const parseRenderQuarantineMarker = (
  bytes: Uint8Array,
  label: string,
): IRenderQuarantineMarker => {
  const buffer = Buffer.from(bytes);
  let value: unknown;
  try {
    value = parseAutoMovieStructuredJson({
      record: "render-quarantine-marker",
      bytes: buffer,
    });
  } catch {
    throw new Error(`Render quarantine marker "${label}" is invalid.`);
  }
  const markerKeys =
    isPlainObject(value) && value.version === 2
      ? [
          "adjudication",
          "contentFingerprint",
          "kind",
          "logical",
          "original",
          "preserved",
          "targetIdentity",
          "version",
        ]
      : [
          "contentFingerprint",
          "kind",
          "original",
          "preserved",
          "targetIdentity",
          "version",
        ];
  if (
    isPlainObject(value) === false ||
    Object.keys(value).sort(compare).join("\0") !==
      markerKeys.sort(compare).join("\0") ||
    (value.version !== 1 && value.version !== 2) ||
    (value.version === 2 &&
      isRenderCleanupReceipt(value.adjudication) === false) ||
    (value.kind !== "directory" && value.kind !== "file") ||
    typeof value.contentFingerprint !== "string" ||
    /^sha256:[0-9a-f]{64}$/u.test(value.contentFingerprint) === false ||
    typeof value.original !== "string" ||
    validOwnedRelativePath(value.original) === false ||
    isRenderGcPreservedPath(value.original) ||
    typeof value.preserved !== "string" ||
    validOwnedRelativePath(value.preserved) === false ||
    isRenderGcPreservedPath(value.preserved) === false ||
    typeof value.targetIdentity !== "string" ||
    value.targetIdentity.length === 0
  )
    throw new Error(`Render quarantine marker "${label}" is invalid.`);
  const markerBase: IRenderQuarantineMarkerBase = {
    contentFingerprint: value.contentFingerprint as `sha256:${string}`,
    kind: value.kind,
    original: value.original,
    preserved: value.preserved,
    targetIdentity: value.targetIdentity,
  };
  let adjudication: IAutoMovieProductionRenderCleanupReceipt | undefined;
  if (value.version === 2) {
    adjudication =
      value.adjudication as IAutoMovieProductionRenderCleanupReceipt;
    if (
      adjudication.path !== value.logical ||
      adjudication.generation !== value.targetIdentity ||
      adjudication.fingerprint !== value.contentFingerprint
    )
      throw new Error(
        `Render quarantine marker "${label}" does not bind its adjudication receipt.`,
      );
  }
  const marker = createRenderQuarantineMarker({ ...markerBase, adjudication });
  if (buffer.equals(encodeRenderQuarantineMarker(marker)) === false)
    throw new Error(`Render quarantine marker "${label}" is not canonical.`);
  return marker;
};

/** Bind one immutable quarantine marker to its exact private evidence. */
export const inspectRenderQuarantineMarker = (
  snapshot: IRenderGcTargetSnapshot,
): IRenderQuarantineEvidence => {
  const marker = parseRenderQuarantineMarker(
    readCapturedRenderGcFile(snapshot, RENDER_QUARANTINE_MARKER_MAX_BYTES),
    snapshot.target,
  );
  const evidence = captureRenderGcTarget(
    snapshot.base.path,
    path.join(snapshot.base.path, ...marker.preserved.split("/")),
  );
  if (
    evidence.base.path !== snapshot.base.path ||
    evidence.base.real !== snapshot.base.real ||
    evidence.base.identity !== snapshot.base.identity ||
    evidence.kind !== marker.kind ||
    evidence.contentFingerprint !== marker.contentFingerprint ||
    evidence.targetIdentity !== marker.targetIdentity
  )
    throw new Error(
      `Render quarantine marker "${snapshot.target}" does not bind its evidence.`,
    );
  assertRenderGcTarget(snapshot);
  assertRenderGcTarget(evidence);
  assertRootIdentity(snapshot.base);
  return { evidence, marker };
};

/**
 * Inventory strict evidence pairs and report ambiguous physical duplicates.
 *
 * A marker binds evidence only when it is the sole marker naming that physical
 * generation. Two markers over one generation cannot both own it, so neither
 * keeps its evidence here: each returns without evidence, which the planner
 * reads as an observation conflict, rather than disappearing from the plan.
 */
export const inventoryRenderQuarantineCandidates = (
  markers: readonly IRenderGcTargetSnapshot[],
  inspect: (
    marker: IRenderGcTargetSnapshot,
  ) => IRenderQuarantineEvidence = inspectRenderQuarantineMarker,
): readonly IRenderQuarantineGcCandidate[] => {
  const entries = markers.map((marker) => {
    try {
      const inspected = inspect(marker);
      return {
        adjudication:
          inspected.marker.version === 2 ? inspected.marker.adjudication : null,
        evidence: inspected.evidence,
        marker,
      };
    } catch {
      return { adjudication: null, evidence: null, marker };
    }
  });
  const owners = new Map<string, number>();
  for (const entry of entries)
    if (entry.evidence !== null)
      owners.set(
        entry.evidence.targetIdentity,
        (owners.get(entry.evidence.targetIdentity) ?? 0) + 1,
      );
  return entries.map((entry) => {
    const evidence =
      entry.evidence !== null && owners.get(entry.evidence.targetIdentity) === 1
        ? entry.evidence
        : null;
    return {
      adjudication: entry.adjudication,
      bytes: entry.marker.bytes + (evidence?.bytes ?? 0),
      evidence,
      fingerprint:
        evidence === null
          ? entry.marker.contentFingerprint
          : digestAutoMovieBytes(
              Buffer.from(
                `${entry.marker.contentFingerprint}\0${evidence.contentFingerprint}`,
              ),
            ),
      marker: entry.marker,
    };
  });
};

/** Remove an exact pair, plus only a pre-captured empty legacy container. */
export const removeCapturedRenderQuarantine = (props: {
  evidence: IRenderGcTargetSnapshot;
  marker: IRenderGcTargetSnapshot;
  quarantine: string;
}): void => {
  if (
    props.evidence.base.path !== props.marker.base.path ||
    props.evidence.base.real !== props.marker.base.real ||
    props.evidence.base.identity !== props.marker.base.identity
  )
    throw new Error("Render quarantine pair crosses ownership roots.");
  assertRenderGcTarget(props.marker);
  assertRenderGcTarget(props.evidence);
  const evidenceParent = path.dirname(props.evidence.target);
  const relativeParent = path.relative(
    props.evidence.base.path,
    evidenceParent,
  );
  let ownedParent: IRenderGcTargetSnapshot | null = null;
  if (
    path.dirname(relativeParent) === "." &&
    path.basename(relativeParent).startsWith(RENDER_GC_PRESERVED_PREFIX) &&
    path.basename(relativeParent) !== RENDER_GC_QUARANTINE_EVIDENCE_DIRECTORY &&
    path.resolve(props.quarantine) !== evidenceParent
  ) {
    const captured = captureRenderGcTarget(
      props.evidence.base.path,
      evidenceParent,
    );
    const child = captured.entries.find(
      (entry) => entry.path === path.basename(props.evidence.target),
    );
    if (
      captured.kind !== "directory" ||
      child?.kind !== props.evidence.kind ||
      child.identity !== props.evidence.targetIdentity ||
      (props.evidence.kind === "file" &&
        (child.bytes !== props.evidence.bytes ||
          child.digest !== props.evidence.fileDigest))
    )
      throw new Error(
        "Render quarantine evidence is not bound to its private container.",
      );
    ownedParent = captured;
    assertRenderGcTarget(props.marker);
    assertRenderGcTarget(props.evidence);
  }
  removeCapturedRenderGcTarget({
    isolated: path.join(props.quarantine, randomUUID()),
    quarantine: props.quarantine,
    snapshot: props.evidence,
  });
  removeCapturedRenderGcTarget({
    isolated: path.join(props.quarantine, randomUUID()),
    quarantine: props.quarantine,
    snapshot: props.marker,
  });
  if (ownedParent === null) return;
  let parent: IRenderGcTargetSnapshot;
  try {
    parent = captureRenderGcTarget(props.evidence.base.path, evidenceParent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (
    parent.targetIdentity === ownedParent.targetIdentity &&
    parent.kind === "directory" &&
    parent.bytes === 0 &&
    parent.entries.length === 1 &&
    parent.entries[0]?.kind === "directory" &&
    parent.entries[0].path === ""
  )
    removeCapturedRenderGcTarget({
      isolated: path.join(props.quarantine, randomUUID()),
      quarantine: props.quarantine,
      snapshot: parent,
    });
};

/** Revalidate an exact captured target without changing it. */
export const assertCapturedRenderTarget = (
  snapshot: IRenderGcTargetSnapshot,
): void => assertRenderGcTarget(snapshot);

/** Prove that one captured file is an exact member of a captured directory. */
export const assertCapturedRenderGcFileEntry = (props: {
  directory: IRenderGcTargetSnapshot;
  file: IRenderGcTargetSnapshot;
  relative: string;
}): void => {
  const segments = props.relative.split("/");
  if (
    props.directory.kind !== "directory" ||
    props.file.kind !== "file" ||
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\\") ||
        segment.includes("\0"),
    ) ||
    props.file.target !== path.resolve(props.directory.target, ...segments)
  )
    throw new Error("Render captured file is not the declared tree member.");
  const entry = props.directory.entries.find(
    (candidate) => candidate.path === props.relative,
  );
  if (
    entry?.kind !== "file" ||
    entry.identity !== props.file.targetIdentity ||
    entry.bytes !== props.file.bytes ||
    entry.digest !== props.file.fileDigest
  )
    throw new Error(
      `Render captured file "${props.file.target}" is not bound to its directory inventory.`,
    );
};

/** Read the bytes of the exact captured file through a matching descriptor. */
export const readCapturedRenderGcFile = (
  snapshot: IRenderGcTargetSnapshot,
  maximumBytes: number,
): Uint8Array => {
  if (snapshot.kind !== "file")
    throw new Error(`Render target "${snapshot.target}" is not a file.`);
  if (
    Number.isSafeInteger(maximumBytes) === false ||
    maximumBytes < 0 ||
    snapshot.bytes > maximumBytes
  )
    throw new Error(
      `Render target "${snapshot.target}" exceeds its read boundary.`,
    );
  assertRootIdentity(snapshot.base);
  const descriptor = fs.openSync(snapshot.target, "r");
  const bytes = Buffer.alloc(snapshot.bytes);
  let offset = 0;
  let openedIdentity = "";
  let failure: IRenderGcDescriptorFailure | undefined;
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (
      opened.isFile() === false ||
      physicalFileId(opened) !== identityFileId(snapshot.targetIdentity)
    )
      throw new Error(
        `Render target "${snapshot.target}" opened a different file.`,
      );
    const openedVersion = physicalVersion(opened);
    openedIdentity = physicalFileId(opened);
    while (offset < bytes.length) {
      const length = fs.readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (length === 0)
        throw new Error(
          `Render target "${snapshot.target}" ended before its captured size.`,
        );
      offset += length;
    }
    const completed = fs.fstatSync(descriptor, { bigint: true });
    if (physicalVersion(completed) !== openedVersion)
      throw new Error(
        `Render target "${snapshot.target}" changed while descriptor-read.`,
      );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    closeRenderGcDescriptor(descriptor, failure, "captured render file");
  }
  const contentFingerprint = digestAutoMovieBytes(
    Buffer.from(
      JSON.stringify([
        {
          bytes: bytes.length,
          digest: digestAutoMovieBytes(bytes),
          identity: openedIdentity,
          kind: "file",
          path: "",
        } satisfies IRenderGcContentEntry,
      ]),
    ),
  );
  if (contentFingerprint !== snapshot.contentFingerprint)
    throw new Error(
      `Render target "${snapshot.target}" differs from its captured bytes.`,
    );
  assertRenderGcTarget(snapshot);
  return bytes;
};

const isolateCapturedRenderTarget = (props: {
  isolated: string;
  quarantine: string;
  snapshot: IRenderGcTargetSnapshot;
}): {
  moved: IRenderGcTargetSnapshot;
  quarantine: IRenderGcPhysicalDirectory;
} => {
  const quarantine = physicalDirectory(
    props.quarantine,
    "render GC quarantine",
  );
  if (inside(props.snapshot.base.real, quarantine.real) === false)
    throw new Error("Render GC quarantine escapes its ownership root.");
  const isolated = path.resolve(props.isolated);
  if (
    path.dirname(isolated) !== quarantine.path ||
    inside(quarantine.path, isolated) === false
  )
    throw new Error("Render GC isolated path escapes its quarantine.");
  assertRenderGcTarget(props.snapshot);
  assertPhysicalDirectoryIdentity(quarantine, "render GC quarantine");
  fs.renameSync(props.snapshot.target, isolated);
  const movedQuarantine = physicalDirectory(
    props.quarantine,
    "render GC quarantine",
  );
  assertSamePhysicalDirectory(
    quarantine,
    movedQuarantine,
    "render GC quarantine",
  );
  let moved: IRenderGcTargetSnapshot;
  try {
    moved = captureRenderGcTarget(props.snapshot.base.path, isolated);
  } catch (error) {
    throw new Error(
      `Render GC moved an unverifiable entry to "${isolated}" and preserved it: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (
    moved.kind !== props.snapshot.kind ||
    moved.targetIdentity !== props.snapshot.targetIdentity ||
    moved.contentFingerprint !== props.snapshot.contentFingerprint
  ) {
    throw new Error(
      `Render GC target "${props.snapshot.target}" changed at quarantine; its successor was preserved at "${isolated}" and not deleted.`,
    );
  }
  return { moved, quarantine: movedQuarantine };
};

const assertRenderGcTarget = (expected: IRenderGcTargetSnapshot): void => {
  const current = captureResidentTarget(expected.base, expected.target);
  if (
    current.kind !== expected.kind ||
    current.targetIdentity !== expected.targetIdentity ||
    current.contentFingerprint !== expected.contentFingerprint ||
    current.namespaceFingerprint !== expected.namespaceFingerprint
  )
    throw new Error(
      `Render GC target "${expected.target}" changed after inventory.`,
    );
};

const captureResidentTarget = (
  base: IRenderGcPhysicalDirectory,
  target: string,
): IRenderGcTargetSnapshot => {
  assertRootIdentity(base);
  const absolute = path.resolve(target);
  const relative = path.relative(base.path, absolute);
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(`Render GC target "${target}" escapes renderer ownership.`);
  const ancestry: IRenderGcPhysicalDirectory[] = [];
  let cursor = base.path;
  for (const segment of path.dirname(relative) === "."
    ? []
    : path.dirname(relative).split(path.sep)) {
    cursor = path.join(cursor, segment);
    const identity = physicalDirectory(cursor, "render GC target ancestry");
    if (inside(base.real, identity.real) === false)
      throw new Error("Render GC target ancestry escapes renderer ownership.");
    ancestry.push(identity);
  }
  const status = fs.lstatSync(absolute, { bigint: true });
  if (status.isSymbolicLink())
    throw new Error(`Render GC target "${absolute}" is linked.`);
  const resident = fs.realpathSync(absolute);
  const physical = fs.statSync(resident, { bigint: true });
  // Two different conditions used to share one message. A real path that leaves
  // the owned root is an ownership escape; a version that moved between this
  // function's own lstat and the stat of the resolved path is a race, and
  // naming it an escape sends the reader looking for a path that left its root.
  if (inside(base.real, resident) === false)
    throw new Error(
      `Render GC target "${absolute}" escapes renderer ownership.`,
    );
  let stableStatus = status;
  if (physicalVersion(physical) !== physicalVersion(status)) {
    if (isMetadataSettlement(status, physical)) stableStatus = physical;
    else
      throw new Error(
        `Render GC target "${absolute}" changed while it was resolved.`,
      );
  }
  // A file's identity has to match the entry its directory inventory records,
  // and those entries carry the file id so a pathname stat and a descriptor
  // stat agree on them. A directory keeps its device.
  const targetIdentity = status.isFile()
    ? physicalFileId(status)
    : physicalIdentity(status);
  let entries: IRenderGcContentEntry[];
  let kind: "directory" | "file";
  if (status.isFile()) {
    kind = "file";
    const captured = captureFileEntry(resident, "");
    entries = [captured.entry];
    stableStatus = captured.status;
  } else {
    if (status.isDirectory() === false)
      throw new Error(`Render GC target "${absolute}" is not physical.`);
    kind = "directory";
    entries = captureTree(base, resident);
  }
  const completed = fs.lstatSync(absolute, { bigint: true });
  if (completed.isSymbolicLink() || fs.realpathSync(absolute) !== resident)
    throw new Error(`Render GC target "${absolute}" changed while captured.`);
  if (physicalVersion(completed) !== physicalVersion(stableStatus)) {
    if (isMetadataSettlement(stableStatus, completed)) stableStatus = completed;
    else
      throw new Error(`Render GC target "${absolute}" changed while captured.`);
  }
  for (const identity of ancestry)
    assertPhysicalDirectoryIdentity(identity, "render GC target ancestry");
  assertRootIdentity(base);
  const contentFingerprint = digestAutoMovieBytes(
    Buffer.from(JSON.stringify(entries)),
  );
  const namespaceFingerprint = digestAutoMovieBytes(
    Buffer.from(
      JSON.stringify({
        ancestry: ancestry.map((identity) => ({
          identity: identity.identity,
          path: path.relative(base.real, identity.real).replaceAll("\\", "/"),
        })),
        contentFingerprint,
        targetVersion: physicalVersion(stableStatus),
      }),
    ),
  );
  return {
    base,
    bytes: entries.reduce((total, entry) => total + (entry.bytes ?? 0), 0),
    contentFingerprint,
    entries,
    fileDigest: kind === "file" ? entries[0]!.digest! : null,
    kind,
    namespaceFingerprint,
    target: absolute,
    targetIdentity,
    targetVersion: physicalVersion(stableStatus),
  };
};

const captureTree = (
  base: IRenderGcPhysicalDirectory,
  root: string,
): IRenderGcContentEntry[] => {
  const entries: IRenderGcContentEntry[] = [];
  const visit = (directory: string, relative: string): void => {
    const identity = physicalDirectory(
      directory,
      "render GC content directory",
    );
    if (inside(base.real, identity.real) === false)
      throw new Error("Render GC content directory escapes ownership.");
    entries.push({
      identity: identity.identity,
      kind: "directory",
      path: relative,
    });
    for (const name of fs.readdirSync(identity.real).sort(compare)) {
      const absolute = path.join(identity.real, name);
      const child = relative.length === 0 ? name : `${relative}/${name}`;
      const status = fs.lstatSync(absolute, { bigint: true });
      if (status.isSymbolicLink())
        throw new Error(`Render GC content "${absolute}" is linked.`);
      if (status.isDirectory()) visit(absolute, child);
      else if (status.isFile()) entries.push(readFileEntry(absolute, child));
      else throw new Error(`Render GC content "${absolute}" is not physical.`);
    }
    assertPhysicalDirectory(identity, "render GC content directory");
  };
  visit(root, "");
  return entries;
};

const readFileEntry = (file: string, relative: string): IRenderGcContentEntry =>
  captureFileEntry(file, relative).entry;

const captureFileEntry = (
  file: string,
  relative: string,
): IRenderGcFileCapture => {
  for (let attempt = 0; attempt !== 2; ++attempt) {
    const linked = fs.lstatSync(file, { bigint: true });
    if (linked.isSymbolicLink() || linked.isFile() === false)
      throw new Error(`Render GC content "${file}" is not one physical file.`);
    const version = physicalVersion(linked);
    const descriptor = fs.openSync(file, "r");
    let bytes = 0;
    let digest: `sha256:${string}`;
    let failure: IRenderGcDescriptorFailure | undefined;
    try {
      const opened = fs.fstatSync(descriptor, { bigint: true });
      if (
        opened.isFile() === false ||
        physicalFileId(opened) !== physicalFileId(linked)
      )
        throw new Error(`Render GC content "${file}" changed before open.`);
      const openedVersion = physicalVersion(opened);
      const hash = createHash("sha256");
      const chunk = Buffer.allocUnsafe(1024 * 1024);
      for (;;) {
        const length = fs.readSync(descriptor, chunk, 0, chunk.length, bytes);
        if (length === 0) break;
        hash.update(chunk.subarray(0, length));
        bytes += length;
      }
      digest = `sha256:${hash.digest("hex")}`;
      const completed = fs.fstatSync(descriptor, { bigint: true });
      if (
        completed.isFile() === false ||
        physicalVersion(completed) !== openedVersion
      )
        throw new Error(`Render GC content "${file}" changed while hashed.`);
    } catch (error) {
      failure = { error };
      throw error;
    } finally {
      closeRenderGcDescriptor(descriptor, failure, "inventoried render file");
    }
    const resident = fs.lstatSync(file, { bigint: true });
    if (
      resident.isSymbolicLink() ||
      resident.isFile() === false ||
      physicalFileId(resident) !== physicalFileId(linked)
    )
      throw new Error(`Render GC content "${file}" changed while read.`);
    if (physicalVersion(resident) !== version) {
      if (attempt === 0 && isMetadataSettlement(linked, resident)) continue;
      throw new Error(`Render GC content "${file}" changed while read.`);
    }
    return {
      entry: {
        bytes,
        digest,
        identity: physicalFileId(linked),
        kind: "file",
        path: relative,
      },
      status: resident,
    };
  }
  throw new Error(`Render GC content "${file}" changed while read.`);
};

const physicalDirectory = (
  directory: string,
  label: string,
): IRenderGcPhysicalDirectory => {
  const namespacePath = path.resolve(directory);
  const linked = fs.lstatSync(namespacePath, { bigint: true });
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(`${label} "${namespacePath}" is not physical.`);
  const real = fs.realpathSync(namespacePath);
  const status = fs.statSync(real, { bigint: true });
  const version = physicalVersion(status);
  if (
    status.isDirectory() === false ||
    status.dev !== linked.dev ||
    status.ino !== linked.ino
  )
    throw new Error(`${label} "${namespacePath}" changed while resolved.`);
  return {
    identity: physicalIdentity(status),
    path: namespacePath,
    real,
    version,
  };
};

const assertRootIdentity = (expected: IRenderGcPhysicalDirectory): void => {
  const current = physicalDirectory(expected.path, "render GC ownership root");
  if (current.identity !== expected.identity || current.real !== expected.real)
    throw new Error("Render GC ownership root changed physical identity.");
};

const assertPhysicalDirectory = (
  expected: IRenderGcPhysicalDirectory,
  label: string,
): void => {
  const current = physicalDirectory(expected.path, label);
  if (
    current.identity !== expected.identity ||
    current.real !== expected.real ||
    current.version !== expected.version
  )
    throw new Error(`${label} "${expected.path}" changed physical identity.`);
};

const assertPhysicalDirectoryIdentity = (
  expected: IRenderGcPhysicalDirectory,
  label: string,
): void => {
  const current = physicalDirectory(expected.path, label);
  if (current.identity !== expected.identity || current.real !== expected.real)
    throw new Error(`${label} "${expected.path}" changed physical identity.`);
};

const assertSamePhysicalDirectory = (
  expected: IRenderGcPhysicalDirectory,
  current: IRenderGcPhysicalDirectory,
  label: string,
): void => {
  if (
    current.path !== expected.path ||
    current.identity !== expected.identity ||
    current.real !== expected.real
  )
    throw new Error(`${label} "${expected.path}" changed physical identity.`);
};

const physicalIdentity = (status: fs.BigIntStats): string =>
  `${status.dev}\0${status.ino}`;

// A pathname stat and a descriptor stat are two different sources and do not
// agree on every field: Windows reads the volume serial through a different
// API for each, so one resident, unmodified file can report two devices. The
// file id is what both sources agree on, so cross-source comparisons bind by
// it, and a full version is only ever compared against another reading of the
// same source.
const physicalFileId = (status: fs.BigIntStats): string => `${status.ino}`;

const identityFileId = (identity: string): string =>
  identity.slice(identity.indexOf("\0") + 1);

const physicalVersion = (status: fs.BigIntStats): string =>
  `${physicalIdentity(status)}\0${status.size}\0${status.mtimeNs}\0${status.ctimeNs}`;

// Windows can publish a stable file's creation/change timestamp one pathname
// observation after an atomic replacement becomes visible. That is harmless
// only when identity, kind, size, and content modification time stay fixed;
// every other version transition remains a content or namespace race.
const isMetadataSettlement = (
  before: fs.BigIntStats,
  after: fs.BigIntStats,
): boolean =>
  before.isFile() === after.isFile() &&
  before.isDirectory() === after.isDirectory() &&
  (before.isFile()
    ? physicalFileId(before) === physicalFileId(after)
    : physicalIdentity(before) === physicalIdentity(after)) &&
  before.size === after.size &&
  before.mtimeNs === after.mtimeNs;

const ownedRelativePath = (
  base: string,
  target: string,
  label: string,
): string => {
  const relative = path.relative(path.resolve(base), path.resolve(target));
  if (
    relative.length === 0 ||
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    relative.includes("\0")
  )
    throw new Error(`${label} escapes its ownership root.`);
  return relative.replaceAll("\\", "/");
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

const isRenderCleanupReceipt = (
  value: unknown,
): value is IAutoMovieProductionRenderCleanupReceipt =>
  isPlainObject(value) &&
  Object.keys(value).sort(compare).join("\0") ===
    [
      "authority",
      "basis",
      "disposition",
      "fingerprint",
      "generation",
      "kind",
      "path",
      "reason",
      "stage",
      "state",
      "version",
    ]
      .sort(compare)
      .join("\0") &&
  value.version === 1 &&
  typeof value.basis === "string" &&
  /^sha256:[0-9a-f]{64}$/u.test(value.basis) &&
  value.disposition === "quarantine" &&
  typeof value.kind === "string" &&
  [
    "chunk",
    "chunk-pointer",
    "chunk-tree",
    "dialogue-cache",
    "model-cache",
    "quarantine",
    "publication",
  ].includes(value.kind) &&
  typeof value.path === "string" &&
  validOwnedRelativePath(value.path) &&
  typeof value.generation === "string" &&
  value.generation.length !== 0 &&
  // A generation is a physical target identity, and that identity joins its
  // device and inode with NUL on purpose; only line breaks are foreign to it.
  /[\r\n]/u.test(value.generation) === false &&
  typeof value.fingerprint === "string" &&
  /^sha256:[0-9a-f]{64}$/u.test(value.fingerprint) &&
  value.state === "integrity-failed" &&
  value.authority === "exact-quarantine" &&
  typeof value.stage === "string" &&
  [
    "absence",
    "locator",
    "capture",
    "receipt",
    "inventory",
    "media",
    "currentness",
    "ownership",
    "reference",
  ].includes(value.stage) &&
  typeof value.reason === "string" &&
  value.reason.trim().length !== 0 &&
  /[\r\n\0]/u.test(value.reason) === false;

const validOwnedRelativePath = (relative: string): boolean => {
  const segments = relative.split("/");
  return (
    segments.length !== 0 &&
    path.posix.isAbsolute(relative) === false &&
    segments.every(
      (segment) =>
        segment.length !== 0 &&
        segment !== "." &&
        segment !== ".." &&
        segment.includes("\\") === false &&
        segment.includes("\0") === false,
    )
  );
};

const inside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (path.isAbsolute(relative) === false &&
      relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false)
  );
};

const compare = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
