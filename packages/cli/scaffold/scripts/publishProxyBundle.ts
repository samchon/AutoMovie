import { digestAutoMovieBytes } from "@automovie/mcp";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcContentEntry,
  type IRenderGcPhysicalDirectory,
  type IRenderGcTargetSnapshot,
  RENDER_GC_PRESERVED_PREFIX,
  assertRenderPhysicalDirectoryIdentity,
  captureRenderGcTarget,
  captureRenderPhysicalDirectory,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
  readCapturedRenderGcFile,
  removeCapturedRenderGcTarget,
} from "./renderGcSnapshot";

const CLAIM_FILE = ".publication-claim.json";
const CLAIM_MAX_BYTES = 16 * 1024;

interface IProxyPublicationClaim {
  version: 1;
  expected: `sha256:${string}`;
  pid: number;
  token: string;
}

/** Publish one immutable proxy bundle without overwriting a destination. */
export const publishProxyBundle = (props: {
  expected: ReadonlyMap<string, Uint8Array>;
  parent: string;
  processAlive: (pid: number) => boolean;
  renderRoot: string;
  target: string;
}): { reused: boolean } => {
  assertDirectChild(props.parent, props.target, "proxy publication target");
  if (props.expected.has("publication.json") === false)
    throw new Error("Proxy publication requires one root publication receipt.");
  const expected = expectedFacts(props.expected);
  const ownership = capturePublicationOwnership(props.renderRoot, props.parent);
  const assertOwnership = (): void => assertPublicationOwnership(ownership);

  const existing = captureExisting(props.renderRoot, props.target);
  if (existing !== null) {
    try {
      assertExpectedTree(existing, expected, undefined, false);
      assertOwnership();
      return { reused: true };
    } catch (error) {
      const recovery = recoverClaimedPublication({
        ...props,
        expected,
        ownership,
        snapshot: existing,
      });
      if (recovery === "reused") return { reused: true };
      if (recovery === null) throw error;
    }
  }

  const candidate = path.join(
    props.parent,
    `.${path.basename(props.target)}.${randomUUID()}.candidate`,
  );
  assertOwnership();
  fs.mkdirSync(candidate);
  assertOwnership();
  const candidateReservation = captureRenderGcTarget(
    props.renderRoot,
    candidate,
  );
  let completeCandidate: IRenderGcTargetSnapshot | null = null;
  let candidateRemoved = false;
  let targetReservation: IRenderGcTargetSnapshot | null = null;
  let targetDirectories: ReadonlyMap<string, string> | null = null;
  const ownedTargetFiles = new Map<string, IRenderGcContentEntry>();
  try {
    writeExpectedTree(candidate, props.expected, assertOwnership);
    completeCandidate = captureRenderGcTarget(props.renderRoot, candidate);
    assertSameTarget(candidateReservation, completeCandidate);
    assertExpectedTree(completeCandidate, expected, undefined, false);
    assertOwnership();

    try {
      fs.mkdirSync(props.target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      assertOwnership();
      const successor = captureRenderGcTarget(props.renderRoot, props.target);
      assertExpectedTree(successor, expected, undefined, false);
      return { reused: true };
    }
    assertOwnership();
    targetReservation = captureRenderGcTarget(props.renderRoot, props.target);
    createExpectedDirectories(
      props.target,
      expected.directories,
      assertOwnership,
    );
    const preparedTarget = captureRenderGcTarget(
      props.renderRoot,
      props.target,
    );
    assertSameTarget(targetReservation, preparedTarget);
    targetDirectories = directoryIdentities(
      preparedTarget,
      expected.directories,
    );

    const claim: IProxyPublicationClaim = {
      version: 1,
      expected: expected.fingerprint,
      pid: process.pid,
      token: randomUUID(),
    };
    const claimSnapshot = createRenderGcFileSnapshot(
      props.renderRoot,
      path.join(props.target, CLAIM_FILE),
      Buffer.from(`${JSON.stringify(claim)}\n`, "utf8"),
    );
    ownedTargetFiles.set(CLAIM_FILE, claimSnapshot.entries[0]!);

    linkCandidatePayloads({
      assertOwnership,
      candidate,
      candidateSnapshot: completeCandidate,
      expected,
      ownedTargetFiles,
      target: props.target,
    });
    const preparedPublication = captureRenderGcTarget(
      props.renderRoot,
      props.target,
    );
    assertOwnedTarget(
      targetReservation,
      preparedPublication,
      targetDirectories,
      ownedTargetFiles,
    );

    removeExactTree(completeCandidate);
    candidateRemoved = true;
    assertOwnership();

    const receipt = props.expected.get("publication.json")!;
    const receiptSnapshot = createRenderGcFileSnapshot(
      props.renderRoot,
      path.join(props.target, "publication.json"),
      receipt,
    );
    ownedTargetFiles.set("publication.json", receiptSnapshot.entries[0]!);
    removeExactTree(claimSnapshot);
    ownedTargetFiles.delete(CLAIM_FILE);

    const published = captureRenderGcTarget(props.renderRoot, props.target);
    assertSameTarget(targetReservation, published);
    assertExpectedTree(published, expected, ownedTargetFiles, true);
    assertOwnership();
    return { reused: false };
  } catch (error) {
    if (targetReservation !== null && targetDirectories !== null)
      removeOwnedTarget(targetReservation, targetDirectories, ownedTargetFiles);
    throw error;
  } finally {
    if (candidateRemoved === false)
      removeExactTree(completeCandidate ?? candidateReservation, true);
  }
};

const recoverClaimedPublication = (props: {
  expected: IExpectedTree;
  parent: string;
  processAlive: (pid: number) => boolean;
  renderRoot: string;
  snapshot: IRenderGcTargetSnapshot;
  target: string;
  ownership: IProxyPublicationOwnership;
}): "removed" | "reused" | null => {
  const claimEntry = props.snapshot.entries.find(
    (entry) => entry.kind === "file" && entry.path === CLAIM_FILE,
  );
  if (claimEntry === undefined) return null;
  const claimSnapshot = captureRenderGcTarget(
    props.renderRoot,
    path.join(props.target, CLAIM_FILE),
  );
  if (
    claimSnapshot.kind !== "file" ||
    claimSnapshot.entries[0]?.identity !== claimEntry.identity
  )
    throw new Error("Proxy publication claim changed physical identity.");
  const claim = JSON.parse(
    Buffer.from(
      readCapturedRenderGcFile(claimSnapshot, CLAIM_MAX_BYTES),
    ).toString("utf8"),
  ) as unknown;
  assertClaim(claim, props.expected.fingerprint);
  if (props.processAlive(claim.pid))
    throw new Error(
      `Proxy publication is still owned by live process ${claim.pid}.`,
    );
  assertPublicationOwnership(props.ownership);
  assertExpectedTree(
    props.snapshot,
    props.expected,
    undefined,
    true,
    claimEntry,
  );
  const complete =
    props.expected.files.size + props.expected.directories.size + 1;
  if (props.snapshot.entries.length === complete) {
    const ownedFiles = new Map(
      props.snapshot.entries
        .filter((entry) => entry.kind === "file" && entry.path !== CLAIM_FILE)
        .map((entry) => [entry.path, entry]),
    );
    removeExactTree(claimSnapshot);
    const recovered = captureRenderGcTarget(props.renderRoot, props.target);
    assertSameTarget(props.snapshot, recovered);
    assertExpectedTree(recovered, props.expected, ownedFiles, false);
    assertPublicationOwnership(props.ownership);
    return "reused";
  }
  removeExactTree(props.snapshot);
  assertPublicationOwnership(props.ownership);
  return "removed";
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
    relative === "" ||
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

interface IExpectedTree {
  directories: ReadonlySet<string>;
  files: ReadonlyMap<string, { bytes: number; digest: `sha256:${string}` }>;
  fingerprint: `sha256:${string}`;
}

const expectedFacts = (
  expected: ReadonlyMap<string, Uint8Array>,
): IExpectedTree => {
  const files = new Map(
    [...expected]
      .map(
        ([relative, bytes]) =>
          [
            canonicalRelative(relative),
            { bytes: bytes.length, digest: digestAutoMovieBytes(bytes) },
          ] as const,
      )
      .sort(([left], [right]) => compare(left, right)),
  );
  const directories = new Set([""]);
  for (const relative of files.keys()) {
    const segments = relative.split("/");
    for (let length = 1; length < segments.length; ++length)
      directories.add(segments.slice(0, length).join("/"));
  }
  return {
    directories,
    files,
    fingerprint: digestAutoMovieBytes(
      Buffer.from(JSON.stringify([...files]), "utf8"),
    ),
  };
};

const writeExpectedTree = (
  root: string,
  expected: ReadonlyMap<string, Uint8Array>,
  assertOwnership: () => void,
): void => {
  for (const [relative, bytes] of [...expected].sort(([left], [right]) =>
    compare(left, right),
  )) {
    assertOwnership();
    const destination = resolveBundleFile(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes, { flag: "wx" });
    assertOwnership();
  }
};

const createExpectedDirectories = (
  target: string,
  directories: ReadonlySet<string>,
  assertOwnership: () => void,
): void => {
  for (const relative of [...directories].filter(Boolean).sort(compare)) {
    assertOwnership();
    fs.mkdirSync(resolveBundleDirectory(target, relative));
    assertOwnership();
  }
};

const linkCandidatePayloads = (props: {
  assertOwnership: () => void;
  candidate: string;
  candidateSnapshot: IRenderGcTargetSnapshot;
  expected: IExpectedTree;
  ownedTargetFiles: Map<string, IRenderGcContentEntry>;
  target: string;
}): void => {
  const candidateEntries = new Map(
    props.candidateSnapshot.entries.map((entry) => [entry.path, entry]),
  );
  for (const relative of [...props.expected.files.keys()]
    .filter((entry) => entry !== "publication.json")
    .sort(compare)) {
    props.assertOwnership();
    const source = resolveBundleFile(props.candidate, relative);
    const expectedSource = candidateEntries.get(relative)!;
    if (fileIdentity(source) !== expectedSource.identity)
      throw new Error(`Proxy candidate file "${relative}" changed identity.`);
    const destination = resolveBundleFile(props.target, relative);
    fs.linkSync(source, destination);
    const linkedIdentity = fileIdentity(destination);
    if (linkedIdentity !== expectedSource.identity)
      throw new Error(`Proxy target file "${relative}" is not the candidate.`);
    props.ownedTargetFiles.set(relative, expectedSource);
    props.assertOwnership();
  }
};

const directoryIdentities = (
  snapshot: IRenderGcTargetSnapshot,
  expected: ReadonlySet<string>,
): ReadonlyMap<string, string> => {
  const directories = new Map(
    snapshot.entries
      .filter((entry) => entry.kind === "directory")
      .map((entry) => [entry.path, entry.identity]),
  );
  if (
    directories.size !== expected.size ||
    [...expected].some((relative) => directories.has(relative) === false) ||
    snapshot.entries.some((entry) => entry.kind === "file")
  )
    throw new Error("Proxy target directory reservation changed inventory.");
  return directories;
};

const assertOwnedTarget = (
  reservation: IRenderGcTargetSnapshot,
  current: IRenderGcTargetSnapshot,
  directories: ReadonlyMap<string, string>,
  files: ReadonlyMap<string, IRenderGcContentEntry>,
): void => {
  if (
    reservation.base.identity !== current.base.identity ||
    reservation.targetIdentity !== current.targetIdentity ||
    current.entries.length !== directories.size + files.size ||
    current.entries.some((entry) =>
      entry.kind === "directory"
        ? directories.get(entry.path) !== entry.identity
        : files.get(entry.path)?.identity !== entry.identity ||
          files.get(entry.path)?.digest !== entry.digest ||
          files.get(entry.path)?.bytes !== entry.bytes,
    )
  )
    throw new Error("Proxy target changed outside publisher ownership.");
};

const assertExpectedTree = (
  snapshot: IRenderGcTargetSnapshot,
  expected: IExpectedTree,
  ownedFiles?: ReadonlyMap<string, IRenderGcContentEntry>,
  allowClaim: boolean = false,
  claimEntry?: IRenderGcContentEntry,
): void => {
  if (snapshot.kind !== "directory")
    throw new Error("Proxy publication is not one physical directory.");
  const entries = new Map(snapshot.entries.map((entry) => [entry.path, entry]));
  const valid = snapshot.entries.every((entry) => {
    if (entry.kind === "directory") return expected.directories.has(entry.path);
    if (allowClaim && entry.path === CLAIM_FILE)
      return claimEntry !== undefined && entry.identity === claimEntry.identity;
    const fact = expected.files.get(entry.path);
    const owned = ownedFiles?.get(entry.path);
    return (
      fact !== undefined &&
      entry.bytes === fact.bytes &&
      entry.digest === fact.digest &&
      (owned === undefined || owned.identity === entry.identity)
    );
  });
  if (
    valid === false ||
    [...expected.directories].some(
      (relative) => entries.get(relative)?.kind !== "directory",
    ) ||
    (allowClaim === false &&
      (snapshot.entries.length !==
        expected.directories.size + expected.files.size ||
        [...expected.files.keys()].some(
          (relative) => entries.get(relative)?.kind !== "file",
        )))
  )
    throw new Error(
      "Proxy publication tree has foreign or unexpected entries.",
    );
};

const removeOwnedTarget = (
  reservation: IRenderGcTargetSnapshot,
  directories: ReadonlyMap<string, string>,
  files: ReadonlyMap<string, IRenderGcContentEntry>,
): void => {
  const current = captureExisting(reservation.base.path, reservation.target);
  if (current === null) return;
  try {
    assertOwnedTarget(reservation, current, directories, files);
  } catch {
    return;
  }
  removeExactTree(current);
};

const removeExactTree = (
  snapshot: IRenderGcTargetSnapshot,
  absentAllowed: boolean = false,
): void => {
  const quarantine = ensureRenderPhysicalDirectory(
    snapshot.base.path,
    `${RENDER_GC_PRESERVED_PREFIX}proxy-publication-${randomUUID()}`,
  );
  try {
    removeCapturedRenderGcTarget({
      isolated: path.join(quarantine, randomUUID()),
      quarantine,
      snapshot,
    });
  } catch (error) {
    if (
      absentAllowed === false ||
      ((error as NodeJS.ErrnoException).code !== "ENOENT" &&
        (error as NodeJS.ErrnoException).code !== "ENOTDIR")
    )
      throw error;
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

const assertSameTarget = (
  reservation: IRenderGcTargetSnapshot,
  current: IRenderGcTargetSnapshot,
): void => {
  if (
    reservation.base.identity !== current.base.identity ||
    reservation.target !== current.target ||
    reservation.targetIdentity !== current.targetIdentity
  )
    throw new Error(`Proxy tree "${reservation.target}" changed identity.`);
};

const assertClaim = (
  value: unknown,
  expected: `sha256:${string}`,
): asserts value is IProxyPublicationClaim => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== "expected,pid,token,version" ||
    (value as { version?: unknown }).version !== 1 ||
    (value as { expected?: unknown }).expected !== expected ||
    Number.isSafeInteger((value as { pid?: unknown }).pid) === false ||
    (value as { pid: number }).pid <= 0 ||
    typeof (value as { token?: unknown }).token !== "string" ||
    /^[0-9a-f-]{36}$/u.test((value as { token: string }).token) === false
  )
    throw new Error("Proxy publication recovery claim is malformed or stale.");
};

const fileIdentity = (file: string): string => {
  const status = fs.lstatSync(file, { bigint: true });
  if (status.isSymbolicLink() || status.isFile() === false)
    throw new Error(`Proxy publication file "${file}" is not physical.`);
  return `${status.dev}\0${status.ino}`;
};

const resolveBundleDirectory = (root: string, relative: string): string =>
  resolveBundleFile(root, relative);

const resolveBundleFile = (root: string, relative: string): string => {
  const canonical = canonicalRelative(relative);
  const target = path.resolve(root, ...canonical.split("/"));
  if (target.startsWith(`${path.resolve(root)}${path.sep}`) === false)
    throw new Error(`Proxy bundle file "${relative}" escapes its tree.`);
  return target;
};

const canonicalRelative = (relative: string): string => {
  if (
    relative.length === 0 ||
    relative.includes("\\") ||
    relative.startsWith("/") ||
    /^[A-Za-z]:/u.test(relative) ||
    relative
      .split("/")
      .some(
        (segment) =>
          segment.length === 0 || segment === "." || segment === "..",
      )
  )
    throw new Error(
      `Proxy bundle file "${relative}" must be one canonical relative path.`,
    );
  return relative;
};

const assertDirectChild = (
  parent: string,
  target: string,
  label: string,
): void => {
  if (path.dirname(path.resolve(target)) !== path.resolve(parent))
    throw new Error(`${label} must be a direct child of its physical parent.`);
};

const compare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
