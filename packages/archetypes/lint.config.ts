import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const assetArchetypeFiles = [
  "src/IAutoMovieModelArchetype.ts",
  "src/archetypeRegistry.ts",
  "src/parameterValues.ts",
  "src/primitiveArchetypes.ts",
  "src/primitivePropArchetype.ts",
  "src/stickmanArchetype.ts",
];

const actorArchetypeFiles = [
  "src/IAutoMovieModelArchetype.ts",
  "src/primitiveArchetypes.ts",
  "src/stickmanArchetype.ts",
];

const gaitFiles = [
  "src/humanoidGaits.ts",
  "src/horseGaits.ts",
  "src/catGaits.ts",
];

/** Public archetype contracts and their direct product and system owners. */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "asset archetypes implement asset-authoring requirements",
      type: "typescript",
      files: assetArchetypeFiles,
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/asset-authoring/identity-and-instances.md",
          "requirements/asset-authoring/geometry.md",
          "requirements/asset-authoring/representations-bounds-and-lod.md",
          "requirements/asset-authoring/rig-and-state.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "asset archetypes implement asset representation specifications",
      type: "typescript",
      files: assetArchetypeFiles,
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/asset-and-representation/identity-resources-and-lifecycle.md",
          "specifications/asset-and-representation/model-geometry-and-surface-facts.md",
          "specifications/asset-and-representation/bounds-proxies-and-lod.md",
          "specifications/asset-and-representation/rig-deformation-and-state.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "actor archetypes implement body and representation requirements",
      type: "typescript",
      files: actorArchetypeFiles,
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/actors/body-scale-and-landmarks.md",
          "requirements/actors/representation-tiers-and-fidelity-boundary.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "actor archetypes implement actor fidelity specifications",
      type: "typescript",
      files: actorArchetypeFiles,
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/asset-and-representation/fidelity-and-validation.md",
          "specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "gait archetypes implement procedural motion requirements",
      type: "typescript",
      files: gaitFiles,
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: ["requirements/motion/procedural-motion-and-gaits.md"],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "gait archetypes implement kinematics specifications",
      type: "typescript",
      files: gaitFiles,
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "gait archetypes implement formation motion requirements",
      type: "typescript",
      files: gaitFiles,
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: ["requirements/formations/reform-and-group-motion.md"],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "gait archetypes implement formation motion specifications",
      type: "typescript",
      files: gaitFiles,
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md",
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
