import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const genericAssetContractFiles = [
  "src/IAutoMovieModelArchetype.ts",
  "src/archetypeRegistry.ts",
  "src/parameterValues.ts",
];

const primitiveModelFiles = [
  "src/primitiveArchetypes.ts",
  "src/primitivePropArchetype.ts",
];

const actorArchetypeFiles = ["src/stickmanArchetype.ts"];

const gaitFiles = [
  "src/humanoidGaits.ts",
  "src/horseGaits.ts",
  "src/catGaits.ts",
];

/** Public archetype contracts and their direct product and system owners. */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "generic archetype contracts implement asset requirements",
      type: "typescript",
      files: genericAssetContractFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/asset-authoring/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/asset-authoring/identity-and-instances.md",
            "requirements/asset-authoring/geometry.md",
            "requirements/asset-authoring/representations-bounds-and-lod.md",
            "requirements/asset-authoring/rig-and-state.md",
            "requirements/asset-authoring/validation.md",
          ],
          symbol: "h3",
        },
      ],
    },
    {
      name: "generic archetype contracts implement asset specifications",
      type: "typescript",
      files: genericAssetContractFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/asset-and-representation/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/alternatives-instances-and-groups.md",
            "specifications/asset-and-representation/model-geometry-and-surface-facts.md",
            "specifications/asset-and-representation/bounds-proxies-and-lod.md",
            "specifications/asset-and-representation/rig-deformation-and-state.md",
            "specifications/asset-and-representation/fidelity-and-validation.md",
          ],
          symbol: "h3",
        },
      ],
    },
    {
      name: "primitive models implement geometry requirements",
      type: "typescript",
      files: primitiveModelFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/asset-authoring/README.md"],
          symbol: ["h2", "h3"],
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
      name: "primitive models implement model representation specifications",
      type: "typescript",
      files: primitiveModelFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/asset-and-representation/README.md"],
          symbol: ["h2", "h3"],
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
      name: "actor archetypes implement body and representation requirements",
      type: "typescript",
      files: actorArchetypeFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/actors/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/actors/body-scale-and-landmarks.md",
            "requirements/actors/representation-tiers-and-fidelity-boundary.md",
          ],
          symbol: "h3",
        },
      ],
    },
    {
      name: "actor archetypes implement actor fidelity specifications",
      type: "typescript",
      files: actorArchetypeFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/README.md",
            "specifications/performance-motion-and-staging/README.md",
          ],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/fidelity-and-validation.md",
            "specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md",
          ],
          symbol: "h3",
        },
      ],
    },
    {
      name: "gait archetypes implement procedural motion requirements",
      type: "typescript",
      files: gaitFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/motion/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/motion/procedural-motion-and-gaits.md"],
          symbol: "h3",
        },
      ],
    },
    {
      name: "gait archetypes implement kinematics specifications",
      type: "typescript",
      files: gaitFiles,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/performance-motion-and-staging/README.md"],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md",
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
