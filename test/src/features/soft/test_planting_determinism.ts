import { growPlanting, plantingStateDigest } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import { plantingRecipe } from "../internal/softFixtures";

/** A jittered recipe, where every seeded decision is live. */
const jittered = (seed: number) =>
  plantingRecipe({
    seed,
    structure: {
      ...plantingRecipe().structure,
      directionJitter: 0.5,
      lengthJitter: 0.5,
      gravitropism: 0.25,
    },
    foliage: {
      density: 6,
      minLevel: 0,
      size: { x: 0.05, y: 0.125, z: 0.05 },
      scaleJitter: 0.5,
      rollJitter: 1,
    },
  });

/**
 * A derived plant is a pure function of its recipe, and its seed is the only
 * thing that varies it.
 *
 * Determinism here is not incidental: a seeded value is drawn from the recipe
 * seed folded with the **path** of child indices that produced the branch,
 * never from a sequential stream, so a branch's jitter does not depend on how
 * many branches happened to be emitted before it. That is what lets a plant be
 * re-derived in a later render chunk, on another machine, and be the same
 * plant.
 *
 * Nothing transcendental is evaluated on the way: directions are authored as
 * vectors, rotations are built from the rational parameterization of the
 * circle, and only operations IEEE-754 specifies exactly ever touch a
 * coordinate.
 *
 * Scenarios:
 *
 * 1. Two derivations of the same jittered recipe are bit-identical, coordinate by
 *    coordinate and quaternion by quaternion, and so are their digests.
 * 2. A different seed is a different plant, so the digest is measuring the seeded
 *    content and not a constant.
 * 3. A recipe rebuilt from scratch — a different object with the same values —
 *    digests identically, so nothing is keyed on object identity.
 * 4. Removing the jitter removes the variation: every first-order branch of an
 *    unjittered recipe has exactly the authored length, while the jittered one
 *    spreads them.
 * 5. The declared caps are enforced rather than decorative: a branch cap below
 *    what the law grows, and a leaf cap below what the foliage bears, each
 *    throw with the recipe named. The leaf cap is reached while blades are
 *    emitted rather than after the structure is complete, so a density of a
 *    trillion leaves per metre is refused at the sixteenth blade instead of
 *    exhausting the machine on the way to a cap that was going to refuse it.
 */
export const test_planting_determinism = (): void => {
  const once = growPlanting(jittered(20_260_810));
  const twice = growPlanting(jittered(20_260_810));
  TestValidator.equals(
    "the same recipe derives the same plant, bit for bit",
    namedFacts([
      ["branchCount", () => once.branches.length === twice.branches.length],
      ["leafCount", () => once.leaves.length === twice.leaves.length],
      [
        "branches",
        () =>
          once.branches.every((branch, index) =>
            (["x", "y", "z"] as const).every(
              (axis) =>
                Object.is(branch.end[axis], twice.branches[index].end[axis]) &&
                Object.is(
                  branch.start[axis],
                  twice.branches[index].start[axis],
                ),
            ),
          ),
      ],
      [
        "leaves",
        () =>
          once.leaves.every((leaf, index) =>
            (["x", "y", "z", "w"] as const).every((axis) =>
              Object.is(
                leaf.rotation[axis],
                twice.leaves[index].rotation[axis],
              ),
            ),
          ),
      ],
      [
        "scales",
        () =>
          once.leaves.every((leaf, index) =>
            (["x", "y", "z"] as const).every((axis) =>
              Object.is(leaf.scale[axis], twice.leaves[index].scale[axis]),
            ),
          ),
      ],
      [
        "digest",
        () => plantingStateDigest(once) === plantingStateDigest(twice),
      ],
    ]),
    {
      branchCount: true,
      leafCount: true,
      branches: true,
      leaves: true,
      scales: true,
      digest: true,
    },
  );

  TestValidator.equals(
    "the seed is what varies the plant",
    namedFacts([
      [
        "differs",
        () =>
          plantingStateDigest(growPlanting(jittered(7))) !==
          plantingStateDigest(once),
      ],
      [
        "rebuilt",
        () =>
          plantingStateDigest(
            growPlanting(JSON.parse(JSON.stringify(jittered(20_260_810)))),
          ) === plantingStateDigest(once),
      ],
    ]),
    { differs: true, rebuilt: true },
  );

  const plain = growPlanting(plantingRecipe());
  const lengths = (state: typeof plain, level: number): number[] =>
    state.branches
      .filter((branch) => branch.level === level)
      .map((branch) =>
        Math.sqrt(
          (branch.end.x - branch.start.x) ** 2 +
            (branch.end.y - branch.start.y) ** 2 +
            (branch.end.z - branch.start.z) ** 2,
        ),
      );
  TestValidator.equals(
    "jitter is what spreads the branch lengths",
    namedFacts([
      [
        "uniform",
        () =>
          new Set(lengths(plain, 1).map((value) => value.toFixed(12))).size ===
          1,
      ],
      [
        "spread",
        () =>
          new Set(lengths(once, 1).map((value) => value.toFixed(12))).size > 1,
      ],
    ]),
    { uniform: true, spread: true },
  );

  TestValidator.equals(
    "the declared caps are enforced",
    namedFacts([
      [
        "branches",
        () =>
          throwsError(
            () =>
              growPlanting(
                plantingRecipe({ budget: { maxBranches: 3, maxLeaves: 512 } }),
              ),
            ['planting "fern" exceeded its declared cap of 3 branches'],
          ),
      ],
      [
        "leaves",
        () =>
          throwsError(
            () =>
              growPlanting(
                plantingRecipe({
                  foliage: {
                    density: 4,
                    minLevel: 1,
                    size: { x: 0.05, y: 0.1, z: 0.05 },
                    scaleJitter: 0,
                    rollJitter: 0,
                  },
                  budget: { maxBranches: 64, maxLeaves: 2 },
                }),
              ),
            ['planting "fern" exceeded its declared cap of 2 leaves'],
          ),
      ],
      [
        "leafCapIsReachedBeforeTheMachineIs",
        () =>
          throwsError(
            () =>
              growPlanting(
                plantingRecipe({
                  foliage: {
                    density: 1e12,
                    minLevel: 0,
                    size: { x: 0.05, y: 0.1, z: 0.05 },
                    scaleJitter: 0,
                    rollJitter: 0,
                  },
                  budget: { maxBranches: 64, maxLeaves: 16 },
                }),
              ),
            ['planting "fern" exceeded its declared cap of 16 leaves'],
          ),
      ],
    ]),
    {
      branches: true,
      leaves: true,
      leafCapIsReachedBeforeTheMachineIs: true,
    },
  );
};
