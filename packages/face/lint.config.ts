import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/** Dormant face modules answer only for the actor contracts they implement. */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "face proxy modules implement actor representation requirements",
      type: "typescript",
      files: [
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
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/actors/README.md",
          "requirements/actors/representation-tiers-and-fidelity-boundary.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "face proxy modules implement actor representation specifications",
      type: "typescript",
      files: [
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
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/performance-motion-and-staging/README.md",
          "specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "face morph modules implement deformation requirements",
      type: "typescript",
      files: ["src/faceMorphs.ts", "src/headMorph.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/actors/README.md",
          "requirements/actors/skeleton-rig-and-retargeting.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "face morph modules implement deformation specifications",
      type: "typescript",
      files: ["src/faceMorphs.ts", "src/headMorph.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/asset-and-representation/README.md",
          "specifications/asset-and-representation/rig-deformation-and-state.md",
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
