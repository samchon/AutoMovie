import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

// Each declared person owns a review. Unassigned source stays in the shared
// residual population, so a new helper cannot silently escape review coverage.
const subjects = ["generated-korean-girl-01"];
const sharedSources = [
  "src/subjects/**/*.ts",
  ...subjects.map((subject) => `!src/subjects/${subject}/**/*.ts`),
];
// Domain review carriers remain attached to the root construction record.
// Match their explicit suffix, so a future preview.ts is still source to review.
const studyReviews = [
  "studies/human-face/review.ts",
  "studies/human-face/**/*-review.ts",
];
const studySources = [
  "studies/human-face/**/*.ts",
  ...studyReviews.map((file) => `!${file}`),
];

/**
 * A model owes every recorded view, and that review owes the complete current
 * construction source. Review fingerprints expire on referenced declarations;
 * they record inspection, not a compiler judgment that the face looks correct.
 * Coverage, carrier cardinality and nonvisual source inspection remain errors.
 * Missing or expired rendered-view acknowledgements warn independently of
 * construction-source inspection. Their structural twins retain the population
 * and acknowledgement constraints; a warning never accepts the face's likeness.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    ...subjects.flatMap((subject): ITtscEvidenceGraphConfig["claims"] => [
      {
        name: `${subject}: every required view is recorded`,
        type: "typescript" as const,
        files: [`src/subjects/${subject}/model.ts`],
        symbol: "function" as const,
        reference: [
          {
            type: "markdown" as const,
            files: [`src/subjects/${subject}/review.md`],
            symbol: "h2" as const,
            checklist: true,
            noEvidenceExclude: true,
            severity: "error" as const,
          },
          {
            type: "markdown" as const,
            files: [`src/subjects/${subject}/review.md`],
            symbol: "h2" as const,
            checklist: true,
            noEvidenceExclude: true,
            requireReview: true,
            severity: "warning" as const,
          },
        ],
      },
      {
        name: `${subject}: reviewed construction basis`,
        type: "typescript" as const,
        files: [`src/subjects/${subject}/review.ts`],
        symbol: "property" as const,
        reference: [
          {
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
          {
            type: "typescript" as const,
            package: "@automovie/human",
            files: ["src/components/**/*.ts", "src/geometry/**/*.ts"],
            symbol: ["type", "function", "property"],
            noEvidenceExclude: true,
            requireReview: true,
          },
        ],
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
    {
      name: "portable face studies retain every per-person observation",
      type: "typescript",
      files: studySources,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          files: ["studies/human-face/review.md"],
          symbol: "h2",
          checklist: true,
          noEvidenceExclude: true,
          severity: "error",
        },
        {
          type: "markdown",
          files: ["studies/human-face/review.md"],
          symbol: "h2",
          checklist: true,
          noEvidenceExclude: true,
          requireReview: true,
          severity: "warning",
        },
      ],
    },
    {
      name: "portable face studies retain their construction review",
      type: "typescript",
      files: studySources,
      symbol: ["type", "function", "property"],
      reference: {
        type: "typescript",
        files: ["studies/human-face/review.ts"],
        symbol: "property",
        singleEvidencePerSymbol: true,
        noEvidenceExclude: true,
      },
    },
    {
      name: "portable face construction source is inspected",
      type: "typescript",
      files: studyReviews,
      symbol: "property",
      reference: [
        {
          type: "typescript",
          package: "@automovie/human",
          files: ["src/**/*.ts", "!src/**/index.ts"],
          symbol: ["type", "function", "property"],
          noEvidenceExclude: true,
          requireReview: true,
        },
        {
          type: "typescript",
          files: studySources,
          symbol: ["type", "function", "property"],
          noEvidenceExclude: true,
          requireReview: true,
        },
      ],
    },
    {
      name: "portable face construction review retains its domain inspections",
      type: "typescript",
      files: ["studies/human-face/review.ts"],
      symbol: "property",
      reference: {
        type: "typescript",
        files: ["studies/human-face/**/*-review.ts"],
        symbol: "property",
        requireReview: true,
        noEvidenceExclude: true,
      },
    },
    {
      name: "portable face studies retain the provenance and review contract",
      type: "typescript",
      files: ["studies/human-face/**/*.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../docs",
          files: ["requirements/actors/facial-authoring/**/README.md"],
          symbol: "h1",
        },
        {
          type: "markdown",
          root: "../docs",
          files: [
            "requirements/actors/facial-authoring/**/*.md",
            "!requirements/actors/facial-authoring/**/README.md",
          ],
          symbol: "h3",
        },
        {
          type: "markdown",
          root: "../docs",
          files: [
            "specifications/asset-and-representation/facial-authoring/**/README.md",
          ],
          symbol: "h1",
        },
        {
          type: "markdown",
          root: "../docs",
          files: [
            "specifications/asset-and-representation/facial-authoring/**/*.md",
            "!specifications/asset-and-representation/facial-authoring/**/README.md",
          ],
          symbol: "h3",
        },
      ],
    },
  ],
};

export default {
  extends: "../config/lint.config.ts",
  plugins: { evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
