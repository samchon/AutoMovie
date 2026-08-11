import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Public cli contracts answer directly for both product promises and
 * package-independent system contracts.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public cli exports implement requirements",
      type: "typescript",
      files: ["src/**/*.ts", "src/**/*.tsx"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/agent-authoring/**/*.md",
          "requirements/delivery-and-accessibility/**/*.md",
          "requirements/diagnostics/**/*.md",
          "requirements/evidence-and-provenance/**/*.md",
          "requirements/operations-and-recovery/**/*.md",
          "requirements/product/**/*.md",
          "requirements/rendering/**/*.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "public cli exports implement specifications",
      type: "typescript",
      files: ["src/**/*.ts", "src/**/*.tsx"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/authoring-and-authority/**/*.md",
          "specifications/editorial-render-and-delivery/**/*.md",
          "specifications/evidence-and-provenance/**/*.md",
          "specifications/execution-and-recovery/**/*.md",
          "specifications/validation-and-diagnostics/**/*.md",
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
