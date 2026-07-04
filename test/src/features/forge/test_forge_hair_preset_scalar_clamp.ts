import {
  IForgeMeshPart,
  buildBust,
  buildHairBun,
  buildHairShell,
  buildHairTails,
  buildSkullShell,
} from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

const assertFinitePart = (label: string, part: IForgeMeshPart): void => {
  TestValidator.predicate(
    `${label} has finite positions`,
    part.positions.every((v) => Number.isFinite(v)),
  );
  TestValidator.predicate(
    `${label} has finite indices`,
    part.indices.every((v) => Number.isFinite(v)),
  );
};

const assertNonEmptyFinitePart = (
  label: string,
  part: IForgeMeshPart,
): void => {
  TestValidator.predicate(`${label} has vertices`, part.positions.length > 0);
  assertFinitePart(label, part);
};

/**
 * Forge preset controls are documented as bounded numbers. Direct public calls
 * still need deterministic behavior when imported preset data contains `NaN` or
 * values outside those bounds: invalid scalars must not leak into geometry.
 *
 * Scenario: hostile hair/head preset scalars still produce finite meshes, while
 * non-finite empty-style sizes/lengths resolve to empty optional parts.
 */
export const test_forge_hair_preset_scalar_clamp = (): void => {
  const skull = { width: Infinity, crown: -2, depth: Number.NaN };

  assertNonEmptyFinitePart(
    "hair shell",
    buildHairShell(
      {
        length: 2,
        volume: -1,
        bangs: Number.NaN,
        curtain: Infinity,
        updo: -Infinity,
      },
      skull,
    ),
  );
  assertNonEmptyFinitePart(
    "hair bun",
    buildHairBun({ size: 2, height: Infinity }, skull),
  );
  assertNonEmptyFinitePart(
    "skull shell",
    buildSkullShell({ width: Infinity, crown: -Infinity, depth: Number.NaN }),
  );
  assertNonEmptyFinitePart(
    "bust",
    buildBust({ neck: Number.NaN, shoulders: 2 }),
  );

  const tails = buildHairTails(
    {
      length: 2,
      height: Number.NaN,
      spread: Infinity,
      width: -1,
    },
    skull,
  );
  assertNonEmptyFinitePart("right tail", tails.right);
  assertNonEmptyFinitePart("left tail", tails.left);

  const noBun = buildHairBun({ size: Number.NaN, height: 0.5 });
  TestValidator.equals("nan bun size is empty", noBun.positions.length, 0);
  TestValidator.equals(
    "nan bun size has no triangles",
    noBun.indices.length,
    0,
  );

  const noTails = buildHairTails({
    length: Number.NaN,
    height: 0.5,
    spread: 0.5,
    width: 0.5,
  });
  TestValidator.equals(
    "nan tail length empties right tail",
    noTails.right.positions.length,
    0,
  );
  TestValidator.equals(
    "nan tail length empties left tail",
    noTails.left.positions.length,
    0,
  );
};
