import { buildHairShell } from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * `updo` gathers the drape: at full lift the back/side strands end near the
 * nape instead of falling by `length`, and the A-line flare collapses — bound
 * hair hugs the skull. Same parameters otherwise, so the comparison isolates
 * the new control.
 *
 * Scenario: a long style with `updo: 1` ends strictly higher (greater min y)
 * and flares strictly less (smaller max |x|) than the same style loose.
 */
export const test_forge_hair_updo = (): void => {
  const base = { length: 0.8, volume: 0.6, bangs: 0.5, curtain: 0.5 };
  const loose = buildHairShell(base);
  const bound = buildHairShell({ ...base, updo: 1 });
  const minY = (p: number[]): number => {
    let m = Infinity;
    for (let i = 1; i < p.length; i += 3) m = Math.min(m, p[i]!);
    return m;
  };
  const maxAbsX = (p: number[]): number => {
    let m = 0;
    for (let i = 0; i < p.length; i += 3) m = Math.max(m, Math.abs(p[i]!));
    return m;
  };
  TestValidator.predicate(
    "updo lifts the fall to the nape",
    minY(bound.positions) > minY(loose.positions) + 0.05,
  );
  TestValidator.predicate(
    "updo suppresses the flare",
    maxAbsX(bound.positions) < maxAbsX(loose.positions),
  );
};
