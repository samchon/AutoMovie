import type { ITtscEvidenceGraphClaim } from "@ttsc/evidence";

import type { AutoMovieProductionContractClaim } from "./createAutoMovieProductionContractClaim";

/**
 * Project admitted local claims into the native evaluator's input schema.
 *
 * The factory validates ownership first. Manifest readers retain the original
 * declaration; this projection removes only its AutoMovie binding metadata.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-native-boundary Preserves claim policy and the authored declaration while adapting local claims for native evaluation.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-native-boundary Copies admitted claims and removes only AutoMovie ownership metadata from native output.
 */
export const projectAutoMovieNativeClaims = (
  claims: readonly (
    | ITtscEvidenceGraphClaim
    | AutoMovieProductionContractClaim
  )[],
): ITtscEvidenceGraphClaim[] =>
  claims.map((claim) => {
    const native = { ...claim };
    Reflect.deleteProperty(native, "autoMovieBinding");
    return native;
  });
