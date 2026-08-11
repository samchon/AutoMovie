import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/** Declarations reachable from the package barrel. */
const publicLeaves: string[] = [
  "src/canonicalFace.ts",
  "src/eyeShells.ts",
  "src/faceMorphs.ts",
  "src/hairShell.ts",
  "src/hairTails.ts",
  "src/headMorph.ts",
  "src/profileAmplitude.ts",
  "src/silhouetteBands.ts",
  "src/similarity2.ts",
  "src/taubinSmooth.ts",
];

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
