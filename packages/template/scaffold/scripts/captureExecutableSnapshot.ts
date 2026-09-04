import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export interface ICaptureExecutableSnapshot {
  descriptor: number;
  /** Version read from this descriptor; compare only against another fstat. */
  descriptorVersion: string;
  digest: `sha256:${string}`;
  directory: IPhysicalDirectory;
  identity: string;
  maximumBytes: number | null;
  path: string;
  physicalIdentity: string;
}

interface IPhysicalDirectory {
  identity: string;
  path: string;
  real: string;
  version: string;
}

/** Close a failed acquisition without discarding either failure. */
const throwCaptureExecutableSnapshotFailure = (
  failure: unknown,
  descriptor: number,
  operation: "creation" | "opening",
): never => {
  try {
    fs.closeSync(descriptor);
  } catch (closeFailure) {
    throw new AggregateError(
      [failure, closeFailure],
      `Capture executable snapshot ${operation} and descriptor cleanup failed.`,
    );
  }
  throw failure;
};

/** Create private bytes and retain the exact descriptor opened with `wx+`. */
export const createCaptureExecutableSnapshot = (
  file: string,
  bytes: Uint8Array,
): ICaptureExecutableSnapshot => {
  const namespacePath = path.resolve(file);
  const before = physicalDirectory(
    path.dirname(namespacePath),
    "capture executable directory",
  );
  const descriptor = fs.openSync(namespacePath, "wx+");
  try {
    let position = 0;
    while (position < bytes.length) {
      const length = fs.writeSync(
        descriptor,
        bytes,
        position,
        bytes.length - position,
        position,
      );
      if (length === 0)
        throw new Error(`Capture executable "${namespacePath}" write stalled.`);
      position += length;
    }
    fs.fsyncSync(descriptor);
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (opened.isFile() === false)
      throw new Error(`Capture executable "${namespacePath}" is not physical.`);
    const directory = physicalDirectory(
      path.dirname(namespacePath),
      "capture executable directory",
    );
    if (
      directory.path !== before.path ||
      directory.real !== before.real ||
      directory.identity !== before.identity
    )
      throw new Error(
        `Capture executable directory "${directory.path}" changed while created.`,
      );
    const resident = fs.lstatSync(namespacePath, { bigint: true });
    if (
      resident.isSymbolicLink() ||
      resident.isFile() === false ||
      physicalFileIdentity(resident) !== physicalFileIdentity(opened)
    )
      throw new Error(
        `Capture executable "${namespacePath}" changed while created.`,
      );
    const snapshot: ICaptureExecutableSnapshot = {
      descriptor,
      descriptorVersion: physicalVersion(opened),
      digest: digestDescriptor(descriptor, bytes.length),
      directory,
      identity: physicalVersion(resident),
      maximumBytes: bytes.length,
      path: namespacePath,
      physicalIdentity: physicalFileIdentity(opened),
    };
    assertCaptureExecutable(snapshot);
    return snapshot;
  } catch (error) {
    return throwCaptureExecutableSnapshotFailure(error, descriptor, "creation");
  }
};

/** Open and fingerprint one physical executable for a later launch boundary. */
export const openCaptureExecutable = (
  file: string,
  maximumBytes: number | null = null,
): ICaptureExecutableSnapshot => {
  if (
    maximumBytes !== null &&
    (Number.isSafeInteger(maximumBytes) === false || maximumBytes < 0)
  )
    throw new Error("Capture executable byte limit is invalid.");
  const namespacePath = path.resolve(file);
  const directory = physicalDirectory(
    path.dirname(namespacePath),
    "capture executable directory",
  );
  const linked = fs.lstatSync(namespacePath, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error(
      `Capture executable "${namespacePath}" is not one physical file.`,
    );
  const identity = physicalVersion(linked);
  const descriptor = fs.openSync(namespacePath, "r");
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (
      opened.isFile() === false ||
      physicalFileIdentity(opened) !== physicalFileIdentity(linked)
    )
      throw new Error(
        `Capture executable "${namespacePath}" changed before open.`,
      );
    if (maximumBytes !== null && opened.size > BigInt(maximumBytes))
      throw new Error(
        `Capture executable "${namespacePath}" exceeds its maximum byte length.`,
      );
    const digest = digestDescriptor(descriptor, maximumBytes);
    const completed = fs.fstatSync(descriptor, { bigint: true });
    const descriptorVersion = physicalVersion(opened);
    if (
      completed.isFile() === false ||
      physicalVersion(completed) !== descriptorVersion
    )
      throw new Error(
        `Capture executable "${namespacePath}" changed while hashed.`,
      );
    const snapshot: ICaptureExecutableSnapshot = {
      descriptor,
      descriptorVersion,
      digest,
      directory,
      identity,
      maximumBytes,
      path: namespacePath,
      physicalIdentity: physicalFileIdentity(opened),
    };
    assertCaptureExecutable(snapshot);
    return snapshot;
  } catch (error) {
    return throwCaptureExecutableSnapshotFailure(error, descriptor, "opening");
  }
};

/**
 * What a refusal tells its reader to run, and why the two differ.
 *
 * A refusal that names the wrong command is a wall. `capture:install` downloads
 * and republishes a browser generation and costs minutes; it is the answer when
 * the installed bytes are wrong and the answer to nothing else. When the bytes
 * are provably intact and only the filesystem's stamps moved, the reader has
 * already done everything an install can do, so the only thing left to say is
 * to run the doctor again once the machine stops touching the file.
 */
const REINSTALL_INSTRUCTION =
  "Run npm run capture:install, then npm run capture:doctor.";

const RETRY_INSTRUCTION =
  "The installation itself is intact, so reinstalling changes nothing: wait a few seconds for that activity to finish and run npm run capture:doctor again, without npm run capture:install.";

/**
 * Why an unchanged file reports a changed stamp, measured rather than assumed.
 *
 * `physicalVersion` folds `mtimeNs` and `ctimeNs` in, and neither is a statement
 * about content. Measured on this repository's Windows NTFS target: reading the
 * file through a second handle moves `atimeNs` alone, changing an attribute
 * moves `ctimeNs` alone, and writing an alternate data stream moves `mtimeNs`
 * and `ctimeNs` together while the main stream stays byte-for-byte identical. An
 * in-place rewrite of the same length moves exactly the same two fields, so no
 * comparison of stamps can separate "somebody replaced this executable" from
 * "a virus scanner or a search indexer touched a browser that finished
 * extracting a minute ago", which is the observed cause of a first
 * `capture:doctor` failing and the second succeeding untouched.
 *
 * The digest can separate them, and it is the same claim the refusal makes, so
 * a moved version is settled by rehashing the descriptor that is still open on
 * the captured inode. This never accepts drift: both outcomes still refuse. It
 * decides which of the two refusals is true, so the reader is told to reinstall
 * only when reinstalling is the fix.
 */
const captureExecutableBytesIntact = (
  expected: ICaptureExecutableSnapshot,
): boolean => {
  try {
    return (
      digestDescriptor(expected.descriptor, expected.maximumBytes) ===
      expected.digest
    );
  } catch {
    // A read that cannot complete, or bytes that now overrun the captured
    // maximum, is itself proof that these are no longer the captured bytes.
    return false;
  }
};

/**
 * A refusal that already names the command that answers it.
 *
 * Every caller that wraps one of these adds context, and a wrapper that also
 * appends its own generic remedy puts two contradicting instructions in front
 * of one reader; the launch boundary did exactly that, which is how a browser
 * the machine had merely touched told its author to spend a minute and a half
 * reinstalling. A wrapper tests for this type instead of matching on wording.
 */
export class CaptureExecutableInstructedError extends Error {}

/**
 * A refusal about bytes this project has already proven.
 *
 * Its subject is byte-for-byte the captured file; what moved is the
 * filesystem's stamps, which say nothing about content. That is the shape of a
 * virus scanner or a search indexer reading a browser that finished extracting
 * a minute ago, and such activity is transient by nature: the scan ends.
 *
 * The separation from its parent is not stylistic, because the two readers of
 * these refusals differ. A launch boundary refuses immediately, because it is
 * about to hand an executable to the operating system and waiting would mean
 * launching under an assumption it just declined to make. A diagnostic may
 * wait: its whole job is to answer whether capture is ready, and "run me again"
 * is a question rather than an answer. Callers separate the two by this type,
 * for the same reason the parent states about its own wrappers.
 *
 * {@link observation} is the refusal without its instruction, so a caller that
 * has already waited can say what it observed and then give a different
 * instruction, instead of pasting a second one after the first.
 */
export class CaptureExecutableTouchedError extends CaptureExecutableInstructedError {
  public constructor(
    message: string,
    public readonly observation: string,
  ) {
    super(message);
  }
}

/**
 * What is left to say once waiting has been tried and did not work.
 *
 * Reinstalling is still not the answer; the bytes were proven before the first
 * wait; so the remaining causes are the ones that do not stop on their own.
 */
const PERSISTENT_INSTRUCTION =
  "Exclude this directory from your antivirus and search indexer, or run with AUTOMOVIE_CAPTURE_BROWSER=chrome to use a system channel, then run npm run capture:doctor again.";

export interface ISettledCaptureExecutable<T> {
  /** Acquisitions spent, `1` when nothing was in the way. */
  attempts: number;
  value: T;
  /** Milliseconds spent waiting between them, `0` on a first-attempt success. */
  waitedMs: number;
}

/**
 * Acquire something across ambient filesystem activity, or report that it did
 * not end.
 *
 * This exists because a diagnostic that answers "run me again" has not
 * answered. `capture:doctor` is the first gate a new project meets, one command
 * after `capture:install`, which is exactly when a scanner is most likely to be
 * reading a browser that finished extracting seconds ago; so the transient
 * refusal lands on the reader least equipped to recognize it as transient, and
 * the temptation the message spends a paragraph arguing against is to reinstall.
 *
 * Only {@link CaptureExecutableTouchedError} is waited on, and waiting accepts
 * nothing: that class is only ever constructed after the captured bytes were
 * rehashed and matched, so what is being waited out is the stamps settling, not
 * a verdict softening. Every other failure, including changed bytes, is
 * rethrown on its first appearance.
 *
 * Exhaustion is itself a finding rather than the same refusal repeated. Stamps
 * that keep moving across a bounded wait are continuous activity, which is a
 * different cause with a different remedy, so the last failure is replaced by
 * one that says how long it was given and what to do instead.
 *
 * `wait` is a parameter so a test can measure this without spending the time.
 */
export const settleCaptureExecutableTouch = async <T>(props: {
  acquire: () => Promise<T>;
  attempts: number;
  waitMs: number;
  wait?: (milliseconds: number) => Promise<void>;
}): Promise<ISettledCaptureExecutable<T>> => {
  if (Number.isSafeInteger(props.attempts) === false || props.attempts < 1)
    throw new Error("Capture executable settle attempt count is invalid.");
  if (Number.isSafeInteger(props.waitMs) === false || props.waitMs < 0)
    throw new Error("Capture executable settle wait is invalid.");
  const wait = props.wait ?? delay;
  let waitedMs = 0;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const value = await props.acquire();
      return { attempts: attempt, value, waitedMs };
    } catch (failure) {
      if (failure instanceof CaptureExecutableTouchedError === false)
        throw failure;
      if (attempt >= props.attempts)
        throw Object.assign(
          new CaptureExecutableTouchedError(
            `${failure.observation} Waiting did not help: ${attempt} acquisitions over ${waitedMs} ms each found the stamps moved again, so this activity is continuous rather than the tail of an install. ${PERSISTENT_INSTRUCTION}`,
            failure.observation,
          ),
          { cause: failure },
        );
      await wait(props.waitMs);
      waitedMs += props.waitMs;
    }
  }
};

const changedBytesFailure = (
  expected: ICaptureExecutableSnapshot,
): CaptureExecutableInstructedError =>
  new CaptureExecutableInstructedError(
    `Capture executable "${expected.path}" changed open descriptor bytes. ${REINSTALL_INSTRUCTION}`,
  );

const touchedWhileOpenFailure = (
  expected: ICaptureExecutableSnapshot,
  subject: string,
): CaptureExecutableTouchedError => {
  const observation = `Capture executable ${subject} "${expected.path}" is byte-for-byte the file this project captured, and its filesystem stamps moved while the descriptor stayed open, so something outside this project touched it mid-run; on Windows an antivirus or search indexer scanning a freshly installed browser is the usual cause.`;
  return new CaptureExecutableTouchedError(
    `${observation} ${RETRY_INSTRUCTION}`,
    observation,
  );
};

/** Revalidate the open executable descriptor and its resident pathname. */
export const assertCaptureExecutable = (
  expected: ICaptureExecutableSnapshot,
): void => {
  assertCaptureExecutableDescriptor(expected);
  const resident = fs.lstatSync(expected.path, { bigint: true });
  if (resident.isSymbolicLink() || resident.isFile() === false)
    throw new CaptureExecutableInstructedError(
      `Capture executable "${expected.path}" changed physical identity. Something replaced that path with a link or a non-file. ${REINSTALL_INSTRUCTION}`,
    );
  if (physicalVersion(resident) !== expected.identity) {
    // The descriptor's bytes were just revalidated above, so a pathname whose
    // stamps moved while it still names that exact inode is the same drift the
    // descriptor check classifies, reported one stat later.
    if (physicalFileIdentity(resident) === expected.physicalIdentity)
      throw touchedWhileOpenFailure(expected, "pathname");
    throw new CaptureExecutableInstructedError(
      `Capture executable "${expected.path}" changed physical identity. Another file now occupies that path. ${REINSTALL_INSTRUCTION}`,
    );
  }
  assertPhysicalDirectory(expected.directory, "capture executable directory");
};

/** Revalidate the exact open descriptor bytes without consulting its pathname. */
export const assertCaptureExecutableDescriptor = (
  expected: ICaptureExecutableSnapshot,
): void => {
  const opened = fs.fstatSync(expected.descriptor, { bigint: true });
  if (
    opened.isFile() === false ||
    physicalFileIdentity(opened) !== expected.physicalIdentity
  )
    throw changedBytesFailure(expected);
  if (physicalVersion(opened) === expected.descriptorVersion) return;
  if (captureExecutableBytesIntact(expected) === false)
    throw changedBytesFailure(expected);
  throw touchedWhileOpenFailure(expected, "descriptor");
};

/** Rehash the exact open descriptor when byte-for-byte publication requires it. */
export const assertCaptureExecutableBytes = (
  expected: ICaptureExecutableSnapshot,
): void => {
  assertCaptureExecutableDescriptor(expected);
  if (
    digestDescriptor(expected.descriptor, expected.maximumBytes) !==
    expected.digest
  )
    throw changedBytesFailure(expected);
  const completed = fs.fstatSync(expected.descriptor, { bigint: true });
  if (completed.isFile() === false) throw changedBytesFailure(expected);
  // The rehash above just proved these bytes, so a version that moved during it
  // is the machine touching the file, not the file changing.
  if (physicalVersion(completed) !== expected.descriptorVersion)
    throw touchedWhileOpenFailure(expected, "descriptor");
};

/** Verify that one atomic rename published the same open file at a new path. */
export const assertRelocatedCaptureExecutable = (
  expected: ICaptureExecutableSnapshot,
  file: string,
): void => {
  assertCaptureExecutableBytes(expected);
  const destination = path.resolve(file);
  const directory = physicalDirectory(
    path.dirname(destination),
    "capture executable directory",
  );
  const resident = fs.lstatSync(destination, { bigint: true });
  if (
    directory.path !== expected.directory.path ||
    directory.real !== expected.directory.real ||
    directory.identity !== expected.directory.identity ||
    resident.isSymbolicLink() ||
    resident.isFile() === false ||
    physicalVersion(resident) !== expected.identity
  )
    throw new Error(
      `Capture executable "${expected.path}" was not relocated exactly.`,
    );
};

/** Remove a private staged path only while it still names the captured inode. */
export const removeCaptureExecutableIfResident = (
  expected: ICaptureExecutableSnapshot,
  file = expected.path,
): boolean => {
  try {
    const destination = path.resolve(file);
    const directory = physicalDirectory(
      path.dirname(destination),
      "capture executable directory",
    );
    const resident = fs.lstatSync(destination, { bigint: true });
    if (
      directory.path !== expected.directory.path ||
      directory.real !== expected.directory.real ||
      directory.identity !== expected.directory.identity ||
      resident.isSymbolicLink() ||
      resident.isFile() === false ||
      physicalFileIdentity(resident) !== expected.physicalIdentity
    )
      return false;
    fs.rmSync(destination, { force: true });
    return true;
  } catch {
    return false;
  }
};

/** Close a capture executable snapshot after launch verification. */
export const closeCaptureExecutable = (
  snapshot: ICaptureExecutableSnapshot,
): void => fs.closeSync(snapshot.descriptor);

const digestDescriptor = (
  descriptor: number,
  maximumBytes: number | null = null,
): `sha256:${string}` => {
  const hash = createHash("sha256");
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  let position = 0;
  for (;;) {
    const capacity =
      maximumBytes === null
        ? chunk.length
        : Math.min(chunk.length, maximumBytes - position + 1);
    if (capacity <= 0)
      throw new Error("Capture executable exceeds its maximum byte length.");
    const length = fs.readSync(descriptor, chunk, 0, capacity, position);
    if (length === 0) break;
    hash.update(chunk.subarray(0, length));
    position += length;
    if (maximumBytes !== null && position > maximumBytes)
      throw new Error("Capture executable exceeds its maximum byte length.");
  }
  return `sha256:${hash.digest("hex")}`;
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
    // A directory identity is compared against another pathname stat, including
    // one taken by a different module, so it keeps its device.
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
  if (current.real === expected.real && current.version === expected.version)
    return;
  // A directory's stamps move whenever anything is created or removed inside
  // it, which a quarantine file or an extraction leftover does without the
  // directory ever ceasing to be the one that was captured. That is the same
  // ambient activity the descriptor refusals classify, so it earns the same
  // instruction rather than a reinstall the reader has already performed.
  if (
    current.real === expected.real &&
    current.identity === expected.identity
  ) {
    const observation = `${label} "${expected.path}" changed while this project held its executable open, so something outside this project wrote into it mid-run.`;
    throw new CaptureExecutableTouchedError(
      `${observation} ${RETRY_INSTRUCTION}`,
      observation,
    );
  }
  throw new CaptureExecutableInstructedError(
    `${label} "${expected.path}" changed physical identity. Another directory now occupies that path. ${REINSTALL_INSTRUCTION}`,
  );
};

const physicalVersion = (status: fs.BigIntStats): string =>
  `${status.dev}\0${status.ino}\0${status.size}\0${status.mtimeNs}\0${status.ctimeNs}`;

// A pathname stat and a descriptor stat do not agree on every field: Windows
// reads the volume serial through a different API for each, so one resident,
// unmodified file can report two devices. The file id is what both sources
// agree on, so every cross-source comparison binds by it.
const physicalFileIdentity = (status: fs.BigIntStats): string =>
  `${status.ino}`;
