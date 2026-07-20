import { meshAdjacency, taubinSmooth } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * Boundary vertices smooth against boundary neighbors at the reduced
 * `boundaryFactor` strength. On a two-triangle quad every vertex is boundary;
 * lifting one corner to z = 1 and hand-running one λ|μ iteration at factor 0.6
 * gives λ: v0 1→0.7, v1/v3 0→0.15, v2 0→0.1; μ: v0 0.7 +
 * (−0.318)((0.15+0.1+0.15)/3 − 0.7) = 0.8802. Oracle by hand.
 *
 * Scenario: quad (0,1,2)+(0,2,3), v0 at z 1 → 0.8802 after one iteration.
 */
export const test_forge_taubin_boundary = (): void => {
  const positions = [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0];
  const smoothed = taubinSmooth(
    positions,
    meshAdjacency([0, 1, 2, 0, 2, 3], 4),
  );
  TestValidator.predicate("corner λ|μ step", nclose(smoothed[2]!, 0.8802));
};
