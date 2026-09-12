import {
  type ITtscEvidenceGraphConfig,
  type ITtscEvidenceGraphReference,
  evidence,
} from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const documentReferences = (
  files: readonly string[],
): ITtscEvidenceGraphReference[] => [
  {
    type: "markdown",
    root: "../../docs",
    files: [...files],
    symbol: ["h3"],
  },
];

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
  "src/caption/**/*.ts",
  "!src/caption/index.ts",
  "src/captionPlan.ts",
  "src/captionSidecar.ts",
  "src/captionSlice.ts",
];

/**
 * The media domain: output profiles, the occurrence key and the Node entry.
 *
 * These sources answer for the delivery contracts of the bytes they write and
 * read, which are named document by document in their claim rather than by
 * topic folder: selecting a folder would make this package answer for every
 * unit in it, including the mixing, provider and human-judgment units it does
 * not implement. The barrels re-export declarations that answer at their
 * definition, and the model exporter answers under the two model-serialization
 * claims instead, so all three are subtracted.
 */
const mediaSources = [
  "src/delivery/**/*.ts",
  "!src/delivery/index.ts",
  "src/film/**/*.ts",
  "!src/film/index.ts",
  "src/node/**/*.ts",
  "!src/node/index.ts",
  "!src/node/exportModelToGLB.ts",
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
  "!src/node/exportModelToGLB.ts",
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
      files: ["src/node/exportModelToGLB.ts"],
      symbol: ["type", "function", "property"],
      reference: topicReferences([
        "requirements/asset-authoring",
        "requirements/product",
      ]),
    },
    {
      name: "model serialization implements bounded asset specifications",
      type: "typescript",
      files: ["src/node/exportModelToGLB.ts"],
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
      name: "delivery and media declarations implement their delivery contracts",
      type: "typescript",
      files: mediaSources,
      symbol: ["type", "function", "property"],
      reference: documentReferences([
        "requirements/delivery-and-accessibility/audio-streams-and-channels.md",
        "requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md",
        "requirements/delivery-and-accessibility/picture-color-and-image-sequences.md",
        "requirements/sound/sources-and-external-assets.md",
        "requirements/sound/validation-and-delivery.md",
        "specifications/asset-and-representation/generated-assets-and-repaint-handoff.md",
        "specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md",
      ]),
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
