import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const publicSource = ["src/**/*.ts", "!src/index.ts"];

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public evidence exports implement production evidence requirements",
      type: "typescript",
      files: publicSource,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/production-evidence/README.md"],
          symbol: "h1",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/production-evidence/**/*.md",
            "!requirements/production-evidence/**/README.md",
          ],
          symbol: "h3",
        },
      ],
    },
    {
      name: "public evidence exports implement production evidence specifications",
      type: "typescript",
      files: publicSource,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/production-evidence/README.md"],
          symbol: "h1",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/production-evidence/**/*.md",
            "!specifications/production-evidence/**/README.md",
          ],
          symbol: "h3",
        },
      ],
    },
    {
      name: "production language exports implement authoring requirements",
      type: "typescript",
      files: [
        "src/AutoMovieProductionLanguage.ts",
        "src/createAutoMovieEvidenceConfig.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: ["requirements/agent-authoring/production-language.md"],
        symbol: "h3",
      },
    },
    {
      name: "production language exports implement authoring specifications",
      type: "typescript",
      files: [
        "src/AutoMovieProductionLanguage.ts",
        "src/createAutoMovieEvidenceConfig.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/authoring-and-authority/production-language.md",
        ],
        symbol: "h3",
      },
    },
    {
      name: "contract migration exports implement recovery requirements",
      type: "typescript",
      files: ["src/contractMigration.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/operations-and-recovery/contract-baseline.md",
          "requirements/operations-and-recovery/contract-migration-plan.md",
          "requirements/operations-and-recovery/contract-migration-publication.md",
        ],
        symbol: "h3",
      },
    },
    {
      name: "contract migration exports implement recovery specifications",
      type: "typescript",
      files: ["src/contractMigration.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/execution-and-recovery/contract-baseline.md",
          "specifications/execution-and-recovery/contract-migration-plan.md",
          "specifications/execution-and-recovery/contract-migration-publication.md",
        ],
        symbol: "h3",
      },
    },
    {
      name: "delivery contract exports implement narrative specifications",
      type: "typescript",
      files: ["src/deliveryToc.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: ["specifications/narrative-and-intent/delivery-index.md"],
        symbol: "h3",
      },
    },
    {
      name: "delivery contract exports implement story requirements",
      type: "typescript",
      files: ["src/deliveryToc.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: ["requirements/story/delivery-index.md"],
        symbol: "h3",
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
