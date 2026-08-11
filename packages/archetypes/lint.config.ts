import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const publicSurface = ["src/*.ts", "!src/index.ts"];

const requirementReadmes = [
  "requirements/actors/**/README.md",
  "requirements/asset-authoring/**/README.md",
  "requirements/motion/**/README.md",
];

const requirementContent = [
  "requirements/actors/**/*.md",
  "!requirements/actors/**/README.md",
  "requirements/asset-authoring/**/*.md",
  "!requirements/asset-authoring/**/README.md",
  "requirements/motion/**/*.md",
  "!requirements/motion/**/README.md",
];

const specificationReadmes = [
  "specifications/asset-and-representation/**/README.md",
  "specifications/performance-motion-and-staging/**/README.md",
];

const specificationContent = [
  "specifications/asset-and-representation/**/*.md",
  "!specifications/asset-and-representation/**/README.md",
  "specifications/performance-motion-and-staging/**/*.md",
  "!specifications/performance-motion-and-staging/**/README.md",
];

/**
 * The public archetype surface answers for stable contract populations.
 *
 * Contract documents are selected by domain or by the complete layer, never by
 * individual Markdown filename. New documents therefore enter the graph
 * automatically and non-applicable units remain explicit source exclusions.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public archetype exports implement requirements",
      type: "typescript",
      files: publicSurface,
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
      name: "public archetype exports implement specifications",
      type: "typescript",
      files: publicSurface,
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
