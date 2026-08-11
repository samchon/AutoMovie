import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const specificationReadmes = ["specifications/**/README.md"];
const specificationContent = [
  "specifications/**/*.md",
  "!specifications/**/README.md",
];
const requirementReadmes = ["requirements/**/README.md"];
const requirementContent = [
  "requirements/**/*.md",
  "!requirements/**/README.md",
];

/**
 * Package-independent specifications make the observable requirements precise.
 *
 * README roots and content units are separate role populations. This keeps
 * their hierarchy intact without enumerating contract files or selecting an
 * ancestor and its mixed positive and excluded descendants together.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "specification indexes refine requirement indexes",
      type: "markdown",
      files: specificationReadmes,
      symbol: "h1",
      reference: {
        type: "markdown",
        files: requirementReadmes,
        symbol: "h1",
      },
    },
    {
      name: "specification units refine requirement units",
      type: "markdown",
      files: specificationContent,
      symbol: "h3",
      reference: {
        type: "markdown",
        files: requirementContent,
        symbol: "h3",
      },
    },
  ],
};

export default {
  extends: "../config/lint.config.ts",
  plugins: {
    evidence,
  },
  rules: {
    "evidence/graph": ["error", graph],
  },
} satisfies ITtscLintConfig;
