import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Every supported public declaration under `src` is selected for contract evidence.
 *
 * The population crosses every directory depth, so a source added under a new
 * subdirectory joins the graph by existing. The barrel is the only exclusion,
 * because it re-exports declarations that already answer at their definition.
 */
const publicSurface = ["src/**/*.ts", "!src/**/index.ts"];

/**
 * The public ingest surface answers for stable contract populations.
 *
 * Contract documents are selected by domain or by the complete layer, never by
 * individual Markdown filename. New documents therefore enter the graph
 * automatically and non-applicable units remain explicit source exclusions.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public ingest exports implement requirements",
      type: "typescript",
      files: publicSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/asset-authoring/**/README.md",
            "requirements/external-inputs/**/README.md",
            "requirements/motion/**/README.md",
          ],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/asset-authoring/**/*.md",
            "requirements/external-inputs/**/*.md",
            "requirements/motion/**/*.md",
            "!requirements/**/README.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "public ingest exports implement specifications",
      type: "typescript",
      files: publicSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/**/README.md",
            "specifications/interchange-and-adoption/**/README.md",
            "specifications/performance-motion-and-staging/**/README.md",
          ],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/**/*.md",
            "specifications/interchange-and-adoption/**/*.md",
            "specifications/performance-motion-and-staging/**/*.md",
            "!specifications/**/README.md",
          ],
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
