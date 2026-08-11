import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Public archetypes contracts answer directly for both product promises and
 * package-independent system contracts.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public archetypes exports implement requirements",
      type: "typescript",
      files: ["src/**/*.ts", "src/**/*.tsx"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/actors/**/*.md",
          "requirements/asset-authoring/**/*.md",
          "requirements/formations/**/*.md",
          "requirements/motion/**/*.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "public archetypes exports implement specifications",
      type: "typescript",
      files: ["src/**/*.ts", "src/**/*.tsx"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/asset-and-representation/**/*.md",
          "specifications/performance-motion-and-staging/**/*.md",
        ],
        symbol: ["h2", "h3"],
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
