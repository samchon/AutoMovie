import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Every supported public declaration under `src` answers for the authoring
 * contracts.
 *
 * The population is derived from the source tree rather than enumerated, so a
 * new template source answers for the same contracts instead of silently
 * answering for nothing. The barrel is the only exclusion, because it
 * re-exports declarations that already answer at their definition.
 */
const authoringSurface = [
  "src/**/*.ts",
  "!src/**/index.ts",
  "!src/writeFiles.ts",
  "!src/nativeScaffoldPublication.ts",
  "!src/scaffoldFileSnapshot.ts",
  "!src/scaffoldPublication.ts",
];

/**
 * Writing the rendered bytes is an operational act, not an authoring one.
 *
 * These two answer for idempotent, non-destructive writes into a directory a
 * user already owns, which is an operations-and-recovery contract rather than
 * an authoring contract.
 */
const writeSurface = [
  "src/writeFiles.ts",
  "src/nativeScaffoldPublication.ts",
  "src/scaffoldFileSnapshot.ts",
  "src/scaffoldPublication.ts",
];

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public template exports implement authoring requirements",
      type: "typescript",
      files: authoringSurface,
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
            // Answered by the packages that publish capability, which stayed
            // outside the template.
            "!requirements/product/capability-and-content.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "public template exports implement authoring specifications",
      type: "typescript",
      files: authoringSurface,
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
    {
      name: "template write exports implement operational requirements",
      type: "typescript",
      files: writeSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["requirements/operations-and-recovery/**/README.md"],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/operations-and-recovery/idempotency-and-side-effects.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "template write exports implement operational specifications",
      type: "typescript",
      files: writeSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/execution-and-recovery/**/README.md"],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/execution-and-recovery/retry-backoff-and-idempotency.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
  ],
};

export default {
  plugins: { evidence },
  rules: {
    "evidence/graph": ["error", graph],
    "evidence/documented": "error",
    "evidence/todo": "error",
  },
} satisfies ITtscLintConfig;
