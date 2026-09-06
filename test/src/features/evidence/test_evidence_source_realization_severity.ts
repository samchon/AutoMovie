import {
  type AutoMovieSourceRealizationBranch,
  createAutoMovieSourceRealizationReferences,
} from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

/**
 * Source realization can reach its first render without paying a review that
 * only that render makes possible. The graph still charges the same exact
 * target population and cardinality at error level. This unit examines only
 * AutoMovie's typed configuration output, never native evidence evaluation.
 *
 * Scenarios:
 * 1. Every rendered source family keeps error structure beside warning review.
 * 2. System evaluation and production serialization retain error freshness.
 * 3. Pre-review declarations emit only error structure with no review demand.
 * 4. File, unit, and scene selectors retain their roots, exclusions, checklist,
 *    ownership, and cardinality in both references without mutating the input.
 */
export const test_evidence_source_realization_severity = (): void => {
  const families: readonly [AutoMovieSourceRealizationBranch, boolean][] = [
    ["mapSources", true],
    ["modelSources", true],
    ["spaceSources", true],
    ["materialSources", true],
    ["instanceSources", true],
    ["motionSources", true],
    ["shots", true],
    ["filmSources", true],
    ["systemSources", false],
    ["productionSources", false],
  ];
  for (const [branch, rendered] of families)
    for (const requireReview of [false, true]) {
      const reference = {
        type: "markdown",
        root: "docs",
        files: ["models/**/*.md", "!models/excluded.md"],
        symbol: "file",
        noEvidenceExclude: true,
        singleEvidencePerSymbol: true,
      } satisfies Parameters<
        typeof createAutoMovieSourceRealizationReferences
      >[0]["reference"];
      const input = {
        ...reference,
        files: [...reference.files],
      };
      const output = createAutoMovieSourceRealizationReferences({
        branch,
        reference: input,
        requireReview,
      });
      const expected: ReturnType<
        typeof createAutoMovieSourceRealizationReferences
      > = [
        {
          ...input,
          severity: "error",
          requireReview: requireReview && !rendered,
        },
      ];
      if (rendered && requireReview)
        expected.push({
          ...input,
          severity: "warning",
          requireReview: true,
        });
      TestValidator.equals(
        `${branch} review=${requireReview}`,
        output,
        expected,
      );
      TestValidator.equals("caller reference unchanged", input, reference);
    }
  for (const symbol of ["file", "h2", "h3"] as const) {
    const reference = {
      type: "markdown",
      root: "docs",
      files: ["briefs/**/*.md"],
      symbol,
      noEvidenceExclude: true,
      uniqueEvidence: true,
      singleEvidencePerSymbol: true,
      checklist: true,
    } satisfies Parameters<
      typeof createAutoMovieSourceRealizationReferences
    >[0]["reference"];
    const output = createAutoMovieSourceRealizationReferences({
      branch: "shots",
      reference: { ...reference, files: [...reference.files] },
      requireReview: true,
    });
    TestValidator.equals(
      `${symbol} structural policy stays strict beside rendered review`,
      output,
      [
        { ...reference, severity: "error", requireReview: false },
        { ...reference, severity: "warning", requireReview: true },
      ],
    );
  }
};
