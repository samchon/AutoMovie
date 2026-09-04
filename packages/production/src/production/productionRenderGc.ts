type AutoMovieContentDigest =
  import("@automovie/interface").AutoMovieContentDigest;
type IAutoMovieProductionRenderJobPlan =
  import("./productionRenderJob").IAutoMovieProductionRenderJobPlan;

/**
 * One renderer-owned disk entry considered by mark-and-sweep.
 *
 * @evidence requirements/operations-and-recovery/retention-and-cleanup.md#operations-cleanup-target-preview Carries the exact target, generation, bytes, and finding an operator previews.
 * @evidence specifications/execution-and-recovery/retention-cleanup-and-quarantine.md#execution-cleanup-plan-preview Supplies the immutable inventory fact behind one cleanup decision.
 */
export interface IAutoMovieProductionRenderGcCandidate {
  /**
   * Canonical logical ownership path reported by the renderer host.
   */
  path: string;
  /**
   * Ownership class; active locks and attempts are deliberately absent.
   */
  kind:
    | "chunk"
    | "chunk-pointer"
    | "chunk-tree"
    | "dialogue-cache"
    | "model-cache"
    | "quarantine"
    | "publication";
  /**
   * Chunk digest for chunk, pointer, and tree entries; otherwise null.
   */
  digest: AutoMovieContentDigest | null;
  /**
   * Recursive resident byte count reported by the host.
   */
  bytes: number | null;
  /**
   * Physical generation captured for this exact target, or null when the host
   * could not authenticate one without weakening the ownership boundary.
   */
  generation: string | null;
  /**
   * A host finding that must override ordinary reference-based retention.
   */
  observation: IAutoMovieProductionRenderCleanupObservation | null;
}

/**
 * Mutually exclusive artifact states preserved through cleanup decisions.
 *
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-recovery-refusal Keeps unresolved render evidence distinguishable from absence and verified stale output.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery Names the state carried from inspection through resume and finalization.
 */
export type AutoMovieProductionRenderArtifactState =
  | "absent"
  | "current"
  | "verified-stale"
  | "integrity-failed"
  | "unsafe-locator"
  | "foreign-generation"
  | "unavailable"
  | "observation-conflict";

/**
 * Physical authority proved by the host for one captured generation.
 *
 * @evidence requirements/operations-and-recovery/retention-and-cleanup.md#operations-cleanup-concurrency-safety Prevents an ambiguous or successor generation from inheriting mutation authority.
 * @evidence specifications/execution-and-recovery/retention-cleanup-and-quarantine.md#execution-cleanup-concurrency-safety Limits apply to an exact captured remove or quarantine boundary.
 */
export type AutoMovieProductionRenderCleanupAuthority =
  | "none"
  | "exact-remove"
  | "exact-quarantine";

/** Inspection boundary that produced one render-artifact finding. */
export type AutoMovieProductionRenderArtifactStage =
  | "absence"
  | "locator"
  | "capture"
  | "receipt"
  | "inventory"
  | "media"
  | "currentness"
  | "ownership"
  | "reference";

/**
 * One sanitized finding produced without collapsing uncertainty to stale.
 *
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-recovery-refusal Preserves the reason and safe next action for each unresolved chunk.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery Carries inspection failure without copying raw artifact bytes into diagnostics.
 */
export interface IAutoMovieProductionRenderCleanupObservation {
  state: AutoMovieProductionRenderArtifactState;
  authority: AutoMovieProductionRenderCleanupAuthority;
  stage: AutoMovieProductionRenderArtifactStage;
  reason: string;
}

/**
 * One reasoned member of an immutable cleanup disposition set.
 *
 * @evidence requirements/operations-and-recovery/retention-and-cleanup.md#operations-cleanup-target-preview Makes every preview entry explain its exact classification.
 * @evidence specifications/execution-and-recovery/retention-cleanup-and-quarantine.md#execution-cleanup-plan-preview Binds a disposition to the captured candidate and sanitized reason.
 */
export interface IAutoMovieProductionRenderCleanupDecision {
  candidate: IAutoMovieProductionRenderGcCandidate;
  state: AutoMovieProductionRenderArtifactState;
  stage: AutoMovieProductionRenderArtifactStage;
  reason: string;
}

/**
 * Decide whether one typed artifact finding may feed or replace a chunk.
 *
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-recovery-refusal Allows reuse only for current evidence and materialization only for proven absence.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery Makes every unresolved existing generation a render refusal.
 */
export const productionRenderMaterializationDecision = (
  state: AutoMovieProductionRenderArtifactState,
): "render" | "reuse" | "refuse" => {
  if (isRenderCleanupState(state) === false)
    throw new Error(`Render artifact state "${String(state)}" is invalid.`);
  if (state === "absent") return "render";
  if (state === "current") return "reuse";
  return "refuse";
};

/**
 * Dry-run result; hosts may mutate only the exact `remove` and `quarantine`
 * entries and must preserve every manual-adjudication target.
 *
 * @evidence requirements/operations-and-recovery/retention-and-cleanup.md#operations-cleanup-target-preview Exposes all four required disposition sets before apply.
 * @evidence specifications/execution-and-recovery/retention-cleanup-and-quarantine.md#execution-cleanup-plan-preview Keeps automatic and operator-owned recovery disjoint.
 */
export interface IAutoMovieProductionRenderGcPlan {
  /**
   * GC plan schema.
   */
  version: 3;
  /**
   * Entries retained because a current plan or publication marks them.
   */
  retain: IAutoMovieProductionRenderCleanupDecision[];
  /**
   * Unreferenced entries safe to sweep.
   */
  remove: IAutoMovieProductionRenderCleanupDecision[];
  /**
   * Exact captured corrupt generations safe to move out of every consumer.
   */
  quarantine: IAutoMovieProductionRenderCleanupDecision[];
  /**
   * Unresolved generations retained for an operator because no move is proved.
   */
  manualAdjudication: IAutoMovieProductionRenderCleanupDecision[];
  /**
   * Exact sum of removable resident bytes.
   */
  reclaimableBytes: number;
}

/**
 * Mark current proxy/final plans and publication files, then classify garbage.
 *
 * Locks, attempts, and arbitrary paths never enter this planner. The CLI keeps
 * those operational records outside the candidate inventory so GC cannot race
 * an active worker.
 * @evidence requirements/operations-and-recovery/retention-and-cleanup.md#operations-cleanup-target-preview Returns explicit retain, remove, quarantine, and manual-adjudication sets with one exact reason per target.
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-recovery-refusal Keeps integrity, ownership, availability, and observation conflicts distinct from verified stale output.
 * @evidence specifications/execution-and-recovery/retention-cleanup-and-quarantine.md#execution-cleanup-plan-preview Allows automatic mutation only when the host proved authority over the captured generation.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery Preserves unresolved render output instead of converting a read failure into absence.
 */
export const planProductionRenderGc = (props: {
  /** Current plans from every retained tier. */
  plans: readonly IAutoMovieProductionRenderJobPlan[];
  /** Paths claimed by the current aggregate publication manifest. */
  publicationPaths: readonly string[];
  /** Exact pointer/tree paths authenticated as current by the renderer host. */
  retainedChunkPaths: readonly string[];
  /** Exact dialogue/model generations authenticated as current by the sound host. */
  retainedCachePaths: readonly string[];
  /** Physical inventory collected without following links. */
  candidates: readonly IAutoMovieProductionRenderGcCandidate[];
}): IAutoMovieProductionRenderGcPlan => {
  const activeChunks = new Set(
    props.plans.flatMap((plan) =>
      plan.chunks.map(
        (chunk) => `${plan.tier.kind}\0${chunk.id.slice("sha256:".length)}`,
      ),
    ),
  );
  const activePublication = new Set(
    props.publicationPaths.map(canonicalRelativePath),
  );
  const retainedChunkPaths = new Set<string>();
  for (const value of props.retainedChunkPaths) {
    const path = canonicalRelativePath(value);
    if (retainedChunkPaths.has(path))
      throw new Error(`Render GC retained chunk path "${path}" is duplicate.`);
    retainedChunkPaths.add(path);
  }
  const retainedCachePaths = new Set<string>();
  for (const value of props.retainedCachePaths) {
    const path = canonicalRelativePath(value);
    if (retainedCachePaths.has(path))
      throw new Error(`Render GC retained cache path "${path}" is duplicate.`);
    retainedCachePaths.add(path);
  }
  const paths = new Set<string>();
  const chunkPublicationCandidates = new Set<string>();
  const retain: IAutoMovieProductionRenderCleanupDecision[] = [];
  const remove: IAutoMovieProductionRenderCleanupDecision[] = [];
  const quarantine: IAutoMovieProductionRenderCleanupDecision[] = [];
  const manualAdjudication: IAutoMovieProductionRenderCleanupDecision[] = [];
  for (const candidate of [...props.candidates].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  )) {
    const path = canonicalRelativePath(candidate.path);
    const chunkPath = /^(proxy|final)\/chunks\/([0-9a-f]{64})$/u.exec(path);
    const pointerPath = /^(proxy|final)\/pointers\/([0-9a-f]{64})$/u.exec(path);
    const treePath = /^(proxy|final)\/tmp\/([0-9a-f]{64})\.[^/]+$/u.exec(
      path,
    );
    const ownedDigest =
      candidate.kind === "chunk"
        ? chunkPath?.[2]
        : candidate.kind === "chunk-pointer"
          ? pointerPath?.[2]
          : candidate.kind === "chunk-tree"
            ? treePath?.[2]
            : undefined;
    const cachePath =
      candidate.kind === "dialogue-cache"
        ? /^audio-cache\/kokoro\/([^/]+)$/u.exec(path)
        : candidate.kind === "model-cache"
          ? /^model-cache\/kokoro\/([^/]+)$/u.exec(path)
          : null;
    if (
      paths.has(path) ||
      (candidate.bytes !== null &&
        (Number.isSafeInteger(candidate.bytes) === false ||
          candidate.bytes < 0)) ||
      (candidate.generation !== null &&
        (candidate.generation.trim().length === 0 ||
          /[\r\n\0]/u.test(candidate.generation))) ||
      (candidate.observation !== null &&
        (isRenderCleanupState(candidate.observation.state) === false ||
          isRenderCleanupAuthority(candidate.observation.authority) === false ||
          isRenderCleanupStage(candidate.observation.stage) === false ||
          candidate.observation.reason.trim().length === 0 ||
          /[\r\n\0]/u.test(candidate.observation.reason))) ||
      ((candidate.kind === "chunk" ||
        candidate.kind === "chunk-pointer" ||
        candidate.kind === "chunk-tree") &&
        (candidate.digest === null ||
          /^sha256:[0-9a-f]{64}$/.test(candidate.digest) === false ||
          ownedDigest === undefined ||
          candidate.digest !== `sha256:${ownedDigest}`)) ||
      (candidate.kind === "quarantine" &&
        /^(?:proxy|final)\/quarantine\/[^/]+$/u.test(path) === false) ||
      (candidate.kind === "publication" &&
        path.startsWith("publication/") === false) ||
      ((candidate.kind === "dialogue-cache" ||
        candidate.kind === "model-cache") &&
        (cachePath === null ||
          candidate.digest === null ||
          /^sha256:[0-9a-f]{64}$/.test(candidate.digest) === false)) ||
      (candidate.kind !== "chunk" &&
        candidate.kind !== "chunk-pointer" &&
        candidate.kind !== "chunk-tree" &&
        candidate.kind !== "dialogue-cache" &&
        candidate.kind !== "model-cache" &&
        candidate.digest !== null)
    )
      throw new Error(
        `Render GC candidate "${candidate.path}" has duplicate or invalid ownership facts.`,
      );
    paths.add(path);
    if (candidate.kind === "chunk-pointer" || candidate.kind === "chunk-tree")
      chunkPublicationCandidates.add(path);
    const normalized = { ...candidate, path };
    const marked =
      (candidate.kind === "chunk" &&
        chunkPath !== null &&
        activeChunks.has(`${chunkPath[1]}\0${chunkPath[2]}`)) ||
      ((candidate.kind === "chunk-pointer" ||
        candidate.kind === "chunk-tree") &&
        retainedChunkPaths.has(path)) ||
      ((candidate.kind === "dialogue-cache" ||
        candidate.kind === "model-cache") &&
        retainedCachePaths.has(path)) ||
      (candidate.kind === "publication" && activePublication.has(path));
    const observation =
      normalized.observation ??
      (marked
        ? {
            state: "current" as const,
            authority: "none" as const,
            stage: "reference" as const,
            reason: "the current plan or aggregate publication marks this exact target",
          }
        : {
            state: "verified-stale" as const,
            authority: "exact-remove" as const,
            stage: "reference" as const,
            reason: "no current plan, authenticated chunk pair, cache generation, or publication references this exact target",
          });
    const decision: IAutoMovieProductionRenderCleanupDecision = {
      candidate: normalized,
      state: observation.state,
      stage: observation.stage,
      reason: observation.reason,
    };
    const exactGeneration =
      normalized.bytes !== null && normalized.generation !== null;
    if (
      observation.state === "current" &&
      observation.authority === "none" &&
      marked
    )
      retain.push(decision);
    else if (
      observation.state === "absent" &&
      observation.authority === "none"
    )
      retain.push(decision);
    else if (
      observation.state === "verified-stale" &&
      observation.authority === "exact-remove" &&
      exactGeneration
    )
      remove.push(decision);
    else if (
      observation.state === "integrity-failed" &&
      observation.authority === "exact-quarantine" &&
      exactGeneration
    )
      quarantine.push(decision);
    else manualAdjudication.push(decision);
  }
  for (const path of retainedChunkPaths)
    if (chunkPublicationCandidates.has(path) === false)
      throw new Error(
        `Render GC retained chunk path "${path}" has no exact pointer/tree candidate.`,
      );
  const cacheCandidates = new Set(
    props.candidates
      .filter(
        (candidate) =>
          candidate.kind === "dialogue-cache" ||
          candidate.kind === "model-cache",
      )
      .map((candidate) => canonicalRelativePath(candidate.path)),
  );
  for (const path of retainedCachePaths)
    if (cacheCandidates.has(path) === false)
      throw new Error(
        `Render GC retained cache path "${path}" has no exact cache candidate.`,
      );
  const retainedPairs = new Map<string, { pointers: number; trees: number }>();
  for (const path of retainedChunkPaths) {
    const pointer = /^(proxy|final)\/pointers\/([0-9a-f]{64})$/u.exec(path);
    const tree = /^(proxy|final)\/tmp\/([0-9a-f]{64})\.[^/]+$/u.exec(path);
    // Retained paths already proved an exact pointer/tree candidate above.
    const match = (pointer ?? tree)!;
    const key = `${match[1]}\0${match[2]}`;
    const pair = retainedPairs.get(key) ?? { pointers: 0, trees: 0 };
    if (pointer === null) pair.trees++;
    else pair.pointers++;
    retainedPairs.set(key, pair);
  }
  for (const [key, pair] of retainedPairs)
    if (
      pair.pointers !== 1 ||
      pair.trees !== 1 ||
      activeChunks.has(key) === false
    )
      throw new Error(
        `Render GC retained chunk publication "${key.replace("\0", "/")}" is not one exact current pointer/tree pair.`,
      );
  const reclaimableBytes = remove.reduce(
    (total, decision) => total + decision.candidate.bytes!,
    0,
  );
  if (Number.isSafeInteger(reclaimableBytes) === false)
    throw new Error(
      "Render GC reclaimable byte total exceeds safe integer range.",
    );
  return {
    version: 3,
    retain,
    remove,
    quarantine,
    manualAdjudication,
    reclaimableBytes,
  };
};

const isRenderCleanupState = (
  value: unknown,
): value is AutoMovieProductionRenderArtifactState =>
  value === "absent" ||
  value === "current" ||
  value === "verified-stale" ||
  value === "integrity-failed" ||
  value === "unsafe-locator" ||
  value === "foreign-generation" ||
  value === "unavailable" ||
  value === "observation-conflict";

const isRenderCleanupAuthority = (
  value: unknown,
): value is AutoMovieProductionRenderCleanupAuthority =>
  value === "none" ||
  value === "exact-remove" ||
  value === "exact-quarantine";

const isRenderCleanupStage = (
  value: unknown,
): value is AutoMovieProductionRenderArtifactStage =>
  value === "absence" ||
  value === "locator" ||
  value === "capture" ||
  value === "receipt" ||
  value === "inventory" ||
  value === "media" ||
  value === "currentness" ||
  value === "ownership" ||
  value === "reference";

function canonicalRelativePath(value: string): string {
  if (
    value.trim().length === 0 ||
    value.includes("\\") ||
    value.startsWith("/") ||
    /^[A-Za-z]:/.test(value) ||
    value
      .split("/")
      .some(
        (segment) =>
          segment.length === 0 || segment === "." || segment === "..",
      )
  )
    throw new Error(
      `Render GC path "${value}" must be one canonical relative POSIX path.`,
    );
  return value;
}
