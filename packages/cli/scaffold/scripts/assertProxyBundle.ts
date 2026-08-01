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
}

interface IPhysicalFile {
  device: string;
  inode: string;
  path: string;
  relative: string;
}

/** Verify one immutable proxy publication against its exact expected files. */
export const assertPublishedProxyBundle = (
  target: string,
  expected: ReadonlyMap<string, Uint8Array>,
): void => {
  const root = physicalDirectory(target, "proxy bundle");
  const actual = physicalFiles(root);
  const actualByPath = new Map(actual.map((file) => [file.relative, file]));
  if (
    actual.length !== expected.size ||
    actual.some((file) => expected.has(file.relative) === false)
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
    assertPhysicalFile(observed);
    const resident = Buffer.from(
      readAutoMovieProductionOwnedFile({
        root: root.real,
        directory: path.dirname(file),
        relative: path.basename(file),
      }),
    );
    assertPhysicalFile(observed);
    assertPhysicalDirectory(root, "proxy bundle");
    if (
      resident.length !== bytes.length ||
      digestAutoMovieBytes(resident) !== digestAutoMovieBytes(bytes)
    )
      throw new Error(
        `Proxy bundle file "${relative}" changed resident bytes.`,
      );
  }
  assertPhysicalDirectory(root, "proxy bundle");
};

const physicalFiles = (root: IPhysicalDirectory): IPhysicalFile[] => {
  const output: IPhysicalFile[] = [];
  const visit = (directory: string): void => {
    const identity = physicalDirectory(directory, "proxy bundle directory");
    if (inside(root.real, identity.real) === false)
      throw new Error(
        `Proxy bundle directory "${directory}" escapes its physical root.`,
      );
    for (const name of fs
      .readdirSync(identity.real)
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))) {
      const file = path.join(identity.real, name);
      const status = fs.lstatSync(file, { bigint: true });
      if (status.isSymbolicLink())
        throw new Error(`Proxy bundle refuses linked entry "${file}".`);
      if (status.isDirectory()) visit(file);
      else if (status.isFile())
        output.push({
          device: status.dev.toString(),
          inode: status.ino.toString(),
          path: file,
          relative: path.relative(root.real, file).replaceAll("\\", "/"),
        });
      else throw new Error(`Proxy bundle entry "${file}" is not physical.`);
    }
    assertPhysicalDirectory(identity, "proxy bundle directory");
  };
  visit(root.real);
  assertPhysicalDirectory(root, "proxy bundle");
  return output;
};

const assertPhysicalFile = (expected: IPhysicalFile): void => {
  const current = fs.lstatSync(expected.path, { bigint: true });
  if (
    current.isSymbolicLink() ||
    current.isFile() === false ||
    current.dev.toString() !== expected.device ||
    current.ino.toString() !== expected.inode
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
  if (
    status.isDirectory() === false ||
    status.dev !== linked.dev ||
    status.ino !== linked.ino
  )
    throw new Error(`${label} "${namespacePath}" changed while resolved.`);
  return {
    device: status.dev.toString(),
    inode: status.ino.toString(),
    path: namespacePath,
    real,
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
    current.real !== expected.real
  )
    throw new Error(`${label} "${expected.path}" changed physical identity.`);
};

const inside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (path.isAbsolute(relative) === false &&
      relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false)
  );
};
