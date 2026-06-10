import { meshAdjacency, taubinSmooth } from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * A vertex the indices never reference has no neighbors and must pass through
 * smoothing untouched (the fewer-than-two-neighbors guard) — eyeball spheres
 * and other detached parts ride in the same position array.
 *
 * Scenario: a lone triangle plus an unreferenced 4th vertex at (5, 5, 5); the
 * 4th vertex comes out bit-exact.
 */
export const test_forge_taubin_isolated = (): void => {
  const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 5, 5];
  const smoothed = taubinSmooth(positions, meshAdjacency([0, 1, 2], 4));
  TestValidator.equals(
    "unreferenced vertex untouched",
    smoothed.slice(9),
    [5, 5, 5],
  );
};
