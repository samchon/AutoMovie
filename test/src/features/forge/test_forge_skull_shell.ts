import { buildSkullShell } from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * The default skull is a laterally centered dome that stays behind the face
 * shell: 49×25 grid vertices, near-zero mean x (the ellipsoid is symmetric),
 * and a front surface well behind the canonical nose tip (z 0.075) so the two
 * never z-fight.
 *
 * Scenario: default build — vertex count (SEG+1)·(RING+1), |mean x| < 1e-6, max
 * z < 0.05.
 */
export const test_forge_skull_shell = (): void => {
  const skull = buildSkullShell();
  TestValidator.equals("grid vertices", skull.positions.length, 49 * 25 * 3);
  let meanX = 0;
  let maxZ = -Infinity;
  for (let i = 0; i < skull.positions.length; i += 3) {
    meanX += skull.positions[i]! / (skull.positions.length / 3);
    maxZ = Math.max(maxZ, skull.positions[i + 2]!);
  }
  TestValidator.predicate("laterally centered", Math.abs(meanX) < 1e-6);
  TestValidator.predicate("stays behind the face shell", maxZ < 0.05);
};
