import { digestAutoMovieBytes } from "@automovie/production";
import fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcPhysicalDirectory,
  type IRenderGcTargetSnapshot,
  assertCapturedRenderGcFileEntry,
  assertCapturedRenderTarget,
  assertRenderPhysicalDirectoryIdentity,
  captureRenderGcTarget,
  captureRenderPhysicalDirectory,
  createRenderGcFileSnapshot,
  readCapturedRenderGcFile,
} from "./renderGcSnapshot";

const DIALOGUE_PCM_MAX_BYTES = 512 * 1024 * 1024;
const DIALOGUE_RECEIPT_MAX_BYTES = 8 * 1024 * 1024;

/** One exact immutable PCM/receipt cache generation. */
export interface IDialogueCacheSnapshot {
  pcm: Uint8Array;
  receipt: Uint8Array;
  snapshot: IRenderGcTargetSnapshot;
}

interface IDialogueCacheOwnership {
  root: IRenderGcPhysicalDirectory;
  target: IRenderGcPhysicalDirectory;
}

/** Capture both cache files from one exact directory generation. */
export const captureDialogueCache = (
  base: string,
  target: string,
): IDialogueCacheSnapshot => {
  const snapshot = captureRenderGcTarget(base, target);
  return readDialogueCache(snapshot);
};

const readDialogueCache = (
  snapshot: IRenderGcTargetSnapshot,
): IDialogueCacheSnapshot => {
  if (snapshot.kind !== "directory")
    throw new Error("Dialogue cache generation is not a physical directory.");
  assertExactInventory(snapshot, undefined);
  const pcm = readCacheFile(snapshot, "audio.f32", DIALOGUE_PCM_MAX_BYTES);
  const receipt = readCacheFile(
    snapshot,
    "receipt.json",
    DIALOGUE_RECEIPT_MAX_BYTES,
  );
  assertCapturedRenderTarget(snapshot);
  return { pcm, receipt, snapshot };
};

/** Capture absence without accepting an incomplete or malformed generation. */
export const captureExistingDialogueCache = (
  base: string,
  target: string,
): IDialogueCacheSnapshot | null => {
  try {
    return captureDialogueCache(base, target);
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error as NodeJS.ErrnoException).code === "ENOTDIR"
    )
      return null;
    throw error;
  }
};

/** Monotonically publish PCM first and its exact receipt last. */
export const publishDialogueCache = (props: {
  base: string;
  pcm: Uint8Array;
  receipt: Uint8Array;
  target: string;
}): IDialogueCacheSnapshot => {
  if (props.pcm.length === 0 || props.pcm.length > DIALOGUE_PCM_MAX_BYTES)
    throw new Error("Dialogue PCM exceeds its supported byte length.");
  if (
    props.receipt.length === 0 ||
    props.receipt.length > DIALOGUE_RECEIPT_MAX_BYTES
  )
    throw new Error("Dialogue receipt exceeds its supported byte length.");
  assertDirectChild(props.base, props.target);
  const root = captureRenderPhysicalDirectory(
    props.base,
    "dialogue cache root",
  );
  const existing = captureExistingTarget(props.base, props.target);
  let incomplete: IRenderGcTargetSnapshot | null = null;
  if (existing !== null) {
    try {
      assertExactInventory(existing, props);
    } catch (error) {
      if (existing.kind !== "directory") throw error;
      assertCapturedRenderTarget(existing);
      incomplete = existing;
    }
    if (incomplete === null) {
      const reused = readDialogueCache(existing);
      assertExpectedBytes(reused, props);
      return reused;
    }
  }
  assertRenderPhysicalDirectoryIdentity(root, "dialogue cache root");
  if (existing === null)
    try {
      fs.mkdirSync(props.target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  const target = captureRenderPhysicalDirectory(
    props.target,
    "dialogue cache generation",
  );
  if (incomplete !== null) {
    if (target.identity !== incomplete.targetIdentity)
      throw new Error("Dialogue cache partial generation changed identity.");
    assertCapturedRenderTarget(incomplete);
  }
  const compatible = captureRenderGcTarget(root.path, target.path);
  if (
    compatible.kind !== "directory" ||
    compatible.targetIdentity !== target.identity
  )
    throw new Error("Dialogue cache generation changed before publication.");
  assertCompatibleInventory(compatible, props);
  const ownership = { root, target };
  assertOwnership(ownership);
  publishCacheFile(ownership, "audio.f32", props.pcm);
  publishCacheFile(ownership, "receipt.json", props.receipt);
  const published = captureDialogueCache(props.base, props.target);
  assertExpectedBytes(published, props);
  assertOwnership(ownership);
  return published;
};

const publishCacheFile = (
  ownership: IDialogueCacheOwnership,
  name: "audio.f32" | "receipt.json",
  bytes: Uint8Array,
): void => {
  const destination = path.join(ownership.target.path, name);
  const existing = captureExistingTarget(ownership.root.path, destination);
  if (existing !== null) {
    assertExpectedFile(existing, bytes, name);
    assertOwnership(ownership);
    return;
  }
  assertOwnership(ownership);
  try {
    const published = createRenderGcFileSnapshot(
      ownership.root.path,
      destination,
      bytes,
    );
    assertExpectedFile(published, bytes, name);
    assertOwnership(ownership);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const winner = captureRenderGcTarget(ownership.root.path, destination);
    assertExpectedFile(winner, bytes, name);
    assertOwnership(ownership);
  }
};

const readCacheFile = (
  directory: IRenderGcTargetSnapshot,
  relative: "audio.f32" | "receipt.json",
  maximumBytes: number,
): Uint8Array => {
  const file = captureRenderGcTarget(
    directory.base.path,
    path.join(directory.target, relative),
  );
  assertCapturedRenderGcFileEntry({ directory, file, relative });
  return readCapturedRenderGcFile(file, maximumBytes);
};

const assertExactInventory = (
  snapshot: IRenderGcTargetSnapshot,
  expected:
    | Pick<Parameters<typeof publishDialogueCache>[0], "pcm" | "receipt">
    | undefined,
): void => {
  assertCompatibleInventory(snapshot, expected);
  if (snapshot.entries.length !== 3)
    throw new Error(
      "Dialogue cache generation has an invalid exact inventory.",
    );
};

const assertCompatibleInventory = (
  snapshot: IRenderGcTargetSnapshot,
  expected:
    | Pick<Parameters<typeof publishDialogueCache>[0], "pcm" | "receipt">
    | undefined,
): void => {
  const facts = new Map<string, Uint8Array | undefined>([
    ["audio.f32", expected?.pcm],
    ["receipt.json", expected?.receipt],
  ]);
  const paths = new Set(snapshot.entries.map((entry) => entry.path));
  if (
    snapshot.kind !== "directory" ||
    (paths.has("receipt.json") && paths.has("audio.f32") === false) ||
    snapshot.entries.some((entry) => {
      if (entry.path === "") return entry.kind !== "directory";
      const bytes = facts.get(entry.path);
      if (facts.has(entry.path) === false || entry.kind !== "file") return true;
      return (
        bytes !== undefined &&
        (entry.bytes !== bytes.length ||
          entry.digest !== digestAutoMovieBytes(bytes))
      );
    })
  )
    throw new Error("Dialogue cache generation has an incompatible inventory.");
  assertCapturedRenderTarget(snapshot);
};

const assertExpectedBytes = (
  snapshot: IDialogueCacheSnapshot,
  expected: Pick<Parameters<typeof publishDialogueCache>[0], "pcm" | "receipt">,
): void => {
  if (
    Buffer.from(snapshot.pcm).equals(expected.pcm) === false ||
    Buffer.from(snapshot.receipt).equals(expected.receipt) === false
  )
    throw new Error("Dialogue cache generation changed expected bytes.");
};

const assertExpectedFile = (
  snapshot: IRenderGcTargetSnapshot,
  bytes: Uint8Array,
  name: string,
): void => {
  if (
    snapshot.kind !== "file" ||
    snapshot.bytes !== bytes.length ||
    snapshot.fileDigest !== digestAutoMovieBytes(bytes)
  )
    throw new Error(`Dialogue cache ${name} differs from expected bytes.`);
  assertCapturedRenderTarget(snapshot);
};

const assertOwnership = (ownership: IDialogueCacheOwnership): void => {
  assertRenderPhysicalDirectoryIdentity(ownership.root, "dialogue cache root");
  assertRenderPhysicalDirectoryIdentity(
    ownership.target,
    "dialogue cache generation",
  );
};

const captureExistingTarget = (
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

const assertDirectChild = (base: string, target: string): void => {
  if (path.dirname(path.resolve(target)) !== path.resolve(base))
    throw new Error("Dialogue cache generation must be a direct child.");
};
