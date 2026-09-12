import { productionRenderLayersForPass } from "@automovie/engine";
import {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieCompiledFilmEffect,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionDesign,
  IAutoMovieSemanticMaskReceipt,
} from "@automovie/interface";
import {
  type IAutoMovieProductionAudioAssetIdentity,
  type IAutoMovieProductionRenderChunk,
  type IAutoMovieProductionRenderJobPlan,
  type IAutoMovieProductionRenderRuntimeIdentity,
  planProductionRenderJob,
} from "@automovie/render";
import path from "node:path";

import { autoMovieFileSystem as fileSystem } from "../project/fileSystem";
import { canonicalizeAutoMovieJson } from "./contentIdentity";

/**
 * Byte-exact PNG committed by one completed chunk.
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-image-sequences Records each frame's number, path and digest so a sequence's exact count, gaps and stray frames are checkable.
 */
export interface IAutoMovieProductionRenderedFrameReceipt {
  /**
   * Exact zero-based film frame.
   */
  globalFrame: number;
  /**
   * Chunk-directory-relative PNG path.
   */
  path: string;
  /**
   * Digest of the resident PNG bytes.
   */
  digest: AutoMovieContentDigest;
  /**
   * Positive resident PNG byte count.
   */
  bytes: number;
  /**
   * Decoded PNG width.
   */
  width: number;
  /**
   * Decoded PNG height.
   */
  height: number;
}

/**
 * Content-only completion facts; attempts and PIDs are deliberately absent.
 */
export interface IAutoMovieProductionRenderChunkReceipt {
  /**
   * Receipt schema.
   */
  version: 2;
  /**
   * Stable operational slot.
   */
  slot: string;
  /**
   * Exact current chunk content id.
   */
  chunk: AutoMovieContentDigest;
  /**
   * Ordered byte facts for the full frame range.
   */
  frames: IAutoMovieProductionRenderedFrameReceipt[];
  /** Complete semantic dependencies for every shot layer of a mask frame. */
  semanticMasks: IAutoMovieSemanticMaskReceipt[];
  /**
   * Parser-verified chunk MP4.
   */
  encoded: {
    /** Chunk-directory-relative MP4 path. */
    path: string;
    /** Digest of the resident MP4 bytes. */
    digest: AutoMovieContentDigest;
    /** Positive resident MP4 byte count. */
    bytes: number;
  };
}

/**
 * Ephemeral attempt state stored outside a completion receipt.
 */
export interface IAutoMovieProductionRenderAttempt {
  /**
   * Stable operational slot.
   */
  slot: string;
  /**
   * Chunk identity attempted by the process.
   */
  chunk: AutoMovieContentDigest;
  /**
   * Non-content attempt state.
   */
  state: "running" | "failed";
  /**
   * Exact recovery action or failure message.
   */
  correction: string;
}

/**
 * One resumable status row with an exact next action.
 */
export interface IAutoMovieProductionRenderChunkStatus {
  /**
   * Stable operational slot.
   */
  slot: string;
  /**
   * Current planned content identity.
   */
  chunk: AutoMovieContentDigest;
  /**
   * Current completion/recovery classification.
   */
  status: "planned" | "running" | "complete" | "stale" | "failed";
  /**
   * Exact next action for this state.
   */
  correction: string;
}

/**
 * Prove a persisted plan is exactly reproducible from current builder inputs.
 */
export const verifyProductionRenderJobPlan = (props: {
  plan: IAutoMovieProductionRenderJobPlan;
  timeline: IAutoMovieFilmTimeline;
  effects: readonly IAutoMovieCompiledFilmEffect[];
  production: IAutoMovieProductionDesign;
  runtimeIdentity: IAutoMovieProductionRenderRuntimeIdentity;
  sourceFingerprints: Readonly<Record<string, AutoMovieContentDigest>>;
  audioAssets: readonly IAutoMovieProductionAudioAssetIdentity[];
  guidePasses?: readonly Exclude<AutoMovieGuidePass, "beauty">[];
}): void => {
  const expected = planProductionRenderJob({
    timeline: props.timeline,
    effects: props.effects,
    production: props.production,
    runtimeIdentity: props.runtimeIdentity,
    sourceFingerprints: props.sourceFingerprints,
    audioAssets: props.audioAssets,
    chunkFrames: props.plan.chunkFrames,
    guidePasses: props.guidePasses,
    tier: props.plan.tier,
  });
  if (
    canonicalizeAutoMovieJson(props.plan) !==
    canonicalizeAutoMovieJson(expected)
  )
    throw new Error(
      "Stored render plan differs from the current builder-owned timeline and render inputs. Run automovie render plan, then rerender only changed chunk identities.",
    );
};

/**
 * Classify current identities without treating an old slot as current.
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-planned-materialized Separates planned, materialized and verified chunk states instead of reading a receipt's existence as proof of frames.
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-partial-artifact Reports completed chunks beside the missing set instead of exposing a partial sequence as a complete film.
 * @evidence specifications/execution-and-recovery/artifacts-and-atomic-publication.md#execution-partial-artifact-isolation Keeps a chunk whose slot is not current out of the current set so a partial generation is never consumed as a complete manifest.
 */
export const productionRenderChunkStatuses = (props: {
  plan: IAutoMovieProductionRenderJobPlan;
  receipts: readonly IAutoMovieProductionRenderChunkReceipt[];
  attempts: readonly IAutoMovieProductionRenderAttempt[];
}): IAutoMovieProductionRenderChunkStatus[] => {
  return props.plan.chunks.map((chunk) => {
    const slotReceipts = props.receipts.filter(
      (item) => item.slot === chunk.slot,
    );
    const receipt =
      slotReceipts.find((item) => item.chunk === chunk.id) ??
      slotReceipts.at(-1);
    const slotAttempts = props.attempts.filter(
      (item) => item.slot === chunk.slot,
    );
    const attempt =
      slotAttempts.find((item) => item.chunk === chunk.id) ??
      slotAttempts.at(-1);
    if (receipt?.chunk === chunk.id) {
      try {
        verifyProductionRenderChunkReceipt({
          plan: props.plan,
          chunk,
          receipt,
        });
        return status(
          chunk,
          "complete",
          "Verify current bytes, then reuse this chunk.",
        );
      } catch (error) {
        // Receipt verification throws nothing but Error refusals.
        return status(
          chunk,
          "failed",
          `${(error as Error).message} Rerender this chunk.`,
        );
      }
    }
    if (attempt?.chunk === chunk.id)
      return status(
        chunk,
        attempt.state,
        attempt.state === "running"
          ? "Wait for its lock owner or recover the abandoned attempt."
          : attempt.correction,
      );
    if (receipt !== undefined || attempt !== undefined)
      return status(
        chunk,
        "stale",
        "Quarantine prior slot output and render only this current chunk.",
      );
    return status(
      chunk,
      "planned",
      "Acquire its lock, render, encode, verify, and commit.",
    );
  });
};

/**
 * Verify completion identity, exact range coverage, raster, and byte facts.
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-resume Admits a chunk for reuse only when its receipt matches the current plan and chunk identity; anything else is rerendered or preserved for adjudication.
 */
export const verifyProductionRenderChunkReceipt = (props: {
  plan: IAutoMovieProductionRenderJobPlan;
  chunk: IAutoMovieProductionRenderChunk;
  receipt: IAutoMovieProductionRenderChunkReceipt;
}): void => {
  const { plan, chunk, receipt } = props;
  if (
    receipt.version !== 2 ||
    receipt.slot !== chunk.slot ||
    receipt.chunk !== chunk.id
  )
    throw new Error(`Chunk receipt "${receipt.slot}" is stale.`);
  if (receipt.frames.length !== chunk.frames.length)
    throw new Error(
      `Chunk "${chunk.slot}" has ${receipt.frames.length} frame receipts; expected ${chunk.frames.length}.`,
    );
  receipt.frames.forEach((frameReceipt, index) => {
    const expected = chunk.frames[index]!.globalFrame;
    if (
      frameReceipt.globalFrame !== expected ||
      frameReceipt.width !== plan.frameFormat.width ||
      frameReceipt.height !== plan.frameFormat.height ||
      validByteFact(frameReceipt) === false
    )
      throw new Error(
        `Chunk "${chunk.slot}" frame ${index} does not prove global frame ${expected} at the production raster.`,
      );
  });
  if (validByteFact(receipt.encoded) === false)
    throw new Error(`Chunk "${chunk.slot}" has no verified encoded output.`);
  const expectedSemantic =
    chunk.pass === "mask"
      ? chunk.frames.flatMap((frame) =>
          productionRenderLayersForPass(frame, chunk.pass).map((layer) => ({
            frame: frame.globalFrame,
            shot: layer.shot,
          })),
        )
      : [];
  if (receipt.semanticMasks.length !== expectedSemantic.length)
    throw new Error(
      `Chunk "${chunk.slot}" has ${receipt.semanticMasks.length} semantic records; expected ${expectedSemantic.length}.`,
    );
  receipt.semanticMasks.forEach((semantic, index) => {
    const expected = expectedSemantic[index]!;
    if (
      semantic.version !== 1 ||
      semantic.pass !== "mask" ||
      semantic.frame !== expected.frame ||
      semantic.shot !== expected.shot ||
      validByteFact(semantic.sidecar) === false ||
      validSemanticPath(semantic.sidecar.path) === false ||
      /^sha256:[0-9a-f]{64}$/u.test(semantic.semanticDigest) === false ||
      semantic.coverage.unresolved.some(
        (id, unresolvedIndex) =>
          id.trim().length === 0 ||
          (unresolvedIndex !== 0 &&
            semantic.coverage.unresolved[unresolvedIndex - 1]! >= id),
      ) ||
      semantic.coverage.unresolved.length !== 0 ||
      Number.isSafeInteger(semantic.coverage.unaddressed) === false ||
      semantic.coverage.unaddressed !== 0
    )
      throw new Error(
        `Chunk "${chunk.slot}" semantic record ${index} is missing, foreign, incomplete, or invalid.`,
      );
  });
};

const validSemanticPath = (candidate: string): boolean => {
  const segments = candidate.split("/");
  return (
    candidate.trim().length !== 0 &&
    candidate.startsWith("/") === false &&
    candidate.includes("\\") === false &&
    /^[A-Za-z]:/u.test(candidate) === false &&
    segments.every(
      (segment) => segment !== "" && segment !== "." && segment !== "..",
    )
  );
};

interface IProductionRenderChunkFailure {
  error: unknown;
}

class ProductionRenderChunkLifecycleError extends AggregateError {}

/** Preserve one acquired chunk's complete fatal lifecycle in phase order. */
const productionRenderChunkLifecycleFailure = (
  attempt: IProductionRenderChunkFailure | undefined,
  failureRecord: IProductionRenderChunkFailure | undefined,
  release: IProductionRenderChunkFailure | undefined,
): unknown => {
  const failures = [attempt, failureRecord, release].filter(
    (failure): failure is IProductionRenderChunkFailure =>
      failure !== undefined,
  );
  if (failures.length === 1) return failures[0]!.error;
  return new ProductionRenderChunkLifecycleError(
    failures.map((failure) => failure.error),
    "Production render chunk cleanup failed after the render attempt failed.",
  );
};

/**
 * Schedule only non-current chunks through host-owned lock/byte adapters.
 */
export const runProductionRenderJob = async (props: {
  plan: IAutoMovieProductionRenderJobPlan;
  workers: number;
  deliverable?: string;
  adapters: {
    current(
      chunk: IAutoMovieProductionRenderChunk,
    ): Promise<IAutoMovieProductionRenderChunkReceipt | null>;
    acquire(chunk: IAutoMovieProductionRenderChunk): Promise<boolean>;
    render(
      chunk: IAutoMovieProductionRenderChunk,
    ): Promise<IAutoMovieProductionRenderChunkReceipt>;
    fail(
      chunk: IAutoMovieProductionRenderChunk,
      correction: string,
    ): Promise<void>;
    release(chunk: IAutoMovieProductionRenderChunk): Promise<void>;
  };
}): Promise<{
  complete: string[];
  rendered: string[];
  busy: string[];
  failed: Array<{ slot: string; correction: string }>;
}> => {
  if (Number.isSafeInteger(props.workers) === false || props.workers <= 0)
    throw new Error(
      `workers must be a positive safe integer, but was ${props.workers}.`,
    );
  const queue = props.plan.chunks.filter(
    (chunk) =>
      props.deliverable === undefined ||
      chunk.deliverable === props.deliverable,
  );
  if (
    props.deliverable !== undefined &&
    props.plan.chunks.some(
      (chunk) => chunk.deliverable === props.deliverable,
    ) === false
  )
    throw new Error(
      `Render plan has no video chunks for deliverable "${props.deliverable}".`,
    );
  const output = {
    complete: [] as string[],
    rendered: [] as string[],
    busy: [] as string[],
    failed: [] as Array<{ slot: string; correction: string }>,
  };
  let cursor = 0;
  const fatalFailures: IProductionRenderChunkFailure[] = [];
  const reserveFatalFailure = (): IProductionRenderChunkFailure | undefined => {
    if (fatalFailures.length !== 0) return undefined;
    const failure: IProductionRenderChunkFailure = { error: undefined };
    fatalFailures.push(failure);
    return failure;
  };
  const recordFatalFailure = (error: unknown): void => {
    const failure = reserveFatalFailure();
    if (failure !== undefined) failure.error = error;
  };
  const worker = async (): Promise<void> => {
    try {
      while (fatalFailures.length === 0 && cursor < queue.length) {
        const chunk = queue[cursor++]!;
        const current = await props.adapters.current(chunk);
        if (current !== null) {
          verifyProductionRenderChunkReceipt({
            plan: props.plan,
            chunk,
            receipt: current,
          });
          output.complete.push(chunk.slot);
          continue;
        }
        if ((await props.adapters.acquire(chunk)) === false) {
          output.busy.push(chunk.slot);
          continue;
        }
        let attemptFailure: IProductionRenderChunkFailure | undefined;
        let failureRecordFailure: IProductionRenderChunkFailure | undefined;
        let releaseFailure: IProductionRenderChunkFailure | undefined;
        let fatalFailure: IProductionRenderChunkFailure | undefined;
        try {
          const receipt = await props.adapters.render(chunk);
          verifyProductionRenderChunkReceipt({
            plan: props.plan,
            chunk,
            receipt,
          });
          output.rendered.push(chunk.slot);
        } catch (error) {
          attemptFailure = { error };
          const correction =
            error instanceof Error ? error.message : String(error);
          try {
            await props.adapters.fail(chunk, correction);
            output.failed.push({ slot: chunk.slot, correction });
          } catch (failure) {
            failureRecordFailure = { error: failure };
            fatalFailure = reserveFatalFailure();
          }
        } finally {
          try {
            await props.adapters.release(chunk);
          } catch (failure) {
            releaseFailure = { error: failure };
            fatalFailure ??= reserveFatalFailure();
          }
          if (fatalFailure !== undefined)
            fatalFailure.error = productionRenderChunkLifecycleFailure(
              attemptFailure,
              failureRecordFailure,
              releaseFailure,
            );
        }
      }
    } catch (error) {
      recordFatalFailure(error);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(props.workers, Math.max(1, queue.length)) },
      worker,
    ),
  );
  if (fatalFailures.length !== 0) throw fatalFailures[0]!.error;
  const order = new Map(queue.map((chunk, index) => [chunk.slot, index]));
  output.complete.sort((left, right) => order.get(left)! - order.get(right)!);
  output.rendered.sort((left, right) => order.get(left)! - order.get(right)!);
  output.busy.sort((left, right) => order.get(left)! - order.get(right)!);
  output.failed.sort(
    (left, right) => order.get(left.slot)! - order.get(right.slot)!,
  );
  return output;
};

interface IProductionOwnedDescriptorFailure {
  error: unknown;
}

class ProductionOwnedDescriptorCleanupError extends AggregateError {}

/** Close one production-owned descriptor without losing earlier failures. */
const closeProductionOwnedDescriptor = (
  descriptor: number,
  failure: IProductionOwnedDescriptorFailure | undefined,
  target: string,
): void => {
  try {
    fileSystem.closeSync(descriptor);
  } catch (closeFailure) {
    if (failure === undefined) throw closeFailure;
    throw new ProductionOwnedDescriptorCleanupError(
      [
        ...(failure.error instanceof ProductionOwnedDescriptorCleanupError
          ? failure.error.errors
          : [failure.error]),
        closeFailure,
      ],
      `Production-owned descriptor cleanup failed after the read failed: ${target}.`,
    );
  }
};

/**
 * Read one production-owned file without following a link in its namespace.
 *
 * The returned bytes come from one regular file whose complete ancestry is a
 * physical descendant of `root`. Every directory and the file are identified
 * before the read and rechecked afterwards, so a replacement cannot turn a
 * verified content-addressed path into different resident bytes.
 */
export function readAutoMovieProductionOwnedFile(props: {
  /** Physical production ownership root. */
  root: string;
  /** Physical directory that owns the relative file. */
  directory: string;
  /** Strict descendant path below `directory`. */
  relative: string;
  /** Return `null` only when the first target observation is absent. */
  optional: true;
}): Uint8Array | null;
/**
 * Read one required production-owned file without following a link in its
 * namespace.
 */
export function readAutoMovieProductionOwnedFile(props: {
  /** Physical production ownership root. */
  root: string;
  /** Physical directory that owns the relative file. */
  directory: string;
  /** Strict descendant path below `directory`. */
  relative: string;
}): Uint8Array;
/**
 * Execute the production-owned read with an explicit optionality policy.
 */
export function readAutoMovieProductionOwnedFile(props: {
  root: string;
  directory: string;
  relative: string;
  optional?: boolean;
}): Uint8Array | null {
  const root = path.resolve(props.root);
  const directory = path.resolve(props.directory);
  const target = path.resolve(directory, props.relative);
  if (
    `${directory}${path.sep}`.startsWith(`${root}${path.sep}`) === false ||
    target.startsWith(`${directory}${path.sep}`) === false
  )
    throw new Error(
      `Production-owned path "${props.relative}" escapes its owned directory.`,
    );

  const relativeParent = path.relative(root, path.dirname(target));
  const components =
    relativeParent.length === 0 ? [] : relativeParent.split(path.sep);
  const directories = [root];
  for (const component of components)
    directories.push(path.join(directories.at(-1)!, component));

  const identities: IProductionOwnedPathIdentity[] = directories.map(
    (file) => ({
      file,
      identity: productionOwnedDirectoryIdentity(file),
    }),
  );
  const assertResidentDirectories = (): void => {
    const changed = identities.find(
      (expected) =>
        expected.identity !== productionOwnedDirectoryIdentity(expected.file),
    );
    if (changed !== undefined)
      throw new Error(
        `Production-owned path "${changed.file}" changed physical identity while it was read.`,
      );
  };
  let linkedIdentity: string;
  try {
    linkedIdentity = productionOwnedFileIdentity(target);
  } catch (error) {
    if (
      props.optional === true &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      assertResidentDirectories();
      return null;
    }
    throw error;
  }
  const descriptor = fileSystem.openSync(target, "r");
  let failure: IProductionOwnedDescriptorFailure | undefined;
  try {
    const openedIdentity = productionOwnedDescriptorIdentity(
      target,
      descriptor,
    );
    const assertResidentFile = (): void => {
      assertResidentDirectories();
      if (productionOwnedFileIdentity(target) !== linkedIdentity)
        throw new Error(
          `Production-owned path "${target}" changed physical identity while it was read.`,
        );
      const residentDescriptor = fileSystem.openSync(target, "r");
      let residentFailure: IProductionOwnedDescriptorFailure | undefined;
      try {
        if (
          productionOwnedDescriptorIdentity(target, residentDescriptor) !==
          openedIdentity
        )
          throw new Error(
            `Production-owned path "${target}" changed physical identity while it was read.`,
          );
      } catch (error) {
        residentFailure = { error };
        throw error;
      } finally {
        closeProductionOwnedDescriptor(
          residentDescriptor,
          residentFailure,
          target,
        );
      }
    };
    assertResidentFile();
    const bytes = fileSystem.readFileSync(descriptor);
    assertResidentFile();
    return bytes;
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    closeProductionOwnedDescriptor(descriptor, failure, target);
  }
}

const status = (
  chunk: IAutoMovieProductionRenderChunk,
  state: IAutoMovieProductionRenderChunkStatus["status"],
  correction: string,
): IAutoMovieProductionRenderChunkStatus => ({
  slot: chunk.slot,
  chunk: chunk.id,
  status: state,
  correction,
});

const validByteFact = (fact: { digest: string; bytes: number }): boolean =>
  Number.isSafeInteger(fact.bytes) &&
  fact.bytes > 0 &&
  validDigest(fact.digest);

const validDigest = (value: string): boolean =>
  /^sha256:[0-9a-f]{64}$/.test(value);

interface IProductionOwnedPathIdentity {
  file: string;
  identity: string;
}

const productionOwnedDirectoryIdentity = (directory: string): string => {
  const linked = fileSystem.lstatSync(directory, { bigint: true });
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(
      `Production-owned directory "${directory}" is not a physical directory.`,
    );
  return `${linked.dev}\0${linked.ino}`;
};

const productionOwnedFileIdentity = (file: string): string => {
  const linked = fileSystem.lstatSync(file, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error(`Production-owned path "${file}" is not a physical file.`);
  return `${linked.dev}\0${linked.ino}`;
};

const productionOwnedDescriptorIdentity = (
  file: string,
  descriptor: number,
): string => {
  const opened = fileSystem.fstatSync(descriptor, { bigint: true });
  if (opened.isFile() === false)
    throw new Error(`Production-owned path "${file}" is not a physical file.`);
  return `${opened.dev}\0${opened.ino}`;
};
