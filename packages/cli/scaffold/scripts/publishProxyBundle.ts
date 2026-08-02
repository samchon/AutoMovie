import { digestAutoMovieBytes } from "@automovie/mcp";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IProxyBundleCapturedEvidence,
  encodeProxyBundleContainer,
} from "./proxyBundleContainer";
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

/** Publish one immutable proxy container through an exclusive hard link. */
export const publishProxyBundle = (props: {
  expected: ReadonlyMap<string, Uint8Array>;
  parent: string;
  processAlive: (pid: number) => boolean;
  renderRoot: string;
  target: string;
}): { reused: boolean } => {
  void props.processAlive;
  assertDirectChild(props.parent, props.target);
  if (props.expected.has("publication.json") === false)
    throw new Error("Proxy publication requires one root publication receipt.");
  const bytes = encodeProxyBundleContainer(props.expected);
  const expected: IExpectedContainer = {
    bytes: bytes.length,
    digest: digestAutoMovieBytes(bytes),
  };
  const ownership = capturePublicationOwnership(props.renderRoot, props.parent);
  const assertOwnership = (): void => assertPublicationOwnership(ownership);
  const existing = captureExisting(props.renderRoot, props.target);
  if (existing !== null) {
    assertExpectedPublication(existing, expected, bytes, props.expected);
    assertOwnership();
    return { reused: true };
  }

  const candidatePath = path.join(
    props.parent,
    `.${path.basename(props.target)}.${process.pid}.${randomUUID()}.candidate`,
  );
  assertOwnership();
  const candidate = createRenderGcFileSnapshot(
    props.renderRoot,
    candidatePath,
    bytes,
  );
  let linkSucceeded = false;
  try {
    assertOwnership();
    try {
      fs.linkSync(candidate.target, props.target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const successor = captureRenderGcTarget(props.renderRoot, props.target);
      assertExpectedPublication(successor, expected, bytes, props.expected);
      assertOwnership();
      return { reused: true };
    }
    linkSucceeded = true;
    const linked = captureRenderGcTarget(props.renderRoot, props.target);
    assertSameContainer(candidate, linked);
    assertExpectedContainer(linked, expected, bytes);
    assertOwnership();

    const published = captureRenderGcTarget(props.renderRoot, props.target);
    assertSameContainer(candidate, published);
    assertExpectedContainer(published, expected, bytes);
    assertOwnership();
    return { reused: false };
  } finally {
    if (linkSucceeded === false) removeOwnedCandidate(candidate, ownership);
  }
};

const captureProxyPublicationEvidence = (
  snapshot: IRenderGcTargetSnapshot,
): IProxyBundleCapturedEvidence => {
  const bytes = (() => {
    if (snapshot.kind === "file")
      return readCapturedRenderGcFile(snapshot, snapshot.bytes);
    const receiptEntry = snapshot.entries.find(
      (entry) => entry.kind === "file" && entry.path === "publication.json",
    );
    if (receiptEntry === undefined) return Buffer.alloc(0);
    const receipt = captureRenderGcTarget(
      snapshot.base.path,
      path.join(snapshot.target, "publication.json"),
    );
    assertCapturedRenderGcFileEntry({
      directory: snapshot,
      file: receipt,
      relative: "publication.json",
    });
    return readCapturedRenderGcFile(receipt, receipt.bytes);
  })();
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

interface IExpectedContainer {
  bytes: number;
  digest: `sha256:${string}`;
}

const assertExpectedContainer = (
  snapshot: IRenderGcTargetSnapshot,
  expected: IExpectedContainer,
  bytes: Uint8Array,
): void => {
  if (
    snapshot.kind !== "file" ||
    snapshot.bytes !== expected.bytes ||
    snapshot.fileDigest !== expected.digest
  )
    throw new Error("Proxy publication container differs from expected bytes.");
  const resident = readCapturedRenderGcFile(snapshot, bytes.length);
  if (Buffer.from(resident).equals(bytes) === false)
    throw new Error("Proxy publication container changed resident bytes.");
};

const assertExpectedPublication = (
  snapshot: IRenderGcTargetSnapshot,
  container: IExpectedContainer,
  bytes: Uint8Array,
  expected: ReadonlyMap<string, Uint8Array>,
): void => {
  if (snapshot.kind === "file") {
    assertExpectedContainer(snapshot, container, bytes);
    return;
  }
  const files = new Map(
    [...expected].map(([relative, resident]) => [
      relative.replaceAll("\\", "/"),
      { bytes: resident.length, digest: digestAutoMovieBytes(resident) },
    ]),
  );
  const directories = new Set([""]);
  for (const relative of files.keys()) {
    const segments = relative.split("/");
    for (let length = 1; length < segments.length; ++length)
      directories.add(segments.slice(0, length).join("/"));
  }
  if (
    snapshot.entries.length !== files.size + directories.size ||
    snapshot.entries.some((entry) => {
      if (entry.kind === "directory")
        return directories.has(entry.path) === false;
      const fact = files.get(entry.path);
      return (
        fact === undefined ||
        fact.bytes !== entry.bytes ||
        fact.digest !== entry.digest
      );
    })
  )
    throw new Error("Legacy proxy publication differs from expected files.");
  assertCapturedRenderTarget(snapshot);
};

const assertSameContainer = (
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
    throw new Error("Proxy publication used another physical container.");
};

interface IProxyPublicationOwnership {
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
  return { parent: physicalParent, root };
};

const assertPublicationOwnership = (
  ownership: IProxyPublicationOwnership,
): void => {
  assertRenderPhysicalDirectoryIdentity(
    ownership.root,
    "proxy publication root",
  );
  assertRenderPhysicalDirectoryIdentity(
    ownership.parent,
    "proxy publication parent",
  );
};

const removeOwnedCandidate = (
  expected: IRenderGcTargetSnapshot,
  ownership: IProxyPublicationOwnership,
): void => {
  try {
    assertPublicationOwnership(ownership);
    removeExactTarget(expected);
  } catch {
    // Ambiguous ownership is preserved for explicit GC adjudication.
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

const assertDirectChild = (parent: string, target: string): void => {
  if (path.dirname(path.resolve(target)) !== path.resolve(parent))
    throw new Error(
      `Proxy publication target "${target}" must be a direct child.`,
    );
};
