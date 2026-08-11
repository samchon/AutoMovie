import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/** Public ingest modules cite only the contract families they materialize. */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "external byte inspection implements requirement indexes",
      type: "typescript",
      files: ["src/inspectExternalModelBytes.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/asset-authoring/README.md",
          "requirements/external-inputs/README.md",
        ],
        symbol: ["h1", "h2", "h3"],
      },
    },
    {
      name: "external byte inspection implements requirements",
      type: "typescript",
      files: ["src/inspectExternalModelBytes.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/asset-authoring/validation.md",
          "requirements/external-inputs/media-families-and-declared-facts.md",
          "requirements/external-inputs/resource-closure-and-acquisition.md",
          "requirements/external-inputs/unsupported-and-degradation.md",
          "requirements/external-inputs/validation-and-quarantine.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "external byte inspection implements specification indexes",
      type: "typescript",
      files: ["src/inspectExternalModelBytes.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/asset-and-representation/README.md",
          "specifications/interchange-and-adoption/README.md",
        ],
        symbol: ["h1", "h2", "h3"],
      },
    },
    {
      name: "external byte inspection implements specifications",
      type: "typescript",
      files: ["src/inspectExternalModelBytes.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/asset-and-representation/fidelity-and-validation.md",
          "specifications/asset-and-representation/model-geometry-and-surface-facts.md",
          "specifications/interchange-and-adoption/media-inspection-boundaries.md",
          "specifications/interchange-and-adoption/resource-closure-and-acquisition.md",
          "specifications/interchange-and-adoption/support-degradation-and-refusal.md",
          "specifications/interchange-and-adoption/validation-and-quarantine.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "selected external scene normalization implements requirement indexes",
      type: "typescript",
      files: ["src/ingestDocument.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/asset-authoring/README.md",
          "requirements/external-inputs/README.md",
          "requirements/motion/README.md",
        ],
        symbol: ["h1", "h2", "h3"],
      },
    },
    {
      name: "selected external scene normalization implements requirements",
      type: "typescript",
      files: ["src/ingestDocument.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/asset-authoring/external-assets.md",
          "requirements/external-inputs/adoption-modes-and-composition.md",
          "requirements/motion/clips-keyframes-and-interpolation.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "selected external scene normalization implements specification indexes",
      type: "typescript",
      files: ["src/ingestDocument.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/asset-and-representation/README.md",
          "specifications/interchange-and-adoption/README.md",
          "specifications/performance-motion-and-staging/README.md",
        ],
        symbol: ["h1", "h2", "h3"],
      },
    },
    {
      name: "selected external scene normalization implements specifications",
      type: "typescript",
      files: ["src/ingestDocument.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/asset-and-representation/alternatives-instances-and-groups.md",
          "specifications/interchange-and-adoption/adoption-decisions-and-composition.md",
          "specifications/interchange-and-adoption/conversion-receipts-and-determinism.md",
          "specifications/performance-motion-and-staging/motion-sampling-and-composition.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "selected external motion adoption implements requirement indexes",
      type: "typescript",
      files: ["src/externalMotion.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/asset-authoring/README.md",
          "requirements/external-inputs/README.md",
          "requirements/motion/README.md",
        ],
        symbol: ["h1", "h2", "h3"],
      },
    },
    {
      name: "selected external motion adoption implements requirements",
      type: "typescript",
      files: ["src/externalMotion.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/asset-authoring/external-assets.md",
          "requirements/external-inputs/adoption-modes-and-composition.md",
          "requirements/motion/clips-keyframes-and-interpolation.md",
          "requirements/motion/external-motion-inputs.md",
          "requirements/motion/retargeting-and-scale.md",
          "requirements/motion/validation-and-determinism.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "selected external motion adoption implements specification indexes",
      type: "typescript",
      files: ["src/externalMotion.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/asset-and-representation/README.md",
          "specifications/interchange-and-adoption/README.md",
          "specifications/performance-motion-and-staging/README.md",
        ],
        symbol: ["h1", "h2", "h3"],
      },
    },
    {
      name: "selected external motion adoption implements specifications",
      type: "typescript",
      files: ["src/externalMotion.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/asset-and-representation/alternatives-instances-and-groups.md",
          "specifications/interchange-and-adoption/adoption-decisions-and-composition.md",
          "specifications/interchange-and-adoption/conversion-receipts-and-determinism.md",
          "specifications/interchange-and-adoption/media-inspection-boundaries.md",
          "specifications/performance-motion-and-staging/motion-sampling-and-composition.md",
          "specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "rig and morph normalization implements requirement indexes",
      type: "typescript",
      files: [
        "src/humanoidSkeleton.ts",
        "src/ingestFaceTemplate.ts",
        "src/inspectExternalModelBytes.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/asset-authoring/README.md",
          "requirements/motion/README.md",
        ],
        symbol: ["h1", "h2", "h3"],
      },
    },
    {
      name: "rig and morph normalization implements requirements",
      type: "typescript",
      files: [
        "src/humanoidSkeleton.ts",
        "src/ingestFaceTemplate.ts",
        "src/inspectExternalModelBytes.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: ["requirements/asset-authoring/rig-and-state.md"],
        symbol: ["h3"],
      },
    },
    {
      name: "rig and morph normalization implements specification indexes",
      type: "typescript",
      files: [
        "src/humanoidSkeleton.ts",
        "src/ingestFaceTemplate.ts",
        "src/inspectExternalModelBytes.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/asset-and-representation/README.md",
          "specifications/performance-motion-and-staging/README.md",
        ],
        symbol: ["h1", "h2", "h3"],
      },
    },
    {
      name: "rig and morph normalization implements specifications",
      type: "typescript",
      files: [
        "src/humanoidSkeleton.ts",
        "src/ingestFaceTemplate.ts",
        "src/inspectExternalModelBytes.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/asset-and-representation/rig-deformation-and-state.md",
          "specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md",
        ],
        symbol: ["h3"],
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
