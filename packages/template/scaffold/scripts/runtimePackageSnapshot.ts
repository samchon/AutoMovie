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
/** Capture one package identity and selected runtime bytes as one snapshot. */
export const snapshotRuntimePackage = (props: {
  assets?: readonly RuntimePackageAssetSelection[];
  entry: string;
  entries?: readonly string[];
  moduleClosure?: boolean;
  packageExports?: boolean;
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
  const entryPaths = [
    entry.path,
    ...(props.entries ?? []).map((value) => path.resolve(value)),
    ...(props.packageExports === true
      ? packageExecutableExports(located.root, located.manifest.bytes)
      : []),
  ];
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

const packageExecutableExports = (
  root: IPhysicalDirectory,
  manifest: Buffer,
): string[] => {
  const parsed = JSON.parse(manifest.toString("utf8")) as {
    exports?: unknown;
  };
  const relative = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      if (/^\.\/.*\.(?:cjs|js|mjs|node|wasm)$/iu.test(value))
        relative.add(value.slice(2));
      return;
    }
    if (Array.isArray(value)) {
      for (const member of value) visit(member);
      return;
    }
    if (value !== null && typeof value === "object")
      for (const member of Object.values(value)) visit(member);
  };
  visit(parsed.exports);
  return [...relative].sort(compare).map((value) => ownedPath(root, value));
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

const deriveModuleClosure = (
  root: IPhysicalDirectory,
  entries: readonly string[],
): IPhysicalFile[] => {
  const output = new Map<string, IPhysicalFile>();
  const pending = [...new Set(entries.map((value) => path.resolve(value)))];
  while (pending.length !== 0) {
    const target = pending.pop()!;
    if (output.has(target)) continue;
    const file = readOwnedFile(root, target);
    output.set(file.path, file);
    if (/\.(?:cjs|js|mjs)$/iu.test(file.path) === false) continue;
    const source = file.bytes.toString("utf8");
    for (const specifier of moduleSpecifiers(file.path, source)) {
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

const moduleSpecifiers = (_file: string, source: string): string[] => {
  const tokens = javascriptTokens(source);
  const output = new Set<string>();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    const next = tokens[index + 1];
    if (
      (token.value === "require" || token.value === "import") &&
      tokens[index - 1]?.value !== "." &&
      next?.value === "(" &&
      tokens[index + 2]?.kind === "string" &&
      tokens[index + 3]?.value === ")"
    )
      output.add(tokens[index + 2]!.value);
    else if (
      (token.value === "import" || token.value === "from") &&
      next?.kind === "string"
    )
      output.add(next.value);
    else if (
      token.value === "new" &&
      next?.value === "URL" &&
      tokens[index + 2]?.value === "(" &&
      tokens[index + 3]?.kind === "string" &&
      tokens[index + 4]?.value === "," &&
      tokens[index + 5]?.value === "import" &&
      tokens[index + 6]?.value === "." &&
      tokens[index + 7]?.value === "meta" &&
      tokens[index + 8]?.value === "." &&
      tokens[index + 9]?.value === "url" &&
      tokens[index + 10]?.value === ")"
    )
      output.add(tokens[index + 3]!.value);
  }
  return [...output].sort(compare);
};

interface IJavaScriptToken {
  kind: "identifier" | "punctuation" | "string";
  value: string;
}

/** Tokenize only syntax needed to identify literal module edges. */
const javascriptTokens = (source: string): IJavaScriptToken[] => {
  const output: IJavaScriptToken[] = [];
  let index = 0;
  while (index < source.length) {
    const current = source[index]!;
    const next = source[index + 1];
    if (/\s/u.test(current)) {
      index++;
      continue;
    }
    if (current === "/" && next === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") index++;
      continue;
    }
    if (current === "/" && next === "*") {
      const close = source.indexOf("*/", index + 2);
      index = close === -1 ? source.length : close + 2;
      continue;
    }
    if (current === "`") {
      let value = "";
      let interpolated = false;
      index++;
      while (index < source.length) {
        if (source[index] === "\\" && index + 1 < source.length) {
          index++;
          value += source[index++]!;
        } else if (source[index] === "$" && source[index + 1] === "{") {
          interpolated = true;
          index += 2;
        } else if (source[index++] === "`") break;
        else value += source[index - 1]!;
      }
      if (interpolated === false) output.push({ kind: "string", value });
      continue;
    }
    if (current === '"' || current === "'") {
      const quote = current;
      let value = "";
      index++;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\\" && index + 1 < source.length) {
          index++;
          const escaped = source[index++]!;
          value +=
            escaped === "n"
              ? "\n"
              : escaped === "r"
                ? "\r"
                : escaped === "t"
                  ? "\t"
                  : escaped;
        } else value += source[index++]!;
      }
      if (source[index] === quote) index++;
      output.push({ kind: "string", value });
      continue;
    }
    if (/[A-Za-z_$]/u.test(current)) {
      let value = current;
      index++;
      while (index < source.length && /[\w$]/u.test(source[index]!))
        value += source[index++]!;
      output.push({ kind: "identifier", value });
      continue;
    }
    output.push({ kind: "punctuation", value: current });
    index++;
  }
  return output;
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
  return path.resolve(root.real, ...segments);
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
  const output: ITreeInventory = { directories: [], files: [], root };
  const visit = (current: string): void => {
    const identity = physicalDirectory(
      current,
      "runtime package asset directory",
    );
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
      else
        output.files.push({
          identity: physicalVersion(status),
          path: absolute,
          relative: path.relative(root.real, absolute).replaceAll("\\", "/"),
        });
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

const compare = (x: string, y: string): number =>
  Buffer.compare(Buffer.from(x, "utf8"), Buffer.from(y, "utf8"));
