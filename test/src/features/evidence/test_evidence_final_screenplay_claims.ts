import {
  createAutoMovieScreenplayNaturalnessClaims,
  createBlankAutoMovieProductionEvidence,
} from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

/**
 * Final screenplay claims preserve construction identity at each host depth
 * while placing audience-language checklists only on authored heading units.
 *
 * Scenarios:
 * 1. Every stage emits file/H2/H3/H4 lineage; only evidence and review enable
 *    claims, and only review requires current review companions.
 * 2. Complete and first-pilot populations select matching construction/final
 *    directories; a disabled construction branch retains its full denominator.
 * 3. File lineage has no naturalness checklist; each heading independently
 *    answers the common, story, and selected-language naturalness families.
 */
export const test_evidence_final_screenplay_claims = (): void => {
  const blank = createBlankAutoMovieProductionEvidence(
    "/production",
    "english",
  );
  for (const scope of [
    { mode: "complete-production" as const },
    { mode: "first-pilot" as const, partitionGroup: "001-first" },
  ])
    for (const construction of ["disabled", "review"] as const)
      for (const stage of [
        "disabled",
        "draft",
        "evidence",
        "review",
      ] as const) {
        const graph = {
          ...blank,
          populationScope: scope,
          screenplays: construction,
          naturalness: { screenplays: stage },
        };
        const group =
          scope.mode === "first-pilot" && construction !== "disabled"
            ? "001-first"
            : "*";
        const constructionFiles = [`screenplays/${group}/???-*.md`];
        const claims = createAutoMovieScreenplayNaturalnessClaims(graph);
        TestValidator.equals(
          "one lineage claim per host depth",
          claims.map(({ branch, claim }) => ({ branch, symbol: claim.symbol })),
          ["file", "h2", "h3", "h4"].map((symbol) => ({
            branch: "screenplayNaturalness",
            symbol,
          })),
        );
        for (const { claim } of claims) {
          TestValidator.equals(
            "final hosts",
            {
              type: claim.type,
              root: claim.root,
              files: claim.files,
              disabled: claim.disabled,
            },
            {
              type: "markdown",
              root: "docs",
              files: [`final/screenplays/${group}/???-*.md`],
              disabled: stage === "disabled" || stage === "draft",
            },
          );
          const references = Array.isArray(claim.reference)
            ? claim.reference
            : [claim.reference];
          TestValidator.equals(
            "same-depth one-to-one construction lineage",
            references[0],
            {
              type: "markdown",
              root: "docs",
              files: constructionFiles,
              symbol: claim.symbol,
              noEvidenceExclude: true,
              uniqueEvidence: true,
              singleEvidencePerSymbol: true,
              requireReview: stage === "review",
            },
          );
          TestValidator.equals(
            "only headings answer all naturalness families",
            references.slice(1),
            claim.symbol === "file"
              ? []
              : [
                  "naturalness/core/common.md",
                  "naturalness/story/screenplays.md",
                  "language/naturalness/screenplays.md",
                ].map((file) => ({
                  type: "markdown",
                  root: "docs",
                  files: [file],
                  symbol: "h2",
                  checklist: true,
                  noEvidenceExclude: true,
                  requireReview: stage === "review",
                })),
          );
        }
      }
};
