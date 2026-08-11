import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Product-contract evidence from package-independent specifications to
 * observable requirements.
 *
 * Every selected requirement section participates in the specification graph.
 * README files use the same recursive populations instead of a filename
 * exception, and a claim may cite any number of requirements or carry a narrow
 * `@evidenceExclude` when that exact relationship does not apply.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      type: "markdown",
      files: ["specifications/**/*.md"],
      symbol: ["h2", "h3"],
      reference: {
        type: "markdown",
        files: ["requirements/**/*.md"],
        symbol: ["h2", "h3"],
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
