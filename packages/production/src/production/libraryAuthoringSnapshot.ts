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

/** One current source selected by the authoring graph. */
export interface IAutoMovieLibraryAuthoringSourceSnapshot {
  /** Canonical project-relative POSIX path. */
  path: string;
  /** Semantic source digest, or null when the selected member is absent. */
  digest: AutoMovieContentDigest | null;
}

/** Canonical graph and source identity acquired at one point in time. */
export interface IAutoMovieLibraryAuthoringSnapshot {
  version: 1;
  protocol: typeof AUTOMOVIE_LIBRARY_AUTHORING_SNAPSHOT_PROTOCOL;
  root: string;
  packageName: string;
  kind: "library";
  configuration: IAutoMovieProductionEvidence["configuration"];
  manifest: IAutoMovieProductionEvidence["manifest"];
  designBranches: readonly IAutoMovieProductionEvidenceDesignBranch[];
  designOwners: readonly IAutoMovieProductionEvidenceDesignOwner[];
  sourceOwners: readonly IAutoMovieProductionEvidenceSourceOwnerBinding[];
  sources: readonly IAutoMovieLibraryAuthoringSourceSnapshot[];
  digest: AutoMovieContentDigest;
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
