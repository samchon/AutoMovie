import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const publicLeaves = ["src/**/*.ts", "!src/**/index.ts"];

const requirementReadmes = ["requirements/**/README.md"];
const requirementContent = [
  "requirements/**/*.md",
  "!requirements/**/README.md",
];
const specificationReadmes = ["specifications/**/README.md"];
const specificationContent = [
  "specifications/**/*.md",
  "!specifications/**/README.md",
];

/**
 * The public engine surface answers for stable contract populations.
 *
 * Contract documents are selected by domain or by the complete layer, never by
 * individual Markdown filename. New documents therefore enter the graph
 * automatically and non-applicable units remain explicit source exclusions.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public engine exports implement requirements",
      type: "typescript",
      files: publicLeaves,
      evidenceExcludeCarriers: ["src/AutoMovieEngineEvidenceExclusions.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: requirementReadmes,
          symbol: "h1",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: requirementContent,
          symbol: "h3",
        },
      ],
    },
    {
      name: "public engine exports implement specifications",
      type: "typescript",
      files: publicLeaves,
      evidenceExcludeCarriers: ["src/AutoMovieEngineEvidenceExclusions.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: specificationReadmes,
          symbol: "h1",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: specificationContent,
          symbol: "h3",
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
