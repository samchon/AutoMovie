import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Every supported public declaration under `src` is selected for contract evidence.
 *
 * The population is derived from the source tree instead of enumerated. The
 * barrel is the only file outside it, because it re-exports declarations that
 * already answer for their contracts at their definition.
 */
const allSources = ["src/**/*.ts", "!src/**/index.ts"];

const authoringSurface = ["src/bin.ts"];

const inspectionSurface = ["src/loadAutoMovieProjectState.ts"];

/**
 * The operational domain is the residual of the derived population.
 *
 * Writing it as a subtraction rather than a list is what keeps the default
 * inside the graph: a new CLI source answers for the operational contracts
 * until someone deliberately assigns it to the authoring or inspection domain,
 * instead of silently answering for nothing.
 */
const operationsSurface = [...allSources, "!src/loadAutoMovieProjectState.ts"];

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public CLI authoring exports implement requirements",
      type: "typescript",
      files: authoringSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/agent-authoring/project-ownership.md",
            "requirements/product/capability-and-content.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "public CLI authoring exports implement specifications",
      type: "typescript",
      files: authoringSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/authoring-and-authority/capability-and-content-boundary.md",
            "specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md",
            "specifications/authoring-and-authority/source-authority-and-derivation.md",
          ],
          symbol: ["h3"],
          // Deriving scaffold bytes moved to `@automovie/template`, which
          // answers the derivation-lineage and change-impact halves of these
          // documents. The executable keeps the capability-state and
          // source-ownership halves it actually performs.
        },
      ],
    },
    {
      name: "public CLI operational exports implement requirements",
      type: "typescript",
      files: operationsSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/external-inputs/**/README.md",
            "requirements/operations-and-recovery/**/README.md",
            "requirements/rendering/**/README.md",
          ],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/external-inputs/**/*.md",
            "requirements/operations-and-recovery/**/*.md",
            "requirements/rendering/**/*.md",
            "!requirements/**/README.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "public CLI operational exports implement specifications",
      type: "typescript",
      files: operationsSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/editorial-render-and-delivery/**/README.md",
            "specifications/execution-and-recovery/**/README.md",
            "specifications/interchange-and-adoption/**/README.md",
          ],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/editorial-render-and-delivery/**/*.md",
            "specifications/execution-and-recovery/**/*.md",
            "specifications/interchange-and-adoption/**/*.md",
            "!specifications/**/README.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "public CLI inspection exports implement requirements",
      type: "typescript",
      files: inspectionSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/diagnostics/**/README.md",
            "requirements/evidence-and-provenance/**/README.md",
          ],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/diagnostics/**/*.md",
            "requirements/evidence-and-provenance/**/*.md",
            "!requirements/**/README.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "public CLI inspection exports implement specifications",
      type: "typescript",
      files: inspectionSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/evidence-and-provenance/**/README.md",
            "specifications/validation-and-diagnostics/**/README.md",
          ],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/evidence-and-provenance/**/*.md",
            "specifications/validation-and-diagnostics/**/*.md",
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
