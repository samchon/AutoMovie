import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const publicSource = ["src/**/*.ts", "!src/index.ts"];

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public evidence configuration types implement their input requirement",
      type: "typescript",
      files: publicSource,
      symbol: "type",
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
          files: ["requirements/production-evidence/input.md"],
          symbol: "h3",
        },
      ],
    },
    {
      name: "public evidence configuration types implement their input specification",
      type: "typescript",
      files: publicSource,
      symbol: "type",
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
          files: ["specifications/production-evidence/input.md"],
          symbol: "h3",
        },
      ],
    },
    {
      name: "the public evidence factory implements graph requirements",
      type: "typescript",
      files: publicSource,
      symbol: "function",
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
          files: ["requirements/production-evidence/graph.md"],
          symbol: "h3",
        },
      ],
    },
    {
      name: "the public evidence factory implements graph specifications",
      type: "typescript",
      files: publicSource,
      symbol: "function",
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
          files: ["specifications/production-evidence/graph.md"],
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
