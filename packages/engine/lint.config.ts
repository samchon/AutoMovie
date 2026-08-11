import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Public engine contracts answer directly for both product promises and
 * package-independent system contracts.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public engine exports implement requirements",
      type: "typescript",
      files: ["src/**/*.ts", "src/**/*.tsx"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/actors/**/*.md",
          "requirements/asset-authoring/**/*.md",
          "requirements/building-exterior/**/*.md",
          "requirements/camera/**/*.md",
          "requirements/effects-and-simulation/**/*.md",
          "requirements/formations/**/*.md",
          "requirements/interior/**/*.md",
          "requirements/lighting/**/*.md",
          "requirements/map/**/*.md",
          "requirements/motion/**/*.md",
          "requirements/rendering/**/*.md",
          "requirements/sound/**/*.md",
          "requirements/staging/**/*.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "public engine exports implement specifications",
      type: "typescript",
      files: ["src/**/*.ts", "src/**/*.tsx"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/asset-and-representation/**/*.md",
          "specifications/building-envelope/**/*.md",
          "specifications/camera-light-and-visibility/**/*.md",
          "specifications/editorial-render-and-delivery/**/*.md",
          "specifications/interior-space/**/*.md",
          "specifications/performance-motion-and-staging/**/*.md",
          "specifications/simulation-effects-and-sound/**/*.md",
          "specifications/world-and-site/**/*.md",
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
