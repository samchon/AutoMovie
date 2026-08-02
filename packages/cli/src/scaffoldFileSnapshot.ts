import * as fs from "node:fs";
import * as path from "node:path";

export interface IScaffoldPhysicalDirectory {
  identity: string;
  path: string;
  real: string;
}

interface IScaffoldFileSnapshot {
  identity: string;
  path: string;
  version: string;
}

/**
 * Create or capture one ordinary scaffold base without following a linked
 * parent.
 */
export const ensureScaffoldBaseDirectory = (
  directory: string,
): IScaffoldPhysicalDirectory => {
  const absolute = path.resolve(directory);
  const missing: string[] = [];
  let cursor = absolute;
  let ownership: IScaffoldPhysicalDirectory;
  while (true) {
    try {
      ownership = captureScaffoldPhysicalDirectory(cursor);
      break;
    } catch (error) {
      if (missingPath(error) === false) throw error;
      missing.unshift(cursor);
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      cursor = parent;
    }
  }
  for (const target of missing) {
    assertScaffoldPhysicalDirectory(ownership);
    fs.mkdirSync(target);
    assertScaffoldPhysicalDirectory(ownership);
    ownership = captureEmptyScaffoldPhysicalDirectory(target);
  }
  return ownership;
};

/**
 * Capture one ordinary physical directory without accepting symlinks or
 * junctions.
 */
export const captureScaffoldPhysicalDirectory = (
  directory: string,
): IScaffoldPhysicalDirectory => {
  const absolute = path.resolve(directory);
  const status = fs.lstatSync(absolute, { bigint: true });
  if (status.isSymbolicLink() || status.isDirectory() === false)
    throw new Error(
      `scaffold directory is not one ordinary directory: ${absolute}`,
    );
  return {
    identity: physicalIdentity(status),
    path: absolute,
    real: path.resolve(fs.realpathSync.native(absolute)),
  };
};

/** Revalidate one captured scaffold directory generation. */
export const assertScaffoldPhysicalDirectory = (
  ownership: IScaffoldPhysicalDirectory,
): void => {
  const current = captureScaffoldPhysicalDirectory(ownership.path);
  if (
    current.identity !== ownership.identity ||
    current.real !== ownership.real
  )
    throw new Error(`scaffold directory changed generation: ${ownership.path}`);
};

const captureEmptyScaffoldPhysicalDirectory = (
  directory: string,
): IScaffoldPhysicalDirectory => {
  const ownership = captureScaffoldPhysicalDirectory(directory);
  const before = fs.lstatSync(ownership.path, { bigint: true });
  if (physicalIdentity(before) !== ownership.identity)
    throw new Error(`scaffold directory changed generation: ${ownership.path}`);
  const entries = fs.readdirSync(ownership.path);
  const after = fs.lstatSync(ownership.path, { bigint: true });
  if (
    physicalIdentity(after) !== ownership.identity ||
    physicalVersion(after) !== physicalVersion(before)
  )
    throw new Error(
      `scaffold directory changed while inspected: ${ownership.path}`,
    );
  assertScaffoldPhysicalDirectory(ownership);
  if (entries.length !== 0)
    throw new Error(
      `new scaffold directory is unexpectedly non-empty: ${ownership.path}`,
    );
  return ownership;
};

/** Resolve and retain every physical descendant directory needed by one file. */
export const ensureScaffoldFileDirectory = (props: {
  base: IScaffoldPhysicalDirectory;
  cache: Map<string, IScaffoldPhysicalDirectory>;
  directory: string;
}): IScaffoldPhysicalDirectory => {
  const absolute = path.resolve(props.directory);
  const relative = path.relative(props.base.path, absolute);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(`scaffold directory escapes its base: ${absolute}`);
  let current = props.base;
  if (relative.length === 0) return current;
  for (const segment of relative.split(path.sep)) {
    const target = path.join(current.path, segment);
    assertScaffoldPhysicalDirectory(props.base);
    assertScaffoldPhysicalDirectory(current);
    let child = props.cache.get(target);
    if (child === undefined) {
      try {
        child = captureScaffoldPhysicalDirectory(target);
      } catch (error) {
        if (missingPath(error) === false) throw error;
        assertScaffoldPhysicalDirectory(props.base);
        assertScaffoldPhysicalDirectory(current);
        fs.mkdirSync(target);
        assertScaffoldPhysicalDirectory(props.base);
        assertScaffoldPhysicalDirectory(current);
        child = captureEmptyScaffoldPhysicalDirectory(target);
      }
      if (inside(props.base.real, child.real) === false)
        throw new Error(
          `scaffold directory escapes its physical base: ${target}`,
        );
      props.cache.set(target, child);
    } else assertScaffoldPhysicalDirectory(child);
    current = child;
  }
  return current;
};

/**
 * Create or explicitly overwrite one exact final file through its bound
 * descriptor.
 */
export const writeScaffoldFile = (props: {
  base: IScaffoldPhysicalDirectory;
  bytes: Uint8Array;
  force: boolean;
  parent: IScaffoldPhysicalDirectory;
  target: string;
}): void => {
  const absolute = path.resolve(props.target);
  if (path.dirname(absolute) !== props.parent.path)
    throw new Error(`scaffold file changed declared parent: ${absolute}`);
  assertScaffoldOwnership(props.base, props.parent);
  if (props.force) {
    let existing: IScaffoldFileSnapshot | null;
    try {
      existing = captureScaffoldFile(absolute);
    } catch (error) {
      if (missingPath(error) === false) throw error;
      existing = null;
    }
    if (existing !== null) {
      overwriteScaffoldFile({ ...props, existing });
      return;
    }
  }
  createScaffoldFile(props);
};

const createScaffoldFile = (props: {
  base: IScaffoldPhysicalDirectory;
  bytes: Uint8Array;
  parent: IScaffoldPhysicalDirectory;
  target: string;
}): void => {
  const descriptor = fs.openSync(props.target, "wx+");
  let failed = false;
  let completedSnapshot: IScaffoldFileSnapshot | null = null;
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    assertOrdinarySingleLinkFile(opened, props.target);
    assertScaffoldOwnership(props.base, props.parent);
    assertScaffoldFileMatches(captureScaffoldFile(props.target), opened);
    writeScaffoldDescriptor(descriptor, props.target, props.bytes);
    const completed = fs.fstatSync(descriptor, { bigint: true });
    if (completed.size !== BigInt(props.bytes.byteLength))
      throw new Error(`scaffold file changed final size: ${props.target}`);
    assertScaffoldFileMatches(captureScaffoldFile(props.target), completed);
    assertScaffoldDescriptorBytes(descriptor, props.target, props.bytes);
    const finalStatus = fs.fstatSync(descriptor, { bigint: true });
    completedSnapshot = captureScaffoldFile(props.target);
    assertScaffoldFileMatches(completedSnapshot, finalStatus);
    assertScaffoldOwnership(props.base, props.parent);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    closeScaffoldDescriptor(descriptor, failed);
  }
  assertScaffoldFileSnapshot(completedSnapshot!);
  assertScaffoldOwnership(props.base, props.parent);
};

const overwriteScaffoldFile = (props: {
  base: IScaffoldPhysicalDirectory;
  bytes: Uint8Array;
  existing: IScaffoldFileSnapshot;
  parent: IScaffoldPhysicalDirectory;
  target: string;
}): void => {
  const descriptor = fs.openSync(props.target, "r+");
  let failed = false;
  let completedSnapshot: IScaffoldFileSnapshot | null = null;
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    assertOrdinarySingleLinkFile(opened, props.target);
    if (
      physicalIdentity(opened) !== props.existing.identity ||
      physicalVersion(opened) !== props.existing.version
    )
      throw new Error(
        `scaffold file changed before force write: ${props.target}`,
      );
    assertScaffoldOwnership(props.base, props.parent);
    assertScaffoldFileMatches(captureScaffoldFile(props.target), opened);
    fs.ftruncateSync(descriptor, 0);
    writeScaffoldDescriptor(descriptor, props.target, props.bytes);
    const completed = fs.fstatSync(descriptor, { bigint: true });
    if (completed.size !== BigInt(props.bytes.byteLength))
      throw new Error(`scaffold file changed final size: ${props.target}`);
    assertScaffoldFileMatches(captureScaffoldFile(props.target), completed);
    assertScaffoldDescriptorBytes(descriptor, props.target, props.bytes);
    const finalStatus = fs.fstatSync(descriptor, { bigint: true });
    completedSnapshot = captureScaffoldFile(props.target);
    assertScaffoldFileMatches(completedSnapshot, finalStatus);
    assertScaffoldOwnership(props.base, props.parent);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    closeScaffoldDescriptor(descriptor, failed);
  }
  assertScaffoldFileSnapshot(completedSnapshot!);
  assertScaffoldOwnership(props.base, props.parent);
};

const captureScaffoldFile = (file: string): IScaffoldFileSnapshot => {
  const absolute = path.resolve(file);
  const status = fs.lstatSync(absolute, { bigint: true });
  assertOrdinarySingleLinkFile(status, absolute);
  return {
    identity: physicalIdentity(status),
    path: absolute,
    version: physicalVersion(status),
  };
};

const assertScaffoldFileMatches = (
  snapshot: IScaffoldFileSnapshot,
  status: fs.BigIntStats,
): void => {
  if (
    snapshot.identity !== physicalIdentity(status) ||
    snapshot.version !== physicalVersion(status)
  )
    throw new Error(`scaffold file changed generation: ${snapshot.path}`);
};

const assertScaffoldFileSnapshot = (snapshot: IScaffoldFileSnapshot): void => {
  const current = captureScaffoldFile(snapshot.path);
  if (
    current.identity !== snapshot.identity ||
    current.version !== snapshot.version
  )
    throw new Error(
      `scaffold file changed after descriptor close: ${snapshot.path}`,
    );
};

const assertOrdinarySingleLinkFile = (
  status: fs.BigIntStats,
  file: string,
): void => {
  if (
    status.isSymbolicLink() ||
    status.isFile() === false ||
    status.nlink !== 1n
  )
    throw new Error(
      `scaffold file is not one ordinary single-link file: ${file}`,
    );
};

const assertScaffoldOwnership = (
  base: IScaffoldPhysicalDirectory,
  parent: IScaffoldPhysicalDirectory,
): void => {
  assertScaffoldPhysicalDirectory(base);
  assertScaffoldPhysicalDirectory(parent);
  if (inside(base.real, parent.real) === false)
    throw new Error(
      `scaffold file parent escapes its physical base: ${parent.path}`,
    );
};

const writeScaffoldDescriptor = (
  descriptor: number,
  target: string,
  bytes: Uint8Array,
): void => {
  const source = Buffer.from(bytes);
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
      throw new Error(`scaffold file stopped while written: ${target}`);
    offset += written;
  }
  fs.fsyncSync(descriptor);
  assertScaffoldDescriptorBytes(descriptor, target, source);
};

const assertScaffoldDescriptorBytes = (
  descriptor: number,
  target: string,
  bytes: Uint8Array,
): void => {
  const source = Buffer.from(bytes);
  const readback = Buffer.alloc(source.length);
  let offset = 0;
  while (offset < readback.length) {
    const read = fs.readSync(
      descriptor,
      readback,
      offset,
      readback.length - offset,
      offset,
    );
    if (read === 0)
      throw new Error(`scaffold file stopped during readback: ${target}`);
    offset += read;
  }
  if (readback.equals(source) === false)
    throw new Error(`scaffold file changed during readback: ${target}`);
};

const closeScaffoldDescriptor = (descriptor: number, failed: boolean): void => {
  try {
    fs.closeSync(descriptor);
  } catch (error) {
    if (failed === false) throw error;
  }
};

const physicalIdentity = (status: fs.BigIntStats): string =>
  `${status.dev}:${status.ino}`;

const physicalVersion = (status: fs.BigIntStats): string =>
  `${physicalIdentity(status)}:${status.size}:${status.mtimeNs}:${status.ctimeNs}`;

const inside = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return (
    relative.length === 0 ||
    (relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false &&
      path.isAbsolute(relative) === false)
  );
};

const missingPath = (error: unknown): boolean =>
  (error as NodeJS.ErrnoException).code === "ENOENT" ||
  (error as NodeJS.ErrnoException).code === "ENOTDIR";
