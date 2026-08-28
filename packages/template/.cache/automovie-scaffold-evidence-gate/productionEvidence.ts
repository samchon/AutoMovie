import type { IAutoMovieEvidenceConfigProps } from "@automovie/evidence";

/**
 * The sole tracked production kind, population scope, branch-stage, and local
 * contract declaration consumed by graph lint, instruction sync, and final
 * production review.
 *
 * Select the production shape, then advance one layer at a time through
 * `draft -> evidence -> review`. A film follows settings, treatments, scripts,
 * screenplays, shots, and film sources; a brief follows settings, briefs,
 * shots, and film sources; a library selects settings and only its delivered
 * design/source pairs. Film and brief also require reviewed productionSources
 * as the parallel serialized input to filmSources.
 */
export const productionEvidence: IAutoMovieEvidenceConfigProps = {
  location: import.meta.dirname,
  kind: "library",
  populationScope: { mode: "complete-production" },
  settings: "evidence",
  research: "disabled",
  maps: "disabled",
  models: "disabled",
  spaces: "disabled",
  materials: "disabled",
  instances: "disabled",
  motions: "disabled",
  systems: "disabled",
  treatments: "disabled",
  scripts: "disabled",
  screenplays: "disabled",
  briefs: "disabled",
  mapSources: "disabled",
  modelSources: "disabled",
  spaceSources: "disabled",
  materialSources: "disabled",
  instanceSources: "disabled",
  motionSources: "disabled",
  systemSources: "disabled",
  shots: "disabled",
  productionSources: "disabled",
  filmSources: "disabled",
  claims: [],
};
