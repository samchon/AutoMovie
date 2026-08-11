import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * The committed product contract from requirements to specifications.
 *
 * Every specification section answers exactly one requirement section. One
 * requirement may have several specifications because separate packages can
 * honor the same product promise without sharing implementation ownership.
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
        singleEvidencePerSymbol: true,
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
