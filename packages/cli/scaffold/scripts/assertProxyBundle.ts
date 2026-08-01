import {
  digestAutoMovieBytes,
  readAutoMovieProductionOwnedFile,
} from "@automovie/mcp";
import fs from "node:fs";
import path from "node:path";

interface IPhysicalDirectory {
  device: string;
  inode: string;
  path: string;
  real: string;
  version: string;
}

interface IPhysicalFile {
  identity: string;
  path: string;
  relative: string;
}

interface IBundleDirectory {
  identity: IPhysicalDirectory;
  relative: string;
}

interface IPhysicalBundle {
  directories: IBundleDirectory[];
  files: IPhysicalFile[];
}

/** Verify one immutable proxy publication against its exact expected files. */
export const assertPublishedProxyBundle = (
  target: string,
  expected: ReadonlyMap<string, Uint8Array>,
): void => {
  const root = physicalDirectory(target, "proxy bundle");
  const bundle = physicalBundle(root);
  const actualByPath = new Map(
    bundle.files.map((file) => [file.relative, file]),
  );
  if (
    bundle.files.length !== expected.size ||
    bundle.files.some((file) => expected.has(file.relative) === false)
  )
    throw new Error(
      `Proxy bundle "${target}" has an unexpected file inventory.`,
    );
  for (const [relative, bytes] of expected) {
    const observed = actualByPath.get(relative)!;
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
      throw new Error(`Proxy bundle file "${relative}" is not relative.`);
    const file = path.join(root.real, ...segments);
    assertBundleIdentities(bundle);
    const resident = Buffer.from(
      readAutoMovieProductionOwnedFile({
        root: root.real,
        directory: path.dirname(file),
        relative: path.basename(file),
      }),
    );
    assertPhysicalFile(observed);
    assertBundleIdentities(bundle);
    if (
      resident.length !== bytes.length ||
      digestAutoMovieBytes(resident) !== digestAutoMovieBytes(bytes)
    )
      throw new Error(
        `Proxy bundle file "${relative}" changed resident bytes.`,
      );
  }
  assertExactBundle(root, bundle);
};

const physicalBundle = (root: IPhysicalDirectory): IPhysicalBundle => {
  const directories: IBundleDirectory[] = [];
  const files: IPhysicalFile[] = [];
  const visit = (directory: string): void => {
    const identity = physicalDirectory(directory, "proxy bundle directory");
    if (inside(root.real, identity.real) === false)
      throw new Error(
        `Proxy bundle directory "${directory}" escapes its physical root.`,
      );
    directories.push({
      identity,
      relative: path.relative(root.real, identity.real).replaceAll("\\", "/"),
    });
    for (const name of fs
      .readdirSync(identity.real)
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))) {
      const file = path.join(identity.real, name);
      const status = fs.lstatSync(file, { bigint: true });
      if (status.isSymbolicLink())
        throw new Error(`Proxy bundle refuses linked entry "${file}".`);
      if (status.isDirectory()) visit(file);
      else if (status.isFile())
        files.push({
          identity: physicalVersion(status),
          path: file,
          relative: path.relative(root.real, file).replaceAll("\\", "/"),
        });
      else throw new Error(`Proxy bundle entry "${file}" is not physical.`);
    }
    assertPhysicalDirectory(identity, "proxy bundle directory");
  };
  visit(root.real);
  assertPhysicalDirectory(root, "proxy bundle");
  return { directories, files };
};

const assertBundleIdentities = (bundle: IPhysicalBundle): void => {
  for (const directory of bundle.directories)
    assertPhysicalDirectory(directory.identity, "proxy bundle directory");
  for (const file of bundle.files) assertPhysicalFile(file);
};

const assertExactBundle = (
  root: IPhysicalDirectory,
  expected: IPhysicalBundle,
): void => {
  assertBundleIdentities(expected);
  const current = physicalBundle(root);
  if (bundleFingerprint(current) !== bundleFingerprint(expected))
    throw new Error(`Proxy bundle "${root.path}" changed exact inventory.`);
  assertBundleIdentities(expected);
};

const bundleFingerprint = (bundle: IPhysicalBundle): string =>
  JSON.stringify({
    directories: bundle.directories.map((directory) => ({
      identity: directory.identity.version,
      relative: directory.relative,
    })),
    files: bundle.files.map((file) => ({
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
      `Proxy bundle file "${expected.relative}" changed physical identity.`,
    );
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
  const linkedVersion = physicalVersion(linked);
  const statusVersion = physicalVersion(status);
  if (
    status.isDirectory() === false ||
    status.dev !== linked.dev ||
    status.ino !== linked.ino ||
    statusVersion !== linkedVersion
  )
    throw new Error(`${label} "${namespacePath}" changed while resolved.`);
  return {
    device: status.dev.toString(),
    inode: status.ino.toString(),
    path: namespacePath,
    real,
    version: statusVersion,
  };
};

const assertPhysicalDirectory = (
  expected: IPhysicalDirectory,
  label: string,
): void => {
  const current = physicalDirectory(expected.path, label);
  if (
    current.device !== expected.device ||
    current.inode !== expected.inode ||
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
