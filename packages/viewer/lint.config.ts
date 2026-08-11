import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * The public viewer surface answers for stable contract populations.
 *
 * Contract documents are selected by domain or by the complete layer, never by
 * individual Markdown filename. New documents therefore enter the graph
 * automatically and non-applicable units remain explicit source exclusions.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public viewer exports implement requirements",
      type: "typescript",
      files: ["src/**/*.ts", "!src/**/index.ts"],
      evidenceExcludeCarriers: ["src/mount.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/**/README.md"],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/**/*.md", "!requirements/**/README.md"],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "public viewer exports implement specifications",
      type: "typescript",
      files: ["src/**/*.ts", "!src/**/index.ts"],
      evidenceExcludeCarriers: ["src/mount.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/**/README.md"],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/**/*.md", "!specifications/**/README.md"],
          symbol: ["h3"],
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
