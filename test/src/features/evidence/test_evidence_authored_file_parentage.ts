import {
  AUTOMOVIE_AUTHORED_DOCUMENT_LAYERS,
  createAutoMovieAuthoredFileClaims,
} from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";
import type { ITtscEvidenceGraphReference } from "@ttsc/evidence";

/**
 * File parentage belongs to narrative and delivery documents; technical design
 * consumes foundations through its H2 owners without a duplicate file duty.
 *
 * Scenarios:
 * 1. Every authored role receives the same inherited targets; only narrative and
 *    delivery roles produce a file claim.
 * 2. Enabled and disabled claims retain the supplied population and references.
 * 3. An empty reference population produces no file claim for any role.
 */
export const test_evidence_authored_file_parentage = (): void => {
  const population = ["design/one.md", "design/two.md"];
  const references: ITtscEvidenceGraphReference[] = [
    {
      type: "markdown",
      root: "docs",
      files: ["settings/**/*.md"],
      symbol: "h2",
      requireReview: true,
    },
    {
      type: "markdown",
      root: "docs",
      files: ["scripts/**/*.md"],
      symbol: "file",
      uniqueEvidence: true,
    },
  ];
  const wholeDocumentRoles = new Set([
    "treatments",
    "scripts",
    "screenplays",
    "briefs",
  ]);
  for (const layer of AUTOMOVIE_AUTHORED_DOCUMENT_LAYERS)
    for (const enabled of [false, true]) {
      const claims = createAutoMovieAuthoredFileClaims(
        layer,
        population,
        references,
        enabled,
      );
      TestValidator.equals(
        `${layer} file ownership`,
        claims.length,
        wholeDocumentRoles.has(layer) ? 1 : 0,
      );
      for (const claim of claims)
        TestValidator.equals(
          `${layer} inherited relationships`,
          {
            type: claim.type,
            root: claim.root,
            symbol: claim.symbol,
            files: claim.files,
            disabled: claim.disabled,
            reference: claim.reference,
          },
          {
            type: "markdown",
            root: "docs",
            symbol: "file",
            files: population,
            disabled: !enabled,
            reference: references,
          },
        );
      TestValidator.equals(
        `${layer} empty parents`,
        createAutoMovieAuthoredFileClaims(layer, population, [], enabled),
        [],
      );
    }
};
