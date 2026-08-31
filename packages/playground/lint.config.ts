import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * The private playground still carries a real deterministic-prototype contract.
 *
 * Every source module is selected. The film demonstration pays the executable
 * prototype units this application actually renders and explicitly declines
 * the downstream-fidelity units that remain outside a local viewer demo.
 *
 * One of the twenty-five selected modules does that paying. The other
 * twenty-four answer nothing, and that is recorded as debt rather than read as
 * a smaller surface earning a smaller duty -- the evidence-graph skill answers
 * that reading directly: "Neither a removed transport boundary nor an
 * application's smaller surface excuses its public exports from requirement and
 * specification traceability." The count is pinned in `ACCEPTED_UNPAID_HOSTS`
 * and refused if it rises; #2171 owns paying it down.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "playground demonstrations realize prototype requirements",
      type: "typescript",
      files: ["src/**/*.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: ["requirements/product/prototype-quality.md"],
        symbol: "h3",
      },
    },
    {
      name: "playground demonstrations realize prototype specifications",
      type: "typescript",
      files: ["src/**/*.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/authoring-and-authority/prototype-determinism-and-fidelity.md",
        ],
        symbol: "h3",
      },
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
