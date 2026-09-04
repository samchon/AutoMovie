import type {
  AutoMovieEvidenceStage,
  IAutoMovieEvidenceConfigProps,
} from "./createAutoMovieEvidenceConfig";
import type { AutoMovieProductionLanguage } from "./AutoMovieProductionLanguage";

const DISABLED: AutoMovieEvidenceStage = "disabled";

/**
 * Create the one explicit unselected production declaration installed by a
 * fresh scaffold.
 *
 * The language remains an explicit caller input. Everything else is the
 * closed blank state: no production kind, no active branch, no local claim,
 * and the complete-production population mode that becomes effective only
 * after authorship selects a kind.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the initial unselected state as visible and complete as every later tracked declaration.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Produces the canonical input state used by both first scaffold rendering and later instruction synchronization.
 */
export const createBlankAutoMovieProductionEvidence = (
  location: string,
  language: AutoMovieProductionLanguage,
): IAutoMovieEvidenceConfigProps => ({
  location,
  kind: null,
  language,
  populationScope: { mode: "complete-production" },
  settings: DISABLED,
  research: DISABLED,
  maps: DISABLED,
  models: DISABLED,
  spaces: DISABLED,
  materials: DISABLED,
  instances: DISABLED,
  motions: DISABLED,
  systems: DISABLED,
  treatments: DISABLED,
  scripts: DISABLED,
  screenplays: DISABLED,
  briefs: DISABLED,
  mapSources: DISABLED,
  modelSources: DISABLED,
  spaceSources: DISABLED,
  materialSources: DISABLED,
  instanceSources: DISABLED,
  motionSources: DISABLED,
  systemSources: DISABLED,
  shots: DISABLED,
  productionSources: DISABLED,
  filmSources: DISABLED,
  claims: [],
});
