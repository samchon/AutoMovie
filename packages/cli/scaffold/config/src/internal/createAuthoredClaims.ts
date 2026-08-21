import type { ITtscEvidenceGraphClaim } from "@ttsc/evidence";

import type { IAutoMovieEvidenceConfigProps } from "../IAutoMovieEvidenceConfigProps";
import {
  authoredPrinciples,
  commonUnitObligations,
  layerObligations,
  lineage,
  modelReferences,
  motionReferences,
  referencesPerFile,
  settingsReferences,
} from "./createReferences";
import {
  BRIEFS,
  DOCS,
  MODELS,
  MOTIONS,
  RESEARCH,
  SCENARIOS,
  SCRIPT,
  SETTINGS,
  STORYLINES,
} from "./graphConstants";
import { requiresEvidence, requiresReview } from "./requiresReview";

/** Creates the Markdown claims shared by every generated production. */
export const createAuthoredClaims = (
  props: IAutoMovieEvidenceConfigProps,
): ITtscEvidenceGraphClaim[] => {
  const settingsReview = requiresReview(props.settings);
  const researchReview = requiresReview(props.research);
  const modelReview = requiresReview(props.models);
  const motionReview = requiresReview(props.motions);
  const storylineReview = requiresReview(props.storylines);
  const scenarioReview = requiresReview(props.scenarios);
  const scriptReview = requiresReview(props.script);
  const briefReview = requiresReview(props.briefs);
  const off = (stage: typeof props.settings): boolean =>
    !requiresEvidence(stage);

  return [
    {
      name: "settings files answer common and settings principle checklists",
      type: "markdown",
      root: DOCS,
      files: SETTINGS,
      symbol: "file",
      disabled: off(props.settings),
      reference: authoredPrinciples("settings", settingsReview),
    },
    {
      name: "settings H2 units answer common obligations and allocate setting roles",
      type: "markdown",
      root: DOCS,
      files: SETTINGS,
      symbol: "h2",
      disabled: off(props.settings),
      reference: [
        commonUnitObligations(settingsReview),
        layerObligations("settings", settingsReview),
      ],
    },
    {
      name: "research files answer common and research principle checklists",
      type: "markdown",
      root: DOCS,
      files: RESEARCH,
      symbol: "file",
      disabled: off(props.research),
      reference: authoredPrinciples("research", researchReview),
    },
    {
      name: "active research units support downstream authored decisions",
      type: "markdown",
      root: DOCS,
      files: [
        ...(requiresEvidence(props.settings) ? SETTINGS : []),
        ...(requiresEvidence(props.models) ? MODELS : []),
        ...(requiresEvidence(props.motions) ? MOTIONS : []),
        ...(requiresEvidence(props.storylines) ? STORYLINES : []),
        ...(requiresEvidence(props.scenarios) ? SCENARIOS : []),
        ...(requiresEvidence(props.script) ? SCRIPT : []),
        ...(requiresEvidence(props.briefs) ? BRIEFS : []),
      ],
      symbol: "h2",
      disabled:
        off(props.research) ||
        [
          props.settings,
          props.models,
          props.motions,
          props.storylines,
          props.scenarios,
          props.script,
          props.briefs,
        ].every(off),
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
      disabled: off(props.models),
      reference: authoredPrinciples("models", modelReview),
    },
    {
      name: "model H2 units answer common obligations and account for settings and model roles",
      type: "markdown",
      root: DOCS,
      files: MODELS,
      symbol: "h2",
      disabled: off(props.models),
      reference: [
        commonUnitObligations(modelReview),
        ...settingsReferences(props.location, modelReview),
        layerObligations("models", modelReview),
      ],
    },
    {
      name: "motion files answer common and motion principle checklists",
      type: "markdown",
      root: DOCS,
      files: MOTIONS,
      symbol: "file",
      disabled: off(props.motions),
      reference: authoredPrinciples("motions", motionReview),
    },
    {
      name: "motion H2 units answer common obligations and account for settings models and motion roles",
      type: "markdown",
      root: DOCS,
      files: MOTIONS,
      symbol: "h2",
      disabled: off(props.motions),
      reference: [
        commonUnitObligations(motionReview),
        ...settingsReferences(props.location, motionReview),
        ...modelReferences(props.location, motionReview),
        layerObligations("motions", motionReview),
      ],
    },
    {
      name: "storyline files answer common narrative and storyline checklists",
      type: "markdown",
      root: DOCS,
      files: STORYLINES,
      symbol: "file",
      disabled: off(props.storylines),
      reference: authoredPrinciples("storylines", storylineReview),
    },
    {
      name: "storyline H2 sequences answer common obligations and allocate storyline roles",
      type: "markdown",
      root: DOCS,
      files: STORYLINES,
      symbol: "h2",
      disabled: off(props.storylines),
      reference: [
        commonUnitObligations(storylineReview),
        ...settingsReferences(props.location, storylineReview),
        layerObligations("storylines", storylineReview),
      ],
    },
    ...(["h3", "h4"] as const).map(
      (symbol): ITtscEvidenceGraphClaim => ({
        name: `storyline ${symbol.toUpperCase()} units answer common obligations and account for settings`,
        type: "markdown",
        root: DOCS,
        files: STORYLINES,
        symbol,
        disabled: off(props.storylines),
        reference: [
          commonUnitObligations(storylineReview),
          ...settingsReferences(props.location, storylineReview),
        ],
      }),
    ),
    {
      name: "scenario files answer common narrative and scenario checklists",
      type: "markdown",
      root: DOCS,
      files: SCENARIOS,
      symbol: "file",
      disabled: off(props.scenarios),
      reference: authoredPrinciples("scenarios", scenarioReview),
    },
    ...(["h2", "h3", "h4"] as const).map(
      (symbol): ITtscEvidenceGraphClaim => ({
        name: `scenario ${symbol.toUpperCase()} units answer common obligations and refine storylines`,
        type: "markdown",
        root: DOCS,
        files: SCENARIOS,
        symbol,
        disabled: off(props.scenarios),
        reference: [
          commonUnitObligations(scenarioReview),
          lineage(STORYLINES, symbol, scenarioReview),
          ...settingsReferences(props.location, scenarioReview),
        ],
      }),
    ),
    {
      name: "script files answer common narrative and screenplay checklists",
      type: "markdown",
      root: DOCS,
      files: SCRIPT,
      symbol: "file",
      disabled: off(props.script),
      reference: authoredPrinciples("scripts", scriptReview),
    },
    ...(["h2", "h3", "h4"] as const).map(
      (symbol): ITtscEvidenceGraphClaim => ({
        name: `script ${symbol.toUpperCase()} units answer common obligations and preserve narrative lineage`,
        type: "markdown",
        root: DOCS,
        files: SCRIPT,
        symbol,
        disabled: off(props.script),
        reference: [
          commonUnitObligations(scriptReview),
          lineage(SCENARIOS, symbol, scriptReview),
          lineage(STORYLINES, symbol, scriptReview),
          ...settingsReferences(props.location, scriptReview),
        ],
      }),
    ),
    {
      name: "brief files answer common and direct-brief checklists",
      type: "markdown",
      root: DOCS,
      files: BRIEFS,
      symbol: "file",
      disabled: off(props.briefs),
      reference: authoredPrinciples("briefs", briefReview),
    },
    ...(["h2", "h3", "h4"] as const).map(
      (symbol): ITtscEvidenceGraphClaim => ({
        name: `brief ${symbol.toUpperCase()} units answer common obligations and account for active design branches`,
        type: "markdown",
        root: DOCS,
        files: BRIEFS,
        symbol,
        disabled: off(props.briefs),
        reference: [
          commonUnitObligations(briefReview),
          ...settingsReferences(props.location, briefReview),
          ...(requiresEvidence(props.models)
            ? modelReferences(props.location, briefReview)
            : []),
          ...(requiresEvidence(props.motions)
            ? motionReferences(props.location, briefReview)
            : []),
        ],
      }),
    ),
  ];
};
