import {
  type AutoMovieProductionContractClaim,
  createAutoMovieProductionPrincipleClaim,
  createBlankAutoMovieProductionEvidence,
  validateAutoMovieLocalContractClaims,
} from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";
import type { ITtscEvidenceGraphMarkdownReference } from "@ttsc/evidence";

import { throwsError } from "../internal/predicates";

/**
 * AutoMovie principle metadata retains its owning checklist policy rather than
 * describing a stronger obligation than the native evaluator receives.
 *
 * Scenarios:
 * 1. Every stage and both passes admit canonical single and multiple targets,
 *    scalar references, alternate document roots, and pilot-only audits.
 * 2. Claim and reference severity, exclusion, review, cardinality, target kind,
 *    host kind, and malformed target inventories cannot detach from that policy.
 * 3. Metadata-free native declarations retain their independently chosen policy.
 */
export const test_evidence_local_principle_policy = (): void => {
  const blank = createBlankAutoMovieProductionEvidence(
    "/production",
    "english",
  );
  for (const pass of ["construction", "naturalness"] as const)
    for (const stage of ["disabled", "draft", "evidence", "review"] as const) {
      const props = {
        name: "one authored expression rule",
        document: "contracts/expression.md",
        files: [
          pass === "construction"
            ? "screenplays/*/*.md"
            : "final/screenplays/*/*.md",
        ],
        symbol: ["h2", "h3", "h4"] as ("h2" | "h3" | "h4")[],
        layer: "screenplays" as const,
        stage,
        pass,
        populationScope: blank.populationScope,
      };
      const claim = createAutoMovieProductionPrincipleClaim(props);
      const graph = {
        ...blank,
        screenplays: stage,
        naturalness: { screenplays: stage },
        claims: [claim],
      };
      const reference = (
        claim.reference as ITtscEvidenceGraphMarkdownReference[]
      )[0]!;
      for (const valid of [
        claim,
        { ...claim, severity: undefined },
        { ...claim, reference },
        createAutoMovieProductionPrincipleClaim({
          ...props,
          document: [props.document, "contracts/another.md"],
        }),
        createAutoMovieProductionPrincipleClaim({
          ...props,
          documentRoot: "docs/contracts",
          document: "expression.md",
          symbol: "h2",
        }),
      ])
        validateAutoMovieLocalContractClaims({ ...graph, claims: [valid] });

      const referenceMutations: Partial<ITtscEvidenceGraphMarkdownReference>[] =
        [
          { noEvidenceExclude: false },
          { noEvidenceExclude: undefined },
          { requireReview: stage !== "review" },
          { requireReview: undefined },
          { severity: "warning" },
          { severity: "off" },
          { severity: 0 },
          { severity: "error" },
          { symbol: "file" },
          { symbol: "h1" },
          { symbol: undefined },
          { checklist: false },
          { checklist: undefined },
          { uniqueEvidence: true },
          { singleEvidencePerSymbol: true },
          { root: "." },
          { root: undefined },
          { files: [] },
          { files: [props.document, "contracts/another.md"] },
          { files: ["contracts/index.md"] },
          { files: ["contracts/nested/rule.md"] },
        ];
      const mutations: Partial<AutoMovieProductionContractClaim>[] = [
        ...referenceMutations.map((change) => ({
          reference: [{ ...reference, ...change }],
        })),
        ...(["off", 0, "warning", "error", 2] as const).map((severity) => ({
          severity,
        })),
        { name: undefined },
        { symbol: undefined },
        { symbol: "file" },
        { symbol: "h1" },
        { symbol: [] },
        { symbol: ["h2", "file"] },
        { reference: [] },
        { reference: [reference, reference] },
        { reference: { type: "typescript", files: ["src/rules.ts"] } },
        {
          reference: [
            reference,
            { type: "typescript", files: ["src/rules.ts"] },
          ],
        },
      ];
      for (const mutation of mutations)
        TestValidator.predicate(
          `refuse ${pass} ${stage} detached policy ${JSON.stringify(mutation)}`,
          throwsError(() =>
            validateAutoMovieLocalContractClaims({
              ...graph,
              claims: [{ ...claim, ...mutation }],
            }),
          ),
        );

      const scope = {
        mode: "first-pilot" as const,
        partitionGroup: "001-first" as const,
      };
      const audit = createAutoMovieProductionPrincipleClaim({
        ...props,
        populationScope: scope,
        inapplicable: true,
      });
      validateAutoMovieLocalContractClaims({
        ...graph,
        populationScope: scope,
        claims: [audit],
      });
      const { autoMovieBinding: _binding, ...native } = claim;
      validateAutoMovieLocalContractClaims({
        ...graph,
        claims: [
          {
            ...native,
            root: "independent",
            symbol: "file",
            severity: "warning",
            reference: {
              type: "typescript",
              files: ["src/rules.ts"],
              noEvidenceExclude: false,
              requireReview: false,
            },
          },
        ],
      });
    }
};
