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

const captionSources = [
  "src/captionPlan.ts",
  "src/captionSidecar.ts",
  "src/captionSlice.ts",
];
const renderSources = [
  ...captionSources,
  "src/chunkSequenceRender.ts",
  "src/guidePasses.ts",
  "src/headlessCapture.ts",
  "src/plan.ts",
  "src/poseKeypointPlan.ts",
  "src/poseKeypointSidecar.ts",
  "src/renderAndSee.ts",
  "src/renderBudgetPreflight.ts",
  "src/renderObservationAudit.ts",
  "src/renderVideo.ts",
  "src/sequenceRenderPlan.ts",
  "src/sequenceRenderVideo.ts",
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
      files: ["src/screenplay.ts", ...renderSources],
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
