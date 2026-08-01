import {
  digestAutoMovieBytes,
  readAutoMovieProductionOwnedFile,
} from "@automovie/mcp";
import fs from "node:fs";
import path from "node:path";

export interface IRenderGcTargetSnapshot {
  base: IRenderGcPhysicalDirectory;
  bytes: number;
  contentFingerprint: `sha256:${string}`;
  kind: "directory" | "file";
  namespaceFingerprint: `sha256:${string}`;
  target: string;
  targetIdentity: string;
}

export interface IRenderGcPhysicalDirectory {
  identity: string;
  path: string;
  real: string;
  version: string;
}

interface IContentEntry {
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

/** Quarantine and delete only the exact target captured during GC inventory. */
export const removeCapturedRenderGcTarget = (props: {
  isolated: string;
  quarantine: string;
  snapshot: IRenderGcTargetSnapshot;
}): void => {
  const quarantine = physicalDirectory(
    props.quarantine,
    "render GC quarantine",
  );
  if (inside(props.snapshot.base.real, quarantine.real) === false)
    throw new Error("Render GC quarantine escapes its ownership root.");
  const isolated = path.resolve(props.isolated);
  if (
    path.dirname(isolated) !== quarantine.path ||
    inside(quarantine.real, isolated) === false
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
    moved = captureRenderGcTarget(props.snapshot.base.real, isolated);
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
    const restoration = restoreUnexpectedSuccessor(
      props.snapshot,
      moved,
      movedQuarantine,
    );
    throw new Error(
      restoration === "restored"
        ? `Render GC target "${props.snapshot.target}" changed at quarantine; its successor was restored and not deleted.`
        : restoration === "restored-unverified"
          ? `Render GC target "${props.snapshot.target}" changed at quarantine; restoration could not be verified and no deletion was attempted.`
          : `Render GC target "${props.snapshot.target}" changed at quarantine; its successor was preserved at "${isolated}" and not deleted.`,
    );
  }
  assertRenderGcTarget(moved);
  assertPhysicalDirectory(movedQuarantine, "render GC quarantine");
  fs.rmSync(isolated, {
    force: true,
    recursive: moved.kind === "directory",
  });
};

const restoreUnexpectedSuccessor = (
  expected: IRenderGcTargetSnapshot,
  moved: IRenderGcTargetSnapshot,
  quarantine: IRenderGcPhysicalDirectory,
): "preserved" | "restored" | "restored-unverified" => {
  try {
    fs.lstatSync(expected.target);
    return "preserved";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") return "preserved";
  }
  let restored = false;
  try {
    assertRenderGcTarget(moved);
    assertPhysicalDirectory(quarantine, "render GC quarantine");
    fs.renameSync(moved.target, expected.target);
    restored = true;
    const resident = captureRenderGcTarget(expected.base.real, expected.target);
    return resident.targetIdentity === moved.targetIdentity &&
      resident.contentFingerprint === moved.contentFingerprint
      ? "restored"
      : "restored-unverified";
  } catch {
    return restored ? "restored-unverified" : "preserved";
  }
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
  const relative = path.relative(base.real, absolute);
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(`Render GC target "${target}" escapes renderer ownership.`);
  const ancestry: IRenderGcPhysicalDirectory[] = [];
  let cursor = base.real;
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
  const targetIdentity = physicalIdentity(status);
  let entries: IContentEntry[];
  let kind: "directory" | "file";
  if (status.isFile()) {
    kind = "file";
    entries = [readFileEntry(base, absolute, "")];
  } else {
    if (status.isDirectory() === false)
      throw new Error(`Render GC target "${absolute}" is not physical.`);
    kind = "directory";
    entries = captureTree(base, absolute);
  }
  for (const identity of ancestry)
    assertPhysicalDirectory(identity, "render GC target ancestry");
  assertRootIdentity(base);
  const contentFingerprint = digestAutoMovieBytes(
    Buffer.from(JSON.stringify(entries)),
  );
  const namespaceFingerprint = digestAutoMovieBytes(
    Buffer.from(
      JSON.stringify({
        ancestry: ancestry.map((identity) => ({
          path: path.relative(base.real, identity.real).replaceAll("\\", "/"),
          version: identity.version,
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
    kind,
    namespaceFingerprint,
    target: absolute,
    targetIdentity,
  };
};

const captureTree = (
  base: IRenderGcPhysicalDirectory,
  root: string,
): IContentEntry[] => {
  const entries: IContentEntry[] = [];
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
      else if (status.isFile())
        entries.push(readFileEntry(base, absolute, child));
      else throw new Error(`Render GC content "${absolute}" is not physical.`);
    }
    assertPhysicalDirectory(identity, "render GC content directory");
  };
  visit(root, "");
  return entries;
};

const readFileEntry = (
  base: IRenderGcPhysicalDirectory,
  file: string,
  relative: string,
): IContentEntry => {
  const linked = fs.lstatSync(file, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error(`Render GC content "${file}" is not one physical file.`);
  const version = physicalVersion(linked);
  const bytes = Buffer.from(
    readAutoMovieProductionOwnedFile({
      root: base.real,
      directory: path.dirname(file),
      relative: path.basename(file),
    }),
  );
  const resident = fs.lstatSync(file, { bigint: true });
  if (
    resident.isSymbolicLink() ||
    resident.isFile() === false ||
    physicalVersion(resident) !== version
  )
    throw new Error(`Render GC content "${file}" changed while read.`);
  return {
    bytes: bytes.length,
    digest: digestAutoMovieBytes(bytes),
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
    status.ino !== linked.ino ||
    version !== physicalVersion(linked)
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
