import type {
  ITtscEvidenceGraphClaim,
  ITtscEvidenceGraphConfig,
  ITtscEvidenceGraphReference,
} from "@ttsc/evidence";
import fs from "node:fs";
import path from "node:path";

import type { AutoMovieEvidenceStage } from "./AutoMovieEvidenceStage";
import type { IAutoMovieEvidenceConfigProps } from "./IAutoMovieEvidenceConfigProps";
import { requiresReview } from "./internal/requiresReview";
import { validateEvidenceHosts } from "./internal/validateEvidenceHosts";
import { validateEvidenceStages } from "./internal/validateEvidenceStages";

const DOCS = "docs";
const CONTRACTS = "config/docs";

const SETTINGS = ["settings/**/*.md"];
const RESEARCH = ["research/**/*.md"];
const MODELS = ["models/**/*.md"];
const MOTIONS = ["motions/**/*.md"];
const STORYLINES = ["storylines/**/*.md"];
const SCENARIOS = ["scenarios/**/*.md"];
const SCRIPT = ["script/**/*.md"];
const BRIEFS = ["briefs/**/*.md"];

const SUBJECT_SOURCES = [
  "src/units/**/*.ts",
  "src/objects/**/*.ts",
  "src/world/**/*.ts",
  "src/formations/**/*.ts",
];
const MOTION_SOURCES = ["src/motions/**/*.ts"];
const SHOT_SOURCES = ["src/shots/**/*.ts"];
const PRODUCTION_SOURCES = ["src/production.ts"];
const FILM_SOURCES = ["src/film.ts"];

/** Builds one item-by-item principle checklist for every selected host. */
const principleChecklist = (
  file: string,
  requireReview: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: CONTRACTS,
  files: [`principles/${file}`],
  symbol: "h2",
  checklist: true,
  noEvidenceExclude: true,
  requireReview,
});

/** Covers source principles across a population without making every symbol a checklist. */
const principleReference = (
  file: string,
  requireReview: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: CONTRACTS,
  files: [`principles/${file}`],
  symbol: "h2",
  noEvidenceExclude: true,
  requireReview,
});

/** Principle checklists that bind one authored Markdown layer. */
const authoredPrinciples = (
  layer:
    | "settings"
    | "research"
    | "models"
    | "motions"
    | "storylines"
    | "scenarios"
    | "scripts"
    | "briefs",
  requireReview: boolean,
): ITtscEvidenceGraphReference[] => [
  principleChecklist("common.md", requireReview),
  ...(["storylines", "scenarios", "scripts"].includes(layer)
    ? [principleChecklist("narratives.md", requireReview)]
    : []),
  principleChecklist(`${layer}.md`, requireReview),
];

/** One reference per settings file keeps every settings unit independently visible. */
const settingsReferences = (
  location: string,
  requireReview: boolean,
): ITtscEvidenceGraphReference[] =>
  referencesPerFile(location, "settings", "h2", requireReview);

/** One reference per model file keeps every represented model independently visible. */
const modelReferences = (
  location: string,
  requireReview: boolean,
): ITtscEvidenceGraphReference[] =>
  referencesPerFile(location, "models", "h2", requireReview);

/** One reference per motion file keeps every authored motion independently visible. */
const motionReferences = (
  location: string,
  requireReview: boolean,
): ITtscEvidenceGraphReference[] =>
  referencesPerFile(location, "motions", "h2", requireReview);

/**
 * Creates one reference per Markdown file under a production-doc directory.
 *
 * A combined glob lets one file's citation discharge a unit in another file;
 * separate references make every file's own H2 catalogue complete or honestly
 * excluded on its own.
 */
const referencesPerFile = (
  location: string,
  directory: string,
  symbol: "file" | "h2" | "h3" | "h4",
  requireReview: boolean,
  noEvidenceExclude = false,
): ITtscEvidenceGraphReference[] => {
  const docsRoot = path.join(location, DOCS);
  const root = path.join(docsRoot, directory);
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      // Code-unit order keeps graph construction independent of host locale.
      .sort((x, y) => Number(x.name > y.name) - Number(x.name < y.name))) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && entry.name.endsWith(".md"))
        files.push(path.relative(docsRoot, absolute));
    }
  };
  walk(root);
  return files.map((file) => ({
    type: "markdown",
    root: DOCS,
    files: [file.replaceAll("\\", "/")],
    symbol,
    noEvidenceExclude,
    requireReview,
  }));
};

/** Exact one-to-one parentage between matching narrative units. */
const lineage = (
  files: string[],
  symbol: "h2" | "h3" | "h4",
  requireReview: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: DOCS,
  files,
  symbol,
  noEvidenceExclude: true,
  uniqueEvidence: true,
  singleEvidencePerSymbol: true,
  requireReview,
});

/** A complete model or motion source symbol answers for exactly one design file. */
const oneDesignFile = (
  files: string[],
  requireReview: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: DOCS,
  files,
  symbol: "file",
  noEvidenceExclude: true,
  singleEvidencePerSymbol: true,
  requireReview,
});

/** Shared role targets distributed across one owning H2 population. */
const obligations = (
  file: "settings" | "storylines" | "models" | "motions",
  requireReview: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: CONTRACTS,
  files: [`obligations/${file}.md`],
  symbol: "h2",
  requireReview,
});

/** Whether a layer contributes claims to the active graph. */
const disabled = (stage: AutoMovieEvidenceStage): boolean =>
  stage === "disabled";

/** Creates the complete evidence graph for one generated production. */
export function createAutoMovieEvidenceConfig(
  props: IAutoMovieEvidenceConfigProps,
): ITtscEvidenceGraphConfig {
  validateEvidenceStages(props);
  validateEvidenceHosts(props);

  const settingsReview = requiresReview(props.settings);
  const researchReview = requiresReview(props.research);
  const modelReview = requiresReview(props.models);
  const motionReview = requiresReview(props.motions);
  const storylineReview = requiresReview(props.storylines);
  const scenarioReview = requiresReview(props.scenarios);
  const scriptReview = requiresReview(props.script);
  const briefReview = requiresReview(props.briefs);
  const modelSourceReview = requiresReview(props.modelSources);
  const motionSourceReview = requiresReview(props.motionSources);
  const shotReview = requiresReview(props.shots);
  const productionSourceReview = requiresReview(props.productionSources);
  const filmSourceReview = requiresReview(props.filmSources);

  const claims: ITtscEvidenceGraphClaim[] = [
    {
      name: "settings files answer common and settings principle checklists",
      type: "markdown",
      root: DOCS,
      files: SETTINGS,
      symbol: "file",
      disabled: disabled(props.settings),
      reference: authoredPrinciples("settings", settingsReview),
    },
    {
      name: "settings H2 units realize or exclude every production obligation",
      type: "markdown",
      root: DOCS,
      files: SETTINGS,
      symbol: "h2",
      disabled: disabled(props.settings),
      reference: obligations("settings", settingsReview),
    },
    {
      name: "research files answer common and research principle checklists",
      type: "markdown",
      root: DOCS,
      files: RESEARCH,
      symbol: "file",
      disabled: disabled(props.research),
      reference: authoredPrinciples("research", researchReview),
    },
    {
      name: "active research units support downstream authored decisions",
      type: "markdown",
      root: DOCS,
      files: [
        ...(!disabled(props.settings) ? SETTINGS : []),
        ...(!disabled(props.models) ? MODELS : []),
        ...(!disabled(props.motions) ? MOTIONS : []),
        ...(!disabled(props.storylines) ? STORYLINES : []),
        ...(!disabled(props.scenarios) ? SCENARIOS : []),
        ...(!disabled(props.script) ? SCRIPT : []),
        ...(!disabled(props.briefs) ? BRIEFS : []),
      ],
      symbol: "h2",
      disabled:
        disabled(props.research) ||
        [
          props.settings,
          props.models,
          props.motions,
          props.storylines,
          props.scenarios,
          props.script,
          props.briefs,
        ].every(disabled),
      reference: referencesPerFile(
        props.location,
        "research",
        "h2",
        researchReview,
        true,
      ),
    },
    {
      name: "model files answer common and model principle checklists",
      type: "markdown",
      root: DOCS,
      files: MODELS,
      symbol: "file",
      disabled: disabled(props.models),
      reference: authoredPrinciples("models", modelReview),
    },
    {
      name: "model H2 units account for settings and shared model obligations",
      type: "markdown",
      root: DOCS,
      files: MODELS,
      symbol: "h2",
      disabled: disabled(props.models),
      reference: [
        ...settingsReferences(props.location, modelReview),
        obligations("models", modelReview),
      ],
    },
    {
      name: "motion files answer common and motion principle checklists",
      type: "markdown",
      root: DOCS,
      files: MOTIONS,
      symbol: "file",
      disabled: disabled(props.motions),
      reference: authoredPrinciples("motions", motionReview),
    },
    {
      name: "motion H2 units account for settings, models, and motion obligations",
      type: "markdown",
      root: DOCS,
      files: MOTIONS,
      symbol: "h2",
      disabled: disabled(props.motions),
      reference: [
        ...settingsReferences(props.location, motionReview),
        ...modelReferences(props.location, motionReview),
        obligations("motions", motionReview),
      ],
    },
    {
      name: "storyline files answer common, narrative, and storyline checklists",
      type: "markdown",
      root: DOCS,
      files: STORYLINES,
      symbol: "file",
      disabled: disabled(props.storylines),
      reference: authoredPrinciples("storylines", storylineReview),
    },
    {
      name: "storyline H2 sequences account for settings and shared roles",
      type: "markdown",
      root: DOCS,
      files: STORYLINES,
      symbol: "h2",
      disabled: disabled(props.storylines),
      reference: [
        ...settingsReferences(props.location, storylineReview),
        obligations("storylines", storylineReview),
      ],
    },
    {
      name: "storyline H3 scenes account for settings",
      type: "markdown",
      root: DOCS,
      files: STORYLINES,
      symbol: "h3",
      disabled: disabled(props.storylines),
      reference: settingsReferences(props.location, storylineReview),
    },
    {
      name: "storyline H4 beats account for settings",
      type: "markdown",
      root: DOCS,
      files: STORYLINES,
      symbol: "h4",
      disabled: disabled(props.storylines),
      reference: settingsReferences(props.location, storylineReview),
    },
    ...(["h2", "h3", "h4"] as const).map(
      (symbol): ITtscEvidenceGraphClaim => ({
        name: `scenario ${symbol.toUpperCase()} units refine matching storyline units`,
        type: "markdown",
        root: DOCS,
        files: SCENARIOS,
        symbol,
        disabled: disabled(props.scenarios),
        reference: [
          lineage(STORYLINES, symbol, scenarioReview),
          ...settingsReferences(props.location, scenarioReview),
        ],
      }),
    ),
    {
      name: "scenario files answer common, narrative, and scenario checklists",
      type: "markdown",
      root: DOCS,
      files: SCENARIOS,
      symbol: "file",
      disabled: disabled(props.scenarios),
      reference: authoredPrinciples("scenarios", scenarioReview),
    },
    ...(["h2", "h3", "h4"] as const).map(
      (symbol): ITtscEvidenceGraphClaim => ({
        name: `script ${symbol.toUpperCase()} units preserve scenario and storyline lineage`,
        type: "markdown",
        root: DOCS,
        files: SCRIPT,
        symbol,
        disabled: disabled(props.script),
        reference: [
          lineage(SCENARIOS, symbol, scriptReview),
          lineage(STORYLINES, symbol, scriptReview),
          ...settingsReferences(props.location, scriptReview),
        ],
      }),
    ),
    {
      name: "script files answer common, narrative, and script checklists",
      type: "markdown",
      root: DOCS,
      files: SCRIPT,
      symbol: "file",
      disabled: disabled(props.script),
      reference: authoredPrinciples("scripts", scriptReview),
    },
    {
      name: "brief files answer common and direct-brief checklists",
      type: "markdown",
      root: DOCS,
      files: BRIEFS,
      symbol: "file",
      disabled: disabled(props.briefs),
      reference: authoredPrinciples("briefs", briefReview),
    },
    ...(["h2", "h3", "h4"] as const).map(
      (symbol): ITtscEvidenceGraphClaim => ({
        name: `brief ${symbol.toUpperCase()} units account for settings and active design branches`,
        type: "markdown",
        root: DOCS,
        files: BRIEFS,
        symbol,
        disabled: disabled(props.briefs),
        reference: [
          ...settingsReferences(props.location, briefReview),
          ...(!disabled(props.models)
            ? modelReferences(props.location, briefReview)
            : []),
          ...(!disabled(props.motions)
            ? motionReferences(props.location, briefReview)
            : []),
        ],
      }),
    ),
    {
      name: "each model class answers exactly one model design file",
      type: "typescript",
      files: SUBJECT_SOURCES,
      symbol: "type",
      disabled: disabled(props.modelSources),
      reference: oneDesignFile(MODELS, modelSourceReview),
    },
    {
      name: "model source realizes every model design unit and source principle",
      type: "typescript",
      files: SUBJECT_SOURCES,
      symbol: ["type", "property", "function"],
      disabled: disabled(props.modelSources),
      reference: [
        principleReference("model-sources.md", modelSourceReview),
        {
          type: "markdown",
          root: DOCS,
          files: MODELS,
          symbol: "h2",
          noEvidenceExclude: true,
          requireReview: modelSourceReview,
        },
      ],
    },
    {
      name: "each motion source answers exactly one motion design file",
      type: "typescript",
      files: MOTION_SOURCES,
      symbol: ["function", "property"],
      disabled: disabled(props.motionSources),
      reference: oneDesignFile(MOTIONS, motionSourceReview),
    },
    {
      name: "motion source realizes every motion unit and source principle",
      type: "typescript",
      files: MOTION_SOURCES,
      symbol: ["function", "property"],
      disabled: disabled(props.motionSources),
      reference: [
        principleReference("motion-sources.md", motionSourceReview),
        {
          type: "markdown",
          root: DOCS,
          files: MOTIONS,
          symbol: "h2",
          noEvidenceExclude: true,
          requireReview: motionSourceReview,
        },
      ],
    },
    {
      name: "shots realize exactly one script scene or direct-brief shot",
      type: "typescript",
      files: SHOT_SOURCES,
      symbol: ["function", "property"],
      disabled: disabled(props.shots),
      reference: {
        type: "markdown",
        root: DOCS,
        files: props.kind === "film" ? SCRIPT : BRIEFS,
        symbol: "h3",
        noEvidenceExclude: true,
        singleEvidencePerSymbol: true,
        requireReview: shotReview,
      },
    },
    {
      name: "shot source realizes every shot principle",
      type: "typescript",
      files: SHOT_SOURCES,
      symbol: ["function", "property"],
      disabled: disabled(props.shots),
      reference: principleReference("shots.md", shotReview),
    },
    {
      name: "production source serializes settings and production-source principles",
      type: "typescript",
      files: PRODUCTION_SOURCES,
      symbol: "property",
      disabled: disabled(props.productionSources),
      reference: [
        principleReference("production-sources.md", productionSourceReview),
        ...settingsReferences(props.location, productionSourceReview),
      ],
    },
    {
      name: "film source assembles screenplay or brief units and film-source principles",
      type: "typescript",
      files: FILM_SOURCES,
      symbol: "property",
      disabled: disabled(props.filmSources),
      reference: [
        principleReference("film-sources.md", filmSourceReview),
        {
          type: "markdown",
          root: DOCS,
          files: props.kind === "film" ? SCRIPT : BRIEFS,
          symbol: "h2",
          noEvidenceExclude: true,
          requireReview: filmSourceReview,
        },
      ],
    },
  ];

  return {
    claims: claims.filter((claim) =>
      Array.isArray(claim.reference) ? claim.reference.length > 0 : true,
    ),
  };
}
