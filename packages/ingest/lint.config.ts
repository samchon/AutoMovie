import {
  type ITtscEvidenceGraphConfig,
  type ITtscEvidenceGraphReference,
  evidence,
} from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Contract documents named one by one, at the section level.
 *
 * A topic population would enrol every document in the folder and make this
 * package answer for units it does not implement, so a domain whose contracts
 * live beside other owners' contracts is selected document by document.
 */
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

/**
 * Every supported public declaration under `src` is selected for contract evidence.
 *
 * The population crosses every directory depth, so a source added under a new
 * subdirectory joins the graph by existing. The barrel is the only exclusion,
 * because it re-exports declarations that already answer at their definition.
 */
const publicSurface = ["src/**/*.ts", "!src/**/index.ts"];

/**
 * The audio media-input domain: WAVE source facts, decode, and processing.
 *
 * These sources answer for the sound and audio-delivery contracts of the bytes
 * they read, which their claim names document by document rather than by topic
 * folder: the sound and delivery folders also hold the mixing, cue scheduling,
 * dialogue, loudness and provenance-recording units that belong to the engine
 * mixer and the production layer, not to an input decoder. The barrel is
 * subtracted because it re-exports declarations that answer at their
 * definition.
 */
const audioSources = ["src/audio/**/*.ts", "!src/audio/index.ts"];

/**
 * The public ingest surface answers for stable contract populations.
 *
 * Contract documents are selected by domain or by the complete layer, never by
 * individual Markdown filename. New documents therefore enter the graph
 * automatically and non-applicable units remain explicit source exclusions.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public ingest exports implement requirements",
      type: "typescript",
      files: publicSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/asset-authoring/**/README.md",
            "requirements/external-inputs/**/README.md",
            "requirements/motion/**/README.md",
          ],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "requirements/asset-authoring/**/*.md",
            "requirements/external-inputs/**/*.md",
            "requirements/motion/**/*.md",
            "!requirements/**/README.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "public ingest exports implement specifications",
      type: "typescript",
      files: publicSurface,
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/**/README.md",
            "specifications/interchange-and-adoption/**/README.md",
            "specifications/performance-motion-and-staging/**/README.md",
          ],
          symbol: ["h1"],
        },
        {
          type: "markdown",
          root: "../../docs",
          files: [
            "specifications/asset-and-representation/**/*.md",
            "specifications/interchange-and-adoption/**/*.md",
            "specifications/performance-motion-and-staging/**/*.md",
            "!specifications/**/README.md",
          ],
          symbol: ["h3"],
        },
      ],
    },
    {
      name: "audio media input implements its decode and source contracts",
      type: "typescript",
      files: audioSources,
      symbol: ["type", "function", "property"],
      reference: documentReferences([
        "requirements/sound/sources-and-external-assets.md",
        "requirements/delivery-and-accessibility/audio-streams-and-channels.md",
        "requirements/evidence-and-provenance/generation-transformation-and-derivation.md",
        "specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md",
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
