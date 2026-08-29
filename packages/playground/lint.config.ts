import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * The private playground still carries a real deterministic-prototype contract.
 *
 * Every source module is selected. The film demonstration pays the executable
 * prototype units this application actually renders and explicitly declines
 * the downstream-fidelity units that remain outside a local viewer demo.
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
