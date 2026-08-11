import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const authoringSurface = [
  "src/bin.ts",
  "src/renderScaffold.ts",
  "src/renderTemplate.ts",
  "src/templateVersions.ts",
];

const operationsSurface = ["src/bin.ts", "src/writeFiles.ts"];
const inspectionSurface = ["src/loadAutoMovieProjectState.ts"];

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
      name: "public CLI authoring exports implement specifications",
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
