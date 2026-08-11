import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/** Public proxy declarations retained by the dormant face package. */
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

/** Declarations that form the actor's bounded visual appearance. */
const appearanceFiles: string[] = ["src/hairShell.ts", "src/hairTails.ts"];

/** Declarations that carry or transform proxy geometry facts. */
const geometryFiles: string[] = faceFiles.filter(
  (file) => file !== "src/parameters.ts",
);

/** Declarations that define and apply the frozen morph basis. */
const morphFiles: string[] = ["src/faceMorphs.ts", "src/headMorph.ts"];

/** Declarations outside the specialized hair and morph slices. */
const representationFiles: string[] = faceFiles.filter(
  (file) => !appearanceFiles.includes(file) && !morphFiles.includes(file),
);

/** Declarations that reject or bound invalid proxy geometry inputs. */
const validationFiles: string[] = [
  "src/headMorph.ts",
  "src/parameters.ts",
  "src/profileAmplitude.ts",
  "src/silhouetteBands.ts",
  "src/similarity2.ts",
];

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "face proxy exports implement actor representation requirements",
      type: "typescript",
      files: representationFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/actors/README.md"],
          symbol: ["h1", "h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/actors/representation-tiers-and-fidelity-boundary.md",
          ],
          symbol: "h3",
        },
      ],
    },
    {
      name: "face proxy exports implement actor representation specifications",
      type: "typescript",
      files: representationFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/performance-motion-and-staging/README.md"],
          symbol: ["h1", "h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md",
          ],
          symbol: "h3",
        },
      ],
    },
    {
      name: "face appearance exports implement actor appearance requirements",
      type: "typescript",
      files: appearanceFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/actors/README.md"],
          symbol: ["h1", "h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/actors/representation-tiers-and-fidelity-boundary.md",
          ],
          symbol: "h3",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/actors/appearance-costume-and-attachments.md"],
          symbol: "h3",
        },
      ],
    },
    {
      name: "face appearance exports implement actor appearance specifications",
      type: "typescript",
      files: appearanceFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/performance-motion-and-staging/README.md"],
          symbol: ["h1", "h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md",
          ],
          symbol: "h3",
        },
      ],
    },
    {
      name: "face morph exports implement proxy expression requirements",
      type: "typescript",
      files: morphFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/actors/README.md"],
          symbol: ["h1", "h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/actors/representation-tiers-and-fidelity-boundary.md",
          ],
          symbol: "h3",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/actors/pose-expression-and-gaze.md"],
          symbol: "h3",
        },
      ],
    },
    {
      name: "face morph exports implement proxy expression specifications",
      type: "typescript",
      files: morphFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/performance-motion-and-staging/README.md"],
          symbol: ["h1", "h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md",
          ],
          symbol: "h3",
        },
      ],
    },
    {
      name: "face geometry exports implement asset geometry requirements",
      type: "typescript",
      files: geometryFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/asset-authoring/README.md"],
          symbol: ["h1", "h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/asset-authoring/geometry.md"],
          symbol: "h3",
        },
      ],
    },
    {
      name: "face geometry exports implement asset geometry specifications",
      type: "typescript",
      files: geometryFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/asset-and-representation/README.md"],
          symbol: ["h1", "h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/model-geometry-and-surface-facts.md",
          ],
          symbol: "h3",
        },
      ],
    },
    {
      name: "face morph exports implement asset deformation requirements",
      type: "typescript",
      files: morphFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/asset-authoring/README.md"],
          symbol: ["h1", "h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/asset-authoring/rig-and-state.md"],
          symbol: "h3",
        },
      ],
    },
    {
      name: "face morph exports implement deformation specifications",
      type: "typescript",
      files: morphFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/asset-and-representation/README.md"],
          symbol: ["h1", "h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/rig-deformation-and-state.md",
          ],
          symbol: "h3",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/performance-motion-and-staging/README.md"],
          symbol: ["h1", "h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md",
          ],
          symbol: "h3",
        },
      ],
    },
    {
      name: "face validation exports implement asset validation requirements",
      type: "typescript",
      files: validationFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/asset-authoring/README.md"],
          symbol: ["h1", "h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/asset-authoring/validation.md"],
          symbol: "h3",
        },
      ],
    },
    {
      name: "face validation exports implement asset validation specifications",
      type: "typescript",
      files: validationFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/asset-and-representation/README.md"],
          symbol: ["h1", "h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/fidelity-and-validation.md",
          ],
          symbol: "h3",
        },
      ],
    },
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
          symbol: ["h1", "h2", "h3"],
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
          symbol: ["h1", "h2", "h3"],
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
