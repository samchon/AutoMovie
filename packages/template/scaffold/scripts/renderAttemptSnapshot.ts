import type { AutoMovieContentDigest } from "@automovie/interface";
import {
  type AutoMovieLocalProcessOwnerObservation,
  type IAutoMovieLocalProcessOwner,
  compareCodeUnits,
  isAutoMovieLocalProcessOwner,
} from "@automovie/production";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcTargetSnapshot,
  RENDER_GC_REMOVAL_STAGING_DIRECTORY,
  assertRenderPhysicalDirectoryIdentity,
  captureRenderGcTarget,
  captureRenderPhysicalDirectory,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
  readCapturedRenderGcFile,
  removeCapturedRenderGcTarget,
} from "./renderGcSnapshot";
import { observeRenderOwnerRecovery } from "./renderOwnerState";

const RENDER_ATTEMPT_JSON_MAX_BYTES = 64 * 1024;

/** One attempt record authenticated by the random token of its held lock. */
export interface IRenderAttemptRecord {
  version: 2;
  slot: string;
  chunk: AutoMovieContentDigest;
  state: "running" | "failed";
  correction: string;
  owner: IAutoMovieLocalProcessOwner;
  token: string;
}

/** Exact resident attempt pathname and the validated record it contained. */
export interface IRenderAttemptSnapshot {
  record: IRenderAttemptRecord;
  snapshot: IRenderGcTargetSnapshot;
}

/** Exact held chunk-lock generation authorizing attempt mutation. */
export interface IRenderAttemptLockOwner {
  chunk: AutoMovieContentDigest;
  owner: IAutoMovieLocalProcessOwner;
  snapshot: IRenderGcTargetSnapshot;
  token: string;
}

/** Attempt state paired with the exact lock generation that owns it. */
export interface IOwnedRenderAttemptSnapshot extends IRenderAttemptSnapshot {
  lock: IRenderAttemptLockOwner;
}

/** Publish a running attempt without replacing another owner or successor. */
export const beginRenderAttempt = (props: {
  base: string;
  chunk: AutoMovieContentDigest;
  lock: IRenderAttemptLockOwner;
  observeProcessOwner: (
    owner: unknown,
  ) => AutoMovieLocalProcessOwnerObservation;
  owner: IAutoMovieLocalProcessOwner;
  slot: string;
  target: string;
  token: string;
}): IOwnedRenderAttemptSnapshot => {
  if (
    props.lock.chunk !== props.chunk ||
    props.observeProcessOwner(props.lock.owner).state !== "same-owner" ||
    props.observeProcessOwner(props.owner).state !== "same-owner" ||
    props.lock.token !== props.token ||
    props.lock.snapshot.base.path !== path.resolve(props.base) ||
    inside(
      path.join(path.resolve(props.base), "locks"),
      props.lock.snapshot.target,
    ) === false
  )
    throw new Error("Render attempt does not match its held chunk lock.");
  const attempts = ensureRenderPhysicalDirectory(props.base, "attempts");
  const base = captureRenderPhysicalDirectory(
    props.base,
    "render attempt root",
  );
  const attemptDirectory = captureRenderPhysicalDirectory(
    attempts,
    "render attempt directory",
  );
  const assertOwnership = (): void => {
    assertRenderPhysicalDirectoryIdentity(base, "render attempt root");
    assertRenderPhysicalDirectoryIdentity(
      attemptDirectory,
      "render attempt directory",
    );
    assertRenderAttemptLockOwner(props.lock);
  };
  assertAttemptTarget(attempts, props.target);
  assertOwnership();
  const existing = captureExistingAttempt(props.base, props.target);
  assertOwnership();
  let predecessor: IRenderGcTargetSnapshot | null = null;
  if (existing !== null) {
    const captured = readRenderAttempt(existing);
    assertOwnership();
    if (captured.record.state === "running") {
      const recovery = observeRenderOwnerRecovery({
        between: () => {
          assertOwnership();
          assertSnapshotCurrent(captured.snapshot);
        },
        observe: props.observeProcessOwner,
        owner: captured.record.owner,
      });
      if (recovery.state !== "reclaimable")
        throw new Error(
          `Render attempt "${props.target}" cannot be replaced because owner ${captured.record.owner.pid} is ${recovery.observation.state}.`,
        );
      assertOwnership();
    }
    predecessor = captured.snapshot;
  }
  const record: IRenderAttemptRecord = {
    version: 2,
    slot: props.slot,
    chunk: props.chunk,
    state: "running",
    correction: "",
    owner: props.owner,
    token: props.token,
  };
  assertRenderAttemptRecord(record);
  const published = publishAttemptRecord({
    assertOwnership,
    base: props.base,
    bytes: renderAttemptBytes(record),
    predecessor,
    target: props.target,
  });
  return { ...published, lock: props.lock };
};

/** Replace only the captured running record with its failed successor. */
export const failRenderAttempt = (props: {
  attempt: IOwnedRenderAttemptSnapshot;
  correction: string;
}): IOwnedRenderAttemptSnapshot => {
  if (props.attempt.record.state !== "running")
    throw new Error("Only a running render attempt can transition to failed.");
  const record: IRenderAttemptRecord = {
    ...props.attempt.record,
    state: "failed",
    correction: props.correction,
  };
  const bytes = renderAttemptBytes(record);
  const directory = captureRenderPhysicalDirectory(
    path.dirname(props.attempt.snapshot.target),
    "render attempt directory",
  );
  const assertOwnership = (): void => {
    assertRenderPhysicalDirectoryIdentity(
      props.attempt.snapshot.base,
      "render attempt root",
    );
    assertRenderPhysicalDirectoryIdentity(
      directory,
      "render attempt directory",
    );
    assertRenderAttemptLockOwner(props.attempt.lock);
  };
  assertOwnership();
  assertCurrentAttempt(props.attempt);
  const published = publishAttemptRecord({
    assertOwnership,
    base: props.attempt.snapshot.base.path,
    bytes,
    predecessor: props.attempt.snapshot,
    target: props.attempt.snapshot.target,
  });
  return { ...published, lock: props.attempt.lock };
};

/** Remove only the exact running attempt captured for a completed render. */
export const completeRenderAttempt = (
  attempt: IOwnedRenderAttemptSnapshot,
): void => {
  if (attempt.record.state !== "running")
    throw new Error("Only a running render attempt can complete.");
  const directory = captureRenderPhysicalDirectory(
    path.dirname(attempt.snapshot.target),
    "render attempt directory",
  );
  const assertOwnership = (): void => {
    assertRenderPhysicalDirectoryIdentity(
      attempt.snapshot.base,
      "render attempt root",
    );
    assertRenderPhysicalDirectoryIdentity(
      directory,
      "render attempt directory",
    );
    assertRenderAttemptLockOwner(attempt.lock);
  };
  assertOwnership();
  assertCurrentAttempt(attempt);
  assertOwnership();
  removeExactAttempt(attempt.snapshot);
};

/** Revalidate the exact lock pathname and owner bytes for an attempt. */
export const assertRenderAttemptLockOwner = (
  lock: IRenderAttemptLockOwner,
): void => {
  const current = captureRenderGcTarget(
    lock.snapshot.base.path,
    lock.snapshot.target,
  );
  if (
    current.targetIdentity !== lock.snapshot.targetIdentity ||
    current.targetVersion !== lock.snapshot.targetVersion ||
    current.contentFingerprint !== lock.snapshot.contentFingerprint
  )
    throw new Error("Render attempt chunk lock changed physical generation.");
  const ownerBytes = readCapturedRenderGcFile(
    lock.snapshot,
    RENDER_ATTEMPT_JSON_MAX_BYTES,
  );
  let owner: unknown;
  try {
    owner = JSON.parse(Buffer.from(ownerBytes).toString("utf8")) as unknown;
  } catch {
    throw new Error("Render attempt chunk lock owner bytes are unreadable.");
  }
  if (
    typeof owner !== "object" ||
    owner === null ||
    Array.isArray(owner) ||
    Object.keys(owner).sort(compareCodeUnits).join(",") !==
      "chunk,owner,token,version" ||
    (owner as { version?: unknown }).version !== 2 ||
    (owner as { chunk?: unknown }).chunk !== lock.chunk ||
    isAutoMovieLocalProcessOwner((owner as { owner?: unknown }).owner) ===
      false ||
    (owner as { owner: IAutoMovieLocalProcessOwner }).owner.host !==
      lock.owner.host ||
    (owner as { owner: IAutoMovieLocalProcessOwner }).owner.pid !==
      lock.owner.pid ||
    (owner as { owner: IAutoMovieLocalProcessOwner }).owner.generation !==
      lock.owner.generation ||
    (owner as { token?: unknown }).token !== lock.token
  )
    throw new Error("Render attempt chunk lock owner bytes changed.");
};

/** Parse one attempt only from the bytes and identity of its captured file. */
export const readRenderAttempt = (
  snapshot: IRenderGcTargetSnapshot,
): IRenderAttemptSnapshot => {
  if (snapshot.kind !== "file")
    throw new Error(`Render attempt "${snapshot.target}" is not a file.`);
  const bytes = readCapturedRenderGcFile(
    snapshot,
    RENDER_ATTEMPT_JSON_MAX_BYTES,
  );
  let record: unknown;
  try {
    record = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  } catch {
    throw new Error("Render attempt record is unreadable.");
  }
  assertRenderAttemptRecord(record);
  return { record, snapshot };
};

/** Inventory validated direct-child attempt records for status reporting. */
export const listRenderAttempts = (
  base: string,
  directory: string,
): IRenderAttemptSnapshot[] => {
  if (fs.existsSync(directory) === false) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.name.endsWith(".json"))
    .sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    )
    .map((entry) =>
      readRenderAttempt(
        captureRenderGcTarget(base, path.join(directory, entry.name)),
      ),
    );
};

const publishAttemptRecord = (props: {
  assertOwnership: () => void;
  base: string;
  bytes: Uint8Array;
  predecessor: IRenderGcTargetSnapshot | null;
  target: string;
}): IRenderAttemptSnapshot => {
  props.assertOwnership();
  props.assertOwnership();
  if (props.predecessor !== null) {
    assertSnapshotCurrent(props.predecessor);
    removeExactAttempt(props.predecessor);
    props.assertOwnership();
  }
  const published = createRenderGcFileSnapshot(
    props.base,
    props.target,
    props.bytes,
  );
  props.assertOwnership();
  return readRenderAttempt(published);
};

const captureExistingAttempt = (
  base: string,
  target: string,
): IRenderGcTargetSnapshot | null => {
  try {
    return captureRenderGcTarget(base, target);
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error as NodeJS.ErrnoException).code === "ENOTDIR"
    )
      return null;
    throw error;
  }
};

const assertCurrentAttempt = (attempt: IRenderAttemptSnapshot): void => {
  const current = readRenderAttempt(
    captureRenderGcTarget(attempt.snapshot.base.path, attempt.snapshot.target),
  );
  if (
    current.snapshot.base.identity !== attempt.snapshot.base.identity ||
    current.snapshot.targetIdentity !== attempt.snapshot.targetIdentity ||
    current.snapshot.targetVersion !== attempt.snapshot.targetVersion ||
    current.snapshot.contentFingerprint !==
      attempt.snapshot.contentFingerprint ||
    current.snapshot.namespaceFingerprint !==
      attempt.snapshot.namespaceFingerprint ||
    current.record.token !== attempt.record.token
  )
    throw new Error(
      `Render attempt "${attempt.snapshot.target}" changed before transition.`,
    );
};

const assertSnapshotCurrent = (snapshot: IRenderGcTargetSnapshot): void => {
  const current = captureRenderGcTarget(snapshot.base.path, snapshot.target);
  if (
    current.base.identity !== snapshot.base.identity ||
    current.targetIdentity !== snapshot.targetIdentity ||
    current.targetVersion !== snapshot.targetVersion ||
    current.contentFingerprint !== snapshot.contentFingerprint ||
    current.namespaceFingerprint !== snapshot.namespaceFingerprint
  )
    throw new Error(`Render attempt "${snapshot.target}" changed ownership.`);
};

const removeExactAttempt = (snapshot: IRenderGcTargetSnapshot): void => {
  const quarantine = ensureRenderPhysicalDirectory(
    snapshot.base.path,
    RENDER_GC_REMOVAL_STAGING_DIRECTORY,
  );
  removeCapturedRenderGcTarget({
    isolated: path.join(quarantine, randomUUID()),
    quarantine,
    snapshot,
  });
};

const renderAttemptBytes = (record: IRenderAttemptRecord): Uint8Array => {
  const bytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, "utf8");
  if (bytes.length > RENDER_ATTEMPT_JSON_MAX_BYTES)
    throw new Error("Render attempt record exceeds its maximum byte length.");
  return bytes;
};

const assertRenderAttemptRecord: (
  value: unknown,
) => asserts value is IRenderAttemptRecord = (value) => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort(compareCodeUnits).join(",") !==
      "chunk,correction,owner,slot,state,token,version" ||
    (value as { version?: unknown }).version !== 2 ||
    typeof (value as { slot?: unknown }).slot !== "string" ||
    (value as { slot: string }).slot.length === 0 ||
    typeof (value as { chunk?: unknown }).chunk !== "string" ||
    /^sha256:[0-9a-f]{64}$/u.test((value as { chunk: string }).chunk) ===
      false ||
    ((value as { state?: unknown }).state !== "running" &&
      (value as { state?: unknown }).state !== "failed") ||
    typeof (value as { correction?: unknown }).correction !== "string" ||
    isAutoMovieLocalProcessOwner((value as { owner?: unknown }).owner) ===
      false ||
    typeof (value as { token?: unknown }).token !== "string" ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      (value as { token: string }).token,
    ) === false ||
    ((value as { state: string }).state === "running" &&
      (value as { correction: string }).correction !== "")
  )
    throw new Error("Render attempt record is malformed or unsupported.");
};

const assertAttemptTarget = (directory: string, target: string): void => {
  if (
    path.dirname(path.resolve(target)) !== path.resolve(directory) ||
    path.extname(target) !== ".json"
  )
    throw new Error(
      `Render attempt target "${target}" must be a direct JSON child.`,
    );
};

const inside = (root: string, candidate: string): boolean => {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    relative.length > 0 &&
    path.isAbsolute(relative) === false &&
    relative !== ".." &&
    relative.startsWith(`..${path.sep}`) === false
  );
};
