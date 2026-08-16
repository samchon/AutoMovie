import { evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * `@automovie/mcp` documents its public surface without joining the repository
 * contract graph.
 *
 * The tool surface is an experiment whose server and tool arrangement is
 * expected to move, and its JSDoc is the shipped MCP server instruction and
 * tool description rather than a contract carrier. Citing requirement and
 * specification units from those comments put thousands of tag lines in front
 * of the prose an MCP client actually reads. `evidence/documented` and
 * `evidence/todo` stay: every exported symbol still owes a comment, and an
 * unpaid `@todo` still fails the build.
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
