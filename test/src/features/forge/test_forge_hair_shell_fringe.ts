import { buildHairShell } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * The front sector is the fringe and the opening is the curtain: more `bangs`
 * pulls the front strand tips lower over the forehead, and more `curtain`
 * narrows the face opening so a mid-side strand (yaw ≈ 50°) falls with the back
 * instead of stopping at fringe height. The strand grid is column-major (yaw ×
 * rows), so each column's last row is its tip.
 *
 * Scenario: front-column tip lower at bangs 1 than bangs 0; the yaw≈50°
 * column's tip lower at curtain 1 than curtain 0.
 */
export const test_forge_hair_shell_fringe = (): void => {
  const ROWS = 30;
  const tipY = (positions: number[], column: number): number =>
    positions[(column * (ROWS + 1) + ROWS) * 3 + 1]!;
  const FRONT = 32; // yaw 0 of 64 segments
  const SIDE = 41; // yaw ≈ +50°
  const base = { length: 0.6, volume: 0.5 };

  const noBangs = buildHairShell({ ...base, bangs: 0, curtain: 0.5 });
  const fullBangs = buildHairShell({ ...base, bangs: 1, curtain: 0.5 });
  TestValidator.predicate(
    "bangs pull the fringe down",
    tipY(fullBangs.positions, FRONT) < tipY(noBangs.positions, FRONT) - 0.01,
  );

  const open = buildHairShell({ ...base, bangs: 0.5, curtain: 0 });
  const closed = buildHairShell({ ...base, bangs: 0.5, curtain: 1 });
  TestValidator.predicate(
    "curtain closes the side opening",
    tipY(closed.positions, SIDE) < tipY(open.positions, SIDE) - 0.05,
  );
};
