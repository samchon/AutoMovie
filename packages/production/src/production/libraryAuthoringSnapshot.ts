import type {
  IAutoMovieProductionEvidence,
  IAutoMovieProductionEvidenceDesignBranch,
  IAutoMovieProductionEvidenceDesignOwner,
  IAutoMovieProductionEvidenceSourceOwnerBinding,
} from "@automovie/evidence";
import type { AutoMovieContentDigest } from "@automovie/interface";
import path from "node:path";

import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
  normalizeAutoMovieSource,
} from "./contentIdentity";

/** Versioned identity of the graph-selected library input closure. */
export const AUTOMOVIE_LIBRARY_AUTHORING_SNAPSHOT_PROTOCOL =
  "automovie.library-authoring-snapshot.v1" as const;

/**
 * One current source selected by the authoring graph.
 *
 * @author Samchon
 */
export interface IAutoMovieLibraryAuthoringSourceSnapshot {
  /** Canonical project-relative POSIX path. */
  path: string;
  /** Semantic source digest, or null when the selected member is absent. */
  digest: AutoMovieContentDigest | null;
}

/**
 * Canonical graph and source identity acquired at one point in time.
 *
 * @author Samchon
 */
export interface IAutoMovieLibraryAuthoringSnapshot {
  /** Snapshot schema version. */
  version: 1;
  /** Protocol that gives the snapshot identity its meaning. */
  protocol: typeof AUTOMOVIE_LIBRARY_AUTHORING_SNAPSHOT_PROTOCOL;
  /** Absolute normalized compiler project root. */
  root: string;
  /** Package identity observed with the authoring graph. */
  packageName: string;
  /** Graph-selected production kind. */
  kind: "library";
  /** Complete graph configuration in effect for the attempt. */
  configuration: IAutoMovieProductionEvidence["configuration"];
  /** Selected production manifest. */
  manifest: IAutoMovieProductionEvidence["manifest"];
  /** Complete canonical design-branch population. */
  designBranches: readonly IAutoMovieProductionEvidenceDesignBranch[];
  /** Complete canonical design-owner population. */
  designOwners: readonly IAutoMovieProductionEvidenceDesignOwner[];
  /** Complete canonical source-owner population. */
  sourceOwners: readonly IAutoMovieProductionEvidenceSourceOwnerBinding[];
  /** Normalized bytes identity of every selected source member. */
  sources: readonly IAutoMovieLibraryAuthoringSourceSnapshot[];
  /** Canonical digest of the complete snapshot. */
  digest: AutoMovieContentDigest;
}

/**
 * One exact graph-selected source export admitted to library execution.
 *
 * @author Samchon
 */
export interface IAutoMovieLibrarySourceExecution {
  /** Graph source branch that selected the export. */
  branch: string;
  /** Canonical project-relative POSIX source module path. */
  sourcePath: string;
  /** Named top-level export to evaluate. */
  exportName: string;
  /** Exact authored target path and anchor. */
  owner: string;
  /** Reviewed normalized source digest. */
  sourceDigest: string;
  /** Whether the current graph edge passed review. */
  reviewed: boolean;
}

/**
 * Executable source plan and every refusal found before sandbox evaluation.
 *
 * @author Samchon
 */
export interface IAutoMovieLibrarySourceExecutionPlan {
  /** Canonically ordered exports safe to execute together. */
  entries: readonly IAutoMovieLibrarySourceExecution[];
  /** Complete selected source identity, including missing members. */
  sources: readonly IAutoMovieLibraryAuthoringSourceSnapshot[];
  /** Refusals that empty the executable entry set. */
  problems: readonly string[];
}

/**
 * Acquire one complete library authoring closure from a fresh graph snapshot.
 *
 * The caller supplies source reads from the same project handle that will run
 * the compiler. Missing selected members remain in the identity as `null`, so
 * deletion is a stale transition rather than an exception that skips the
 * publication guard.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-change-impact-visibility Makes every selected owner, binding, export and normalized source revision part of the guarded library input.
 * @evidence requirements/agent-authoring/partial-work.md#agent-atomic-compilation Gives pre-publication currentness one complete graph-derived snapshot to reacquire.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Reconstructs the exact source population selected by the live authoring declaration.
 * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-atomic-invariant Domain-separates one immutable library attempt from a later graph or source transition.
 * @author Samchon
 */
export const captureAutoMovieLibraryAuthoringSnapshot = (props: {
  root: string;
  evidence: IAutoMovieProductionEvidence;
  readSource: (path: string) => Uint8Array;
}): IAutoMovieLibraryAuthoringSnapshot => {
  const root = path.resolve(props.root);
  if (path.resolve(props.evidence.root) !== root)
    throw new Error(
      `Library authoring evidence belongs to "${path.resolve(props.evidence.root)}", not compiler root "${root}". Reopen evidence from the selected project before compiling.`,
    );
  if (props.evidence.manifest.kind !== "library")
    throw new Error(
      `Library authoring snapshot requires kind "library", not "${props.evidence.manifest.kind ?? "unselected"}".`,
    );

  const paths = new Set<string>();
  for (const branch of props.evidence.designBranches)
    for (const source of branch.sourceBinding?.paths ?? []) paths.add(source);
  for (const owner of props.evidence.designOwners)
    for (const source of owner.sourceBinding?.paths ?? []) paths.add(source);
  for (const owner of props.evidence.sourceOwners ?? [])
    paths.add(owner.sourcePath);

  const sources = [...paths]
    .sort(compareCodeUnits)
    .map((source): IAutoMovieLibraryAuthoringSourceSnapshot => {
      try {
        return {
          path: source,
          digest: digestAutoMovieBytes(
            normalizeAutoMovieSource(props.readSource(source)),
          ),
        };
      } catch {
        return { path: source, digest: null };
      }
    });
  const identity = {
    version: 1 as const,
    protocol: AUTOMOVIE_LIBRARY_AUTHORING_SNAPSHOT_PROTOCOL,
    root,
    packageName: props.evidence.packageName,
    kind: "library" as const,
    configuration: props.evidence.configuration,
    manifest: props.evidence.manifest,
    designBranches: sortedDesignBranches(props.evidence.designBranches),
    designOwners: sortedDesignOwners(props.evidence.designOwners),
    sourceOwners: sortedSourceOwners(props.evidence.sourceOwners ?? []),
    sources,
  };
  return {
    ...identity,
    digest: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(identity)),
  };
};

/** Compare two independently acquired closures by their canonical digest. */
export const sameAutoMovieLibraryAuthoringSnapshot = (
  left: IAutoMovieLibraryAuthoringSnapshot,
  right: IAutoMovieLibraryAuthoringSnapshot,
): boolean => left.digest === right.digest;

/**
 * Bind every executable library export to the snapshot bytes it will run.
 *
 * Source-owner edges include design source branches and the separately
 * selected `productionSources` branch. The plan therefore cannot silently
 * hash a reviewed production source without executing its named export, and a
 * stale, missing, ambiguous, or unreviewed edge stays outside `entries`.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Makes reviewed library production sources part of both execution and result attribution.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-derivation-output-lineage Carries source path, named export, exact authored owner and source digest as one execution identity.
 * @author Samchon
 */
export const createAutoMovieLibrarySourceExecutionPlan = (
  snapshot: IAutoMovieLibraryAuthoringSnapshot,
): IAutoMovieLibrarySourceExecutionPlan => {
  const sourceDigests = new Map(
    snapshot.sources.map((source) => [source.path, source.digest]),
  );
  const identities = new Set<string>();
  const entries: IAutoMovieLibrarySourceExecution[] = [];
  const problems: string[] = [];
  for (const binding of snapshot.sourceOwners) {
    const identity = JSON.stringify([
      binding.branch,
      binding.sourcePath,
      binding.exportName,
    ]);
    if (identities.has(identity)) {
      problems.push(
        `Library source owner edge ${identity} is duplicated in the current authoring snapshot.`,
      );
      continue;
    }
    identities.add(identity);
    const digest = sourceDigests.get(binding.sourcePath) ?? null;
    if (digest === null) {
      problems.push(
        `Library source "${binding.sourcePath}" is selected by the authoring graph but is missing or unreadable.`,
      );
      continue;
    }
    if (digest !== binding.sourceDigest) {
      problems.push(
        `Library source "${binding.sourcePath}" changed after its owner edge was resolved (${binding.sourceDigest} -> ${digest}).`,
      );
      continue;
    }
    if (binding.enforced === false || binding.reviewed === false) {
      problems.push(
        `Library source "${binding.sourcePath}#${binding.exportName}" has no current enforced reviewed owner edge.`,
      );
      continue;
    }
    entries.push({
      branch: binding.branch,
      sourcePath: binding.sourcePath,
      exportName: binding.exportName,
      owner: `${binding.targetPath}#${binding.targetAnchor}`,
      sourceDigest: binding.sourceDigest,
      reviewed: binding.reviewed,
    });
  }
  entries.sort((left, right) =>
    compareCodeUnits(
      JSON.stringify([
        left.branch,
        left.sourcePath,
        left.exportName,
        left.owner,
      ]),
      JSON.stringify([
        right.branch,
        right.sourcePath,
        right.exportName,
        right.owner,
      ]),
    ),
  );
  return {
    entries: problems.length === 0 ? entries : [],
    sources: snapshot.sources,
    problems,
  };
};

const sortedDesignBranches = (
  branches: readonly IAutoMovieProductionEvidenceDesignBranch[],
): readonly IAutoMovieProductionEvidenceDesignBranch[] =>
  [...branches]
    .map((branch) => ({
      ...branch,
      sourceBinding:
        branch.sourceBinding === null
          ? null
          : {
              ...branch.sourceBinding,
              files: [...branch.sourceBinding.files].sort(compareCodeUnits),
              paths: [...branch.sourceBinding.paths].sort(compareCodeUnits),
              symbols: [...branch.sourceBinding.symbols].sort(compareCodeUnits),
            },
    }))
    .sort((left, right) => compareCodeUnits(left.branch, right.branch));

const sortedDesignOwners = (
  owners: readonly IAutoMovieProductionEvidenceDesignOwner[],
): readonly IAutoMovieProductionEvidenceDesignOwner[] =>
  [...owners]
    .map((owner) => ({
      ...owner,
      sourceBinding:
        owner.sourceBinding === null
          ? null
          : {
              ...owner.sourceBinding,
              files: [...owner.sourceBinding.files].sort(compareCodeUnits),
              paths: [...owner.sourceBinding.paths].sort(compareCodeUnits),
              symbols: [...owner.sourceBinding.symbols].sort(compareCodeUnits),
            },
    }))
    .sort((left, right) =>
      compareCodeUnits(
        `${left.branch}\0${left.path}`,
        `${right.branch}\0${right.path}`,
      ),
    );

const sortedSourceOwners = (
  owners: readonly IAutoMovieProductionEvidenceSourceOwnerBinding[],
): readonly IAutoMovieProductionEvidenceSourceOwnerBinding[] =>
  [...owners].sort((left, right) =>
    compareCodeUnits(
      JSON.stringify([
        left.branch,
        left.sourcePath,
        left.exportName,
        left.targetPath,
        left.targetAnchor,
      ]),
      JSON.stringify([
        right.branch,
        right.sourcePath,
        right.exportName,
        right.targetPath,
        right.targetAnchor,
      ]),
    ),
  );
