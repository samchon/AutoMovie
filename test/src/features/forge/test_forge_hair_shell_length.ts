import { buildHairShell } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * `length` rules the back fall: a longer style must reach strictly lower than a
 * cropped one, and a wider skull (explicit skull parameters) must widen the
 * drape with it ??the hair always drapes over the skull it is given.
 *
 * Scenario: min y at length 1 < min y at length 0; max |x| grows with skull
 * width +1 at equal hair parameters.
 */
export const test_forge_hair_shell_length = (): void => {
  const base = { length: 0, volume: 0.5, bangs: 0.5, curtain: 0.5 };
  const minY = (positions: number[]): number => {
    let m = Infinity;
    for (let i = 1; i < positions.length; i += 3)
      m = Math.min(m, positions[i]!);
    return m;
  };
  const maxX = (positions: number[]): number => {
    let m = 0;
    for (let i = 0; i < positions.length; i += 3)
      m = Math.max(m, Math.abs(positions[i]!));
    return m;
  };
  const cropped = buildHairShell(base);
  const long = buildHairShell({ ...base, length: 1 });
  TestValidator.predicate(
    "longer hair reaches lower",
    minY(long.positions) < minY(cropped.positions) - 0.2,
  );
  const wide = buildHairShell(base, { width: 1, crown: 0, depth: 0 });
  TestValidator.predicate(
    "hair follows a wider skull",
    maxX(wide.positions) > maxX(cropped.positions) + 0.005,
  );
};
