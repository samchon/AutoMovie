import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

// Process entries expose no declaration; their callable boundaries are in src.
const publicSources = [
  "src/**/*.ts",
  "!src/**/index.ts",
  "!src/bin.ts",
  "!src/reference-bin.ts",
];

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "reference exports implement navigation requirements",
      type: "typescript",
      files: publicSources,
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: ["requirements/agent-authoring/reference-navigation.md"],
        symbol: "h3",
      },
    },
    {
      name: "reference exports implement navigation specifications",
      type: "typescript",
      files: publicSources,
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/authoring-and-authority/reference-navigation.md",
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
