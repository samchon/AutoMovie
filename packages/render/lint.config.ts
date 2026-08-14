import {
  type ITtscEvidenceGraphConfig,
  type ITtscEvidenceGraphReference,
  evidence,
} from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const topicReferences = (
  folders: readonly string[],
): ITtscEvidenceGraphReference[] => [
  {
    type: "markdown",
    root: "../../docs",
    files: folders.map((folder) => `${folder}/**/README.md`),
    symbol: ["h1"],
  },
  {
    type: "markdown",
    root: "../../docs",
    files: folders.flatMap((folder) => [
      `${folder}/**/*.md`,
      `!${folder}/**/README.md`,
    ]),
    symbol: ["h3"],
  },
];

/**
 * Every supported public declaration under `src` is selected for contract evidence.
 *
 * The population is derived from the source tree instead of enumerated. The
 * barrel is the only file outside it, because it re-exports declarations that
 * already answer for their contracts at their definition.
 */
const allSources = ["src/**/*.ts", "!src/**/index.ts"];

const captionSources = [
  "src/captionPlan.ts",
  "src/captionSidecar.ts",
  "src/captionSlice.ts",
];

/**
 * The rendering domain is the residual of the derived population.
 *
 * Writing it as a subtraction rather than a list is what keeps the default
 * inside the graph: a new render source answers for the rendering and editorial
 * contracts until someone deliberately assigns it to the model-export or
 * screenplay domain, instead of silently answering for nothing.
 */
const renderSources = [
  ...allSources,
  "!src/exportModel.ts",
  "!src/screenplay.ts",
];

/**
 * Public render declarations answer only for the product domains they realize.
 *
 * Topic README files remain first-class H1 evidence while stable contract
 * sections live at H3 in every non-README document. Folder populations keep new
 * contracts visible without turning barrel re-exports into false hosts.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "model serialization implements bounded asset requirements",
      type: "typescript",
      files: ["src/exportModel.ts"],
      symbol: ["type", "function", "property"],
      reference: topicReferences([
        "requirements/asset-authoring",
        "requirements/product",
      ]),
    },
    {
      name: "model serialization implements bounded asset specifications",
      type: "typescript",
      files: ["src/exportModel.ts"],
      symbol: ["type", "function", "property"],
      reference: topicReferences([
        "specifications/asset-and-representation",
        "specifications/authoring-and-authority",
      ]),
    },
    {
      name: "screenplay and caption text implement narrative requirements",
      type: "typescript",
      files: ["src/screenplay.ts", ...captionSources],
      symbol: ["type", "function", "property"],
      reference: topicReferences([
        "requirements/story",
        "requirements/delivery-and-accessibility",
      ]),
    },
    {
      name: "screenplay text implements narrative specifications",
      type: "typescript",
      files: ["src/screenplay.ts"],
      symbol: ["type", "function", "property"],
      reference: topicReferences(["specifications/narrative-and-intent"]),
    },
    {
      name: "render declarations implement rendering requirements",
      type: "typescript",
      files: renderSources,
      symbol: ["type", "function", "property"],
      reference: topicReferences([
        "requirements/rendering",
        "requirements/editorial",
        "requirements/repaint",
      ]),
    },
    {
      name: "render declarations implement editorial delivery specifications",
      type: "typescript",
      // The residual carries its own negative patterns, so the screenplay this
      // claim adds back has to follow them rather than precede them.
      files: [...renderSources, "src/screenplay.ts"],
      symbol: ["type", "function", "property"],
      reference: topicReferences([
        "specifications/editorial-render-and-delivery",
      ]),
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
