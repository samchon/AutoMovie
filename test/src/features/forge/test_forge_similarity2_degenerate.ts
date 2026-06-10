import { fitSimilarity2 } from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * All-coincident source points define no scale or rotation — the fit throws
 * rather than emitting NaNs that would silently corrupt every downstream
 * vertex.
 *
 * Scenario: three copies of the same point throw.
 */
export const test_forge_similarity2_degenerate = (): void => {
  TestValidator.error("coincident sources throw", () =>
    fitSimilarity2([1, 2, 3, 1, 2, 3, 1, 2, 3], [0, 0, 0, 1, 1, 1, 2, 2, 2]),
  );
};
