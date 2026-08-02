import { digestAutoMovieBytes } from "@automovie/mcp";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcPhysicalDirectory,
  type IRenderGcTargetSnapshot,
  RENDER_GC_PRESERVED_PREFIX,
  assertCapturedRenderGcFileEntry,
  assertCapturedRenderTarget,
  assertRenderPhysicalDirectoryIdentity,
  captureRenderGcTarget,
  captureRenderPhysicalDirectory,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
  readCapturedRenderGcFile,
  removeCapturedRenderGcTarget,
} from "./renderGcSnapshot";

const PROXY_PUBLICATION_RECEIPT_MAX_BYTES = 8 * 1024 * 1024;

/** Receipt bytes bound to the exact publication snapshot that supplied them. */
export interface IProxyBundleCapturedEvidence {
  baseIdentity: string;
  bytes: Uint8Array;
  contentFingerprint: string;
  namespaceFingerprint: string;
  target: string;
  targetIdentity: string;
  targetVersion: string;
}

/** Adjudicate proxy GC from one exact captured publication. */
export const captureProxyPublicationGcTarget = <Value>(props: {
  judge: (
    snapshot: IRenderGcTargetSnapshot,
    evidence: IProxyBundleCapturedEvidence,
  ) => Value;
  renderRoot: string;
  target: string;
}): { snapshot: IRenderGcTargetSnapshot; value: Value } => {
  const snapshot = captureRenderGcTarget(props.renderRoot, props.target);
  const evidence = captureProxyPublicationEvidence(snapshot);
  const value = props.judge(snapshot, evidence);
  assertCapturedRenderTarget(snapshot);
  return { snapshot, value };
};

/**
 * Materialize one immutable content-addressed proxy bundle without replacing
 * paths.
 */
export const publishProxyBundle = (props: {
  expected: ReadonlyMap<string, Uint8Array>;
  parent: string;
  processAlive: (pid: number) => boolean;
  renderRoot: string;
  target: string;
}): { reused: boolean } => {
  void props.processAlive;
  assertDirectChild(props.parent, props.target);
  const expected = expectedFiles(props.expected);
  if (expected.has("publication.json") === false)
    throw new Error("Proxy publication requires one root publication receipt.");
  const ownership = capturePublicationOwnership(props.renderRoot, props.parent);
  const existing = captureExisting(props.renderRoot, props.target);
  if (existing !== null) {
    try {
      assertExpectedPublication(existing, expected);
      assertPublicationOwnership(ownership);
      return { reused: true };
    } catch (error) {
      if (existing.kind !== "directory") throw error;
    }
  }

  assertPublicationOwnership(ownership);
  if (existing === null)
    try {
      fs.mkdirSync(props.target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  const target = captureRenderPhysicalDirectory(
    props.target,
    "proxy publication target",
  );
  const directories = materializeExpectedDirectories({
    expected,
    ownership,
    target,
  });
  for (const entry of [...expected.values()].sort((left, right) => {
    if (left.relative === "publication.json") return 1;
    if (right.relative === "publication.json") return -1;
    return compare(left.relative, right.relative);
  }))
    publishExpectedFile({
      entry,
      directories,
      ownership,
      renderRoot: props.renderRoot,
      target,
    });
  assertPublicationDirectories(ownership, target, directories.values());
  const published = captureRenderGcTarget(props.renderRoot, props.target);
  assertExpectedPublication(published, expected);
  assertPublicationDirectories(ownership, target, directories.values());
  return { reused: false };
};

const captureProxyPublicationEvidence = (
  snapshot: IRenderGcTargetSnapshot,
): IProxyBundleCapturedEvidence => {
  if (snapshot.kind !== "directory")
    throw new Error("Proxy publication is not a materialized directory.");
  const receiptEntry = snapshot.entries.find(
    (entry) => entry.kind === "file" && entry.path === "publication.json",
  );
  if (
    receiptEntry === undefined ||
    receiptEntry.bytes === undefined ||
    receiptEntry.bytes > PROXY_PUBLICATION_RECEIPT_MAX_BYTES
  )
    throw new Error("Proxy publication has no bounded root receipt.");
  const receipt = captureRenderGcTarget(
    snapshot.base.path,
    path.join(snapshot.target, "publication.json"),
  );
  assertCapturedRenderGcFileEntry({
    directory: snapshot,
    file: receipt,
    relative: "publication.json",
  });
  const bytes = readCapturedRenderGcFile(
    receipt,
    PROXY_PUBLICATION_RECEIPT_MAX_BYTES,
  );
  return {
    baseIdentity: snapshot.base.identity,
    bytes,
    contentFingerprint: snapshot.contentFingerprint,
    namespaceFingerprint: snapshot.namespaceFingerprint,
    target: snapshot.target,
    targetIdentity: snapshot.targetIdentity,
    targetVersion: snapshot.targetVersion,
  };
};

interface IExpectedFile {
  bytes: Uint8Array;
  digest: `sha256:${string}`;
  relative: string;
}

const expectedFiles = (
  source: ReadonlyMap<string, Uint8Array>,
): ReadonlyMap<string, IExpectedFile> => {
  const output = new Map<string, IExpectedFile>();
  for (const [relative, bytes] of source) {
    const canonical = canonicalRelativePath(relative);
    if (output.has(canonical))
      throw new Error(`Proxy publication repeats path "${canonical}".`);
    output.set(canonical, {
      bytes,
      digest: digestAutoMovieBytes(bytes),
      relative: canonical,
    });
  }
  return output;
};

const materializeExpectedDirectories = (props: {
  expected: ReadonlyMap<string, IExpectedFile>;
  ownership: IProxyPublicationOwnership;
  target: IRenderGcPhysicalDirectory;
}): ReadonlyMap<string, IRenderGcPhysicalDirectory> => {
  const relativeDirectories = new Set<string>();
  for (const relative of props.expected.keys()) {
    const segments = relative.split("/");
    for (let length = 1; length < segments.length; ++length)
      relativeDirectories.add(segments.slice(0, length).join("/"));
  }
  const output = new Map<string, IRenderGcPhysicalDirectory>();
  for (const relative of [...relativeDirectories].sort((left, right) => {
    const depth = left.split("/").length - right.split("/").length;
    return depth === 0 ? compare(left, right) : depth;
  })) {
    assertPublicationDirectories(
      props.ownership,
      props.target,
      output.values(),
    );
    const directory = ensureRenderPhysicalDirectory(
      props.target.path,
      relative,
    );
    output.set(
      relative,
      captureRenderPhysicalDirectory(directory, "proxy publication directory"),
    );
  }
  assertPublicationDirectories(props.ownership, props.target, output.values());
  return output;
};

const publishExpectedFile = (props: {
  directories: ReadonlyMap<string, IRenderGcPhysicalDirectory>;
  entry: IExpectedFile;
  ownership: IProxyPublicationOwnership;
  renderRoot: string;
  target: IRenderGcPhysicalDirectory;
}): void => {
  const destination = path.join(
    props.target.path,
    ...props.entry.relative.split("/"),
  );
  const existing = captureExisting(props.renderRoot, destination);
  if (existing !== null) {
    assertExpectedFile(existing, props.entry);
    assertPublicationDirectories(
      props.ownership,
      props.target,
      props.directories.values(),
    );
    return;
  }
  const candidatePath = path.join(
    props.ownership.candidates.path,
    `.${path.basename(props.target.path)}.${process.pid}.${randomUUID()}.candidate`,
  );
  assertPublicationDirectories(
    props.ownership,
    props.target,
    props.directories.values(),
  );
  const candidate = createRenderGcFileSnapshot(
    props.renderRoot,
    candidatePath,
    props.entry.bytes,
  );
  let linkSucceeded = false;
  let cleanup = candidate;
  try {
    assertPublicationDirectories(
      props.ownership,
      props.target,
      props.directories.values(),
    );
    try {
      fs.linkSync(candidate.target, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const successor = captureRenderGcTarget(props.renderRoot, destination);
      assertExpectedFile(successor, props.entry);
      assertPublicationDirectories(
        props.ownership,
        props.target,
        props.directories.values(),
      );
      return;
    }
    linkSucceeded = true;
    const linked = captureRenderGcTarget(props.renderRoot, destination);
    assertSamePhysicalFile(candidate, linked);
    const capturedCandidate = captureRenderGcTarget(
      props.renderRoot,
      candidate.target,
    );
    assertSamePhysicalFile(candidate, capturedCandidate);
    if (linked.targetVersion !== capturedCandidate.targetVersion)
      throw new Error("Proxy publication link generation changed at commit.");
    assertPublicationDirectories(
      props.ownership,
      props.target,
      props.directories.values(),
    );
    cleanup = capturedCandidate;
    if (removeOwnedCandidate(cleanup, props.ownership) === false)
      throw new Error("Proxy publication candidate cleanup lost ownership.");
    const published = captureRenderGcTarget(props.renderRoot, destination);
    assertSamePhysicalFile(linked, published);
    assertExpectedFile(published, props.entry);
    assertPublicationDirectories(
      props.ownership,
      props.target,
      props.directories.values(),
    );
  } finally {
    if (linkSucceeded === false) removeOwnedCandidate(cleanup, props.ownership);
  }
};

const assertExpectedPublication = (
  snapshot: IRenderGcTargetSnapshot,
  expected: ReadonlyMap<string, IExpectedFile>,
): void => {
  if (snapshot.kind !== "directory")
    throw new Error("Proxy publication is not a materialized directory.");
  const directories = new Set([""]);
  for (const relative of expected.keys()) {
    const segments = relative.split("/");
    for (let length = 1; length < segments.length; ++length)
      directories.add(segments.slice(0, length).join("/"));
  }
  if (
    snapshot.entries.length !== expected.size + directories.size ||
    snapshot.entries.some((entry) => {
      if (entry.kind === "directory")
        return directories.has(entry.path) === false;
      const fact = expected.get(entry.path);
      return (
        fact === undefined ||
        fact.bytes.length !== entry.bytes ||
        fact.digest !== entry.digest
      );
    })
  )
    throw new Error(
      "Proxy publication differs from expected materialized files.",
    );
  assertCapturedRenderTarget(snapshot);
};

const assertExpectedFile = (
  snapshot: IRenderGcTargetSnapshot,
  expected: IExpectedFile,
): void => {
  if (
    snapshot.kind !== "file" ||
    snapshot.bytes !== expected.bytes.length ||
    snapshot.fileDigest !== expected.digest
  )
    throw new Error(
      `Proxy publication file "${expected.relative}" differs from expected bytes.`,
    );
  assertCapturedRenderTarget(snapshot);
};

const assertSamePhysicalFile = (
  expected: IRenderGcTargetSnapshot,
  current: IRenderGcTargetSnapshot,
): void => {
  if (
    current.kind !== "file" ||
    current.base.identity !== expected.base.identity ||
    current.targetIdentity !== expected.targetIdentity ||
    current.contentFingerprint !== expected.contentFingerprint ||
    current.fileDigest !== expected.fileDigest
  )
    throw new Error("Proxy publication used another physical candidate file.");
};

interface IProxyPublicationOwnership {
  candidates: IRenderGcPhysicalDirectory;
  parent: IRenderGcPhysicalDirectory;
  root: IRenderGcPhysicalDirectory;
}

const capturePublicationOwnership = (
  renderRoot: string,
  parent: string,
): IProxyPublicationOwnership => {
  const root = captureRenderPhysicalDirectory(
    renderRoot,
    "proxy publication root",
  );
  const physicalParent = captureRenderPhysicalDirectory(
    parent,
    "proxy publication parent",
  );
  const relative = path.relative(root.real, physicalParent.real);
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error("Proxy publication parent escapes its physical root.");
  const candidateRoot = ensureRenderPhysicalDirectory(
    root.path,
    `${RENDER_GC_PRESERVED_PREFIX}proxy-candidates`,
  );
  const candidates = captureRenderPhysicalDirectory(
    candidateRoot,
    "proxy publication candidate root",
  );
  assertRenderPhysicalDirectoryIdentity(root, "proxy publication root");
  assertRenderPhysicalDirectoryIdentity(
    physicalParent,
    "proxy publication parent",
  );
  return { candidates, parent: physicalParent, root };
};

const assertPublicationOwnership = (
  ownership: IProxyPublicationOwnership,
): void => {
  assertRenderPhysicalDirectoryIdentity(
    ownership.root,
    "proxy publication root",
  );
  assertRenderPhysicalDirectoryIdentity(
    ownership.candidates,
    "proxy publication candidate root",
  );
  assertRenderPhysicalDirectoryIdentity(
    ownership.parent,
    "proxy publication parent",
  );
};

const assertPublicationDirectories = (
  ownership: IProxyPublicationOwnership,
  target: IRenderGcPhysicalDirectory,
  directories: Iterable<IRenderGcPhysicalDirectory>,
): void => {
  assertPublicationOwnership(ownership);
  assertRenderPhysicalDirectoryIdentity(target, "proxy publication target");
  for (const directory of directories)
    assertRenderPhysicalDirectoryIdentity(
      directory,
      "proxy publication directory",
    );
};

const removeOwnedCandidate = (
  expected: IRenderGcTargetSnapshot,
  ownership: IProxyPublicationOwnership,
): boolean => {
  try {
    assertPublicationOwnership(ownership);
    removeExactTarget(expected);
    assertPublicationOwnership(ownership);
    return true;
  } catch {
    return false;
  }
};

const removeExactTarget = (snapshot: IRenderGcTargetSnapshot): void => {
  const quarantine = ensureRenderPhysicalDirectory(
    snapshot.base.path,
    `${RENDER_GC_PRESERVED_PREFIX}proxy-${randomUUID()}`,
  );
  try {
    removeCapturedRenderGcTarget({
      isolated: path.join(quarantine, randomUUID()),
      quarantine,
      snapshot,
    });
  } finally {
    if (fs.readdirSync(quarantine).length === 0) fs.rmdirSync(quarantine);
  }
};

const captureExisting = (
  base: string,
  target: string,
): IRenderGcTargetSnapshot | null => {
  try {
    return captureRenderGcTarget(base, target);
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error as NodeJS.ErrnoException).code === "ENOTDIR"
    )
      return null;
    throw error;
  }
};

const canonicalRelativePath = (relative: string): string => {
  const canonical = relative.replaceAll("\\", "/");
  const segments = canonical.split("/");
  if (
    canonical.length === 0 ||
    path.posix.normalize(canonical) !== canonical ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\0"),
    )
  )
    throw new Error(`Proxy publication path "${relative}" is not canonical.`);
  return canonical;
};

const assertDirectChild = (parent: string, target: string): void => {
  if (path.dirname(path.resolve(target)) !== path.resolve(parent))
    throw new Error(
      `Proxy publication target "${target}" must be a direct child.`,
    );
};

const compare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
