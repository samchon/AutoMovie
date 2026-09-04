import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  digestAutoMovieBytes,
  normalizeAutoMovieSource,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts, throwsError } from "../internal/predicates";
import {
  LIBRARY_ANCHOR,
  LIBRARY_DESIGN,
  LIBRARY_SOURCE,
  libraryAuthoring,
} from "./libraryFixtures";

type Snapshot = { digest: string };
const {
  captureAutoMovieLibraryAuthoringSnapshot,
  createAutoMovieLibrarySourceExecutionPlan,
  sameAutoMovieLibraryAuthoringSnapshot,
} = loadSourceModule<{
  captureAutoMovieLibraryAuthoringSnapshot: (props: {
    root: string;
    evidence: IAutoMovieProductionEvidence;
    readSource: (file: string) => Uint8Array;
  }) => Snapshot;
  createAutoMovieLibrarySourceExecutionPlan: (
    snapshot: Snapshot,
    requireReview?: boolean,
  ) => {
    entries: Array<{ branch: string }>;
    problems: string[];
  };
  sameAutoMovieLibraryAuthoringSnapshot: (
    left: Snapshot,
    right: Snapshot,
  ) => boolean;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/libraryAuthoringSnapshot.ts",
  ),
);

const ROOT = "C:/automovie/library-snapshot";
const SOURCE = "export const hall = 1;\n";
const SOURCE_DIGEST = digestAutoMovieBytes(
  normalizeAutoMovieSource(Buffer.from(SOURCE)),
);
const sourceOwner = {
  branch: "spaceSources",
  stage: "review",
  enforced: true,
  relationship: "lineage" as const,
  sourcePath: LIBRARY_SOURCE,
  exportName: "hall",
  symbolKind: "property" as const,
  sourceDigest: SOURCE_DIGEST,
  targetPath: LIBRARY_DESIGN,
  targetAnchor: LIBRARY_ANCHOR,
  reviewed: true,
};

const snapshot = (
  evidence: IAutoMovieProductionEvidence,
  sources: Readonly<Record<string, string | undefined>>,
) =>
  captureAutoMovieLibraryAuthoringSnapshot({
    root: ROOT,
    evidence,
    readSource: (file) => {
      const value = sources[file];
      if (value === undefined) throw new Error("missing");
      return Buffer.from(value);
    },
  });

/**
 * Library currentness reacquires the complete graph-selected input closure.
 *
 * Scenarios:
 *
 * 1. Object and discovery-order changes plus CRLF/LF spelling preserve identity.
 * 2. Owner digest, stage, population addition, source bytes, and source deletion each change identity independently.
 * 3. A mismatched project root or non-library declaration is refused before source execution.
 */
export const test_production_library_authoring_snapshot = (): void => {
  const base = {
    ...libraryAuthoring({ root: ROOT }),
    sourceOwners: [sourceOwner],
  };
  const initial = snapshot(base, {
    [LIBRARY_SOURCE]: SOURCE.replace("\n", "\r\n"),
  });
  const reordered = snapshot(
    {
      ...base,
      designBranches: [...base.designBranches].reverse(),
      designOwners: [...base.designOwners].reverse(),
      sourceOwners: [...base.sourceOwners].reverse(),
    },
    { [LIBRARY_SOURCE]: SOURCE },
  );
  const changedOwner = snapshot(
    {
      ...base,
      designOwners: base.designOwners.map((owner) => ({
        ...owner,
        units: owner.units.map((unit) => ({ ...unit, digest: "b".repeat(64) })),
      })),
    },
    { [LIBRARY_SOURCE]: SOURCE },
  );
  const changedStage = snapshot(
    {
      ...base,
      designBranches: base.designBranches.map((branch) => ({
        ...branch,
        designStage: "source",
      })),
    },
    { [LIBRARY_SOURCE]: SOURCE },
  );
  const added = snapshot(
    {
      ...base,
      sourceOwners: [
        ...base.sourceOwners,
        { ...sourceOwner, exportName: "annex", targetAnchor: "annex" },
      ],
    },
    {
      [LIBRARY_SOURCE]: "export const hall = 1;\n",
      "src/spaces/annex.ts": "export const annex = 1;\n",
    },
  );
  const productionSource = "src/production/register.ts";
  const productionText = "export const register = 1;\n";
  const productionOwner = {
    ...sourceOwner,
    branch: "productionSources",
    sourcePath: productionSource,
    exportName: "register",
    sourceDigest: digestAutoMovieBytes(
      normalizeAutoMovieSource(Buffer.from(productionText)),
    ),
  };
  const execution = createAutoMovieLibrarySourceExecutionPlan(initial);
  const productionExecution = createAutoMovieLibrarySourceExecutionPlan(
    snapshot(
      { ...base, sourceOwners: [...base.sourceOwners, productionOwner] },
      {
        [LIBRARY_SOURCE]: SOURCE,
        [productionSource]: productionText,
      },
    ),
  );
  const staleExecution = createAutoMovieLibrarySourceExecutionPlan(
    snapshot(base, { [LIBRARY_SOURCE]: "export const hall = 2;\n" }),
  );
  const missingExecution = createAutoMovieLibrarySourceExecutionPlan(
    snapshot(base, {}),
  );
  const unreviewedExecution = createAutoMovieLibrarySourceExecutionPlan(
    snapshot(
      {
        ...base,
        sourceOwners: [{ ...sourceOwner, reviewed: false }],
      },
      { [LIBRARY_SOURCE]: SOURCE },
    ),
  );
  const sourceStageExecution = createAutoMovieLibrarySourceExecutionPlan(
    snapshot(
      {
        ...base,
        sourceOwners: [{ ...sourceOwner, reviewed: false }],
      },
      { [LIBRARY_SOURCE]: SOURCE },
    ),
    false,
  );
  const duplicateExecution = createAutoMovieLibrarySourceExecutionPlan(
    snapshot(
      {
        ...base,
        sourceOwners: [
          sourceOwner,
          { ...sourceOwner, targetAnchor: "competing-owner" },
        ],
      },
      { [LIBRARY_SOURCE]: SOURCE },
    ),
  );
  const disabled = {
    ...base,
    designBranches: base.designBranches.map((branch) => ({
      ...branch,
      sourceBinding:
        branch.sourceBinding === null
          ? null
          : {
              ...branch.sourceBinding,
              enforced: false,
              paths: ["src/spaces/disabled.ts"],
            },
    })),
    designOwners: base.designOwners.map((owner) => ({
      ...owner,
      sourceBinding:
        owner.sourceBinding === null
          ? null
          : {
              ...owner.sourceBinding,
              enforced: false,
              paths: ["src/spaces/disabled.ts"],
            },
    })),
    sourceOwners: [{ ...sourceOwner, enforced: false }],
  };
  TestValidator.equals(
    "library snapshot is complete, canonical, and freshly comparable",
    namedFacts([
      [
        "equivalentOrderAndEol",
        () => sameAutoMovieLibraryAuthoringSnapshot(initial, reordered),
      ],
      ["ownerDigestChanges", () => initial.digest !== changedOwner.digest],
      ["stageChanges", () => initial.digest !== changedStage.digest],
      ["ownerPopulationChanges", () => initial.digest !== added.digest],
      [
        "disabledSourceBytesIgnored",
        () =>
          snapshot(disabled, { "src/spaces/disabled.ts": "first" }).digest ===
          snapshot(disabled, { "src/spaces/disabled.ts": "second" }).digest,
      ],
      [
        "sourceBytesChange",
        () =>
          initial.digest !==
          snapshot(base, { [LIBRARY_SOURCE]: "export const hall = 2;\n" })
            .digest,
      ],
      [
        "missingSourceChanges",
        () => initial.digest !== snapshot(base, {}).digest,
      ],
      [
        "rootMismatchRefused",
        () =>
          throwsError(
            () =>
              captureAutoMovieLibraryAuthoringSnapshot({
                root: "C:/other",
                evidence: base,
                readSource: () => Buffer.from(""),
              }),
            "not compiler root",
          ),
      ],
      [
        "nonLibraryRefused",
        () =>
          throwsError(
            () =>
              snapshot(
                {
                  ...base,
                  manifest: { ...base.manifest, kind: "brief" },
                } as IAutoMovieProductionEvidence,
                { [LIBRARY_SOURCE]: "" },
              ),
            'requires kind "library"',
          ),
      ],
      [
        "reviewedSourceExecuted",
        () => execution.entries.length === 1 && execution.problems.length === 0,
      ],
      [
        "productionSourceExecuted",
        () =>
          productionExecution.entries.some(
            (entry) => entry.branch === "productionSources",
          ) && productionExecution.problems.length === 0,
      ],
      [
        "staleSourceRefused",
        () =>
          staleExecution.entries.length === 0 &&
          staleExecution.problems.some((problem) =>
            problem.includes("changed after"),
          ),
      ],
      [
        "missingSourceRefused",
        () =>
          missingExecution.entries.length === 0 &&
          missingExecution.problems.some((problem) =>
            problem.includes("missing or unreadable"),
          ),
      ],
      [
        "unreviewedSourceRefused",
        () =>
          unreviewedExecution.entries.length === 0 &&
          unreviewedExecution.problems.some((problem) =>
            problem.includes("no current enforced reviewed owner edge"),
          ),
      ],
      [
        "sourceStageAllowsUnreviewed",
        () =>
          sourceStageExecution.entries.length === 1 &&
          sourceStageExecution.problems.length === 0,
      ],
      [
        "duplicateOwnerRefused",
        () =>
          duplicateExecution.entries.length === 0 &&
          duplicateExecution.problems.some((problem) =>
            problem.includes("duplicated"),
          ),
      ],
    ]),
    {
      equivalentOrderAndEol: true,
      ownerDigestChanges: true,
      stageChanges: true,
      ownerPopulationChanges: true,
      disabledSourceBytesIgnored: true,
      sourceBytesChange: true,
      missingSourceChanges: true,
      rootMismatchRefused: true,
      nonLibraryRefused: true,
      reviewedSourceExecuted: true,
      productionSourceExecuted: true,
      staleSourceRefused: true,
      missingSourceRefused: true,
      unreviewedSourceRefused: true,
      sourceStageAllowsUnreviewed: true,
      duplicateOwnerRefused: true,
    },
  );
};
