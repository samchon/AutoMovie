import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/** The retained face surface is a frozen compatibility boundary. */
const faceFiles: string[] = [
  "src/canonicalFace.ts",
  "src/eyeShells.ts",
  "src/faceMorphs.ts",
  "src/hairShell.ts",
  "src/hairTails.ts",
  "src/headMorph.ts",
  "src/parameters.ts",
  "src/profileAmplitude.ts",
  "src/silhouetteBands.ts",
  "src/similarity2.ts",
  "src/taubinSmooth.ts",
];

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "frozen face exports preserve the likeness exclusion",
      type: "typescript",
      files: faceFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/product/README.md"],
          symbol: "h1",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/product/scope-and-exclusions.md"],
          symbol: "h3",
        },
      ],
    },
    {
      name: "frozen face exports preserve the fidelity failure boundary",
      type: "typescript",
      files: faceFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/authoring-and-authority/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/authoring-and-authority/prototype-determinism-and-fidelity.md",
          ],
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
