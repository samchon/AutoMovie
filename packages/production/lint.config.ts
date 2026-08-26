import { evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * `@automovie/production` documents its public surface without joining the
 * repository contract graph.
 *
 * The reason it does not is spent. This was a shipped MCP surface whose class
 * comments became server instructions and whose method comments became tool
 * descriptions under a hard length cap, so citations competed for room with
 * prose a client actually read. That surface is gone, and what is left is
 * ordinary library code with nothing in it a citation would displace. The
 * units this package used to own sit in `legacy` in `docs/contract-ownership`,
 * where they read as debt nobody owns; admitting this package to the graph is
 * the standing correction, and until someone makes it the exclusion is debt
 * rather than a decision. `evidence/documented` and `evidence/todo` stay:
 * every exported symbol still owes a comment, and an unpaid `@todo` still
 * fails the build.
 */
export default {
  extends: "../../config/lint.config.ts",
  plugins: { evidence },
  rules: {
    "evidence/documented": [
      "error",
      { symbol: ["type", "function", "property"] },
    ],
    "evidence/todo": "error",
  },
} satisfies ITtscLintConfig;
