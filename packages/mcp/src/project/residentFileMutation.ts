import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

interface IResidentDirectorySnapshot {
  identity: string;
  path: string;
  real: string;
}

interface IResidentMutationAuthority {
  directories: IResidentDirectorySnapshot[];
}

interface IResidentFileSnapshot {
  identity: string;
  path: string;
  version: string;
}

const EVIDENCE_DIRECTORY = ".automovie-resident-evidence";

/**
 * Publish one resident file without replacing a pathname generation that was
 * not used to make the mutation decision.
 */
export const writeResidentFile = (props: {
  assertNamespace: () => void;
  data: Uint8Array | string;
  file: string;
  root: string;
}): void => {
  const authority = ensureResidentMutationAuthority(
    props.root,
    path.dirname(props.file),
    props.assertNamespace,
  );
  assertResidentMutationAuthority(authority, props.assertNamespace);
  const predecessor = captureResidentFileOrNull(props.file);
  let retained:
    | {
        authority: IResidentMutationAuthority;
        snapshot: IResidentFileSnapshot;
      }
    | undefined;
  if (predecessor !== null) {
    const evidenceAuthority = ensureResidentMutationAuthority(
      props.root,
      path.join(props.root, EVIDENCE_DIRECTORY),
      props.assertNamespace,
    );
    assertResidentMutationAuthority(authority, props.assertNamespace);
    assertResidentFileSnapshot(predecessor);
    const evidence = path.join(
      evidenceAuthority.directories.at(-1)!.path,
      `${process.pid}.${randomUUID()}.resident`,
    );
    if (captureResidentPathOrNull(evidence) !== null)
      throw new Error(`resident evidence slot already exists: ${evidence}`);
    fs.renameSync(props.file, evidence);
    assertResidentMutationAuthority(evidenceAuthority, props.assertNamespace);
    const moved = captureResidentFileOrNull(evidence);
    if (moved === null || moved.identity !== predecessor.identity) {
      restoreUnexpectedResidentEvidence({
        authority,
        evidence,
        file: props.file,
        assertNamespace: props.assertNamespace,
      });
      throw new Error(
        `resident file changed while isolated for replacement: ${props.file}`,
      );
    }
    assertResidentMutationAuthority(evidenceAuthority, props.assertNamespace);
    retained = { authority: evidenceAuthority, snapshot: moved };
  }
  createResidentFile({
    authority,
    assertNamespace: props.assertNamespace,
    bytes:
      typeof props.data === "string"
        ? Buffer.from(props.data, "utf8")
        : Buffer.from(props.data),
    file: props.file,
  });
  if (retained !== undefined) {
    assertResidentFileSnapshot(retained.snapshot);
    assertResidentMutationAuthority(retained.authority, props.assertNamespace);
  }
};

/**
 * Remove one exact resident generation from the public namespace while
 * retaining its private evidence instead of unlinking through a stale path.
 */
export const removeResidentFile = (props: {
  assertNamespace: () => void;
  file: string;
  root: string;
}): void => {
  const authority = ensureResidentMutationAuthority(
    props.root,
    path.dirname(props.file),
    props.assertNamespace,
  );
  assertResidentMutationAuthority(authority, props.assertNamespace);
  const predecessor = captureResidentFileOrNull(props.file);
  if (predecessor === null) {
    assertResidentMutationAuthority(authority, props.assertNamespace);
    return;
  }
  const evidenceAuthority = ensureResidentMutationAuthority(
    props.root,
    path.join(props.root, EVIDENCE_DIRECTORY),
    props.assertNamespace,
  );
  assertResidentMutationAuthority(authority, props.assertNamespace);
  assertResidentFileSnapshot(predecessor);
  const evidence = path.join(
    evidenceAuthority.directories.at(-1)!.path,
    `${process.pid}.${randomUUID()}.resident`,
  );
  if (captureResidentPathOrNull(evidence) !== null)
    throw new Error(`resident evidence slot already exists: ${evidence}`);
  fs.renameSync(props.file, evidence);
  assertResidentMutationAuthority(evidenceAuthority, props.assertNamespace);
  const moved = captureResidentFileOrNull(evidence);
  if (moved === null || moved.identity !== predecessor.identity) {
    restoreUnexpectedResidentEvidence({
      authority,
      evidence,
      file: props.file,
      assertNamespace: props.assertNamespace,
    });
    throw new Error(
      `resident file changed while isolated for removal: ${props.file}`,
    );
  }
  assertResidentMutationAuthority(evidenceAuthority, props.assertNamespace);
  const successor = captureResidentPathOrNull(props.file);
  if (successor !== null)
    throw new Error(
      `resident removal preserved a pathname successor: ${props.file}`,
    );
  assertResidentFileSnapshot(moved);
  assertResidentMutationAuthority(authority, props.assertNamespace);
};

const createResidentFile = (props: {
  authority: IResidentMutationAuthority;
  assertNamespace: () => void;
  bytes: Uint8Array;
  file: string;
}): void => {
  const descriptor = fs.openSync(props.file, "wx+");
  let completed: IResidentFileSnapshot | null = null;
  let failed = false;
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    assertOrdinaryResidentFile(opened, props.file);
    assertResidentMutationAuthority(props.authority, props.assertNamespace);
    assertResidentFileMatches(captureResidentFile(props.file), opened);
    writeResidentDescriptor(descriptor, props.file, props.bytes);
    const final = fs.fstatSync(descriptor, { bigint: true });
    if (final.size !== BigInt(props.bytes.byteLength))
      throw new Error(`resident file changed final size: ${props.file}`);
    assertResidentFileMatches(captureResidentFile(props.file), final);
    assertResidentDescriptorBytes(descriptor, props.file, props.bytes);
    const finalStatus = fs.fstatSync(descriptor, { bigint: true });
    if (residentVersion(finalStatus) !== residentVersion(final))
      throw new Error(
        `resident file changed after final readback: ${props.file}`,
      );
    completed = captureResidentFile(props.file);
    assertResidentFileMatches(completed, finalStatus);
    assertResidentMutationAuthority(props.authority, props.assertNamespace);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    closeResidentDescriptor(descriptor, failed);
  }
  assertResidentFileSnapshot(completed!);
  assertResidentMutationAuthority(props.authority, props.assertNamespace);
};

const ensureResidentMutationAuthority = (
  root: string,
  directory: string,
  assertNamespace: () => void,
): IResidentMutationAuthority => {
  const absoluteRoot = path.resolve(root);
  const absoluteDirectory = path.resolve(directory);
  const relative = path.relative(absoluteRoot, absoluteDirectory);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(
      `resident mutation directory escapes the project root: ${absoluteDirectory}`,
    );
  assertNamespace();
  const rootSnapshot = captureResidentDirectory(absoluteRoot);
  const directories = [rootSnapshot];
  let current = rootSnapshot;
  for (const segment of relative.length === 0 ? [] : relative.split(path.sep)) {
    assertResidentDirectorySnapshot(rootSnapshot);
    assertResidentDirectorySnapshot(current);
    const target = path.join(current.path, segment);
    let child: IResidentDirectorySnapshot;
    try {
      child = captureResidentDirectory(target);
    } catch (error) {
      if (missingResidentPath(error) === false) throw error;
      assertNamespace();
      assertResidentDirectorySnapshot(rootSnapshot);
      assertResidentDirectorySnapshot(current);
      fs.mkdirSync(target);
      assertNamespace();
      assertResidentDirectorySnapshot(rootSnapshot);
      assertResidentDirectorySnapshot(current);
      child = captureEmptyResidentDirectory(target);
    }
    if (inside(rootSnapshot.real, child.real) === false)
      throw new Error(
        `resident mutation directory escapes its physical root: ${target}`,
      );
    directories.push(child);
    current = child;
  }
  const authority = { directories };
  assertResidentMutationAuthority(authority, assertNamespace);
  return authority;
};

const captureResidentDirectory = (
  directory: string,
): IResidentDirectorySnapshot => {
  const absolute = path.resolve(directory);
  const status = fs.lstatSync(absolute, { bigint: true });
  if (status.isSymbolicLink() || status.isDirectory() === false)
    throw new Error(`resident mutation directory is not ordinary: ${absolute}`);
  return {
    identity: residentIdentity(status),
    path: absolute,
    real: path.resolve(fs.realpathSync.native(absolute)),
  };
};

const captureEmptyResidentDirectory = (
  directory: string,
): IResidentDirectorySnapshot => {
  const snapshot = captureResidentDirectory(directory);
  const before = fs.lstatSync(snapshot.path, { bigint: true });
  const entries = fs.readdirSync(snapshot.path);
  const after = fs.lstatSync(snapshot.path, { bigint: true });
  if (
    residentIdentity(before) !== snapshot.identity ||
    residentIdentity(after) !== snapshot.identity ||
    residentVersion(after) !== residentVersion(before)
  )
    throw new Error(
      `resident mutation directory changed while inspected: ${snapshot.path}`,
    );
  assertResidentDirectorySnapshot(snapshot);
  if (entries.length !== 0)
    throw new Error(
      `new resident mutation directory is unexpectedly non-empty: ${snapshot.path}`,
    );
  return snapshot;
};

const assertResidentMutationAuthority = (
  authority: IResidentMutationAuthority,
  assertNamespace: () => void,
): void => {
  assertNamespace();
  for (const directory of authority.directories)
    assertResidentDirectorySnapshot(directory);
  assertNamespace();
};

const assertResidentDirectorySnapshot = (
  snapshot: IResidentDirectorySnapshot,
): void => {
  const current = captureResidentDirectory(snapshot.path);
  if (current.identity !== snapshot.identity || current.real !== snapshot.real)
    throw new Error(
      `resident mutation directory changed generation: ${snapshot.path}`,
    );
};

const captureResidentFile = (file: string): IResidentFileSnapshot => {
  const absolute = path.resolve(file);
  const status = fs.lstatSync(absolute, { bigint: true });
  assertOrdinaryResidentFile(status, absolute);
  return {
    identity: residentIdentity(status),
    path: absolute,
    version: residentVersion(status),
  };
};

const captureResidentFileOrNull = (
  file: string,
): IResidentFileSnapshot | null => {
  try {
    return captureResidentFile(file);
  } catch (error) {
    if (missingResidentPath(error)) return null;
    throw error;
  }
};

const captureResidentPathOrNull = (file: string): fs.BigIntStats | null => {
  try {
    return fs.lstatSync(file, { bigint: true });
  } catch (error) {
    if (missingResidentPath(error)) return null;
    throw error;
  }
};

const assertResidentFileSnapshot = (snapshot: IResidentFileSnapshot): void => {
  const current = captureResidentFile(snapshot.path);
  if (
    current.identity !== snapshot.identity ||
    current.version !== snapshot.version
  )
    throw new Error(`resident file changed generation: ${snapshot.path}`);
};

const assertResidentFileMatches = (
  snapshot: IResidentFileSnapshot,
  status: fs.BigIntStats,
): void => {
  if (
    snapshot.identity !== residentIdentity(status) ||
    snapshot.version !== residentVersion(status)
  )
    throw new Error(`resident file changed generation: ${snapshot.path}`);
};

const assertOrdinaryResidentFile = (
  status: fs.BigIntStats,
  file: string,
): void => {
  if (status.isSymbolicLink() || status.isFile() === false)
    throw new Error(`resident file is not ordinary: ${file}`);
};

const writeResidentDescriptor = (
  descriptor: number,
  file: string,
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
      throw new Error(`resident file stopped while written: ${file}`);
    offset += written;
  }
  fs.fsyncSync(descriptor);
  assertResidentDescriptorBytes(descriptor, file, source);
};

const assertResidentDescriptorBytes = (
  descriptor: number,
  file: string,
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
      throw new Error(`resident file stopped during readback: ${file}`);
    offset += read;
  }
  if (readback.equals(source) === false)
    throw new Error(`resident file changed during readback: ${file}`);
};

const closeResidentDescriptor = (descriptor: number, failed: boolean): void => {
  try {
    fs.closeSync(descriptor);
  } catch (error) {
    if (failed === false) throw error;
  }
};

const restoreUnexpectedResidentEvidence = (props: {
  assertNamespace: () => void;
  authority: IResidentMutationAuthority;
  evidence: string;
  file: string;
}): void => {
  try {
    assertResidentMutationAuthority(props.authority, props.assertNamespace);
    fs.linkSync(props.evidence, props.file);
    assertResidentMutationAuthority(props.authority, props.assertNamespace);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") return;
  }
};

const residentIdentity = (status: fs.BigIntStats): string =>
  `${status.dev}:${status.ino}`;

const residentVersion = (status: fs.BigIntStats): string =>
  `${residentIdentity(status)}:${status.size}:${status.mtimeNs}:${status.ctimeNs}`;

const inside = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return (
    relative.length === 0 ||
    (relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false &&
      path.isAbsolute(relative) === false)
  );
};

const missingResidentPath = (error: unknown): boolean =>
  (error as NodeJS.ErrnoException).code === "ENOENT" ||
  (error as NodeJS.ErrnoException).code === "ENOTDIR";
