import type { AutoMovieContentDigest } from "@automovie/mcp";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcTargetSnapshot,
  RENDER_GC_PRESERVED_PREFIX,
  assertRenderPhysicalDirectoryIdentity,
  captureRenderGcTarget,
  captureRenderPhysicalDirectory,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
  readCapturedRenderGcFile,
  removeCapturedRenderGcTarget,
} from "./renderGcSnapshot";

const RENDER_ATTEMPT_JSON_MAX_BYTES = 64 * 1024;

/** One attempt record authenticated by the random token of its held lock. */
export interface IRenderAttemptRecord {
  version: 1;
  slot: string;
  chunk: AutoMovieContentDigest;
  state: "running" | "failed";
  correction: string;
  pid: number;
  token: string;
}

/** Exact resident attempt pathname and the validated record it contained. */
export interface IRenderAttemptSnapshot {
  record: IRenderAttemptRecord;
  snapshot: IRenderGcTargetSnapshot;
}

/** Publish a running attempt without replacing another owner or successor. */
export const beginRenderAttempt = (props: {
  base: string;
  chunk: AutoMovieContentDigest;
  pid: number;
  processAlive: (pid: number) => boolean;
  slot: string;
  target: string;
  token: string;
}): IRenderAttemptSnapshot => {
  const base = captureRenderPhysicalDirectory(
    props.base,
    "render attempt root",
  );
  const attempts = ensureRenderPhysicalDirectory(props.base, "attempts");
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
  };
  assertAttemptTarget(attempts, props.target);
  assertOwnership();
  const existing = captureExistingAttempt(props.base, props.target);
  if (existing !== null) {
    const captured = readRenderAttempt(existing);
    if (captured.record.state === "running") {
      if (props.processAlive(captured.record.pid))
        throw new Error(
          `Render attempt "${props.target}" is still owned by live process ${captured.record.pid}.`,
        );
      assertOwnership();
      if (props.processAlive(captured.record.pid))
        throw new Error(
          `Render attempt "${props.target}" became live during stale recovery.`,
        );
    }
    removeExactAttempt(captured.snapshot);
    assertOwnership();
  }
  const record: IRenderAttemptRecord = {
    version: 1,
    slot: props.slot,
    chunk: props.chunk,
    state: "running",
    correction: "",
    pid: props.pid,
    token: props.token,
  };
  assertRenderAttemptRecord(record);
  const bytes = renderAttemptBytes(record);
  const snapshot = createRenderGcFileSnapshot(props.base, props.target, bytes);
  const captured = readRenderAttempt(snapshot);
  assertOwnership();
  return captured;
};

/** Replace only the captured running record with its failed successor. */
export const failRenderAttempt = (props: {
  attempt: IRenderAttemptSnapshot;
  correction: string;
}): IRenderAttemptSnapshot => {
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
  };
  assertOwnership();
  assertCurrentAttempt(props.attempt);
  removeExactAttempt(props.attempt.snapshot);
  assertOwnership();
  const snapshot = createRenderGcFileSnapshot(
    props.attempt.snapshot.base.path,
    props.attempt.snapshot.target,
    bytes,
  );
  const captured = readRenderAttempt(snapshot);
  assertOwnership();
  return captured;
};

/** Remove only the exact running attempt captured for a completed render. */
export const completeRenderAttempt = (
  attempt: IRenderAttemptSnapshot,
): void => {
  if (attempt.record.state !== "running")
    throw new Error("Only a running render attempt can complete.");
  assertCurrentAttempt(attempt);
  removeExactAttempt(attempt.snapshot);
};

/** Parse one attempt only from the bytes and identity of its captured file. */
export const readRenderAttempt = (
  snapshot: IRenderGcTargetSnapshot,
): IRenderAttemptSnapshot => {
  if (snapshot.kind !== "file")
    throw new Error(`Render attempt "${snapshot.target}" is not a file.`);
  const record = JSON.parse(
    Buffer.from(
      readCapturedRenderGcFile(snapshot, RENDER_ATTEMPT_JSON_MAX_BYTES),
    ).toString("utf8"),
  ) as unknown;
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
    current.snapshot.targetIdentity !== attempt.snapshot.targetIdentity ||
    current.snapshot.targetVersion !== attempt.snapshot.targetVersion ||
    current.snapshot.contentFingerprint !==
      attempt.snapshot.contentFingerprint ||
    current.record.token !== attempt.record.token
  )
    throw new Error(
      `Render attempt "${attempt.snapshot.target}" changed before transition.`,
    );
};

const removeExactAttempt = (snapshot: IRenderGcTargetSnapshot): void => {
  const quarantine = ensureRenderPhysicalDirectory(
    snapshot.base.path,
    `${RENDER_GC_PRESERVED_PREFIX}attempt-${randomUUID()}`,
  );
  try {
    removeCapturedRenderGcTarget({
      isolated: path.join(quarantine, randomUUID()),
      quarantine,
      snapshot,
    });
  } finally {
    if (fs.readdirSync(quarantine).length === 0) fs.rmdirSync(quarantine);
  }
};

const renderAttemptBytes = (record: IRenderAttemptRecord): Uint8Array => {
  const bytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, "utf8");
  if (bytes.length > RENDER_ATTEMPT_JSON_MAX_BYTES)
    throw new Error("Render attempt record exceeds its maximum byte length.");
  return bytes;
};

const assertRenderAttemptRecord = (
  value: unknown,
): asserts value is IRenderAttemptRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !==
      "chunk,correction,pid,slot,state,token,version" ||
    (value as { version?: unknown }).version !== 1 ||
    typeof (value as { slot?: unknown }).slot !== "string" ||
    (value as { slot: string }).slot.length === 0 ||
    typeof (value as { chunk?: unknown }).chunk !== "string" ||
    /^sha256:[0-9a-f]{64}$/u.test((value as { chunk: string }).chunk) ===
      false ||
    ((value as { state?: unknown }).state !== "running" &&
      (value as { state?: unknown }).state !== "failed") ||
    typeof (value as { correction?: unknown }).correction !== "string" ||
    Number.isSafeInteger((value as { pid?: unknown }).pid) === false ||
    ((value as { pid: number }).pid as number) <= 0 ||
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
