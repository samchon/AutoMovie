import { meshAdjacency, taubinSmooth } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * Per-vertex weights protect features: a vertex weighted 0 must come out
 * bit-exact even where unweighted smoothing would move it (the interior test's
 * 0.765), pinning that the weight multiplies the step rather than, say, the
 * neighborhood.
 *
 * Scenario: the hexagon-fan center with weight 0 keeps z exactly 1 over 3
 * iterations.
 */
export const test_forge_taubin_weights = (): void => {
  const indices: number[] = [];
  for (let i = 0; i < 6; i++) indices.push(0, 1 + i, 1 + ((i + 1) % 6));
  const positions: number[] = [0, 0, 1];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * i) / 3;
    positions.push(Math.cos(a), Math.sin(a), 0);
  }
  const smoothed = taubinSmooth(positions, meshAdjacency(indices, 7), {
    iterations: 3,
    weights: [0, 1, 1, 1, 1, 1, 1],
  });
  TestValidator.equals("zero-weight vertex pinned", smoothed[2], 1);
};
