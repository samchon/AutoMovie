import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

// Each declared person owns a review. Unassigned source stays in the shared
// residual population, so a new helper cannot silently escape review coverage.
const subjects = ["generated-korean-girl-01"];
const sharedSources = [
  "src/subjects/**/*.ts",
  ...subjects.map((subject) => `!src/subjects/${subject}/**/*.ts`),
];

/**
 * A model owes every recorded view, and that review owes the complete current
 * construction source. Review fingerprints expire on referenced declarations;
 * they record inspection, not a compiler judgment that the face looks correct.
 * Missing or stale reviews warn: rendering must run before a fresh visual
 * review can be written, including when ttsx checks this project at startup.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: subjects.flatMap((subject): ITtscEvidenceGraphConfig["claims"] => [
    {
      name: `${subject}: every required view is recorded`,
      type: "typescript" as const,
      files: [`src/subjects/${subject}/model.ts`],
      symbol: "function" as const,
      reference: {
        type: "markdown" as const,
        files: [`src/subjects/${subject}/review.md`],
        symbol: "h2" as const,
        checklist: true,
        noEvidenceExclude: true,
      },
    },
    {
      name: `${subject}: reviewed construction basis`,
      type: "typescript" as const,
      files: [`src/subjects/${subject}/review.ts`],
      symbol: "property" as const,
      reference: {
        type: "typescript" as const,
        // A review is the observer, not part of the geometry it observes.
        files: [
          ...sharedSources,
          `src/subjects/${subject}/**/*.ts`,
          "!src/subjects/**/review.ts",
        ],
        symbol: ["type", "function", "property"],
        noEvidenceExclude: true,
        requireReview: true,
      },
    },
    {
      name: `${subject}: model retains its review carrier`,
      type: "typescript" as const,
      files: [`src/subjects/${subject}/model.ts`],
      symbol: "function" as const,
      reference: {
        type: "typescript" as const,
        files: [`src/subjects/${subject}/review.ts`],
        symbol: "property" as const,
        singleEvidencePerSymbol: true,
        noEvidenceExclude: true,
      },
    },
  ]),
};

export default {
  extends: "../config/lint.config.ts",
  plugins: { evidence },
  rules: { "evidence/graph": ["warning", graph] },
} satisfies ITtscLintConfig;
