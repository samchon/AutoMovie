import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Every supported public declaration under `src` is selected for contract evidence.
 *
 * The population is derived from the source tree instead of enumerated, so a
 * file joins the graph by existing rather than by someone remembering to list
 * it here. The negative patterns name source classes that owe no product contract:
 * the barrel re-exports declarations that already answer at their definition,
 * `bin.ts` is the process entry point rather than a contract carrier, and the
 * guide constant is generated from `prompts/` and gitignored.
 */
const publicSurface = [
  "src/**/*.ts",
  "!src/**/index.ts",
  "!src/bin.ts",
  "!src/guides/AutoMovieGuideConstant.ts",
];

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
 * The public MCP surface answers for stable contract populations.
 *
 * Contract documents are selected by domain or by the complete layer, never by
 * individual Markdown filename. New documents therefore enter the graph
 * automatically and non-applicable units remain explicit source exclusions.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public MCP exports implement requirements",
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
      name: "public MCP exports implement specifications",
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
