import { digestAutoMovieBytes } from "@automovie/mcp";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const RENDER_GC_PRESERVED_PREFIX = ".gc-preserved-";

/** Keep fail-closed GC evidence outside all later automatic deletion plans. */
export const isRenderGcPreservedPath = (relative: string): boolean =>
  relative
    .replaceAll("\\", "/")
    .split("/")[0]
    ?.startsWith(RENDER_GC_PRESERVED_PREFIX) === true;

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
    const snapshot = captureRenderGcTarget(root.path, absolute);
    if (
      snapshot.kind !== "file" ||
      snapshot.targetIdentity !== physicalIdentity(opened) ||
      snapshot.targetVersion !== physicalVersion(opened) ||
      Buffer.from(readCapturedRenderGcFile(snapshot, source.length)).equals(
        source,
      ) === false
    )
      throw new Error(
        `Render file "${target}" changed after descriptor publication.`,
      );
    const completed = fs.fstatSync(descriptor, { bigint: true });
    if (physicalVersion(completed) !== snapshot.targetVersion)
      throw new Error(`Render file "${target}" changed while published.`);
    assertPhysicalDirectoryIdentity(parent, "render file directory");
    assertRootIdentity(root);
    return snapshot;
  } finally {
    fs.closeSync(descriptor);
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
  assertPhysicalDirectory(isolated.quarantine, "render GC quarantine");
  fs.rmSync(isolated.moved.target, {
    force: true,
    recursive: isolated.moved.kind === "directory",
  });
};

/** Quarantine only the exact captured target through a private staging path. */
export const quarantineCapturedRenderTarget = (props: {
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
  try {
    fs.lstatSync(destination);
    throw new Error(`Render quarantine destination "${destination}" exists.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  assertRenderGcTarget(isolated.moved);
  assertPhysicalDirectory(isolated.quarantine, "render GC quarantine");
  assertPhysicalDirectory(destinationParent, "render quarantine destination");
  fs.renameSync(isolated.moved.target, destination);
  const movedDestination = physicalDirectory(
    destinationParent.path,
    "render quarantine destination",
  );
  assertSamePhysicalDirectory(
    destinationParent,
    movedDestination,
    "render quarantine destination",
  );
  const completed = captureRenderGcTarget(
    props.snapshot.base.path,
    destination,
  );
  if (
    completed.kind !== isolated.moved.kind ||
    completed.targetIdentity !== isolated.moved.targetIdentity ||
    completed.contentFingerprint !== isolated.moved.contentFingerprint
  )
    throw new Error(
      `Render quarantine destination "${destination}" changed after private staging.`,
    );
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
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (
      opened.isFile() === false ||
      physicalIdentity(opened) !== snapshot.targetIdentity ||
      physicalVersion(opened) !== snapshot.targetVersion
    )
      throw new Error(
        `Render target "${snapshot.target}" opened a different file.`,
      );
    openedIdentity = physicalIdentity(opened);
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
    if (physicalVersion(completed) !== snapshot.targetVersion)
      throw new Error(
        `Render target "${snapshot.target}" changed while descriptor-read.`,
      );
  } finally {
    fs.closeSync(descriptor);
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
  assertPhysicalDirectory(quarantine, "render GC quarantine");
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
  if (
    inside(base.real, resident) === false ||
    physicalVersion(physical) !== physicalVersion(status)
  )
    throw new Error(
      `Render GC target "${absolute}" escapes renderer ownership.`,
    );
  const targetIdentity = physicalIdentity(status);
  let entries: IRenderGcContentEntry[];
  let kind: "directory" | "file";
  if (status.isFile()) {
    kind = "file";
    entries = [readFileEntry(resident, "")];
  } else {
    if (status.isDirectory() === false)
      throw new Error(`Render GC target "${absolute}" is not physical.`);
    kind = "directory";
    entries = captureTree(base, resident);
  }
  const completed = fs.lstatSync(absolute, { bigint: true });
  if (
    completed.isSymbolicLink() ||
    physicalVersion(completed) !== physicalVersion(status) ||
    fs.realpathSync(absolute) !== resident
  )
    throw new Error(`Render GC target "${absolute}" changed while captured.`);
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
        targetVersion: physicalVersion(status),
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
    targetVersion: physicalVersion(status),
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

const readFileEntry = (
  file: string,
  relative: string,
): IRenderGcContentEntry => {
  const linked = fs.lstatSync(file, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error(`Render GC content "${file}" is not one physical file.`);
  const version = physicalVersion(linked);
  const descriptor = fs.openSync(file, "r");
  let bytes = 0;
  let digest: `sha256:${string}`;
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (opened.isFile() === false || physicalVersion(opened) !== version)
      throw new Error(`Render GC content "${file}" changed before open.`);
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
    if (completed.isFile() === false || physicalVersion(completed) !== version)
      throw new Error(`Render GC content "${file}" changed while hashed.`);
  } finally {
    fs.closeSync(descriptor);
  }
  const resident = fs.lstatSync(file, { bigint: true });
  if (
    resident.isSymbolicLink() ||
    resident.isFile() === false ||
    physicalVersion(resident) !== version
  )
    throw new Error(`Render GC content "${file}" changed while read.`);
  return {
    bytes,
    digest,
    identity: physicalIdentity(linked),
    kind: "file",
    path: relative,
  };
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

const physicalVersion = (status: fs.BigIntStats): string =>
  `${physicalIdentity(status)}\0${status.size}\0${status.mtimeNs}\0${status.ctimeNs}`;

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
