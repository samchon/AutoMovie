import {
  builtEnvironmentPlacementOverlapSweep,
  builtEnvironmentSupportSweep,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieModel,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeProp, primitivePart } from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";

/**
 * A whole building answers what floats and what intersects, without being asked
 * one pair at a time.
 *
 * `#building-structural-support` asks for two capabilities in one sentence:
 * express what supports what, and find the floating or disconnected elements.
 * `builtEnvironmentSupportStatus` delivered the first and cannot deliver the
 * second, because it judges a relation the author already named. A building with
 * 3,474 placings has no author who can name them all, and `#1902`'s oriel window
 * hung in the air through round after round of exactly that kind of review.
 *
 * The support sweep therefore claims no relation. It reports the nearest
 * measurable body under each one and the clearance to it, so "nothing is under
 * this" and "the nearest thing is a metre down" are both readable, and neither is
 * a guess about which body is the support.
 *
 * Scenarios:
 *
 * 1. The fixture is a legal building, so every measurement below is about a
 *    record the engine accepts rather than about one it would refuse.
 * 2. The support sweep separates ground-borne, body-borne, floating, and
 *    unresolved bodies, and reports each floating body's nearest neighbour below
 *    with the clearance to it.
 * 3. A body the record locates but carries no vertices for is judged as the point
 *    it states, and reports that basis with its answer. It is neither dropped nor
 *    silently promoted to a volume: standing on a slab top it is borne, standing
 *    over nothing it is floating, and `element-origin-point` is how the caller
 *    reads either as a claim about a point.
 * 4. The overlap sweep reports interpenetration and not contact: a column with a
 *    box driven through it is one pair, and a box meeting another exactly on a
 *    face is none.
 * 5. Both sweeps prune and both say what they cost. Over a field of a thousand
 *    bodies each performs a small multiple of the population rather than a
 *    multiple of its square, which is the difference between a check somebody
 *    runs every round and one they run once.
 */
export const test_architecture_built_environment_sweep = (): void => {
  const record = environment();
  TestValidator.equals(
    "the sweep fixture is a legal building",
    validateBuiltEnvironment({ environment: record }).success,
    true,
  );

  const support = builtEnvironmentSupportSweep({ environment: record });
  TestValidator.equals(
    "the support sweep separates ground, bearing, air, and unmeasurable",
    {
      measured: support.measured,
      grounded: support.grounded,
      borne: support.borne,
      floating: support.floating.map((entry) => ({
        id: entry.body.id,
        basis: entry.basis,
        below: entry.below?.body.id ?? null,
        clearance: entry.below?.clearance ?? null,
      })),
      unresolved: support.unresolved.map((body) => body.id),
    },
    {
      measured: 9,
      grounded: 1,
      borne: 5,
      floating: [
        {
          id: "lamp",
          basis: "element-geometry-bounds",
          below: "beam",
          clearance: 1,
        },
        {
          id: "orphan",
          basis: "element-geometry-bounds",
          below: null,
          clearance: null,
        },
        {
          id: "external-air",
          basis: "element-origin-point",
          below: null,
          clearance: null,
        },
      ],
      unresolved: ["root"],
    },
  );

  TestValidator.equals(
    "the support sweep reads a handful of candidates per body, not the record",
    support.compared > 0 && support.compared < support.measured * 4,
    true,
  );

  const overlap = builtEnvironmentPlacementOverlapSweep({
    environment: record,
  });
  TestValidator.equals(
    "the overlap sweep reports intrusion, grades it, and prunes",
    namedFacts([
      [
        "one intruding pair",
        () =>
          overlap.pairs.length === 1 &&
          overlap.pairs[0]!.left.id === "column" &&
          overlap.pairs[0]!.right.id === "intruder",
      ],
      [
        "graded by the smaller body's share",
        () =>
          Math.abs(overlap.pairs[0]!.volume - 1.2) < 1e-9 &&
          Math.abs(overlap.pairs[0]!.fraction - 0.6) < 1e-9,
      ],
      ["the same population is measured", () => overlap.measured === 9],
      [
        "fewer comparisons than every pair",
        () => overlap.compared > 0 && overlap.compared < (9 * 8) / 2,
      ],
    ]),
    {
      "one intruding pair": true,
      "graded by the smaller body's share": true,
      "the same population is measured": true,
      "fewer comparisons than every pair": true,
    },
  );

  inspectSweepScale();
};

/**
 * What both sweeps cost over a field nobody could check by naming pairs.
 *
 * A thousand bodies is a quarter of the placings one measured production carried,
 * and the naive form of either sweep is half a million pair tests over it. The
 * numbers asserted here are the pruning, so a change that quietly restores the
 * quadratic pass fails this case rather than a benchmark months later.
 *
 * The field is laid out as a grid of separated boxes on the ground: every body is
 * grounded, no pair intersects, and both answers are therefore known in advance.
 * That is what makes the cost the only thing under test.
 */
const inspectSweepScale = (): void => {
  const size = 32;
  const record = field(size);
  const bodies = size * size;
  const naive = (bodies * (bodies - 1)) / 2;
  const support = builtEnvironmentSupportSweep({ environment: record });
  const overlap = builtEnvironmentPlacementOverlapSweep({
    environment: record,
  });
  TestValidator.equals(
    "a field of a thousand bodies is swept without a quadratic pass",
    namedFacts([
      [
        "every body is measured",
        () => support.measured === bodies && overlap.measured === bodies,
      ],
      [
        "the field is clean",
        () =>
          support.floating.length === 0 &&
          support.grounded === bodies &&
          overlap.pairs.length === 0,
      ],
      [
        "the support sweep stays linear in the population",
        () => support.compared < bodies * 4,
      ],
      [
        "the overlap sweep stays far under every pair",
        () => overlap.compared > 0 && overlap.compared < naive / 10,
      ],
    ]),
    {
      "every body is measured": true,
      "the field is clean": true,
      "the support sweep stays linear in the population": true,
      "the overlap sweep stays far under every pair": true,
    },
  );
};

/** One flat grid of separated ground-borne boxes, `size` by `size`. */
const field = (size: number): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "sweep-field",
  units: "meter",
  buildings: [{ id: "field", element: "root", space: "whole" }],
  models: [boxModel("cube-model", 1, 1, 1)],
  modelReferences: [],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: place(0, 0, 0),
      model: null,
      space: "whole",
    },
    ...Array.from({ length: size * size }, (_unused, index) => ({
      id: `cube-${index}`,
      kind: "equipment" as const,
      parent: "root",
      transform: place((index % size) * 2, 0.5, Math.floor(index / size) * 2),
      model: "cube-model",
      space: "whole",
    })),
  ],
  spaces: [{ id: "whole", kind: "building", parent: null, cells: [] }],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});

const place = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const boxModel = (
  id: string,
  width: number,
  height: number,
  depth: number,
): IAutoMovieModel => ({
  ...makeProp([
    primitivePart(`${id}-box`, { type: "box", width, height, depth }),
  ]),
  id,
});

/**
 * One small building whose every body is placed for one of the answers.
 *
 * A slab on the ground, a column bearing on the slab, a beam bearing on the
 * column, a lamp a metre above the beam, an orphan standing over nothing, a box
 * driven through the column, and a box meeting the column exactly on a face. The
 * transform-only root states no place at all and resolves to nothing; the two
 * runtime model references state a place and carry no vertices, one of them on the
 * slab top and one of them in mid-air.
 */
const environment = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "sweep-house",
  units: "meter",
  buildings: [{ id: "house", element: "root", space: "whole" }],
  models: [
    boxModel("slab-model", 4, 1, 4),
    boxModel("column-model", 1, 2, 1),
    boxModel("beam-model", 4, 0.5, 1),
    boxModel("cube-model", 1, 1, 1),
  ],
  modelReferences: ["external-model"],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: place(0, 0, 0),
      model: null,
      space: "whole",
    },
    {
      id: "slab",
      kind: "slab",
      parent: "root",
      transform: place(0, 0.5, 0),
      model: "slab-model",
      space: "whole",
    },
    {
      id: "column",
      kind: "structure",
      parent: "root",
      transform: place(0, 2, 0),
      model: "column-model",
      space: "whole",
    },
    {
      id: "beam",
      kind: "structure",
      parent: "root",
      transform: place(0, 3.25, 0),
      model: "beam-model",
      space: "whole",
    },
    {
      id: "lamp",
      kind: "equipment",
      parent: "root",
      transform: place(0, 5, 0),
      model: "cube-model",
      space: "whole",
    },
    {
      id: "orphan",
      kind: "equipment",
      parent: "root",
      transform: place(10, 5, 10),
      model: "cube-model",
      space: "whole",
    },
    {
      id: "intruder",
      kind: "equipment",
      parent: "root",
      transform: place(0.4, 2, 0),
      model: "column-model",
      space: "whole",
    },
    {
      // On the far side from the intruder, so the one box that merely touches the
      // column touches nothing else either.
      id: "touching",
      kind: "equipment",
      parent: "root",
      transform: place(-1, 1.5, 0),
      model: "cube-model",
      space: "whole",
    },
    {
      id: "external",
      kind: "external-fixture",
      parent: "root",
      transform: place(0, 1, 0),
      model: "external-model",
      space: "whole",
    },
    {
      id: "external-air",
      kind: "external-fixture",
      parent: "root",
      transform: place(10, 5, -10),
      model: "external-model",
      space: "whole",
    },
  ],
  spaces: [{ id: "whole", kind: "building", parent: null, cells: [] }],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});
