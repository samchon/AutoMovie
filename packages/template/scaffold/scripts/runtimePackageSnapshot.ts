import {
  digestAutoMovieBytes,
  readAutoMovieProductionOwnedFile,
} from "@automovie/production";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export type RuntimePackageAssetSelection =
  | { kind: "file"; relative: string }
  | { kind: "tree"; relative: string };

export interface IRuntimePackageSnapshot {
  assets: Array<{
    bytes: Buffer;
    digest: `sha256:${string}`;
    path: string;
  }>;
  closure: Array<{
    digest: `sha256:${string}`;
    path: string;
  }>;
  contentFingerprint: `sha256:${string}`;
  entry: string;
  entryDigest: `sha256:${string}`;
  fingerprint: `sha256:${string}`;
  package: string;
  root: string;
  version: string;
}

interface IRuntimePackageObservation {
  files: readonly IPhysicalFile[];
  root: IPhysicalDirectory;
  trees: readonly ITreeInventory[];
}

interface IPhysicalDirectory {
  identity: string;
  path: string;
  real: string;
  version: string;
}

interface IPhysicalFile {
  bytes: Buffer;
  directories: readonly IPhysicalDirectory[];
  identity: string;
  path: string;
}

interface ITreeInventory {
  directories: Array<{ identity: IPhysicalDirectory; relative: string }>;
  files: Array<{ identity: string; path: string; relative: string }>;
  root: IPhysicalDirectory;
}

const observations = new WeakMap<
  IRuntimePackageSnapshot,
  IRuntimePackageObservation
>();
const generationRegistrySymbol = Symbol.for(
  "automovie.runtime-package-generation.v1",
);
const generationRegistry = (() => {
  const owner = globalThis as typeof globalThis & {
    [generationRegistrySymbol]?: Map<string, string>;
  };
  return (owner[generationRegistrySymbol] ??= new Map<string, string>());
})();

/** Capture one package identity and selected runtime bytes as one snapshot. */
export const snapshotRuntimePackage = (props: {
  assets?: readonly RuntimePackageAssetSelection[];
  entry: string;
  entries?: readonly string[];
  moduleClosure?: boolean;
  packageName: string;
}): IRuntimePackageSnapshot => {
  if (
    props.packageName.trim().length === 0 ||
    props.packageName !== props.packageName.trim()
  )
    throw new Error("Runtime package name is invalid.");
  const located = locatePackage(props.entry, props.packageName);
  const entry = readOwnedFile(located.root, path.resolve(props.entry));
  const files = new Map<string, IPhysicalFile>([
    [located.manifest.path, located.manifest],
    [entry.path, entry],
  ]);
  const entryPaths = [entry.path, ...(props.entries ?? []).map(path.resolve)];
  for (const additional of entryPaths.slice(1)) {
    const file = readOwnedFile(located.root, additional);
    files.set(file.path, file);
  }
  if (props.moduleClosure === true)
    for (const file of deriveModuleClosure(located.root, entryPaths))
      files.set(file.path, file);
  const trees: ITreeInventory[] = [];
  const assets = new Map<
    string,
    { bytes: Buffer; digest: `sha256:${string}`; path: string }
  >();
  for (const selection of props.assets ?? []) {
    const selected = ownedPath(located.root, selection.relative);
    if (selection.kind === "file") {
      const file = readOwnedFile(located.root, selected);
      files.set(file.path, file);
      addAsset(assets, located.root, file);
      continue;
    }
    const inventory = scanTree(located.root, selected);
    trees.push(inventory);
    for (const observed of inventory.files) {
      const file = readOwnedFile(located.root, observed.path);
      if (file.identity !== observed.identity)
        throw new Error(
          `Runtime package asset "${observed.relative}" changed after inventory.`,
        );
      files.set(file.path, file);
      addAsset(assets, located.root, file);
    }
    assertTree(located.root, inventory);
  }
  const capturedFiles = [...files.values()].sort((left, right) =>
    compare(left.path, right.path),
  );
  for (const file of capturedFiles) assertPhysicalFile(file);
  for (const tree of trees) assertTree(located.root, tree);
  assertPhysicalDirectory(located.root, "runtime package root");
  const closure = capturedFiles.map((file) => ({
    digest: digestAutoMovieBytes(file.bytes),
    path: path.relative(located.root.real, file.path).replaceAll("\\", "/"),
  }));
  const contentFingerprint = digestAutoMovieBytes(
    Buffer.from(
      JSON.stringify({
        package: props.packageName,
        version: located.version,
        files: closure,
      }),
    ),
  );
  const fingerprint = digestAutoMovieBytes(
    Buffer.from(
      JSON.stringify({
        files: capturedFiles.map((file) => ({
          identity: file.identity,
          path: path
            .relative(located.root.real, file.path)
            .replaceAll("\\", "/"),
        })),
        root: located.root.identity,
        trees: trees.map(treeFingerprint).sort(compare),
      }),
    ),
  );
  const output: IRuntimePackageSnapshot = {
    assets: [...assets.values()].sort((x, y) => compare(x.path, y.path)),
    closure,
    contentFingerprint,
    entry: entry.path,
    entryDigest: digestAutoMovieBytes(entry.bytes),
    fingerprint,
    package: props.packageName,
    root: located.root.real,
    version: located.version,
  };
  observations.set(output, { files: capturedFiles, root: located.root, trees });
  return output;
};

/** Revalidate the exact physical package generation captured by a snapshot. */
export const assertRuntimePackageSnapshotCurrent = (
  snapshot: IRuntimePackageSnapshot,
): void => {
  const observation = observations.get(snapshot);
  if (observation === undefined)
    throw new Error("Runtime package snapshot has no resident observation.");
  for (const file of observation.files) assertPhysicalFile(file);
  for (const tree of observation.trees) assertTree(observation.root, tree);
  assertPhysicalDirectory(observation.root, "runtime package root");
};

/** Bind one Node module cache to the package generation first loaded through it. */
export const bindRuntimePackageSnapshotGeneration = (
  snapshot: IRuntimePackageSnapshot,
): void => {
  assertRuntimePackageSnapshotCurrent(snapshot);
  const key = `${snapshot.package}\0${snapshot.root}`;
  const resident = generationRegistry.get(key);
  if (resident !== undefined && resident !== snapshot.fingerprint)
    throw new Error(
      `Runtime package "${snapshot.package}" changed after its resident module generation was bound. Start a new process with the current installation.`,
    );
  generationRegistry.set(key, snapshot.fingerprint);
};

const deriveModuleClosure = (
  root: IPhysicalDirectory,
  entries: readonly string[],
): IPhysicalFile[] => {
  const output = new Map<string, IPhysicalFile>();
  const pending = [...new Set(entries.map(path.resolve))];
  while (pending.length !== 0) {
    const target = pending.pop()!;
    if (output.has(target)) continue;
    const file = readOwnedFile(root, target);
    output.set(file.path, file);
    if (/\.(?:cjs|js|mjs)$/iu.test(file.path) === false) continue;
    const source = file.bytes.toString("utf8");
    for (const specifier of moduleSpecifiers(source)) {
      if (specifier.startsWith(".") === false) continue;
      const resolved = createRequire(file.path).resolve(specifier);
      if (inside(root.real, resolved) === false)
        throw new Error(
          `Runtime package module "${specifier}" escapes its package root.`,
        );
      pending.push(resolved);
    }
  }
  return [...output.values()];
};

const moduleSpecifiers = (source: string): string[] => {
  const patterns = [
    /\b(?:require|import)\s*\(\s*(["'])([^"']+)\1\s*\)/gu,
    /\bfrom\s*(["'])([^"']+)\1/gu,
    /\bimport\s*(["'])([^"']+)\1/gu,
    /\bnew\s+URL\s*\(\s*(["'])([^"']+)\1\s*,\s*import\.meta\.url\s*\)/gu,
  ];
  const output = new Set<string>();
  for (const pattern of patterns)
    for (const match of source.matchAll(pattern)) output.add(match[2]!);
  return [...output].sort(compare);
};

const locatePackage = (
  entry: string,
  packageName: string,
): {
  manifest: IPhysicalFile;
  root: IPhysicalDirectory;
  version: string;
} => {
  let directory = path.dirname(path.resolve(entry));
  for (;;) {
    const root = physicalDirectory(directory, "runtime package ancestor");
    let manifest: IPhysicalFile | undefined;
    try {
      manifest = readOwnedFile(root, path.join(root.real, "package.json"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      assertPhysicalDirectory(root, "runtime package ancestor");
    }
    if (manifest !== undefined) {
      const parsed = JSON.parse(manifest.bytes.toString("utf8")) as {
        name?: unknown;
        version?: unknown;
      };
      if (parsed.name === packageName) {
        if (
          typeof parsed.version !== "string" ||
          parsed.version.trim().length === 0
        )
          throw new Error(
            `Runtime package "${packageName}" has no valid version.`,
          );
        if (inside(root.real, path.resolve(entry)) === false)
          throw new Error(
            `Runtime package entry for "${packageName}" escapes its root.`,
          );
        assertPhysicalFile(manifest);
        assertPhysicalDirectory(root, "runtime package root");
        return { manifest, root, version: parsed.version };
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory)
      throw new Error(
        `Resolved package "${packageName}" has no matching package.json ancestor.`,
      );
    directory = parent;
  }
};

const ownedPath = (root: IPhysicalDirectory, relative: string): string => {
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
    throw new Error(`Runtime package asset path "${relative}" is invalid.`);
  const absolute = path.resolve(root.real, ...segments);
  if (inside(root.real, absolute) === false)
    throw new Error(`Runtime package asset path "${relative}" escapes.`);
  return absolute;
};

const addAsset = (
  output: Map<
    string,
    { bytes: Buffer; digest: `sha256:${string}`; path: string }
  >,
  root: IPhysicalDirectory,
  file: IPhysicalFile,
): void => {
  const relative = path.relative(root.real, file.path).replaceAll("\\", "/");
  const asset = {
    bytes: file.bytes,
    digest: digestAutoMovieBytes(file.bytes),
    path: relative,
  };
  const prior = output.get(relative);
  if (prior !== undefined && prior.digest !== asset.digest)
    throw new Error(`Runtime package asset "${relative}" is inconsistent.`);
  output.set(relative, asset);
};

const readOwnedFile = (
  root: IPhysicalDirectory,
  file: string,
): IPhysicalFile => {
  assertPhysicalDirectory(root, "runtime package root");
  const absolute = path.resolve(file);
  if (inside(root.real, absolute) === false)
    throw new Error(`Runtime package file "${absolute}" escapes its root.`);
  const owner = path.dirname(absolute);
  const relativeOwner = path.relative(root.real, owner);
  const directories = [root];
  let cursor = root.real;
  for (const segment of relativeOwner.length === 0
    ? []
    : relativeOwner.split(path.sep)) {
    cursor = path.join(cursor, segment);
    const identity = physicalDirectory(cursor, "runtime package ancestry");
    if (inside(root.real, identity.real) === false)
      throw new Error("Runtime package ancestry escapes its physical root.");
    directories.push(identity);
  }
  const linked = fs.lstatSync(absolute, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error(`Runtime package file "${absolute}" is not physical.`);
  const identity = physicalVersion(linked);
  const bytes = Buffer.from(
    readAutoMovieProductionOwnedFile({
      root: root.real,
      directory: owner,
      relative: path.basename(absolute),
    }),
  );
  const resident = fs.lstatSync(absolute, { bigint: true });
  if (
    resident.isSymbolicLink() ||
    resident.isFile() === false ||
    physicalVersion(resident) !== identity
  )
    throw new Error(
      `Runtime package file "${absolute}" changed while its bytes were read.`,
    );
  for (const directory of directories)
    assertPhysicalDirectory(directory, "runtime package ancestry");
  return { bytes, directories, identity, path: absolute };
};

const scanTree = (
  packageRoot: IPhysicalDirectory,
  directory: string,
): ITreeInventory => {
  const root = physicalDirectory(directory, "runtime package asset tree");
  if (inside(packageRoot.real, root.real) === false)
    throw new Error("Runtime package asset tree escapes its package.");
  const output: ITreeInventory = { directories: [], files: [], root };
  const visit = (current: string): void => {
    const identity = physicalDirectory(
      current,
      "runtime package asset directory",
    );
    if (inside(root.real, identity.real) === false)
      throw new Error("Runtime package asset directory escapes its tree.");
    output.directories.push({
      identity,
      relative: path.relative(root.real, identity.real).replaceAll("\\", "/"),
    });
    for (const name of fs.readdirSync(identity.real).sort(compare)) {
      const absolute = path.join(identity.real, name);
      const status = fs.lstatSync(absolute, { bigint: true });
      if (status.isSymbolicLink())
        throw new Error(`Runtime package asset "${absolute}" is linked.`);
      if (status.isDirectory()) visit(absolute);
      else if (status.isFile())
        output.files.push({
          identity: physicalVersion(status),
          path: absolute,
          relative: path.relative(root.real, absolute).replaceAll("\\", "/"),
        });
      else
        throw new Error(`Runtime package asset "${absolute}" is not physical.`);
    }
    assertPhysicalDirectory(identity, "runtime package asset directory");
  };
  visit(root.real);
  assertPhysicalDirectory(packageRoot, "runtime package root");
  return output;
};

const assertTree = (
  packageRoot: IPhysicalDirectory,
  expected: ITreeInventory,
): void => {
  for (const directory of expected.directories)
    assertPhysicalDirectory(
      directory.identity,
      "runtime package asset directory",
    );
  const current = scanTree(packageRoot, expected.root.path);
  if (treeFingerprint(current) !== treeFingerprint(expected))
    throw new Error("Runtime package asset tree changed exact inventory.");
};

const treeFingerprint = (tree: ITreeInventory): string =>
  JSON.stringify({
    directories: tree.directories.map((directory) => ({
      identity: directory.identity.version,
      relative: directory.relative,
    })),
    files: tree.files.map((file) => ({
      identity: file.identity,
      relative: file.relative,
    })),
  });

const assertPhysicalFile = (expected: IPhysicalFile): void => {
  const current = fs.lstatSync(expected.path, { bigint: true });
  if (
    current.isSymbolicLink() ||
    current.isFile() === false ||
    physicalVersion(current) !== expected.identity
  )
    throw new Error(
      `Runtime package file "${expected.path}" changed physical identity.`,
    );
  for (const directory of expected.directories)
    assertPhysicalDirectory(directory, "runtime package ancestry");
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
  const version = physicalVersion(status);
  if (
    status.isDirectory() === false ||
    status.dev !== linked.dev ||
    status.ino !== linked.ino ||
    version !== physicalVersion(linked)
  )
    throw new Error(`${label} "${namespacePath}" changed while resolved.`);
  return {
    identity: `${status.dev}\0${status.ino}`,
    path: namespacePath,
    real,
    version,
  };
};

const assertPhysicalDirectory = (
  expected: IPhysicalDirectory,
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

const compare = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
