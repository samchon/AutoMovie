import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const publicSurface = ["src/bin.ts"];

/**
 * The public create-automovie surface answers for stable contract populations.
 *
 * Contract documents are selected by domain and role, never by an individual
 * content filename. README topic identities participate as H1 units while
 * durable content contracts participate as H3 units.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public create-automovie exports implement requirements",
      type: "typescript",
      files: publicSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/agent-authoring/**/README.md",
            "requirements/product/**/README.md",
          ],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/agent-authoring/**/*.md",
            "requirements/product/**/*.md",
            "!requirements/**/README.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "public create-automovie exports implement specifications",
      type: "typescript",
      files: publicSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/authoring-and-authority/**/README.md"],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/authoring-and-authority/**/*.md",
            "!specifications/**/README.md",
          ],
          symbol: ["h3"],
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
