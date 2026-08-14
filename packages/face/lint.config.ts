import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Every supported public declaration under `src` is selected for contract evidence.
 *
 * The population is derived from the source tree instead of enumerated, so a
 * file joins the graph by existing rather than by someone remembering to list
 * it here. The barrel is the only exclusion: it re-exports declarations that
 * already answer for their contracts at their definition.
 *
 * Deriving the population is maintenance of the frozen package rather than an
 * extension of it. It adds no export, no geometry, and no fidelity; it only
 * lets the graph check the frozen-boundary citations these declarations already
 * carry.
 */
const publicLeaves: string[] = ["src/**/*.ts", "!src/**/index.ts"];

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public face compatibility exports implement requirements",
      type: "typescript",
      files: publicLeaves,
      evidenceExcludeCarriers: ["src/canonicalFace.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/actors/**/*.md",
            "requirements/asset-authoring/**/*.md",
            "requirements/product/**/*.md",
            "!requirements/**/README.md",
          ],
          symbol: "h3",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/actors/**/README.md",
            "requirements/asset-authoring/**/README.md",
            "requirements/product/**/README.md",
          ],
          symbol: "h1",
        },
      ],
    },
    {
      name: "public face compatibility exports implement specifications",
      type: "typescript",
      files: publicLeaves,
      evidenceExcludeCarriers: ["src/canonicalFace.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/**/*.md",
            "specifications/authoring-and-authority/**/*.md",
            "specifications/performance-motion-and-staging/**/*.md",
            "!specifications/**/README.md",
          ],
          symbol: "h3",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/**/README.md",
            "specifications/authoring-and-authority/**/README.md",
            "specifications/performance-motion-and-staging/**/README.md",
          ],
          symbol: "h1",
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
