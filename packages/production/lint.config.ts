import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Every authored production declaration joins the repository contract graph.
 *
 * The barrel is the only source exclusion because it re-exports declarations
 * whose defining symbols already carry their own contract evidence.
 *
 * Joining is selection, not obligation, and this comment used to say otherwise:
 * a new source entered both claims "merely by existing", which reads as a duty
 * the graph does not impose. What the claims enforce is that every contract
 * target has at least one implementing host, so a source that implements no
 * listed target owes nothing and stays silent.
 *
 * The consequence is worth seeing rather than inferring. Measured on this
 * package, eleven of fifty-eight selected sources carry a citation, and the
 * repository population gate prints that ratio for every package that runs
 * this graph.
 *
 * That ratio is debt, not designed silence, and this comment used to argue the
 * opposite -- that requiring the other forty-seven to speak would buy package-
 * boundary restatement rather than inspection. Two measurements refuse the
 * argument. Eleven of the thirteen packages running this graph answer for
 * everything they select, `interface` across 160 sources and `engine` across
 * 216, so payment at this scale is evidently not restatement. And the largest
 * unpaid surfaces here are implementations of listed targets rather than
 * sources with no target to implement: `requirements/repaint/*` reads green
 * from three citing files while the 1,260-line repaint service, the 1,767-line
 * oracle service and the 1,233-line legacy importer answer nothing.
 *
 * So the forty-seven are recorded as unpaid rather than reclassified. The count
 * is pinned in `ACCEPTED_UNPAID_HOSTS` and refused if it rises, which is the
 * per-host lower bound the evidence-graph skill assigns to a structural guard,
 * and #2171 owns paying it down.
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
