import { growPlanting, plantingStateDigest } from "@automovie/engine";
import { IAutoMoviePruningEnvelope } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, vclose } from "../internal/predicates";
import { plantingRecipe } from "../internal/softFixtures";

/** A vertical trunk of unit length under one pruning envelope. */
const clipped = (pruning: IAutoMoviePruningEnvelope) =>
  growPlanting(plantingRecipe({ pruning }));

/**
 * The pruning envelope cuts the derived structure analytically, and only the
 * children that emerge before the cut survive.
 *
 * Clipping in the renderer would be the cheap answer and the wrong one: a
 * quantity take-off, a collision check and a camera would then be reading three
 * different plants. Cutting the structure means the envelope is a fact about
 * the plant. The cut itself is the exact slab or quadratic root rather than a
 * sampled crossing, so a trained hedge's face does not move when a step count
 * changes.
 *
 * The trunk runs from the origin along `+y` for exactly one metre, so every
 * expectation below is a plain reading of the envelope:
 *
 * ```text
 *   box   : the nearest slab crossing ahead, here y = 0.75
 *   sphere: −b + √(b² − c) with b = o·d = 0 and c = |o|² − r² = −0.5625,
 *           so the root is exactly √0.5625 = 0.75
 * ```
 *
 * Its two children emerge at half height and at the tip, which straddles that
 * cut: the first survives, the second is gone.
 *
 * Scenarios:
 *
 * 1. With no envelope the trunk reaches its full length and nothing is marked
 *    pruned.
 * 2. A box whose ceiling sits at `0.75` cuts the trunk exactly there and marks it
 *    pruned; the child emerging at half height survives and the one emerging at
 *    the tip does not.
 * 3. A sphere of radius `0.75` about the origin produces exactly the same cut
 *    through the quadratic root rather than through a slab, which is what
 *    proves the two envelopes are independent derivations.
 * 4. A branch whose own base already lies outside the envelope is not grown at
 *    all, so an envelope that misses the plant entirely yields nothing and
 *    `null` bounds rather than a stub at the origin.
 * 5. An envelope the whole plant fits inside — of either shape — cuts nothing and
 *    derives exactly the unpruned structure, so the pruned flag is a
 *    measurement and not a property of having declared an envelope.
 * 6. A cut structure digests differently from an uncut one and reproduces its own
 *    digest, so pruning is carried by the derived record rather than by a flag
 *    nobody reads.
 */
export const test_planting_pruning_envelope = (): void => {
  const free = clipped({ kind: "none" });
  TestValidator.equals(
    "an unpruned structure reaches its full length",
    namedFacts([
      ["end", () => vclose(free.branches[0].end, { x: 0, y: 1, z: 0 })],
      ["flag", () => free.branches.every((branch) => branch.pruned === false)],
      ["count", () => free.branches.length === 7],
    ]),
    { end: true, flag: true, count: true },
  );

  const boxed = clipped({
    kind: "box",
    min: { x: -1, y: -1, z: -1 },
    max: { x: 1, y: 0.75, z: 1 },
  });
  TestValidator.equals(
    "a box cuts the trunk at its slab crossing and drops what grows past it",
    namedFacts([
      ["end", () => vclose(boxed.branches[0].end, { x: 0, y: 0.75, z: 0 })],
      ["pruned", () => boxed.branches[0].pruned === true],
      [
        "survivor",
        () => boxed.branches.some((branch) => branch.id === "trunk/a"),
      ],
      [
        "dropped",
        () => boxed.branches.every((branch) => branch.id !== "trunk/b"),
      ],
      [
        "survivorBase",
        () =>
          vclose(
            boxed.branches.filter((branch) => branch.id === "trunk/a")[0].start,
            { x: 0, y: 0.5, z: 0 },
          ),
      ],
    ]),
    {
      end: true,
      pruned: true,
      survivor: true,
      dropped: true,
      survivorBase: true,
    },
  );

  const balled = clipped({
    kind: "sphere",
    center: { x: 0, y: 0, z: 0 },
    radius: 0.75,
  });
  TestValidator.equals(
    "a sphere cuts at the quadratic root, to the same place",
    namedFacts([
      ["end", () => vclose(balled.branches[0].end, { x: 0, y: 0.75, z: 0 })],
      ["pruned", () => balled.branches[0].pruned === true],
      [
        "dropped",
        () => balled.branches.every((branch) => branch.id !== "trunk/b"),
      ],
    ]),
    { end: true, pruned: true, dropped: true },
  );

  const missed = clipped({
    kind: "box",
    min: { x: 4, y: 4, z: 4 },
    max: { x: 5, y: 5, z: 5 },
  });
  const elsewhere = clipped({
    kind: "sphere",
    center: { x: 9, y: 9, z: 9 },
    radius: 1,
  });
  TestValidator.equals(
    "a base outside the envelope grows nothing at all",
    namedFacts([
      ["box", () => missed.branches.length === 0 && missed.bounds === null],
      [
        "sphere",
        () => elsewhere.branches.length === 0 && elsewhere.bounds === null,
      ],
    ]),
    { box: true, sphere: true },
  );

  const roomy = clipped({
    kind: "box",
    min: { x: -4, y: -4, z: -4 },
    max: { x: 4, y: 4, z: 4 },
  });
  const wide = clipped({
    kind: "sphere",
    center: { x: 0, y: 0, z: 0 },
    radius: 10,
  });
  TestValidator.equals(
    "an envelope the plant fits inside cuts nothing",
    namedFacts([
      ["count", () => roomy.branches.length === 7],
      ["flag", () => roomy.branches.every((branch) => branch.pruned === false)],
      ["end", () => vclose(roomy.branches[0].end, { x: 0, y: 1, z: 0 })],
      ["sphereCount", () => wide.branches.length === 7],
      ["sphereFlag", () => wide.branches.every((branch) => !branch.pruned)],
      [
        "sameAsUnpruned",
        () => plantingStateDigest(wide) === plantingStateDigest(free),
      ],
    ]),
    {
      count: true,
      flag: true,
      end: true,
      sphereCount: true,
      sphereFlag: true,
      sameAsUnpruned: true,
    },
  );

  TestValidator.equals(
    "a cut structure digests differently from an uncut one",
    namedFacts([
      [
        "differs",
        () => plantingStateDigest(boxed) !== plantingStateDigest(free),
      ],
      [
        "stable",
        () =>
          plantingStateDigest(
            clipped({
              kind: "box",
              min: { x: -1, y: -1, z: -1 },
              max: { x: 1, y: 0.75, z: 1 },
            }),
          ) === plantingStateDigest(boxed),
      ],
    ]),
    { differs: true, stable: true },
  );
};
