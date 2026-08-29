import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Every authored production declaration joins the repository contract graph.
 *
 * The barrel is the only source exclusion because it re-exports declarations
 * whose defining symbols already carry their own contract evidence. A new
 * production source therefore enters both claims merely by existing.
 */
const publicSurface = ["src/**/*.ts", "!src/**/index.ts"];

const productionRequirementContracts = [
  "requirements/operations-and-recovery/concurrent-runs-and-locking.md",
  "requirements/production-design/continuity-change-and-deliverables.md",
  "requirements/repaint/providers-models-and-credentials.md",
  "requirements/repaint/retries-seeds-and-variation.md",
  "requirements/repaint/sequence-continuity-and-publication.md",
  "requirements/review/subject-inspection.md",
];

const productionSpecificationContracts = [
  "specifications/asset-and-representation/generated-assets-and-repaint-handoff.md",
  "specifications/execution-and-recovery/concurrent-ownership-and-locking.md",
  "specifications/narrative-and-intent/budgets-continuity-and-deliverables.md",
  "specifications/review-and-acceptance/subject-surface-and-inspection.md",
];

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public production exports implement requirements",
      type: "typescript",
      files: publicSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: productionRequirementContracts,
          symbol: "h3",
        },
      ],
    },
    {
      name: "public production exports implement specifications",
      type: "typescript",
      files: publicSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: productionSpecificationContracts,
          symbol: "h3",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/review-and-acceptance/README.md"],
          symbol: "h2",
        },
      ],
    },
  ],
};

export default {
  extends: "../../config/lint.config.ts",
  plugins: { evidence },
  rules: {
    "evidence/documented": [
      "error",
      { symbol: ["type", "function", "property"] },
    ],
    "evidence/graph": ["error", graph],
    "evidence/todo": "error",
  },
} satisfies ITtscLintConfig;
