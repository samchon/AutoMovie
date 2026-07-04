import { meshAdjacency, taubinSmooth } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * One hand-computed 貫|關 iteration on a hexagon fan whose center is lifted to z
 * = 1 over a flat ring: 貫 pulls the center halfway down (0.5); the ring,
 * boundary-smoothed along itself only, stays flat; 關 then pushes the center
 * back out to 0.5 + (??.53)(0 ??0.5) = 0.765. Oracle from the spec's
 * arithmetic, not from the code.
 *
 * Scenario: default options, center z 1 ??0.765, ring z stays 0.
 */
export const test_forge_taubin_interior = (): void => {
  const indices: number[] = [];
  for (let i = 0; i < 6; i++) indices.push(0, 1 + i, 1 + ((i + 1) % 6));
  const positions: number[] = [0, 0, 1];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * i) / 3;
    positions.push(Math.cos(a), Math.sin(a), 0);
  }
  const smoothed = taubinSmooth(positions, meshAdjacency(indices, 7));
  TestValidator.predicate("center 貫|關 step", nclose(smoothed[2]!, 0.765));
  TestValidator.predicate(
    "flat boundary ring unmoved in z",
    [1, 2, 3, 4, 5, 6].every((i) => nclose(smoothed[i * 3 + 2]!, 0)),
  );
};
