import type { IAutoMovieProductionEvidenceSourceOwnerBinding } from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

import { resolveAutoMovieSourceOwnerBinding } from "../../../../packages/production/src/production/sourceOwnerBinding";
import { namedFacts } from "../internal/predicates";

/**
 * Executed source exports resolve through one exact graph-selected owner edge.
 *
 * Scenarios:
 *
 * 1. Exact path, export, owner, digest, and current review resolve together.
 * 2. Missing, ambiguous, swapped-owner, stale-source, and stale-review edges
 *    fail with distinct reasons.
 * 3. A path alias and a same-named export from another branch cannot borrow the
 *    reviewed edge.
 */
export const test_production_source_owner_binding = (): void => {
  const binding: IAutoMovieProductionEvidenceSourceOwnerBinding = {
    branch: "spaceSources",
    stage: "review",
    enforced: true,
    relationship: "lineage",
    sourcePath: "src/spaces/hall.ts",
    exportName: "hall",
    symbolKind: "property",
    sourceDigest:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    targetPath: "docs/spaces/hall.md",
    targetAnchor: "hall",
    reviewed: true,
  };
  const resolve = (
    overrides: Partial<
      Parameters<typeof resolveAutoMovieSourceOwnerBinding>[0]
    > = {},
  ) =>
    resolveAutoMovieSourceOwnerBinding({
      bindings: [binding],
      branch: binding.branch,
      sourcePath: binding.sourcePath,
      exportName: binding.exportName,
      owner: `${binding.targetPath}#${binding.targetAnchor}`,
      sourceDigest: binding.sourceDigest,
      requireReviewed: true,
      ...overrides,
    });

  TestValidator.equals(
    "source owner binding admits exactly one current reviewed edge",
    namedFacts([
      ["exactEdgeResolves", () => resolve().success],
      [
        "shotEntryUsesSelectedOwnerWithoutRuntimeClaim",
        () => resolve({ owner: undefined }).success,
      ],
      [
        "missingEdgeIsDistinct",
        () => resolve({ bindings: [] }).reason === "missing",
      ],
      [
        "ambiguousEdgeIsDistinct",
        () => resolve({ bindings: [binding, binding] }).reason === "ambiguous",
      ],
      [
        "swappedOwnerIsDistinct",
        () =>
          resolve({ owner: "docs/spaces/annex.md#annex" }).reason === "owner",
      ],
      [
        "staleSourceIsDistinct",
        () => resolve({ sourceDigest: "sha256:changed" }).reason === "digest",
      ],
      [
        "unreviewedEdgeBlocksReview",
        () =>
          resolve({ bindings: [{ ...binding, reviewed: false }] }).reason ===
          "review",
      ],
      [
        "evidenceStageMayDiagnoseBeforeReview",
        () =>
          resolve({
            bindings: [{ ...binding, reviewed: false, stage: "evidence" }],
            requireReviewed: false,
          }).success,
      ],
      [
        "pathAliasCannotBorrowEdge",
        () =>
          resolve({ sourcePath: "src/spaces/./hall.ts" }).reason === "missing",
      ],
      [
        "otherBranchCannotBorrowEdge",
        () => resolve({ branch: "modelSources" }).reason === "missing",
      ],
    ]),
    {
      exactEdgeResolves: true,
      shotEntryUsesSelectedOwnerWithoutRuntimeClaim: true,
      missingEdgeIsDistinct: true,
      ambiguousEdgeIsDistinct: true,
      swappedOwnerIsDistinct: true,
      staleSourceIsDistinct: true,
      unreviewedEdgeBlocksReview: true,
      evidenceStageMayDiagnoseBeforeReview: true,
      pathAliasCannotBorrowEdge: true,
      otherBranchCannotBorrowEdge: true,
    },
  );
};
