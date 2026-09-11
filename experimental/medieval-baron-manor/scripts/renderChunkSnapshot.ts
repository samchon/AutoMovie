import { resolveProductionFrameRate } from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieProductionFrameRate,
  IAutoMovieSemanticMask,
} from "@automovie/interface";
import {
  type AutoMovieLocalProcessOwnerObservation,
  type IAutoMovieLocalProcessOwner,
  type IAutoMovieProductionRenderChunk,
  type IAutoMovieProductionRenderChunkReceipt,
  type IAutoMovieProductionRenderCleanupObservation,
  type IAutoMovieProductionRenderGcCandidate,
  assertProductionVideoProfile,
  digestAutoMovieBytes,
  parseAutoMovieStructuredJson,
  probeProductionMedia,
  probeProductionVideoMp4,
  resolveProductionVideoProfile,
  verifyAutoMovieProductionSemanticMaskReceipt,
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
  for (const semantic of publication.receipt.semanticMasks) {
    const sidecar = readRenderChunkPublicationFile(
      publication,
      semantic.sidecar.path,
    );
    verifyAutoMovieProductionSemanticMaskReceipt({
      receipt: semantic,
      expectedFrame: semantic.frame,
      expectedShot: semantic.shot,
      evidence: {
        version: 1,
        shot: semantic.shot,
        mask: parseAutoMovieStructuredJson({
          record: "semantic-mask-sidecar",
          bytes: sidecar,
        }) as IAutoMovieSemanticMask,
        coverage: semantic.coverage,
      },
      resident: { path: semantic.sidecar.path, bytes: sidecar },
    });
  }
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
  frameFormat: {
    fps: number;
    frameRate?: IAutoMovieProductionFrameRate;
    height: number;
    width: number;
  };
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
  try {
    assertProductionVideoProfile({
      expected: resolveProductionVideoProfile({
        width: props.frameFormat.width,
        height: props.frameFormat.height,
        frameRate: resolveProductionFrameRate(props.frameFormat),
      }),
      actual: video,
    });
  } catch {
    return null;
  }
  if (
    video.width !== props.frameFormat.width ||
    video.height !== props.frameFormat.height ||
    video.frameCount !== props.chunk.frames.length
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

/** Classify one readable receipt without treating current corruption as stale. */
export const renderChunkReceiptObservation = (props: {
  expected: Pick<IAutoMovieProductionRenderChunk, "id" | "slot"> | null;
  receipt: Pick<
    IAutoMovieProductionRenderChunkReceipt,
    "chunk" | "slot" | "version"
  >;
  verified: boolean;
}): IAutoMovieProductionRenderCleanupObservation | null => {
  const identityMatches =
    props.expected !== null &&
    props.receipt.version === 2 &&
    props.receipt.slot === props.expected.slot &&
    props.receipt.chunk === props.expected.id;
  if (identityMatches && props.verified) return null;
  return identityMatches
    ? {
        state: "integrity-failed",
        authority: "exact-quarantine",
        stage: "inventory",
        reason:
          "the current chunk receipt contradicts its declared frame, media, or semantic inventory",
      }
    : {
        state: "verified-stale",
        authority: "exact-remove",
        stage: "currentness",
        reason:
          "the readable receipt-bound chunk generation is not the current plan generation",
      };
};

/** Resolve one dead-tree candidate through its canonical current chunk only. */
export const currentRenderChunkPublicationProtectsTree = (props: {
  candidate: IRenderGcTargetSnapshot;
  candidateName: string;
  capture: (
    chunk: IAutoMovieProductionRenderChunk,
  ) => IRenderChunkPublicationSnapshot | null;
  chunks: ReadonlyMap<AutoMovieContentDigest, IAutoMovieProductionRenderChunk>;
}): boolean => {
  const identity = renderChunkTemporaryTreeIdentity(props.candidateName);
  if (identity === null) return false;
  const digest = `sha256:${identity.digest}` as AutoMovieContentDigest;
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
    // A current pointer that cannot be resolved proves neither absence nor
    // staleness. Preserve every matching tree until explicit GC can report the
    // typed pointer finding and an operator can adjudicate it.
    return true;
  }
};

/** Filesystem, capture, and revalidation seams behind one chunk GC inventory. */
export interface IRenderChunkGcInventorySeams {
  assertCaptured: (snapshot: IRenderGcTargetSnapshot) => void;
  captureTarget: (base: string, target: string) => IRenderGcTargetSnapshot;
  capturePublication: (
    pointer: IRenderGcTargetSnapshot,
  ) => IRenderChunkPublicationSnapshot;
  filesystem: Pick<typeof fs, "existsSync" | "lstatSync" | "readdirSync">;
}

/**
 * Inventory pointer/tree GC candidates and retain only an exact current pair.
 *
 * A current pointer authenticates one tree at capture time. When the later
 * tree scan cannot confirm that exact tree (it changed, could not be recaptured,
 * or is gone), the pair is a changed-during-read observation: the pointer
 * carries an observation conflict rather than falling through to the planner's
 * unreferenced default, which would remove it.
 *
 * One pointer name carries one digest and authenticates only a tree named by
 * that digest, so two pointers of one tier can never claim one tree; the
 * inventory therefore keys authenticated trees by target without a duplicate
 * check.
 */
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
  seams: IRenderChunkGcInventorySeams;
  tier: "final" | "proxy";
}): {
  entries: IRenderChunkGcInventoryEntry[];
  retainedChunkPaths: string[];
} => {
  if (SCOPE_PATTERN.test(props.scope) === false)
    throw new Error("Render chunk GC scope is not a SHA-256 namespace.");
  const seams = props.seams;
  const entries: IRenderChunkGcInventoryEntry[] = [];
  const retainedChunkPaths = new Set<string>();
  const authenticatedTrees = new Map<
    string,
    {
      current: boolean;
      digest: AutoMovieContentDigest;
      observation: IAutoMovieProductionRenderCleanupObservation | null;
      pointer: IAutoMovieProductionRenderGcCandidate;
      pointerPath: string;
      tree: IRenderGcTargetSnapshot;
      visited: boolean;
    }
  >();
  const unresolvedDigests = new Set<AutoMovieContentDigest>();
  const pointerPattern = new RegExp(
    `^\\.automovie-chunk-${props.scope}\\.${props.tier}\\.([0-9a-f]{64})\\.publication\\.json$`,
    "u",
  );
  for (const name of seams.filesystem
    .readdirSync(props.root)
    .sort(compareCodeUnits)) {
    const match = pointerPattern.exec(name);
    if (match === null) continue;
    const digest = `sha256:${match[1]}` as AutoMovieContentDigest;
    const pointerPath = `${props.tier}/pointers/${match[1]}`;
    const pointerTarget = path.join(props.root, name);
    let pointer: IRenderGcTargetSnapshot;
    try {
      pointer = seams.captureTarget(props.root, pointerTarget);
    } catch {
      let unsafe = false;
      try {
        unsafe = seams.filesystem.lstatSync(pointerTarget).isSymbolicLink();
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
          fingerprint: null,
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
    const candidate: IAutoMovieProductionRenderGcCandidate = {
      path: pointerPath,
      kind: "chunk-pointer",
      digest,
      bytes: pointer.bytes,
      generation: pointer.targetIdentity,
      fingerprint: pointer.contentFingerprint,
      observation: null,
    };
    entries.push({ candidate, snapshot: pointer });
    let publication: IRenderChunkPublicationSnapshot;
    try {
      publication = seams.capturePublication(pointer);
    } catch {
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
      candidate.observation = {
        state: "unsafe-locator",
        authority: "none",
        stage: "locator",
        reason:
          "the captured chunk pointer names a tree outside its exact digest namespace",
      };
      unresolvedDigests.add(digest);
      continue;
    }
    const chunk = props.chunks.get(digest);
    let verified = false;
    if (chunk !== undefined) {
      try {
        props.assertReceipt(chunk, publication.receipt);
        verified = true;
      } catch {
        verified = false;
      }
    }
    const observation = renderChunkReceiptObservation({
      expected: chunk ?? null,
      receipt: publication.receipt,
      verified,
    });
    candidate.observation = observation;
    authenticatedTrees.set(publication.tree.target, {
      current: observation === null,
      digest,
      observation,
      pointer: candidate,
      pointerPath,
      tree: publication.tree,
      visited: false,
    });
  }
  const temporaryRoot = path.join(props.renderJobRoot, props.tier, "tmp");
  if (seams.filesystem.existsSync(temporaryRoot))
    for (const entry of seams.filesystem
      .readdirSync(temporaryRoot, { withFileTypes: true })
      .sort((left, right) => compareCodeUnits(left.name, right.name))) {
      const identity = renderChunkTemporaryTreeIdentity(entry.name);
      if (identity === null) continue;
      const target = path.join(temporaryRoot, entry.name);
      const digest = `sha256:${identity.digest}` as AutoMovieContentDigest;
      const authenticated = authenticatedTrees.get(target);
      if (authenticated !== undefined) authenticated.visited = true;
      let snapshot: IRenderGcTargetSnapshot;
      try {
        snapshot = seams.captureTarget(props.renderJobRoot, target);
      } catch {
        const unsafe =
          entry.isSymbolicLink() ||
          (entry.isDirectory() === false && entry.isFile() === false);
        entries.push({
          candidate: {
            path: `${props.tier}/tmp/${entry.name}`,
            kind: "chunk-tree",
            digest,
            bytes: null,
            generation: null,
            fingerprint: null,
            observation: {
              state: unsafe ? "unsafe-locator" : "unavailable",
              authority: "none",
              stage: unsafe ? "locator" : "capture",
              reason: unsafe
                ? "the chunk tree locator is not one physical directory"
                : "the chunk tree generation could not be captured consistently",
            },
          },
          snapshot: null,
        });
        if (authenticated?.current === true)
          authenticated.pointer.observation = {
            state: "observation-conflict",
            authority: "none",
            stage: "capture",
            reason:
              "the tree observed through this current pointer could not be recaptured consistently",
          };
        continue;
      }
      const exact =
        authenticated !== undefined &&
        exactTreeContent(authenticated.tree, snapshot);
      const candidate: IAutoMovieProductionRenderGcCandidate = {
        path: `${props.tier}/tmp/${entry.name}`,
        kind: "chunk-tree",
        digest,
        bytes: snapshot.bytes,
        generation: snapshot.targetIdentity,
        fingerprint: snapshot.contentFingerprint,
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
            : exact
              ? authenticated.observation
              : {
                  state: "observation-conflict",
                  authority: "none",
                  stage: "capture",
                  reason:
                    "the recaptured tree differs from the generation observed through its pointer",
                },
      };
      if (authenticated !== undefined && authenticated.current && !exact)
        authenticated.pointer.observation = {
          state: "observation-conflict",
          authority: "none",
          stage: "capture",
          reason:
            "the tree observed through this current pointer differs from its recaptured generation",
        };
      if (authenticated === undefined && candidate.observation === null) {
        // The owner check recaptures the tree between its two observations and
        // once more after them; a tree that moves under that fence is not
        // reclaimable and not proven foreign, so it is reported as unavailable
        // rather than ending the inventory for every sibling.
        let recovery: "preserved" | "reclaimable" | "unavailable";
        try {
          recovery = observeRenderOwnerRecovery({
            between: () => seams.assertCaptured(snapshot),
            observe: props.observeProcessOwner,
            owner: identity.owner,
          }).state;
          if (recovery === "reclaimable") seams.assertCaptured(snapshot);
        } catch {
          recovery = "unavailable";
        }
        if (recovery === "preserved")
          candidate.observation = {
            state: "foreign-generation",
            authority: "none",
            stage: "ownership",
            reason:
              "the temporary tree owner is not proved reclaimable by this process generation",
          };
        else if (recovery === "unavailable")
          candidate.observation = {
            state: "unavailable",
            authority: "none",
            stage: "capture",
            reason:
              "the temporary tree generation changed while its owner was observed",
          };
      }
      entries.push({ candidate, snapshot });
      if (authenticated?.current === true && exact) {
        retainedChunkPaths.add(authenticated.pointerPath);
        retainedChunkPaths.add(candidate.path);
      }
    }
  for (const authenticated of authenticatedTrees.values())
    if (authenticated.current && authenticated.visited === false)
      authenticated.pointer.observation = {
        state: "observation-conflict",
        authority: "none",
        stage: "capture",
        reason:
          "the tree observed through this current pointer was absent from the tree inventory",
      };
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
    value = parseAutoMovieStructuredJson({
      record: "render-chunk-receipt",
      bytes,
    });
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
    receipt.version !== 2 ||
    typeof receipt.slot !== "string" ||
    receipt.slot.length === 0 ||
    Array.isArray(receipt.frames) === false ||
    receipt.frames.length === 0 ||
    receipt.frames.every(validFrameReceipt) === false ||
    Array.isArray(receipt.semanticMasks) === false ||
    receipt.semanticMasks.every(validSemanticReceipt) === false ||
    typeof receipt.encoded !== "object" ||
    receipt.encoded === null ||
    isRenderChunkRelativePath(receipt.encoded.path) === false ||
    CONTENT_DIGEST_PATTERN.test(receipt.encoded.digest) === false ||
    Number.isSafeInteger(receipt.encoded.bytes) === false ||
    receipt.encoded.bytes <= 0
  )
    throw new Error("Render chunk pointer has an invalid receipt.");
  const payloads = [
    receipt.encoded.path,
    ...receipt.frames.map((frame) => frame.path),
  ];
  if (new Set(payloads).size !== payloads.length)
    throw new Error("Render chunk pointer repeats a payload path.");
  const semanticPaths = new Map<
    string,
    { bytes: number; digest: AutoMovieContentDigest }
  >();
  for (const semantic of receipt.semanticMasks) {
    if (payloads.includes(semantic.sidecar.path))
      throw new Error(
        "Render chunk semantic sidecar replaces another payload.",
      );
    const previous = semanticPaths.get(semantic.sidecar.path);
    if (
      previous !== undefined &&
      (previous.bytes !== semantic.sidecar.bytes ||
        previous.digest !== semantic.sidecar.digest)
    )
      throw new Error("Render chunk repeats a semantic path with other bytes.");
    semanticPaths.set(semantic.sidecar.path, semantic.sidecar);
  }
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

const validSemanticReceipt = (
  value: IAutoMovieProductionRenderChunkReceipt["semanticMasks"][number],
): boolean =>
  typeof value === "object" &&
  value !== null &&
  value.version === 1 &&
  Number.isSafeInteger(value.frame) &&
  value.frame >= 0 &&
  value.pass === "mask" &&
  typeof value.shot === "string" &&
  value.shot.trim().length !== 0 &&
  validByteFact(value.sidecar) &&
  CONTENT_DIGEST_PATTERN.test(value.semanticDigest) &&
  Array.isArray(value.coverage.unresolved) &&
  Number.isSafeInteger(value.coverage.unaddressed) &&
  value.coverage.unaddressed >= 0;

const validByteFact = (value: {
  path: string;
  digest: AutoMovieContentDigest;
  bytes: number;
}): boolean =>
  isRenderChunkRelativePath(value.path) &&
  CONTENT_DIGEST_PATTERN.test(value.digest) &&
  Number.isSafeInteger(value.bytes) &&
  value.bytes > 0;

const assertReceiptInventory = (
  tree: IRenderGcTargetSnapshot,
  receipt: RenderChunkPublicationReceipt,
): void => {
  const files = new Map<
    string,
    { bytes: number; digest: AutoMovieContentDigest }
  >([[receipt.encoded.path, receipt.encoded]]);
  for (const frame of receipt.frames) files.set(frame.path, frame);
  for (const semantic of receipt.semanticMasks)
    files.set(semantic.sidecar.path, semantic.sidecar);
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
