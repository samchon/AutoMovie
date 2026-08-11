import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Public mcp contracts answer directly for both product promises and
 * package-independent system contracts.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public mcp exports implement requirements",
      type: "typescript",
      files: ["src/**/*.ts", "src/**/*.tsx"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/acceptance/**/*.md",
          "requirements/agent-authoring/**/*.md",
          "requirements/delivery-and-accessibility/**/*.md",
          "requirements/diagnostics/**/*.md",
          "requirements/evidence-and-provenance/**/*.md",
          "requirements/external-inputs/**/*.md",
          "requirements/operations-and-recovery/**/*.md",
          "requirements/product/**/*.md",
          "requirements/production-design/**/*.md",
          "requirements/repaint/**/*.md",
          "requirements/review/**/*.md",
          "requirements/story/**/*.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "public mcp exports implement specifications",
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
          "specifications/interchange-and-adoption/**/*.md",
          "specifications/narrative-and-intent/**/*.md",
          "specifications/review-and-acceptance/**/*.md",
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
