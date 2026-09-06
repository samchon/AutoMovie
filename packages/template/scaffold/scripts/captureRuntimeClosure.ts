import type { IAutoMovieCaptureRuntimeIdentity } from "@automovie/interface";
import {
  canonicalizeAutoMovieJson,
  digestAutoMovieBytes,
  parseAutoMovieStructuredJson,
} from "@automovie/production";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import {
  type IRuntimePackageSnapshot,
  assertRuntimePackageSnapshotCurrent,
  snapshotRuntimePackage,
} from "./runtimePackageSnapshot";

export type IProductionCaptureRuntimeClosureIdentity =
  IAutoMovieCaptureRuntimeIdentity["runtimeClosure"];

export interface IProductionCaptureRuntimeClosureSnapshot {
  identity: IProductionCaptureRuntimeClosureIdentity;
  assertCurrent: () => void;
}

interface IPhysicalDirectory {
  identity: string;
  path: string;
  real: string;
  version: string;
}

interface IPhysicalFile {
  digest: `sha256:${string}`;
  identity: string;
  path: string;
  relative: string;
  size: number;
}

interface IPhysicalTreeSnapshot {
  contentDigest: `sha256:${string}`;
  directories: IPhysicalDirectory[];
  files: IPhysicalFile[];
  root: IPhysicalDirectory;
}

interface IResolvedPackageSnapshot {
  entry: string;
  dependencies: string[];
  snapshot: IRuntimePackageSnapshot;
}

const compare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/**
 * Snapshot every installed byte reachable from the capture entry packages.
 *
 * Package manifests discover their own dependency graph, while each package's
 * complete physical tree (apart from the separately traversed `node_modules`
 * namespace) prevents a new dynamic chunk or browser asset from falling
 * outside the identity merely because a handwritten import scanner missed it.
 */
export const snapshotProductionCaptureRuntimeClosure = (props: {
  browserSupport:
    | {
        source: "package-owned" | "configured-executable";
        root: string;
      }
    | { source: "system-channel" };
  packageEntries: readonly { entry: string; package: string }[];
}): IProductionCaptureRuntimeClosureSnapshot => {
  const packages = snapshotPackageGraph(props.packageEntries);
  const browserTree =
    props.browserSupport.source === "system-channel"
      ? null
      : snapshotPhysicalTree(props.browserSupport.root);
  const packageIdentity = packages
    .map(({ snapshot }) => ({
      package: snapshot.package,
      version: snapshot.version,
      contentDigest: snapshot.contentFingerprint,
      files: snapshot.closure.length,
      bytes: snapshot.assets.reduce(
        (sum, asset) => sum + asset.bytes.length,
        0,
      ),
    }))
    .sort((left, right) =>
      compare(
        `${left.package}\0${left.version}\0${left.contentDigest}`,
        `${right.package}\0${right.version}\0${right.contentDigest}`,
      ),
    );
  let browserSupport: IProductionCaptureRuntimeClosureIdentity["browserSupport"];
  if (browserTree === null)
    browserSupport = {
      status: "system-channel-unsealed",
      source: "system-channel",
    };
  else {
    if (props.browserSupport.source === "system-channel")
      throw new Error("A system-channel browser cannot own a support tree.");
    browserSupport = {
      status: "content-sealed",
      source: props.browserSupport.source,
      contentDigest: browserTree.contentDigest,
      files: browserTree.files.length,
      bytes: browserTree.files.reduce((sum, file) => sum + file.size, 0),
    };
  }
  const contentDigest = digestAutoMovieBytes(
    Buffer.from(
      canonicalizeAutoMovieJson({
        protocolVersion: "automovie.capture-runtime-closure.v1",
        packages: packageIdentity,
        browserSupport,
      }),
      "utf8",
    ),
  );
  const identity: IProductionCaptureRuntimeClosureIdentity = {
    protocolVersion: "automovie.capture-runtime-closure.v1",
    contentDigest,
    packages: packageIdentity,
    browserSupport,
  };
  const assertCurrent = (): void => {
    for (const entry of packages) {
      assertRuntimePackageSnapshotCurrent(entry.snapshot);
      for (const dependency of entry.dependencies) {
        const resolved = resolvePackageEntry(entry.snapshot.root, dependency);
        const expected = packages.find(
          (candidate) =>
            candidate.snapshot.package === dependency &&
            candidate.entry === resolved,
        );
        if (expected === undefined)
          throw new Error(
            `Installed capture dependency "${dependency}" changed its resolved package generation. Restart with the current installation.`,
          );
      }
    }
    if (browserTree !== null) assertPhysicalTreeCurrent(browserTree);
  };
  assertCurrent();
  return { identity, assertCurrent };
};

const snapshotPackageGraph = (
  roots: readonly { entry: string; package: string }[],
): IResolvedPackageSnapshot[] => {
  const output: IResolvedPackageSnapshot[] = [];
  const pending = roots.map((root) => ({
    entry: path.resolve(root.entry),
    package: root.package,
  }));
  const visited = new Set<string>();
  while (pending.length !== 0) {
    const current = pending.shift()!;
    const initial = snapshotRuntimePackage({
      entry: current.entry,
      packageName: current.package,
    });
    const key = initial.root;
    if (visited.has(key)) {
      assertRuntimePackageSnapshotCurrent(initial);
      continue;
    }
    visited.add(key);
    const selections = packageSelections(initial.root);
    const snapshot = snapshotRuntimePackage({
      assets: selections,
      entry: current.entry,
      packageName: current.package,
    });
    if (
      packageSelectionNames(snapshot.root).join("\0") !==
      selections.map((selection) => selection.relative).join("\0")
    )
      throw new Error(
        `Installed capture package "${current.package}" changed its top-level inventory while it was sealed.`,
      );
    const manifest = snapshot.assets.find(
      (asset) => asset.path === "package.json",
    );
    if (manifest === undefined)
      throw new Error(
        `Installed capture package "${current.package}" has no captured manifest.`,
      );
    const parsed = parseAutoMovieStructuredJson({
      record: "capture-package-manifest",
      bytes: manifest.bytes,
    }) as {
      dependencies?: Record<string, unknown>;
      optionalDependencies?: Record<string, unknown>;
    };
    const dependencies = [
      ...new Set([
        ...dependencyNames(parsed.dependencies),
        ...dependencyNames(parsed.optionalDependencies),
      ]),
    ].sort(compare);
    const resolvedDependencies: string[] = [];
    for (const dependency of dependencies)
      try {
        const entry = resolvePackageEntry(snapshot.root, dependency);
        resolvedDependencies.push(dependency);
        pending.push({ entry, package: dependency });
      } catch (error) {
        if (dependencyNames(parsed.dependencies).includes(dependency))
          throw error;
      }
    output.push({
      entry: path.resolve(current.entry),
      dependencies: resolvedDependencies,
      snapshot,
    });
    assertRuntimePackageSnapshotCurrent(snapshot);
  }
  return output;
};

const dependencyNames = (
  value: Record<string, unknown> | undefined,
): string[] =>
  value === undefined
    ? []
    : Object.entries(value)
        .filter(
          ([name, version]) =>
            name.trim().length !== 0 && typeof version === "string",
        )
        .map(([name]) => name)
        .sort(compare);

const packageSelections = (
  root: string,
): Array<{ kind: "file" | "tree"; relative: string }> =>
  packageSelectionNames(root).map((relative) => {
    const status = fs.lstatSync(path.join(root, relative));
    if (status.isSymbolicLink())
      throw new Error(
        `Installed capture package entry "${path.join(root, relative)}" is linked. Reinstall a physical package tree.`,
      );
    if (status.isFile()) return { kind: "file", relative };
    if (status.isDirectory()) return { kind: "tree", relative };
    throw new Error(
      `Installed capture package entry "${path.join(root, relative)}" is neither a file nor a directory.`,
    );
  });

const packageSelectionNames = (root: string): string[] =>
  fs
    .readdirSync(root)
    .filter((name) => name !== "node_modules")
    .sort(compare);

const resolvePackageEntry = (root: string, packageName: string): string => {
  const resolver = createRequireFromRoot(root);
  try {
    return fs.realpathSync(resolver.resolve(packageName));
  } catch (error) {
    try {
      return fs.realpathSync(resolver.resolve(`${packageName}/package.json`));
    } catch {
      throw error;
    }
  }
};

const createRequireFromRoot = (root: string): NodeRequire => {
  return createRequire(path.join(root, "package.json"));
};

/** Snapshot a complete physical support-file tree without retaining handles. */
const snapshotPhysicalTree = (directory: string): IPhysicalTreeSnapshot => {
  const root = physicalDirectory(directory, "capture support root");
  const directories: IPhysicalDirectory[] = [];
  const files: IPhysicalFile[] = [];
  const visit = (current: string): void => {
    const observed = physicalDirectory(current, "capture support directory");
    if (inside(root.real, observed.real) === false)
      throw new Error("Capture support directory escapes its physical root.");
    directories.push(observed);
    for (const name of fs.readdirSync(observed.real).sort(compare)) {
      const target = path.join(observed.real, name);
      const status = fs.lstatSync(target, { bigint: true });
      if (status.isSymbolicLink())
        throw new Error(`Capture support entry "${target}" is linked.`);
      if (status.isDirectory()) visit(target);
      else if (status.isFile()) {
        const captured = readPhysicalFile(target);
        files.push({
          digest: digestAutoMovieBytes(captured.bytes),
          identity: physicalVersion(captured.status),
          path: target,
          relative: path.relative(root.real, target).replaceAll("\\", "/"),
          size: captured.bytes.length,
        });
      } else
        throw new Error(`Capture support entry "${target}" is not physical.`);
    }
    assertPhysicalDirectoryCurrent(observed, "capture support directory");
  };
  visit(root.real);
  const contentDigest = digestAutoMovieBytes(
    Buffer.from(
      canonicalizeAutoMovieJson(
        files.map((file) => ({ path: file.relative, digest: file.digest })),
      ),
      "utf8",
    ),
  );
  const snapshot = { contentDigest, directories, files, root };
  assertPhysicalTreeCurrent(snapshot);
  return snapshot;
};

const assertPhysicalTreeCurrent = (snapshot: IPhysicalTreeSnapshot): void => {
  for (const directory of snapshot.directories)
    assertPhysicalDirectoryCurrent(directory, "capture support directory");
  for (const file of snapshot.files) {
    const status = fs.lstatSync(file.path, { bigint: true });
    if (
      status.isSymbolicLink() ||
      status.isFile() === false ||
      physicalVersion(status) !== file.identity
    )
      throw new Error(
        `Capture support file "${file.relative}" changed physical generation. Restart with the current installation.`,
      );
  }
  const currentFiles: string[] = [];
  const visit = (current: string): void => {
    for (const name of fs.readdirSync(current).sort(compare)) {
      const target = path.join(current, name);
      const status = fs.lstatSync(target);
      if (status.isSymbolicLink())
        throw new Error(`Capture support entry "${target}" is linked.`);
      if (status.isDirectory()) visit(target);
      else if (status.isFile())
        currentFiles.push(
          path.relative(snapshot.root.real, target).replaceAll("\\", "/"),
        );
      else
        throw new Error(`Capture support entry "${target}" is not physical.`);
    }
  };
  visit(snapshot.root.real);
  if (
    currentFiles.sort(compare).join("\0") !==
    snapshot.files
      .map((file) => file.relative)
      .sort(compare)
      .join("\0")
  )
    throw new Error(
      "Capture support tree changed exact inventory. Restart with the current installation.",
    );
};

const readPhysicalFile = (
  file: string,
): { bytes: Buffer; status: fs.BigIntStats } => {
  const linked = fs.lstatSync(file, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error(`Capture support file "${file}" is not physical.`);
  const descriptor = fs.openSync(file, "r");
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (opened.isFile() === false)
      throw new Error(`Capture support file "${file}" is not physical.`);
    const bytes = readDescriptorBytes(descriptor, opened.size);
    const confirmed = fs.fstatSync(descriptor, { bigint: true });
    const repeated = readDescriptorBytes(descriptor, confirmed.size);
    const resident = fs.lstatSync(file, { bigint: true });
    const residentDescriptor = fs.openSync(file, "r");
    let reopened: fs.BigIntStats;
    try {
      reopened = fs.fstatSync(residentDescriptor, { bigint: true });
    } finally {
      fs.closeSync(residentDescriptor);
    }
    if (
      resident.isSymbolicLink() ||
      resident.isFile() === false ||
      physicalVersion(resident) !== physicalVersion(linked) ||
      physicalVersion(confirmed) !== physicalVersion(opened) ||
      reopened.dev !== confirmed.dev ||
      reopened.ino !== confirmed.ino ||
      bytes.equals(repeated) === false ||
      repeated.length !== Number(confirmed.size)
    )
      throw new Error(`Capture support file "${file}" changed while read.`);
    return { bytes: repeated, status: resident };
  } finally {
    fs.closeSync(descriptor);
  }
};

const readDescriptorBytes = (descriptor: number, size: bigint): Buffer => {
  if (size > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Capture support file exceeds the addressable byte range.");
  const bytes = Buffer.alloc(Number(size));
  let position = 0;
  while (position < bytes.length) {
    const length = fs.readSync(
      descriptor,
      bytes,
      position,
      bytes.length - position,
      position,
    );
    if (length === 0)
      throw new Error("Capture support file read stalled before its end.");
    position += length;
  }
  return bytes;
};

const physicalDirectory = (
  directory: string,
  label: string,
): IPhysicalDirectory => {
  const namespacePath = path.resolve(directory);
  const linked = fs.lstatSync(namespacePath, { bigint: true });
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(`${label} "${namespacePath}" is not physical.`);
  const real = fs.realpathSync(namespacePath);
  const status = fs.statSync(real, { bigint: true });
  if (
    status.isDirectory() === false ||
    status.dev !== linked.dev ||
    status.ino !== linked.ino ||
    physicalVersion(status) !== physicalVersion(linked)
  )
    throw new Error(`${label} "${namespacePath}" changed while resolved.`);
  return {
    identity: `${status.dev}\0${status.ino}`,
    path: namespacePath,
    real,
    version: physicalVersion(status),
  };
};

const assertPhysicalDirectoryCurrent = (
  expected: IPhysicalDirectory,
  label: string,
): void => {
  const current = physicalDirectory(expected.path, label);
  if (
    current.identity !== expected.identity ||
    current.real !== expected.real ||
    current.version !== expected.version
  )
    throw new Error(
      `${label} "${expected.path}" changed physical generation. Restart with the current installation.`,
    );
};

const physicalVersion = (status: fs.BigIntStats): string =>
  `${status.dev}\0${status.ino}\0${status.size}\0${status.mtimeNs}\0${status.ctimeNs}`;

const inside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (path.isAbsolute(relative) === false &&
      relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false)
  );
};
