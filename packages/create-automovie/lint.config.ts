import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Public create-automovie contracts answer directly for both product promises
 * and package-independent system contracts.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public create-automovie exports implement requirements",
      type: "typescript",
      files: ["src/bin.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/agent-authoring/README.md",
            "requirements/product/README.md",
          ],
          symbol: ["h2", "h3"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/agent-authoring/project-ownership.md",
            "requirements/agent-authoring/source-owned-loop.md",
            "requirements/product/charter.md",
          ],
          symbol: "h3",
        },
      ],
    },
    {
      name: "public create-automovie exports implement specifications",
      type: "typescript",
      files: ["src/bin.ts"],
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
            "specifications/authoring-and-authority/capability-and-content-boundary.md",
            "specifications/authoring-and-authority/source-authority-and-derivation.md",
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
