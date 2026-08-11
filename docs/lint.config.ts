import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Product-contract evidence from package-independent specifications to
 * observable requirements.
 *
 * Every selected requirement section must receive positive specification
 * evidence. The package's structural validator separately requires every
 * specification host to cite a requirement, preserves stable document
 * identities, and guards the source-side triangle once source claims join the
 * graph.
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
