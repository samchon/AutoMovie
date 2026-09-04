import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

import {
  captureAutoMovieLibraryAuthoringSnapshot,
  sameAutoMovieLibraryAuthoringSnapshot,
} from "../../../../packages/production/src/production/libraryAuthoringSnapshot";
import { namedFacts, throwsError } from "../internal/predicates";
import {
  LIBRARY_ANCHOR,
  LIBRARY_DESIGN,
  LIBRARY_SOURCE,
  libraryAuthoring,
} from "./libraryFixtures";

const ROOT = "C:/automovie/library-snapshot";
const sourceOwner = {
  branch: "spaces",
  stage: "review",
  enforced: true,
  relationship: "lineage" as const,
  sourcePath: LIBRARY_SOURCE,
  exportName: "hall",
  symbolKind: "property" as const,
  sourceDigest: `sha256:${"1".repeat(64)}`,
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
    [LIBRARY_SOURCE]: "export const hall = 1;\r\n",
  });
  const reordered = snapshot(
    {
      ...base,
      designBranches: [...base.designBranches].reverse(),
      designOwners: [...base.designOwners].reverse(),
      sourceOwners: [...base.sourceOwners].reverse(),
    },
    { [LIBRARY_SOURCE]: "export const hall = 1;\n" },
  );
  const changedOwner = snapshot(
    {
      ...base,
      designOwners: base.designOwners.map((owner) => ({
        ...owner,
        units: owner.units.map((unit) => ({ ...unit, digest: "b".repeat(64) })),
      })),
    },
    { [LIBRARY_SOURCE]: "export const hall = 1;\n" },
  );
  const changedStage = snapshot(
    {
      ...base,
      designBranches: base.designBranches.map((branch) => ({
        ...branch,
        designStage: "source",
      })),
    },
    { [LIBRARY_SOURCE]: "export const hall = 1;\n" },
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
    ]),
    {
      equivalentOrderAndEol: true,
      ownerDigestChanges: true,
      stageChanges: true,
      ownerPopulationChanges: true,
      sourceBytesChange: true,
      missingSourceChanges: true,
      rootMismatchRefused: true,
      nonLibraryRefused: true,
    },
  );
};
