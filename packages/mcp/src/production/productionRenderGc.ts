import { AutoMovieContentDigest } from "@automovie/interface";

import { IAutoMovieProductionRenderJobPlan } from "./productionRenderJob";

/**
 * One renderer-owned disk entry considered by mark-and-sweep.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives renderer host code a typed candidate record for supplying its own disk inventory.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Treats render-file discovery as deterministic host input rather than an MCP authoring operation.
 */
export interface IAutoMovieProductionRenderGcCandidate {
  /**
   * Canonical logical ownership path reported by the renderer host.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets ordinary host code identify each candidate by its canonical renderer-owned path.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Accepts path identity from deterministic renderer bookkeeping instead of making MCP inspect storage.
   */
  path: string;
  /**
   * Ownership class; active locks and attempts are deliberately absent.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes the renderer's closed ownership classes to typed cleanup callers.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps locks and attempts outside the deterministic candidate set, without adding MCP file-management commands.
   */
  kind: "chunk" | "chunk-pointer" | "chunk-tree" | "quarantine" | "publication";
  /**
   * Chunk digest for chunk, pointer, and tree entries; otherwise null.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes chunk identity available as a typed digest while non-content entries state `null` explicitly.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Feeds deterministic reachability from renderer content identities, not from MCP session knowledge.
   */
  digest: AutoMovieContentDigest | null;
  /**
   * Recursive resident byte count reported by the host.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets typed host inventories attach the recursively measured resident bytes to each entry.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Uses deterministic host measurements for reclamation accounting rather than asking MCP to probe the filesystem.
   */
  bytes: number;
}

/**
 * Dry-run result; hosts may delete only the exact `remove` entries.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Provides ordinary maintenance code with a typed, inspectable dry-run GC decision.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Returns deterministic keep/remove data for a host to execute, without turning MCP into a deletion surface.
 */
export interface IAutoMovieProductionRenderGcPlan {
  /**
   * GC plan schema.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Pins the GC record version as a literal ordinary TypeScript consumers can discriminate.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Versions deterministic planner output in code instead of negotiating cleanup state through MCP.
   */
  version: 1;
  /**
   * Entries retained because a current plan or publication marks them.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives host code the exact typed candidates preserved by current plans and publications.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Publishes the deterministic mark set as data while MCP remains uninvolved in retention policy.
   */
  keep: IAutoMovieProductionRenderGcCandidate[];
  /**
   * Unreferenced entries safe to sweep.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Hands ordinary cleanup code the precise typed entries that are safe to sweep.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Separates deterministic sweep classification from any MCP command that could mutate renderer storage.
   */
  remove: IAutoMovieProductionRenderGcCandidate[];
  /**
   * Exact sum of removable resident bytes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes the exact byte total ordinary host code can report before performing a sweep.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Derives reclamation size from deterministic candidate accounting, not an MCP-side estimate.
   */
  reclaimableBytes: number;
}

/**
 * Mark current proxy/final plans and publication files, then classify garbage.
 *
 * Locks, attempts, and arbitrary paths never enter this planner. The CLI keeps
 * those operational records outside the candidate inventory so GC cannot race
 * an active worker.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets ordinary renderer maintenance code compute mark-and-sweep from explicit plans, publications, and candidates.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Implements cleanup as a deterministic pure planner whose result a host may apply outside MCP.
 */
export const planProductionRenderGc = (props: {
  /** Current plans from every retained tier. */
  plans: readonly IAutoMovieProductionRenderJobPlan[];
  /** Paths claimed by the current aggregate publication manifest. */
  publicationPaths: readonly string[];
  /** Exact pointer/tree paths authenticated as current by the renderer host. */
  retainedChunkPaths: readonly string[];
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
  const paths = new Set<string>();
  const chunkPublicationCandidates = new Set<string>();
  const keep: IAutoMovieProductionRenderGcCandidate[] = [];
  const remove: IAutoMovieProductionRenderGcCandidate[] = [];
  for (const candidate of [...props.candidates].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  )) {
    const path = canonicalRelativePath(candidate.path);
    const chunkPath = /^(proxy|final)\/chunks\/([0-9a-f]{64})$/u.exec(path);
    const pointerPath = /^(proxy|final)\/pointers\/([0-9a-f]{64})$/u.exec(path);
    const treePath = /^(proxy|final)\/tmp\/([0-9a-f]{64})\.[^.]+\.\d+$/u.exec(
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
    if (
      paths.has(path) ||
      Number.isSafeInteger(candidate.bytes) === false ||
      candidate.bytes < 0 ||
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
      (candidate.kind !== "chunk" &&
        candidate.kind !== "chunk-pointer" &&
        candidate.kind !== "chunk-tree" &&
        candidate.digest !== null)
    )
      throw new Error(
        `Render GC candidate "${candidate.path}" has duplicate or invalid ownership facts.`,
      );
    paths.add(path);
    if (candidate.kind === "chunk-pointer" || candidate.kind === "chunk-tree")
      chunkPublicationCandidates.add(path);
    const normalized = { ...candidate, path };
    if (
      (candidate.kind === "chunk" &&
        chunkPath !== null &&
        activeChunks.has(`${chunkPath[1]}\0${chunkPath[2]}`)) ||
      ((candidate.kind === "chunk-pointer" ||
        candidate.kind === "chunk-tree") &&
        retainedChunkPaths.has(path)) ||
      (candidate.kind === "publication" && activePublication.has(path))
    )
      keep.push(normalized);
    else remove.push(normalized);
  }
  for (const path of retainedChunkPaths)
    if (chunkPublicationCandidates.has(path) === false)
      throw new Error(
        `Render GC retained chunk path "${path}" has no exact pointer/tree candidate.`,
      );
  const retainedPairs = new Map<string, { pointers: number; trees: number }>();
  for (const path of retainedChunkPaths) {
    const pointer = /^(proxy|final)\/pointers\/([0-9a-f]{64})$/u.exec(path);
    const tree = /^(proxy|final)\/tmp\/([0-9a-f]{64})\.[^.]+\.\d+$/u.exec(path);
    const match = pointer ?? tree;
    if (match === null) continue;
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
    (total, candidate) => total + candidate.bytes,
    0,
  );
  if (Number.isSafeInteger(reclaimableBytes) === false)
    throw new Error(
      "Render GC reclaimable byte total exceeds safe integer range.",
    );
  return {
    version: 1,
    keep,
    remove,
    reclaimableBytes,
  };
};

const canonicalRelativePath = (value: string): string => {
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
};
