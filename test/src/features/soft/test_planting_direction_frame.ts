import { growPlanting } from "@automovie/engine";
import { IAutoMoviePlantingDomain } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, vclose } from "../internal/predicates";
import { plantingRecipe } from "../internal/softFixtures";

/** A two-level recipe with a single child, so one branch answers for the law. */
const oriented = (props: {
  axis?: { x: number; y: number; z: number };
  direction?: { x: number; y: number; z: number };
  gravitropism?: number;
  directionJitter?: number;
}): IAutoMoviePlantingDomain =>
  plantingRecipe({
    structure: {
      ...plantingRecipe().structure,
      levels: 2,
      axis: props.axis ?? { x: 0, y: 1, z: 0 },
      children: [
        {
          id: "a",
          direction: props.direction ?? { x: 1, y: 0, z: 0 },
          offset: 0.5,
        },
      ],
      gravitropism: props.gravitropism ?? 0,
      directionJitter: props.directionJitter ?? 0,
    },
    budget: { maxBranches: 8, maxLeaves: 0 },
  });

/** The world direction the single child grew along. */
const childAxis = (domain: IAutoMoviePlantingDomain) => {
  const child = growPlanting(domain).branches[1];
  const length = Math.sqrt(
    (child.end.x - child.start.x) ** 2 +
      (child.end.y - child.start.y) ** 2 +
      (child.end.z - child.start.z) ** 2,
  );
  return {
    x: (child.end.x - child.start.x) / length,
    y: (child.end.y - child.start.y) / length,
    z: (child.end.z - child.start.z) / length,
  };
};

/**
 * A child's authored direction means the same thing wherever its parent points,
 * and the vertical bias and the seeded spread are applied to it in a stated
 * order.
 *
 * The frame is the deterministic perpendicular pair of Duff et al. (2017) about
 * the parent's axis, with the child's `+y` running along that axis. The sign
 * trick in that construction is what keeps `sign + axis.z` away from zero for
 * every unit axis, so a trunk pointing along `−z` needs no special case and a
 * plant is not quietly different depending on which way it was planted.
 *
 * Gravitropism then blends the world direction toward vertical and the seeded
 * spread perturbs it, each renormalized. Both are stated as vector operations
 * rather than as angles, which is what keeps the whole derivation free of
 * trigonometry and therefore bit-reproducible.
 *
 * Scenarios:
 *
 * 1. Off a vertical trunk the authored `(1, 0, 0)` is exactly world `+x`, and `(1,
 *    1, 0)` is exactly `(1, 1, 0)/√2`: the frame is the identity in the
 *    ordinary case rather than an arbitrary rotation of it.
 * 2. Off a trunk pointing along `−z` — the branch of the frame construction the
 *    vertical case never reaches — the same authored direction lands at its
 *    hand-computed world position.
 * 3. Full positive gravitropism drives every child to exactly `(0, −1, 0)`, and
 *    full negative to exactly `(0, 1, 0)`, whatever was authored.
 * 4. A half bias that exactly cancels the authored direction is the degenerate
 *    case: the blend has no length, so the child falls back to its parent's own
 *    axis rather than to a division by zero.
 * 5. Seeded spread moves the direction off the authored one and stays
 *    deterministic, while zero spread leaves it exactly where it was.
 */
export const test_planting_direction_frame = (): void => {
  TestValidator.equals(
    "an authored direction is read in the parent's own frame",
    namedFacts([
      ["axial", () => vclose(childAxis(oriented({})), { x: 1, y: 0, z: 0 })],
      [
        "diagonal",
        () =>
          vclose(childAxis(oriented({ direction: { x: 1, y: 1, z: 0 } })), {
            x: Math.SQRT1_2,
            y: Math.SQRT1_2,
            z: 0,
          }),
      ],
    ]),
    { axial: true, diagonal: true },
  );

  const lying = growPlanting(oriented({ axis: { x: 0, y: 0, z: -1 } }));
  TestValidator.equals(
    "a trunk along −z takes the other branch of the frame construction",
    namedFacts([
      ["trunk", () => vclose(lying.branches[0].end, { x: 0, y: 0, z: -1 })],
      [
        "childBase",
        () => vclose(lying.branches[1].start, { x: 0, y: 0, z: -0.5 }),
      ],
      [
        "childTip",
        () => vclose(lying.branches[1].end, { x: 0.5, y: 0, z: -0.5 }),
      ],
    ]),
    { trunk: true, childBase: true, childTip: true },
  );

  TestValidator.equals(
    "a full vertical bias overrides whatever was authored",
    namedFacts([
      [
        "droop",
        () =>
          vclose(childAxis(oriented({ gravitropism: 1 })), {
            x: 0,
            y: -1,
            z: 0,
          }),
      ],
      [
        "lift",
        () =>
          vclose(childAxis(oriented({ gravitropism: -1 })), {
            x: 0,
            y: 1,
            z: 0,
          }),
      ],
    ]),
    { droop: true, lift: true },
  );

  TestValidator.equals(
    "an exactly cancelling bias falls back to the parent's axis",
    vclose(
      childAxis(
        oriented({ direction: { x: 0, y: 1, z: 0 }, gravitropism: 0.5 }),
      ),
      { x: 0, y: 1, z: 0 },
    ),
    true,
  );

  const spread = oriented({ directionJitter: 0.5 });
  TestValidator.equals(
    "seeded spread moves the direction and stays deterministic",
    namedFacts([
      [
        "moved",
        () => vclose(childAxis(spread), { x: 1, y: 0, z: 0 }, 1e-3) === false,
      ],
      [
        "stable",
        () => {
          const first = childAxis(spread);
          const second = childAxis(oriented({ directionJitter: 0.5 }));
          return (
            Object.is(first.x, second.x) &&
            Object.is(first.y, second.y) &&
            Object.is(first.z, second.z)
          );
        },
      ],
      ["unspread", () => vclose(childAxis(oriented({})), { x: 1, y: 0, z: 0 })],
    ]),
    { moved: true, stable: true, unspread: true },
  );
};
