import { digestAutoMovieBytes } from "@automovie/mcp";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcContentEntry,
  type IRenderGcPhysicalDirectory,
  type IRenderGcTargetSnapshot,
  RENDER_GC_PRESERVED_PREFIX,
  assertCapturedRenderTarget,
  assertRenderPhysicalDirectoryIdentity,
  captureRenderGcTarget,
  captureRenderPhysicalDirectory,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
  readCapturedRenderGcFile,
  removeCapturedRenderGcTarget,
} from "./renderGcSnapshot";

const CLAIM_FILE = ".publication-claim.json";
const CLAIM_MAX_BYTES = 8 * 1024 * 1024;

interface IProxyPublicationOwner {
  version: 1;
  expected: `sha256:${string}`;
  pid: number;
  token: string;
}

interface IProxyPublicationClaim {
  version: 1;
  expected: `sha256:${string}`;
  directories: Array<{ identity: string; path: string }>;
  files: Array<{ identity: string; path: string }>;
  pid: number;
  targetIdentity: string;
  token: string;
}

/** Adjudicate proxy GC from one exact captured tree and revalidate it. */
export const captureProxyPublicationGcTarget = <Value>(props: {
  judge: (snapshot: IRenderGcTargetSnapshot) => Value;
  renderRoot: string;
  target: string;
}): { snapshot: IRenderGcTargetSnapshot; value: Value } => {
  const snapshot = captureRenderGcTarget(props.renderRoot, props.target);
  const value = props.judge(snapshot);
  assertCapturedRenderTarget(snapshot);
  return { snapshot, value };
};

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
  const ownerPath = path.join(
    props.parent,
    `.${path.basename(props.target)}.publication-owner.json`,
  );
  const priorOwnerSnapshot = captureExisting(props.renderRoot, ownerPath);
  const priorOwner =
    priorOwnerSnapshot === null
      ? null
      : readPublicationOwner(priorOwnerSnapshot, expected.fingerprint);
  if (priorOwner !== null && props.processAlive(priorOwner.pid))
    throw new Error(
      `Proxy publication is still owned by live process ${priorOwner.pid}.`,
    );

  const existing = captureExisting(props.renderRoot, props.target);
  if (existing !== null) {
    try {
      assertExpectedTree(existing, expected, undefined, false);
      assertOwnership();
      if (priorOwnerSnapshot !== null) removeExactTree(priorOwnerSnapshot);
      return { reused: true };
    } catch (error) {
      const recovery = recoverClaimedPublication({
        ...props,
        expected,
        owner: priorOwner,
        ownership,
        snapshot: existing,
      });
      if (recovery === "reused") {
        if (priorOwnerSnapshot !== null) removeExactTree(priorOwnerSnapshot);
        return { reused: true };
      }
      if (recovery === null) throw error;
    }
  }
  if (priorOwnerSnapshot !== null) removeExactTree(priorOwnerSnapshot);
  const owner: IProxyPublicationOwner = {
    version: 1,
    expected: expected.fingerprint,
    pid: process.pid,
    token: randomUUID(),
  };
  const ownerSnapshot = createRenderGcFileSnapshot(
    props.renderRoot,
    ownerPath,
    Buffer.from(`${JSON.stringify(owner)}\n`, "utf8"),
  );

  try {
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
      targetDirectories = createExpectedDirectories(
        props.target,
        targetReservation,
        expected.directories,
        assertOwnership,
      );
      const preparedTarget = captureRenderGcTarget(
        props.renderRoot,
        props.target,
      );
      assertSameTarget(targetReservation, preparedTarget);
      assertOwnedTarget(
        targetReservation,
        preparedTarget,
        targetDirectories,
        ownedTargetFiles,
      );

      const candidateFiles = fileEntries(completeCandidate);
      const claim: IProxyPublicationClaim = {
        version: 1,
        expected: expected.fingerprint,
        directories: [...targetDirectories].map(([path, identity]) => ({
          identity,
          path,
        })),
        files: [...candidateFiles].map(([path, entry]) => ({
          identity: entry.identity,
          path,
        })),
        pid: process.pid,
        targetIdentity: targetReservation.targetIdentity,
        token: owner.token,
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

      linkCandidateFile({
        candidate,
        candidateEntries: candidateFiles,
        ownedTargetFiles,
        relative: "publication.json",
        target: props.target,
      });
      const committed = captureRenderGcTarget(props.renderRoot, props.target);
      assertOwnedTarget(
        targetReservation,
        committed,
        targetDirectories,
        ownedTargetFiles,
      );

      removeExactTree(completeCandidate);
      candidateRemoved = true;
      removeExactTree(claimSnapshot);
      ownedTargetFiles.delete(CLAIM_FILE);

      const published = captureRenderGcTarget(props.renderRoot, props.target);
      assertSameTarget(targetReservation, published);
      assertOwnedTarget(
        targetReservation,
        published,
        targetDirectories,
        ownedTargetFiles,
      );
      assertExpectedTree(published, expected, ownedTargetFiles, true);
      assertOwnership();
      return { reused: false };
    } catch (error) {
      if (targetReservation !== null && targetDirectories !== null)
        removeOwnedTarget(
          targetReservation,
          targetDirectories,
          ownedTargetFiles,
        );
      throw error;
    } finally {
      if (candidateRemoved === false)
        removeExactTree(completeCandidate ?? candidateReservation, true);
    }
  } finally {
    removeExactTree(ownerSnapshot, true);
  }
};

const recoverClaimedPublication = (props: {
  expected: IExpectedTree;
  owner: IProxyPublicationOwner | null;
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
  if (props.owner !== null && claim.token !== props.owner.token)
    throw new Error(
      "Proxy publication claim does not match its owner sidecar.",
    );
  if (props.processAlive(claim.pid))
    throw new Error(
      `Proxy publication is still owned by live process ${claim.pid}.`,
    );
  assertPublicationOwnership(props.ownership);
  if (claim.targetIdentity !== props.snapshot.targetIdentity)
    throw new Error("Proxy publication target changed from its owner claim.");
  const claimedDirectories = new Map(
    claim.directories.map((entry) => [entry.path, entry.identity]),
  );
  const claimedFiles = new Map(
    claim.files.map((entry) => [entry.path, entry.identity]),
  );
  if (
    claimedDirectories.size !== props.expected.directories.size ||
    [...props.expected.directories].some(
      (relative) => claimedDirectories.has(relative) === false,
    ) ||
    claimedFiles.size !== props.expected.files.size ||
    [...props.expected.files.keys()].some(
      (relative) => claimedFiles.has(relative) === false,
    )
  )
    throw new Error("Proxy publication claim has incomplete ownership facts.");
  assertExpectedTree(
    props.snapshot,
    props.expected,
    undefined,
    true,
    claimEntry,
  );
  const currentEntries = new Map(
    props.snapshot.entries.map((entry) => [entry.path, entry]),
  );
  if (
    props.snapshot.entries.some((entry) =>
      entry.kind === "directory"
        ? claimedDirectories.get(entry.path) !== entry.identity
        : entry.path === CLAIM_FILE
          ? entry.identity !== claimEntry.identity
          : claimedFiles.get(entry.path) !== entry.identity,
    )
  )
    throw new Error("Proxy publication recovery found an inode successor.");
  const complete =
    props.expected.files.size + props.expected.directories.size + 1;
  if (props.snapshot.entries.length === complete) {
    const ownedFiles = new Map(
      [...props.expected.files.keys()].map((relative) => [
        relative,
        currentEntries.get(relative)!,
      ]),
    );
    removeExactTree(claimSnapshot);
    const recovered = captureRenderGcTarget(props.renderRoot, props.target);
    assertSameTarget(props.snapshot, recovered);
    assertOwnedTarget(
      props.snapshot,
      recovered,
      claimedDirectories,
      ownedFiles,
    );
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
  reservation: IRenderGcTargetSnapshot,
  directories: ReadonlySet<string>,
  assertOwnership: () => void,
): ReadonlyMap<string, string> => {
  const owned = new Map<string, string>([["", reservation.targetIdentity]]);
  for (const relative of [...directories].filter(Boolean).sort(compare)) {
    assertOwnership();
    assertOwnedDirectories(target, reservation, owned);
    fs.mkdirSync(resolveBundleDirectory(target, relative));
    const created = captureRenderPhysicalDirectory(
      resolveBundleDirectory(target, relative),
      `proxy publication directory "${relative}"`,
    );
    owned.set(relative, created.identity);
    assertOwnedDirectories(target, reservation, owned);
    assertOwnership();
  }
  return owned;
};

const assertOwnedDirectories = (
  target: string,
  reservation: IRenderGcTargetSnapshot,
  directories: ReadonlyMap<string, string>,
): void => {
  const root = captureRenderPhysicalDirectory(
    target,
    "proxy publication target",
  );
  if (root.identity !== reservation.targetIdentity)
    throw new Error("Proxy publication target directory was replaced.");
  for (const [relative, identity] of directories) {
    if (relative.length === 0) continue;
    const current = captureRenderPhysicalDirectory(
      resolveBundleDirectory(target, relative),
      `proxy publication directory "${relative}"`,
    );
    if (current.identity !== identity)
      throw new Error(
        `Proxy publication directory "${relative}" was replaced.`,
      );
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
  const candidateEntries = fileEntries(props.candidateSnapshot);
  for (const relative of [...props.expected.files.keys()]
    .filter((entry) => entry !== "publication.json")
    .sort(compare)) {
    props.assertOwnership();
    linkCandidateFile({
      candidate: props.candidate,
      candidateEntries,
      ownedTargetFiles: props.ownedTargetFiles,
      relative,
      target: props.target,
    });
    props.assertOwnership();
  }
};

const linkCandidateFile = (props: {
  candidate: string;
  candidateEntries: ReadonlyMap<string, IRenderGcContentEntry>;
  ownedTargetFiles: Map<string, IRenderGcContentEntry>;
  relative: string;
  target: string;
}): void => {
  const source = resolveBundleFile(props.candidate, props.relative);
  const expectedSource = props.candidateEntries.get(props.relative)!;
  if (fileIdentity(source) !== expectedSource.identity)
    throw new Error(
      `Proxy candidate file "${props.relative}" changed identity.`,
    );
  const destination = resolveBundleFile(props.target, props.relative);
  fs.linkSync(source, destination);
  const linkedIdentity = fileIdentity(destination);
  if (linkedIdentity !== expectedSource.identity)
    throw new Error(
      `Proxy target file "${props.relative}" is not the candidate.`,
    );
  props.ownedTargetFiles.set(props.relative, expectedSource);
};

const fileEntries = (
  snapshot: IRenderGcTargetSnapshot,
): ReadonlyMap<string, IRenderGcContentEntry> =>
  new Map(
    snapshot.entries
      .filter((entry) => entry.kind === "file")
      .map((entry) => [entry.path, entry]),
  );

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
    Object.keys(value).sort().join(",") !==
      "directories,expected,files,pid,targetIdentity,token,version" ||
    (value as { version?: unknown }).version !== 1 ||
    (value as { expected?: unknown }).expected !== expected ||
    validClaimEntries((value as { directories?: unknown }).directories) ===
      false ||
    validClaimEntries((value as { files?: unknown }).files) === false ||
    Number.isSafeInteger((value as { pid?: unknown }).pid) === false ||
    (value as { pid: number }).pid <= 0 ||
    typeof (value as { targetIdentity?: unknown }).targetIdentity !==
      "string" ||
    (value as { targetIdentity: string }).targetIdentity.length === 0 ||
    typeof (value as { token?: unknown }).token !== "string" ||
    validToken((value as { token: string }).token) === false
  )
    throw new Error("Proxy publication recovery claim is malformed or stale.");
};

const readPublicationOwner = (
  snapshot: IRenderGcTargetSnapshot,
  expected: `sha256:${string}`,
): IProxyPublicationOwner => {
  if (snapshot.kind !== "file")
    throw new Error("Proxy publication owner sidecar is not a file.");
  const value = JSON.parse(
    Buffer.from(readCapturedRenderGcFile(snapshot, CLAIM_MAX_BYTES)).toString(
      "utf8",
    ),
  ) as unknown;
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
    validToken((value as { token: string }).token) === false
  )
    throw new Error("Proxy publication owner sidecar is malformed or stale.");
  return value as IProxyPublicationOwner;
};

const validClaimEntries = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      Array.isArray(entry) === false &&
      Object.keys(entry).sort().join(",") === "identity,path" &&
      typeof (entry as { identity?: unknown }).identity === "string" &&
      (entry as { identity: string }).identity.length !== 0 &&
      typeof (entry as { path?: unknown }).path === "string",
  );

const validToken = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
    value,
  );

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
