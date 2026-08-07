import { formationSlot } from "@automovie/engine";
import { IAutoMovieFormationDesign } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

const RANKS = 4;
const FILES = 25;
const COUNT = RANKS * FILES;

const line = (props: {
  seed: number;
  dressing?: { lateral: number; depth: number };
}): IAutoMovieFormationDesign => ({
  id: "probe-line",
  modelRecipe: "probe-model",
  count: COUNT,
  layout: {
    kind: "line",
    ranks: RANKS,
    files: FILES,
    spacing: { lateral: 0.7, depth: 1.2 },
    ...(props.dressing === undefined ? {} : { dressing: props.dressing }),
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: props.seed,
  capabilities: [],
  heroOverrides: [],
});

const positions = (
  formation: IAutoMovieFormationDesign,
): { x: number; z: number }[] =>
  Array.from({ length: COUNT }, (_unused, slot) => {
    const placed = formationSlot(formation, slot).position;
    return { x: placed.x, z: placed.z };
  });

const same = (
  left: { x: number; z: number }[],
  right: { x: number; z: number }[],
): boolean =>
  left.length === right.length &&
  left.every(
    (point, index) =>
      nclose(point.x, right[index]!.x, 1e-12) &&
      nclose(point.z, right[index]!.z, 1e-12),
  );

/**
 * A formed layout can be dressed to a tolerance, and that tolerance reproduces.
 *
 * Placing every member on exact geometry makes a unit read as one figure
 * repeated on a grid. Real formed troops hold a line to a tolerance, and the
 * width of that tolerance is what a battle film is often about, so it has to be
 * a declared property rather than an assumption.
 *
 * Determinism is the whole point of deriving it from the seed and the slot
 * index instead of from randomness: nothing is stored per member, and the same
 * design must produce the same army on every machine and every run.
 *
 * The oracle is the layout arithmetic, not the engine's output: exact slots sit
 * on multiples of `spacing`, so a deviation is detectable as a departure from
 * that lattice, and it is bounded by the declared tolerance by construction.
 *
 * Scenarios:
 *
 * 1. A layout with no dressing places every member on exact lattice geometry,
 *    which is the negative twin: the axis must be inert when unused.
 * 2. Both tolerances at zero reproduce those exact positions, so declaring the
 *    axis without asking for deviation changes nothing.
 * 3. A non-zero tolerance moves members off the lattice, and every deviation stays
 *    inside the declared bound on both axes.
 * 4. The same seed reproduces the same army exactly; a different seed produces a
 *    different one. Reproducibility is the property, not merely variation.
 * 5. A tolerance on one axis alone leaves the other axis exact, so the two bounds
 *    are independent rather than one shared jitter.
 */
export const test_world_formation_dressing = (): void => {
  const exact = positions(line({ seed: 7 }));
  const lattice = Array.from({ length: COUNT }, (_unused, slot) => ({
    x: ((slot % FILES) - (FILES - 1) / 2) * 0.7,
    z: Math.floor(slot / FILES) * 1.2,
  }));
  TestValidator.predicate(
    "an undressed layout sits on exact lattice geometry",
    same(exact, lattice),
  );
  TestValidator.predicate(
    "a zero tolerance reproduces those exact positions",
    same(
      positions(line({ seed: 7, dressing: { lateral: 0, depth: 0 } })),
      exact,
    ),
  );

  const dressed = positions(
    line({ seed: 7, dressing: { lateral: 0.25, depth: 0.4 } }),
  );
  TestValidator.equals(
    "a declared tolerance moves members off the lattice and stays inside it",
    namedFacts([
      ["leavesTheLattice", () => same(dressed, exact) === false],
      [
        "everyMemberMoved",
        () =>
          dressed.every(
            (point, index) =>
              nclose(point.x, exact[index]!.x, 1e-12) === false ||
              nclose(point.z, exact[index]!.z, 1e-12) === false,
          ),
      ],
      [
        "withinLateralBound",
        () =>
          dressed.every(
            (point, index) => Math.abs(point.x - exact[index]!.x) <= 0.25,
          ),
      ],
      [
        "withinDepthBound",
        () =>
          dressed.every(
            (point, index) => Math.abs(point.z - exact[index]!.z) <= 0.4,
          ),
      ],
    ]),
    {
      leavesTheLattice: true,
      everyMemberMoved: true,
      withinLateralBound: true,
      withinDepthBound: true,
    },
  );

  TestValidator.equals(
    "the same seed reproduces the same army and a different seed does not",
    namedFacts([
      [
        "sameSeedReproduces",
        () =>
          same(
            positions(
              line({ seed: 7, dressing: { lateral: 0.25, depth: 0.4 } }),
            ),
            dressed,
          ),
      ],
      [
        "otherSeedDiffers",
        () =>
          same(
            positions(
              line({ seed: 8, dressing: { lateral: 0.25, depth: 0.4 } }),
            ),
            dressed,
          ) === false,
      ],
    ]),
    { sameSeedReproduces: true, otherSeedDiffers: true },
  );

  const lateralOnly = positions(
    line({ seed: 7, dressing: { lateral: 0.25, depth: 0 } }),
  );
  TestValidator.equals(
    "the two bounds are independent",
    namedFacts([
      [
        "depthStaysExact",
        () =>
          lateralOnly.every((point, index) =>
            nclose(point.z, exact[index]!.z, 1e-12),
          ),
      ],
      [
        "lateralStillMoves",
        () =>
          lateralOnly.some(
            (point, index) => nclose(point.x, exact[index]!.x, 1e-12) === false,
          ),
      ],
    ]),
    { depthStaysExact: true, lateralStillMoves: true },
  );
};
