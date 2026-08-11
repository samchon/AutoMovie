import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Product-contract evidence from package-independent specifications to
 * observable requirements.
 *
 * Every selected specification section owes at least one direct requirement
 * citation, and every selected requirement section must be claimed. A
 * structural guard must separately check stable anchors and the source-side
 * triangle that the native graph cannot prove transitively.
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
        noEvidenceExclude: true,
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
