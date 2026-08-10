import { growPlanting } from "@automovie/engine";
import { IAutoMoviePlantingFoliage } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, qunit, vclose } from "../internal/predicates";
import { plantingRecipe } from "../internal/softFixtures";

/** The same recipe wearing one foliage rule. */
const leafed = (
  foliage: IAutoMoviePlantingFoliage | null,
  axis = { x: 0, y: 1, z: 0 },
) =>
  growPlanting(
    plantingRecipe({
      structure: { ...plantingRecipe().structure, axis },
      foliage,
    }),
  );

const PLAIN: IAutoMoviePlantingFoliage = {
  density: 4,
  minLevel: 1,
  size: { x: 0.05, y: 0.1, z: 0.05 },
  scaleJitter: 0,
  rollJitter: 0,
};

/**
 * Leaves are emitted as lossless full-TRS instance occurrences placed by a
 * density rule, not as a mesh the derivation bakes.
 *
 * The full transform is the point. GPU instancing consumes translation, a unit
 * quaternion and a per-axis scale, and anything the derivation reduced on the
 * way out — a yaw, one uniform number — would be a fact about the plant nobody
 * authored and nothing could recover.
 *
 * Every figure is hand-computable. A branch of length `L` bears `⌊density·L⌋`
 * leaves at parameters `(k + ½)/n` along it, so the first-order branch of
 * length `0.5` under `density = 4` bears two, the first at `0.25` of its
 * length: `(0, 0.5, 0) + (1, 1, 0)/√2 · 0.125`. The blade's own `+y` is carried
 * onto the branch axis by the shortest arc, which off a `45°` branch is exactly
 * the quaternion `(0, 0, −sin 22.5°, cos 22.5°)`.
 *
 * Scenarios:
 *
 * 1. A recipe with no foliage rule bears no leaves at all, and one with a rule
 *    bears exactly `⌊density·length⌋` per bearing branch.
 * 2. `minLevel` gates which branches bear: the trunk is bare while its children
 *    are not, and lowering the gate puts leaves on the trunk.
 * 3. The first leaf sits at its hand-computed position, carries the exact
 *    shortest-arc rotation onto its branch, and is scaled by the authored
 *    per-axis prototype size with the three axes distinct.
 * 4. Every emitted rotation is a unit quaternion, and every leaf names the branch
 *    that bears it.
 * 5. A trunk pointing exactly opposite the blade's own `+y` is the degenerate case
 *    where every perpendicular axis is a shortest arc; the derivation states
 *    its choice — a half turn about `+x` — instead of normalizing a zero.
 * 6. Seeded scale and roll actually vary the blades, and stay inside the declared
 *    jitter.
 */
export const test_planting_foliage = (): void => {
  const bare = leafed(null);
  const plain = leafed(PLAIN);
  TestValidator.equals(
    "a density rule bears exactly the floor of density times length",
    namedFacts([
      ["bare", () => bare.leaves.length === 0],
      ["total", () => plain.leaves.length === 8],
      [
        "firstOrder",
        () =>
          plain.leaves.filter((leaf) => leaf.branch === "trunk/a").length === 2,
      ],
      [
        "secondOrder",
        () =>
          plain.leaves.filter((leaf) => leaf.branch === "trunk/a/a").length ===
          1,
      ],
    ]),
    { bare: true, total: true, firstOrder: true, secondOrder: true },
  );

  const lowered = leafed({ ...PLAIN, minLevel: 0 });
  TestValidator.equals(
    "minLevel gates which branches bear",
    namedFacts([
      [
        "trunkBare",
        () => plain.leaves.every((leaf) => leaf.branch !== "trunk"),
      ],
      [
        "trunkBears",
        () =>
          lowered.leaves.filter((leaf) => leaf.branch === "trunk").length === 4,
      ],
    ]),
    { trunkBare: true, trunkBears: true },
  );

  const first = plain.leaves[0];
  const step = 0.125 / Math.SQRT2;
  const halfTurn = Math.sqrt((1 - Math.SQRT1_2) / 2);
  TestValidator.equals(
    "a leaf carries a lossless full transform onto its branch",
    namedFacts([
      ["branch", () => first.branch === "trunk/a"],
      ["id", () => first.id === "trunk/a:leaf#0"],
      [
        "translation",
        () => vclose(first.translation, { x: step, y: 0.5 + step, z: 0 }),
      ],
      ["rotationX", () => nclose(first.rotation.x, 0)],
      ["rotationY", () => nclose(first.rotation.y, 0)],
      ["rotationZ", () => nclose(first.rotation.z, -halfTurn)],
      [
        "rotationW",
        () => nclose(first.rotation.w, Math.sqrt((1 + Math.SQRT1_2) / 2)),
      ],
      ["scale", () => vclose(first.scale, { x: 0.05, y: 0.1, z: 0.05 })],
      [
        "perAxis",
        () =>
          first.scale.x !== first.scale.y && first.scale.z !== first.scale.y,
      ],
    ]),
    {
      branch: true,
      id: true,
      translation: true,
      rotationX: true,
      rotationY: true,
      rotationZ: true,
      rotationW: true,
      scale: true,
      perAxis: true,
    },
  );

  TestValidator.equals(
    "every emitted rotation is a unit quaternion",
    namedFacts([
      ["plain", () => plain.leaves.every((leaf) => qunit(leaf.rotation))],
      [
        "named",
        () =>
          plain.leaves.every((leaf) =>
            plain.branches.some((branch) => branch.id === leaf.branch),
          ),
      ],
    ]),
    { plain: true, named: true },
  );

  const inverted = leafed({ ...PLAIN, minLevel: 0 }, { x: 0, y: -1, z: 0 });
  const trunkLeaf = inverted.leaves.filter(
    (leaf) => leaf.branch === "trunk",
  )[0];
  TestValidator.equals(
    "an exactly antiparallel branch takes the stated half turn",
    namedFacts([
      [
        "rotation",
        () =>
          vclose(
            {
              x: trunkLeaf.rotation.x,
              y: trunkLeaf.rotation.y,
              z: trunkLeaf.rotation.z,
            },
            { x: 1, y: 0, z: 0 },
          ),
      ],
      ["w", () => Object.is(trunkLeaf.rotation.w, 0)],
      ["unit", () => qunit(trunkLeaf.rotation)],
    ]),
    { rotation: true, w: true, unit: true },
  );

  const varied = leafed({ ...PLAIN, scaleJitter: 0.5, rollJitter: 1 });
  TestValidator.equals(
    "seeded scale and roll vary the blades inside their declared jitter",
    namedFacts([
      [
        "scaleVaries",
        () => new Set(varied.leaves.map((leaf) => leaf.scale.y)).size > 1,
      ],
      [
        "scaleBounded",
        () =>
          varied.leaves.every(
            (leaf) => leaf.scale.y >= 0.05 && leaf.scale.y <= 0.15,
          ),
      ],
      [
        "rollVaries",
        () => new Set(varied.leaves.map((leaf) => leaf.rotation.w)).size > 1,
      ],
      ["unit", () => varied.leaves.every((leaf) => qunit(leaf.rotation))],
    ]),
    {
      scaleVaries: true,
      scaleBounded: true,
      rollVaries: true,
      unit: true,
    },
  );
};
