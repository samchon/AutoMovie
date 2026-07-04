import { buildHairShell } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * `volume` inflates the drape outward from the skull: full volume must be
 * strictly wider than skin-tight at otherwise equal parameters.
 *
 * Scenario: max |x| at volume 1 exceeds volume 0 by more than a centimeter.
 */
export const test_forge_hair_shell_volume = (): void => {
  const base = { length: 0.5, bangs: 0.5, curtain: 0.5 };
  const maxX = (positions: number[]): number => {
    let m = 0;
    for (let i = 0; i < positions.length; i += 3)
      m = Math.max(m, Math.abs(positions[i]!));
    return m;
  };
  const slim = buildHairShell({ ...base, volume: 0 });
  const full = buildHairShell({ ...base, volume: 1 });
  TestValidator.predicate(
    "volume inflates the drape",
    maxX(full.positions) > maxX(slim.positions) + 0.01,
  );
};
