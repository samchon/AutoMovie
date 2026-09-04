import type { AutoMovieContentDigest } from "@automovie/interface";
import {
  type AutoMovieLocalProcessOwnerObservation,
  type IAutoMovieLocalProcessOwner,
  type IAutoMovieProductionRenderChunk,
  type IAutoMovieProductionRenderChunkReceipt,
  type IAutoMovieProductionRenderCleanupObservation,
  type IAutoMovieProductionRenderGcCandidate,
  digestAutoMovieBytes,
  probeProductionMedia,
  probeProductionVideoMp4,
} from "@automovie/production";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcTargetSnapshot,
  RENDER_GC_REMOVAL_STAGING_DIRECTORY,
  assertCapturedRenderGcFileEntry,
  assertCapturedRenderTarget,
  captureRenderGcTarget,
  captureRenderPhysicalDirectory,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
  readCapturedRenderGcFile,
  removeCapturedRenderGcTarget,
} from "./renderGcSnapshot";
import { observeRenderOwnerRecovery } from "./renderOwnerState";
import { parseRenderProcessOwnerSuffix } from "./renderProcessOwner";

const CONTENT_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SCOPE_PATTERN = /^[0-9a-f]{64}$/u;

export type RenderChunkPublicationReceipt =
  IAutoMovieProductionRenderChunkReceipt & {
    publication: {
      contentFingerprint: AutoMovieContentDigest;
      scope: string;
      tier: "final" | "proxy";
      tree: string;
      treeIdentity: string;
      version: 1;
    };
  };

export interface IRenderChunkPublicationSnapshot {
  pointer: IRenderGcTargetSnapshot;
  receipt: RenderChunkPublicationReceipt;
  tree: IRenderGcTargetSnapshot;
}

export interface ILoadedRenderChunkPublication {
  encoded: Uint8Array;
  frames: Array<{
    bytes: Uint8Array;
    receipt: IAutoMovieProductionRenderChunkReceipt["frames"][number];
  }>;
  publication: IRenderChunkPublicationSnapshot;
  receipt: RenderChunkPublicationReceipt;
}

export interface ICurrentRenderChunkPublication {
  /** Receipt- and parser-verified chunk MP4, the assembly's input. */
  encoded: Uint8Array;
  frames: ILoadedRenderChunkPublication["frames"];
  receipt: IAutoMovieProductionRenderChunkReceipt;
}

export interface IRenderChunkGcInventoryEntry {
  candidate: IAutoMovieProductionRenderGcCandidate;
  snapshot: IRenderGcTargetSnapshot | null;
}

/** Fingerprint physical-tree content without binding it to inode identities. */
export const renderChunkContentFingerprint = (
  snapshot: IRenderGcTargetSnapshot,
): AutoMovieContentDigest => {
  if (snapshot.kind !== "directory")
    throw new Error(`Render chunk "${snapshot.target}" is not a directory.`);
  return digestAutoMovieBytes(
    Buffer.from(
      JSON.stringify(
        snapshot.entries.map((entry) =>
          entry.kind === "directory"
            ? { kind: entry.kind, path: entry.path }
            : {
                bytes: entry.bytes,
                digest: entry.digest,
                kind: entry.kind,
                path: entry.path,
              },
        ),
      ),
    ),
  );
};

/** Derive the direct-project-root publication pointer for one chunk identity. */
export const renderChunkPublicationPath = (props: {
  chunk: AutoMovieContentDigest;
  root: string;
  scope: string;
  tier: "final" | "proxy";
}): string => {
  assertPublicationIdentity(props);
  return path.join(
    props.root,
    `.automovie-chunk-${props.scope}.${props.tier}.${props.chunk.slice(7)}.publication.json`,
  );
};

/** Publish a completed immutable tree through one descriptor-bound root pointer. */
export const publishRenderChunkSnapshot = (props: {
  chunk: AutoMovieContentDigest;
  receipt: IAutoMovieProductionRenderChunkReceipt;
  root: string;
  scope: string;
  tier: "final" | "proxy";
  tree: IRenderGcTargetSnapshot;
}): { publication: IRenderChunkPublicationSnapshot; reused: boolean } => {
  assertPublicationIdentity(props);
  const tree = props.tree;
  if (tree.kind !== "directory")
    throw new Error(`Render chunk "${tree.target}" is not a directory.`);
  const root = captureRenderPhysicalDirectory(
    props.root,
    "render chunk publication root",
  );
  if (
    tree.base.path !== root.path ||
    tree.base.real !== root.real ||
    tree.base.identity !== root.identity
  )
    throw new Error("Render chunk tree changed publication ownership root.");
  assertCapturedRenderTarget(tree);
  const relativeTree = ownedRelative(tree.base.path, tree.target).replaceAll(
    "\\",
    "/",
  );
  const receiptBytes = Buffer.from(
    `${JSON.stringify(
      {
        ...props.receipt,
        publication: {
          contentFingerprint: renderChunkContentFingerprint(tree),
          scope: props.scope,
          tier: props.tier,
          tree: relativeTree,
          treeIdentity: tree.targetIdentity,
          version: 1,
        },
      } satisfies RenderChunkPublicationReceipt,
      null,
      2,
    )}\n`,
  );
  const receipt = parsePublicationReceipt(receiptBytes);
  if (receipt.chunk !== props.chunk)
    throw new Error("Render chunk receipt and publication identity differ.");
  assertReceiptInventory(tree, receipt);
  assertCapturedRenderTarget(tree);
  const pointerPath = renderChunkPublicationPath(props);
  let pointer: IRenderGcTargetSnapshot;
  try {
    pointer = createRenderGcFileSnapshot(
      tree.base.path,
      pointerPath,
      receiptBytes,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    throw new Error(
      `Render chunk pointer "${pointerPath}" appeared before publication.`,
    );
  }
  try {
    const publication = captureRenderChunkPublication(
      tree.base.path,
      pointerPath,
    );
    if (
      publication.pointer.targetIdentity !== pointer.targetIdentity ||
      publication.tree.targetIdentity !== tree.targetIdentity
    )
      throw new Error(
        `Render chunk pointer "${pointerPath}" changed while published.`,
      );
    assertCapturedRenderTarget(tree);
    return { publication, reused: false };
  } catch (error) {
    removeCapturedRenderChunkPointer(pointer);
    throw error;
  }
};

/** Capture one root pointer and the exact immutable tree authenticated by it. */
export const captureRenderChunkPublication = (
  root: string,
  pointerPath: string,
): IRenderChunkPublicationSnapshot =>
  captureRenderChunkPublicationFromPointer(
    captureRenderGcTarget(root, pointerPath),
  );

/** Resolve one publication only from the exact pointer snapshot already judged. */
export const captureRenderChunkPublicationFromPointer = (
  pointer: IRenderGcTargetSnapshot,
): IRenderChunkPublicationSnapshot => {
  if (pointer.kind !== "file")
    throw new Error(
      `Render chunk pointer "${pointer.target}" is not a regular file.`,
    );
  const receipt = parsePublicationReceipt(
    readCapturedRenderGcFile(pointer, pointer.bytes),
  );
  const expectedPointer = renderChunkPublicationPath({
    chunk: receipt.chunk,
    root: pointer.base.path,
    scope: receipt.publication.scope,
    tier: receipt.publication.tier,
  });
  if (pointer.target !== expectedPointer)
    throw new Error(
      `Render chunk pointer "${pointer.target}" has a mismatched identity.`,
    );
  const tree = captureRenderGcTarget(
    pointer.base.path,
    renderChunkTarget(pointer.base.path, receipt.publication.tree),
  );
  if (
    tree.kind !== "directory" ||
    tree.targetIdentity !== receipt.publication.treeIdentity ||
    renderChunkContentFingerprint(tree) !==
      receipt.publication.contentFingerprint
  )
    throw new Error(
      `Render chunk pointer "${pointer.target}" does not authenticate its tree.`,
    );
  assertReceiptInventory(tree, receipt);
  assertCapturedRenderTarget(pointer);
  assertCapturedRenderTarget(tree);
  return { pointer, receipt, tree };
};

/** Load every receipt-declared frame and MP4 from one captured publication. */
export const loadRenderChunkPublication = (
  root: string,
  pointerPath: string,
): ILoadedRenderChunkPublication =>
  loadCapturedRenderChunkPublication(captureRenderGcTarget(root, pointerPath));

/** Load receipt-declared bytes from the exact pointer snapshot already judged. */
export const loadCapturedRenderChunkPublication = (
  pointer: IRenderGcTargetSnapshot,
): ILoadedRenderChunkPublication => {
  const publication = captureRenderChunkPublicationFromPointer(pointer);
  const frames = publication.receipt.frames.map((receipt) => {
    const bytes = readRenderChunkPublicationFile(publication, receipt.path);
    if (
      bytes.length !== receipt.bytes ||
      digestAutoMovieBytes(bytes) !== receipt.digest
    )
      throw new Error(
        `Render chunk frame "${receipt.path}" differs from its receipt.`,
      );
    return { bytes, receipt };
  });
  const encoded = readRenderChunkPublicationFile(
    publication,
    publication.receipt.encoded.path,
  );
  if (
    encoded.length !== publication.receipt.encoded.bytes ||
    digestAutoMovieBytes(encoded) !== publication.receipt.encoded.digest
  )
    throw new Error("Render chunk MP4 differs from its receipt.");
  assertRenderChunkPublication(publication);
  return {
    encoded,
    frames,
    publication,
    receipt: publication.receipt,
  };
};

/** Apply the real resume/finalize media gate to one exact captured pointer. */
export const loadCurrentRenderChunkPublication = (props: {
  assertReceipt: (receipt: IAutoMovieProductionRenderChunkReceipt) => void;
  chunk: Pick<IAutoMovieProductionRenderChunk, "frames">;
  frameFormat: { fps: number; height: number; width: number };
  pointer: IRenderGcTargetSnapshot;
}): ICurrentRenderChunkPublication | null => {
  const loaded = loadCapturedRenderChunkPublication(props.pointer);
  props.assertReceipt(loaded.receipt);
  for (const frame of loaded.frames) {
    const probe = probeProductionMedia({
      kind: "preview",
      mediaType: "image/png",
      bytes: frame.bytes,
    });
    if (
      probe.kind !== "png" ||
      probe.width !== frame.receipt.width ||
      probe.height !== frame.receipt.height
    )
      return null;
  }
  const video = probeProductionVideoMp4(loaded.encoded);
  if (
    video.kind !== "video" ||
    video.width !== props.frameFormat.width ||
    video.height !== props.frameFormat.height ||
    video.frameCount !== props.chunk.frames.length ||
    Math.abs(video.fps - props.frameFormat.fps) > 1e-9
  )
    return null;
  return {
    encoded: loaded.encoded,
    frames: loaded.frames,
    receipt: loaded.receipt,
  };
};

/** Feed guide publication and final encode from the same verified frame bytes. */
export const consumeCurrentRenderChunkFrames = (
  current: ICurrentRenderChunkPublication,
  consume: (frame: ICurrentRenderChunkPublication["frames"][number]) => void,
): void => {
  for (const frame of current.frames) consume(frame);
};

/** Decide protection from one current pointer and one exact dead-tree candidate. */
export const renderChunkPublicationProtectsTree = (
  publication: IRenderChunkPublicationSnapshot,
  candidate: IRenderGcTargetSnapshot,
): boolean =>
  publication.tree.target === candidate.target &&
  publication.tree.targetIdentity === candidate.targetIdentity;

/** Resolve one dead-tree candidate through its canonical current chunk only. */
export const currentRenderChunkPublicationProtectsTree = (props: {
  candidate: IRenderGcTargetSnapshot;
  candidateName: string;
  capture: (
    chunk: IAutoMovieProductionRenderChunk,
  ) => IRenderChunkPublicationSnapshot | null;
  chunks: ReadonlyMap<AutoMovieContentDigest, IAutoMovieProductionRenderChunk>;
}): boolean => {
  const match = /^([0-9a-f]{64})\.[^.]+\.\d+$/u.exec(props.candidateName);
  if (match === null) return false;
  const digest = `sha256:${match[1]}` as AutoMovieContentDigest;
  const chunk = props.chunks.get(digest);
  if (chunk === undefined) return false;
  try {
    const publication = props.capture(chunk);
    return (
      publication !== null &&
      publication.receipt.chunk === digest &&
      publication.receipt.slot === chunk.slot &&
      renderChunkPublicationProtectsTree(publication, props.candidate)
    );
  } catch {
    // Only the complete exact canonical pointer protects a dead temp tree.
    return false;
  }
};

/** Inventory pointer/tree GC candidates and retain only an exact current pair. */
export const inventoryRenderChunkGarbage = (props: {
  assertReceipt: (
    chunk: IAutoMovieProductionRenderChunk,
    receipt: IAutoMovieProductionRenderChunkReceipt,
  ) => void;
  chunks: ReadonlyMap<AutoMovieContentDigest, IAutoMovieProductionRenderChunk>;
  observeProcessOwner: (
    owner: unknown,
  ) => AutoMovieLocalProcessOwnerObservation;
  renderJobRoot: string;
  root: string;
  scope: string;
  tier: "final" | "proxy";
}): {
  entries: IRenderChunkGcInventoryEntry[];
  retainedChunkPaths: string[];
} => {
  if (SCOPE_PATTERN.test(props.scope) === false)
    throw new Error("Render chunk GC scope is not a SHA-256 namespace.");
  const entries: IRenderChunkGcInventoryEntry[] = [];
  const retainedChunkPaths = new Set<string>();
  const authenticatedTrees = new Map<
    string,
    {
      current: boolean;
      digest: AutoMovieContentDigest;
      observation: IAutoMovieProductionRenderCleanupObservation | null;
      pointerPath: string;
      tree: IRenderGcTargetSnapshot;
    }
  >();
  const unresolvedDigests = new Set<AutoMovieContentDigest>();
  const pointerPattern = new RegExp(
    `^\\.automovie-chunk-${props.scope}\\.${props.tier}\\.([0-9a-f]{64})\\.publication\\.json$`,
    "u",
  );
  for (const name of fs.readdirSync(props.root).sort(compareCodeUnits)) {
    const match = pointerPattern.exec(name);
    if (match === null) continue;
    const digest = `sha256:${match[1]}` as AutoMovieContentDigest;
    const pointerPath = `${props.tier}/pointers/${match[1]}`;
    const pointerTarget = path.join(props.root, name);
    let pointer: IRenderGcTargetSnapshot;
    try {
      pointer = captureRenderGcTarget(props.root, pointerTarget);
    } catch {
      let unsafe = false;
      try {
        unsafe = fs.lstatSync(pointerTarget).isSymbolicLink();
      } catch {
        unsafe = false;
      }
      entries.push({
        candidate: {
          path: pointerPath,
          kind: "chunk-pointer",
          digest,
          bytes: null,
          generation: null,
          observation: {
            state: unsafe ? "unsafe-locator" : "unavailable",
            authority: "none",
            stage: unsafe ? "locator" : "capture",
            reason: unsafe
              ? "the chunk pointer locator is a symbolic link and remains outside automatic cleanup authority"
              : "the chunk pointer generation could not be captured consistently",
          },
        },
        snapshot: null,
      });
      unresolvedDigests.add(digest);
      continue;
    }
    entries.push({
      candidate: {
        path: pointerPath,
        kind: "chunk-pointer",
        digest,
        bytes: pointer.bytes,
        generation: pointer.targetIdentity,
        observation: null,
      },
      snapshot: pointer,
    });
    let publication: IRenderChunkPublicationSnapshot;
    try {
      publication = captureRenderChunkPublicationFromPointer(pointer);
    } catch {
      const candidate = entries.at(-1)!.candidate;
      candidate.observation = {
        state: "integrity-failed",
        authority: "exact-quarantine",
        stage: "receipt",
        reason:
          "the captured chunk pointer did not authenticate one complete receipt-bound tree",
      };
      unresolvedDigests.add(digest);
      continue;
    }
    const temporaryRoot = path.join(props.renderJobRoot, props.tier, "tmp");
    const treeName = path.basename(publication.tree.target);
    const treeIdentity = renderChunkTemporaryTreeIdentity(treeName);
    if (
      path.dirname(publication.tree.target) !== temporaryRoot ||
      treeIdentity === null ||
      treeIdentity.digest !== match[1]
    ) {
      entries.at(-1)!.candidate.observation = {
        state: "unsafe-locator",
        authority: "none",
        stage: "locator",
        reason:
          "the captured chunk pointer names a tree outside its exact digest namespace",
      };
      unresolvedDigests.add(digest);
      continue;
    }
    if (authenticatedTrees.has(publication.tree.target)) {
      entries.at(-1)!.candidate.observation = {
        state: "observation-conflict",
        authority: "none",
        stage: "reference",
        reason:
          "multiple captured chunk pointers claim the same publication tree",
      };
      unresolvedDigests.add(digest);
      continue;
    }
    const chunk = props.chunks.get(digest);
    let current = false;
    let observation: IAutoMovieProductionRenderCleanupObservation | null = {
      state: "verified-stale",
      authority: "exact-remove",
      stage: "currentness",
      reason:
        "the readable receipt-bound chunk generation is not the current plan generation",
    };
    if (chunk !== undefined)
      try {
        props.assertReceipt(chunk, publication.receipt);
        current = publication.receipt.slot === chunk.slot;
      } catch {
        current = false;
      }
    if (current) observation = null;
    else entries.at(-1)!.candidate.observation = observation;
    authenticatedTrees.set(publication.tree.target, {
      current,
      digest,
      observation: current ? null : observation,
      pointerPath,
      tree: publication.tree,
    });
  }
  const temporaryRoot = path.join(props.renderJobRoot, props.tier, "tmp");
  if (fs.existsSync(temporaryRoot))
    for (const entry of fs
      .readdirSync(temporaryRoot, { withFileTypes: true })
      .sort((left, right) => compareCodeUnits(left.name, right.name))) {
      const identity = renderChunkTemporaryTreeIdentity(entry.name);
      if (identity === null) continue;
      const target = path.join(temporaryRoot, entry.name);
      const snapshot = captureRenderGcTarget(props.renderJobRoot, target);
      const authenticated = authenticatedTrees.get(target);
      const digest = `sha256:${identity.digest}` as AutoMovieContentDigest;
      const candidate: IAutoMovieProductionRenderGcCandidate = {
        path: `${props.tier}/tmp/${entry.name}`,
        kind: "chunk-tree",
        digest,
        bytes: snapshot.bytes,
        generation: snapshot.targetIdentity,
        observation:
          authenticated === undefined
            ? unresolvedDigests.has(digest)
              ? {
                  state: "observation-conflict",
                  authority: "none",
                  stage: "reference",
                  reason:
                    "an unresolved pointer shares this digest, so the tree is not proven stale",
                }
              : null
            : exactTreeContent(authenticated.tree, snapshot)
              ? authenticated.observation
              : {
                  state: "observation-conflict",
                  authority: "none",
                  stage: "capture",
                  reason:
                    "the recaptured tree differs from the generation observed through its pointer",
                },
      };
      if (authenticated === undefined && candidate.observation === null) {
        if (
          observeRenderOwnerRecovery({
            between: () => assertCapturedRenderTarget(snapshot),
            observe: props.observeProcessOwner,
            owner: identity.owner,
          }).state !== "reclaimable"
        )
          candidate.observation = {
            state: "foreign-generation",
            authority: "none",
            stage: "ownership",
            reason:
              "the temporary tree owner is not proved reclaimable by this process generation",
          };
        else assertCapturedRenderTarget(snapshot);
      }
      entries.push({ candidate, snapshot });
      if (
        authenticated?.current === true &&
        authenticated.digest === digest &&
        exactTreeContent(authenticated.tree, snapshot)
      ) {
        retainedChunkPaths.add(authenticated.pointerPath);
        retainedChunkPaths.add(candidate.path);
      }
    }
  return {
    entries,
    retainedChunkPaths: [...retainedChunkPaths].sort(compareCodeUnits),
  };
};

const renderChunkTemporaryTreeIdentity = (
  name: string,
): {
  digest: string;
  owner: IAutoMovieLocalProcessOwner;
} | null => {
  const match = /^([0-9a-f]{64})\.([^.]+)\.(.+)$/u.exec(name);
  if (match === null) return null;
  const owner = parseRenderProcessOwnerSuffix(match[3]);
  return owner === null ? null : { digest: match[1], owner };
};

const exactTreeContent = (
  authenticated: IRenderGcTargetSnapshot,
  candidate: IRenderGcTargetSnapshot,
): boolean =>
  authenticated.kind === candidate.kind &&
  authenticated.target === candidate.target &&
  authenticated.targetIdentity === candidate.targetIdentity &&
  authenticated.targetVersion === candidate.targetVersion &&
  authenticated.bytes === candidate.bytes &&
  authenticated.contentFingerprint === candidate.contentFingerprint &&
  JSON.stringify(authenticated.entries) === JSON.stringify(candidate.entries);

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** Read one exact file that belongs to a previously captured chunk tree. */
export const readRenderChunkPublicationFile = (
  publication: IRenderChunkPublicationSnapshot,
  relative: string,
): Uint8Array => {
  const entry = publication.tree.entries.find(
    (candidate) => candidate.path === relative,
  );
  if (entry?.kind !== "file" || entry.bytes === undefined)
    throw new Error(
      `Render chunk file "${relative}" is absent from its publication.`,
    );
  const file = captureRenderGcTarget(
    publication.tree.base.path,
    renderChunkTarget(publication.tree.target, relative),
  );
  assertCapturedRenderGcFileEntry({
    directory: publication.tree,
    file,
    relative,
  });
  return readCapturedRenderGcFile(file, entry.bytes);
};

/** Revalidate the exact pointer and tree after every consumer read succeeds. */
export const assertRenderChunkPublication = (
  publication: IRenderChunkPublicationSnapshot,
): void => {
  assertCapturedRenderTarget(publication.tree);
  assertCapturedRenderTarget(publication.pointer);
};

/** Remove only one exact stale pointer; its immutable tree remains recoverable. */
export const removeRenderChunkPublication = (
  root: string,
  pointerPath: string,
): boolean => {
  let pointer: IRenderGcTargetSnapshot;
  try {
    pointer = captureRenderGcTarget(root, pointerPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  removeCapturedRenderChunkPointer(pointer);
  return true;
};

/** Remove only the exact captured pointer, preserving any pathname successor. */
export const removeCapturedRenderChunkPointer = (
  pointer: IRenderGcTargetSnapshot,
): void => {
  const quarantine = ensureRenderPhysicalDirectory(
    pointer.base.path,
    RENDER_GC_REMOVAL_STAGING_DIRECTORY,
  );
  removeCapturedRenderGcTarget({
    isolated: path.join(quarantine, randomUUID()),
    quarantine,
    snapshot: pointer,
  });
};

const parsePublicationReceipt = (
  bytes: Uint8Array,
): RenderChunkPublicationReceipt => {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  } catch {
    throw new Error("Render chunk pointer has no trustworthy receipt.");
  }
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as { chunk?: unknown }).chunk !== "string" ||
    CONTENT_DIGEST_PATTERN.test((value as { chunk: string }).chunk) === false ||
    typeof (value as { publication?: unknown }).publication !== "object" ||
    (value as { publication: unknown }).publication === null
  )
    throw new Error("Render chunk pointer has no trustworthy receipt.");
  const receipt = value as RenderChunkPublicationReceipt;
  if (
    receipt.publication.version !== 1 ||
    typeof receipt.publication.scope !== "string" ||
    SCOPE_PATTERN.test(receipt.publication.scope) === false ||
    (receipt.publication.tier !== "proxy" &&
      receipt.publication.tier !== "final") ||
    typeof receipt.publication.tree !== "string" ||
    isRenderChunkRelativePath(receipt.publication.tree) === false ||
    typeof receipt.publication.treeIdentity !== "string" ||
    receipt.publication.treeIdentity.length === 0 ||
    CONTENT_DIGEST_PATTERN.test(receipt.publication.contentFingerprint) ===
      false ||
    receipt.version !== 1 ||
    typeof receipt.slot !== "string" ||
    receipt.slot.length === 0 ||
    Array.isArray(receipt.frames) === false ||
    receipt.frames.length === 0 ||
    receipt.frames.every(validFrameReceipt) === false ||
    typeof receipt.encoded !== "object" ||
    receipt.encoded === null ||
    isRenderChunkRelativePath(receipt.encoded.path) === false ||
    CONTENT_DIGEST_PATTERN.test(receipt.encoded.digest) === false ||
    Number.isSafeInteger(receipt.encoded.bytes) === false ||
    receipt.encoded.bytes <= 0
  )
    throw new Error("Render chunk pointer has an invalid receipt.");
  const files = [
    receipt.encoded.path,
    ...receipt.frames.map((frame) => frame.path),
  ];
  if (new Set(files).size !== files.length)
    throw new Error("Render chunk pointer repeats a payload path.");
  return receipt;
};

const validFrameReceipt = (
  value: IAutoMovieProductionRenderChunkReceipt["frames"][number],
): boolean =>
  typeof value === "object" &&
  value !== null &&
  Number.isSafeInteger(value.globalFrame) &&
  value.globalFrame >= 0 &&
  typeof value.path === "string" &&
  isRenderChunkRelativePath(value.path) &&
  typeof value.digest === "string" &&
  CONTENT_DIGEST_PATTERN.test(value.digest) &&
  Number.isSafeInteger(value.bytes) &&
  value.bytes > 0 &&
  Number.isSafeInteger(value.width) &&
  value.width > 0 &&
  Number.isSafeInteger(value.height) &&
  value.height > 0;

const assertReceiptInventory = (
  tree: IRenderGcTargetSnapshot,
  receipt: RenderChunkPublicationReceipt,
): void => {
  const files = new Map<
    string,
    { bytes: number; digest: AutoMovieContentDigest }
  >([[receipt.encoded.path, receipt.encoded]]);
  for (const frame of receipt.frames) files.set(frame.path, frame);
  const directories = new Set([""]);
  for (const relative of files.keys()) {
    const segments = relative.split("/");
    for (let length = 1; length < segments.length; ++length)
      directories.add(segments.slice(0, length).join("/"));
  }
  if (
    tree.entries.length !== files.size + directories.size ||
    tree.entries.some((entry) =>
      entry.kind === "file"
        ? files.has(entry.path) === false ||
          entry.bytes !== files.get(entry.path)!.bytes ||
          entry.digest !== files.get(entry.path)!.digest
        : directories.has(entry.path) === false,
    )
  )
    throw new Error("Render chunk tree differs from its receipt inventory.");
};

const assertPublicationIdentity = (props: {
  chunk: AutoMovieContentDigest;
  scope: string;
  tier: "final" | "proxy";
}): void => {
  if (
    CONTENT_DIGEST_PATTERN.test(props.chunk) === false ||
    SCOPE_PATTERN.test(props.scope) === false ||
    (props.tier !== "proxy" && props.tier !== "final")
  )
    throw new Error("Render chunk publication identity is invalid.");
};

const renderChunkTarget = (root: string, relative: string): string => {
  if (isRenderChunkRelativePath(relative) === false)
    throw new Error(`Render chunk path "${relative}" is invalid.`);
  const normalized = relative.replaceAll("/", path.sep);
  const absolute = path.resolve(root, normalized);
  if (ownedRelative(root, absolute).length === 0)
    throw new Error(`Render chunk path "${relative}" is invalid.`);
  return absolute;
};

const isRenderChunkRelativePath = (relative: unknown): relative is string =>
  typeof relative === "string" &&
  relative.includes("\\") === false &&
  relative.startsWith("/") === false &&
  /^[A-Za-z]:/u.test(relative) === false &&
  relative
    .split("/")
    .every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        segment.includes("\0") === false,
    );

const ownedRelative = (base: string, target: string): string => {
  const relative = path.relative(path.resolve(base), path.resolve(target));
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative) ||
    relative
      .split(path.sep)
      .some(
        (segment) =>
          segment.length === 0 ||
          segment === "." ||
          segment === ".." ||
          segment.includes("\0"),
      )
  )
    throw new Error(
      `Render chunk path "${target}" escapes its ownership root.`,
    );
  return relative;
};
