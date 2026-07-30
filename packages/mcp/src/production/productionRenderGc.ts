import { AutoMovieContentDigest } from "@automovie/interface";

import { IAutoMovieProductionRenderJobPlan } from "./productionRenderJob";

/** One renderer-owned disk entry considered by mark-and-sweep. */
export interface IAutoMovieProductionRenderGcCandidate {
  /** Render-state-root-relative canonical POSIX path. */
  path: string;
  /** Ownership class; active locks and attempts are deliberately absent. */
  kind: "chunk" | "quarantine" | "publication";
  /** Chunk digest for chunk entries, otherwise null. */
  digest: AutoMovieContentDigest | null;
  /** Recursive resident byte count reported by the host. */
  bytes: number;
}

/** Dry-run result; hosts may delete only the exact `remove` entries. */
export interface IAutoMovieProductionRenderGcPlan {
  /** GC plan schema. */
  version: 1;
  /** Entries retained because a current plan or publication marks them. */
  keep: IAutoMovieProductionRenderGcCandidate[];
  /** Unreferenced entries safe to sweep. */
  remove: IAutoMovieProductionRenderGcCandidate[];
  /** Exact sum of removable resident bytes. */
  reclaimableBytes: number;
}

/**
 * Mark current proxy/final plans and publication files, then classify garbage.
 *
 * Locks, attempts, and arbitrary paths never enter this planner. The CLI keeps
 * those operational records outside the candidate inventory so GC cannot race
 * an active worker.
 */
export const planProductionRenderGc = (props: {
  /** Current plans from every retained tier. */
  plans: readonly IAutoMovieProductionRenderJobPlan[];
  /** Paths claimed by the current aggregate publication manifest. */
  publicationPaths: readonly string[];
  /** Physical inventory collected without following links. */
  candidates: readonly IAutoMovieProductionRenderGcCandidate[];
}): IAutoMovieProductionRenderGcPlan => {
  const activeChunks = new Set(
    props.plans.flatMap((plan) => plan.chunks.map((chunk) => chunk.id)),
  );
  const activePublication = new Set(
    props.publicationPaths.map(canonicalRelativePath),
  );
  const paths = new Set<string>();
  const keep: IAutoMovieProductionRenderGcCandidate[] = [];
  const remove: IAutoMovieProductionRenderGcCandidate[] = [];
  for (const candidate of [...props.candidates].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  )) {
    const path = canonicalRelativePath(candidate.path);
    const chunkPath = /^(?:proxy|final)\/chunks\/([0-9a-f]{64})$/u.exec(path);
    if (
      paths.has(path) ||
      Number.isSafeInteger(candidate.bytes) === false ||
      candidate.bytes < 0 ||
      (candidate.kind === "chunk" &&
        (candidate.digest === null ||
          /^sha256:[0-9a-f]{64}$/.test(candidate.digest) === false ||
          chunkPath === null ||
          candidate.digest !== `sha256:${chunkPath[1]}`)) ||
      (candidate.kind === "quarantine" &&
        /^(?:proxy|final)\/quarantine\/[^/]+$/u.test(path) === false) ||
      (candidate.kind === "publication" &&
        path.startsWith("publication/") === false) ||
      (candidate.kind !== "chunk" && candidate.digest !== null)
    )
      throw new Error(
        `Render GC candidate "${candidate.path}" has duplicate or invalid ownership facts.`,
      );
    paths.add(path);
    const normalized = { ...candidate, path };
    if (
      (candidate.kind === "chunk" && activeChunks.has(candidate.digest!)) ||
      (candidate.kind === "publication" && activePublication.has(path))
    )
      keep.push(normalized);
    else remove.push(normalized);
  }
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
