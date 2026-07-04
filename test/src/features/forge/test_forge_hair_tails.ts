import { buildHairTails } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * Twin tails are mirror twins anchored beside the skull: equal vertex counts,
 * x-mirrored centroids, longer `length` reaching strictly lower, and `length` 0
 * producing empty parts (the preset schema covers tailless styles with the same
 * fields).
 *
 * Scenario: default-skull tails at length .6 — mirror centroids, count
 * equality; length 1 vs .2 minY ordering; length 0 empties.
 */
export const test_forge_hair_tails = (): void => {
  const base = { length: 0.6, height: 0.4, spread: 0.5, width: 0.5 };
  const { right, left } = buildHairTails(base);
  TestValidator.equals(
    "equal tessellation",
    right.positions.length,
    left.positions.length,
  );
  const cxOf = (p: number[]): number => {
    let c = 0;
    for (let i = 0; i < p.length; i += 3) c += p[i]! / (p.length / 3);
    return c;
  };
  TestValidator.predicate(
    "mirror anchors",
    nclose(cxOf(right.positions), -cxOf(left.positions), 5e-3), // seam vertex skews both centroids equally
  );
  const minY = (p: number[]): number => {
    let m = Infinity;
    for (let i = 1; i < p.length; i += 3) m = Math.min(m, p[i]!);
    return m;
  };
  const long = buildHairTails({ ...base, length: 1 });
  const short = buildHairTails({ ...base, length: 0.2 });
  TestValidator.predicate(
    "length reaches lower",
    minY(long.right.positions) < minY(short.right.positions) - 0.1,
  );
  const none = buildHairTails(
    { ...base, length: 0 },
    { width: 0.5, crown: 0, depth: 0 },
  );
  TestValidator.equals("length 0 is empty", none.right.positions.length, 0);
};
