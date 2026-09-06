import type { AutoMoviePopulationScope } from "./AutoMoviePopulationScope";
import { createAutoMoviePopulationFiles } from "./createAutoMoviePopulationFiles";
import type { AutoMovieProductionContractLayer } from "./createAutoMovieProductionContractClaim";

/**
 * Selects the complete authored file population compared by a layer account.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Gives shared and local accounts the same complete authored denominator.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Reuses narrative pilot selection and otherwise includes every depth of the authored layer.
 */
export function createAutoMovieAuthoredPopulationFiles(
  layer: AutoMovieProductionContractLayer,
  scope: AutoMoviePopulationScope,
): string[] {
  if (layer === "treatments" || layer === "scripts" || layer === "screenplays")
    return createAutoMoviePopulationFiles(layer, scope);
  return [`${layer}/**/*.md`];
}
