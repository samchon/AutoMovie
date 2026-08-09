import { formationSlot } from "@automovie/engine";
import { IAutoMovieFormationDesign } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

const LATERAL = 0.8;
const DEPTH = 1.5;

interface IProbe {
  ranks: number;
  files: number;
  count: number;
}

interface ICell {
  rank: number;
  file: number;
}

const square = (
  probe: IProbe,
  props: {
    seed?: number;
    dressing?: { lateral: number; depth: number };
  } = {},
): IAutoMovieFormationDesign => ({
  id: "probe-square",
  modelRecipe: "probe-model",
  count: probe.count,
  layout: {
    kind: "square",
    ranks: probe.ranks,
    files: probe.files,
    spacing: { lateral: LATERAL, depth: DEPTH },
    ...(props.dressing === undefined ? {} : { dressing: props.dressing }),
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: props.seed ?? 11,
  capabilities: [],
  heroOverrides: [],
});

const placed = (
  probe: IProbe,
  props: {
    seed?: number;
    dressing?: { lateral: number; depth: number };
  } = {},
): { x: number; z: number }[] => {
  const formation = square(probe, props);
  return Array.from({ length: probe.count }, (_unused, slot) => {
    const point = formationSlot(formation, slot).position;
    return { x: point.x, z: point.z };
  });
};

/** The exact geometry of one lattice cell, which is what a slot is judged by. */
const geometry = (probe: IProbe, cell: ICell): { x: number; z: number } => ({
  x: (cell.file - (probe.files - 1) / 2) * LATERAL,
  z: cell.rank * DEPTH,
});

/** The cell a placed member is nearest, before asking whether it sits on it. */
const cellOf = (probe: IProbe, point: { x: number; z: number }): ICell => ({
  rank: Math.round(point.z / DEPTH),
  file: Math.round(point.x / LATERAL + (probe.files - 1) / 2),
});

const cells = (probe: IProbe): ICell[] =>
  placed(probe).map((point) => cellOf(probe, point));

const onLattice = (probe: IProbe, point: { x: number; z: number }): boolean => {
  const exact = geometry(probe, cellOf(probe, point));
  return nclose(point.x, exact.x) && nclose(point.z, exact.z);
};

const key = (cell: ICell): string => `${cell.rank}:${cell.file}`;

const distinct = (list: readonly ICell[]): boolean =>
  new Set(list.map(key)).size === list.length;

const inside = (probe: IProbe, cell: ICell): boolean =>
  cell.rank > 0 &&
  cell.rank < probe.ranks - 1 &&
  cell.file > 0 &&
  cell.file < probe.files - 1;

/** Every cell of the outer wall of the rectangle, in no particular order. */
const perimeter = (probe: IProbe): string[] => {
  const out: string[] = [];
  for (let rank = 0; rank < probe.ranks; ++rank)
    for (let file = 0; file < probe.files; ++file)
      if (inside(probe, { rank, file }) === false)
        out.push(key({ rank, file }));
  return out;
};

const neighbours = (left: ICell, right: ICell): boolean =>
  Math.max(
    Math.abs(left.rank - right.rank),
    Math.abs(left.file - right.file),
  ) === 1;

const sameCells = (left: readonly ICell[], right: readonly ICell[]): boolean =>
  left.length === right.length &&
  left.every((cell, index) => key(cell) === key(right[index]!));

/**
 * A hollow rectangle places its members around an empty interior.
 *
 * Every other layout fills the space it occupies: `line` and `column` are solid
 * lattices, `wedge` is a solid triangle, `scatter` fills a disc, and `arc` is
 * the one open curve but it is a curve, so it cannot state a width and a depth
 * separately. The arrangement that was missing is the closed one: a wall of
 * members enclosing a space none of them stands in, which is what a ring drawn
 * around an object, a clearing, or a stage is, and no combination of the other
 * five produces it.
 *
 * The oracle is the layout arithmetic rather than the engine's own output. An
 * exact slot sits on the centred lattice `((file - (files - 1) / 2) * lateral,
 * rank * depth)`, so a member can be read back to the integer cell it stands
 * on, and the arrangement can then be judged as a set of cells: which are
 * occupied, which are empty, and in what order they were filled.
 *
 * Scenarios:
 *
 * 1. A count equal to the wall of a rectangle occupies exactly that wall: every
 *    member sits on the lattice, no two share a cell, no cell strictly inside
 *    the rectangle is occupied, and no cell of the wall is missed. Hollowness
 *    is the property being bought, so it is asserted both ways.
 * 2. The arrangement is centred laterally and runs forward from the anchor, the
 *    way every other layout does, so it composes with facing and with formation
 *    motion cues rather than needing a special case.
 * 3. The walk is one closed circuit in a fixed order: slot 0 is the near-left
 *    corner, consecutive slots are neighbouring cells, and the last member
 *    closes back onto the first. Slot order is what a hero override names, so
 *    it must not depend on anything but the two side lengths and the slot
 *    index.
 * 4. Count is what thickens the wall. The same rectangle at three counts fills the
 *    outer ring, then the ring inside it, then the whole lattice, and a larger
 *    count only ever adds members: it never moves one that was already placed.
 * 5. A rectangle with a side of one encloses nothing. It is a strip in reading
 *    order rather than a circuit walked twice, on both orientations.
 * 6. A count below the wall it describes stops part way and leaves the circuit
 *    open, rather than redistributing members around a smaller rectangle.
 * 7. A count above the whole rectangle keeps going instead of stacking two members
 *    on one cell: the lattice fills solid and the rest take fresh ranks beyond
 *    the far edge. Both a wide and a deep rectangle are checked, because the
 *    two side lengths run out on different sides of the walk.
 * 8. `dressing` moves members off that lattice and stays inside the tolerance it
 *    declares, and the same seed reproduces the same arrangement exactly.
 */
export const test_world_formation_square = (): void => {
  const wall: IProbe = { ranks: 4, files: 5, count: 2 * (4 + 5) - 4 };
  const wallCells = cells(wall);
  TestValidator.equals(
    "a hollow rectangle occupies its whole wall and nothing inside it",
    namedFacts([
      [
        "everyMemberOnTheLattice",
        () => placed(wall).every((point) => onLattice(wall, point)),
      ],
      ["noTwoMembersShareACell", () => distinct(wallCells)],
      [
        "noMemberStandsInside",
        () => wallCells.every((cell) => inside(wall, cell) === false),
      ],
      [
        "noCellOfTheWallIsMissed",
        () => {
          const occupied = new Set(wallCells.map(key));
          const expected = perimeter(wall);
          return (
            occupied.size === expected.length &&
            expected.every((cell) => occupied.has(cell))
          );
        },
      ],
    ]),
    {
      everyMemberOnTheLattice: true,
      noTwoMembersShareACell: true,
      noMemberStandsInside: true,
      noCellOfTheWallIsMissed: true,
    },
  );

  const wallPoints = placed(wall);
  TestValidator.equals(
    "the rectangle is centred laterally and runs forward from the anchor",
    namedFacts([
      [
        "lateralExtremesAreSymmetric",
        () =>
          nclose(
            Math.min(...wallPoints.map((point) => point.x)),
            -Math.max(...wallPoints.map((point) => point.x)),
          ),
      ],
      [
        "lateralHalfWidthIsTheOuterFile",
        () =>
          nclose(
            Math.max(...wallPoints.map((point) => point.x)),
            ((wall.files - 1) / 2) * LATERAL,
          ),
      ],
      [
        "theNearEdgeSitsOnTheAnchor",
        () => nclose(Math.min(...wallPoints.map((point) => point.z)), 0),
      ],
      [
        "theFarEdgeIsTheLastRankForward",
        () =>
          nclose(
            Math.max(...wallPoints.map((point) => point.z)),
            (wall.ranks - 1) * DEPTH,
          ),
      ],
    ]),
    {
      lateralExtremesAreSymmetric: true,
      lateralHalfWidthIsTheOuterFile: true,
      theNearEdgeSitsOnTheAnchor: true,
      theFarEdgeIsTheLastRankForward: true,
    },
  );

  TestValidator.equals(
    "the walk is one closed circuit in a stable order",
    namedFacts([
      ["startsAtTheNearLeftCorner", () => key(wallCells[0]!) === "0:0"],
      [
        "consecutiveSlotsAreNeighbours",
        () =>
          wallCells.every(
            (cell, index) =>
              index === 0 || neighbours(wallCells[index - 1]!, cell),
          ),
      ],
      [
        "theLastMemberClosesTheCircuit",
        () => neighbours(wallCells[wallCells.length - 1]!, wallCells[0]!),
      ],
      [
        "theSameDesignPlacesTheSameMembers",
        () => sameCells(cells(wall), wallCells),
      ],
    ]),
    {
      startsAtTheNearLeftCorner: true,
      consecutiveSlotsAreNeighbours: true,
      theLastMemberClosesTheCircuit: true,
      theSameDesignPlacesTheSameMembers: true,
    },
  );

  const ring: IProbe = { ranks: 5, files: 5, count: 16 };
  const twoDeep: IProbe = { ranks: 5, files: 5, count: 24 };
  const solid: IProbe = { ranks: 5, files: 5, count: 25 };
  const ringCells = cells(ring);
  const twoDeepCells = cells(twoDeep);
  const solidCells = cells(solid);
  TestValidator.equals(
    "count thickens the wall inward without moving a placed member",
    namedFacts([
      [
        "oneRingLeavesTheInteriorEmpty",
        () =>
          ringCells.length === 16 &&
          distinct(ringCells) &&
          ringCells.every((cell) => inside(ring, cell) === false),
      ],
      [
        "twoRingsLeaveOnlyTheCentreEmpty",
        () =>
          distinct(twoDeepCells) &&
          new Set(twoDeepCells.map(key)).has("2:2") === false,
      ],
      [
        "aFullCountFillsTheLattice",
        () => distinct(solidCells) && solidCells.length === 5 * 5,
      ],
      [
        "aLargerCountOnlyAddsMembers",
        () =>
          sameCells(ringCells, solidCells.slice(0, ring.count)) &&
          sameCells(twoDeepCells, solidCells.slice(0, twoDeep.count)),
      ],
    ]),
    {
      oneRingLeavesTheInteriorEmpty: true,
      twoRingsLeaveOnlyTheCentreEmpty: true,
      aFullCountFillsTheLattice: true,
      aLargerCountOnlyAddsMembers: true,
    },
  );

  const flat: IProbe = { ranks: 1, files: 6, count: 6 };
  const narrow: IProbe = { ranks: 6, files: 1, count: 6 };
  TestValidator.equals(
    "a side of one encloses nothing and is filled as a strip",
    namedFacts([
      [
        "oneRankIsASingleRowInOrder",
        () =>
          sameCells(
            cells(flat),
            Array.from({ length: 6 }, (_unused, file) => ({ rank: 0, file })),
          ),
      ],
      [
        "oneRankStaysCentredLaterally",
        () =>
          placed(flat).every((point, file) =>
            nclose(point.x, (file - (flat.files - 1) / 2) * LATERAL),
          ),
      ],
      [
        "oneFileIsASingleColumnInOrder",
        () =>
          sameCells(
            cells(narrow),
            Array.from({ length: 6 }, (_unused, rank) => ({ rank, file: 0 })),
          ),
      ],
      [
        "oneFileStandsOnTheAnchorAxis",
        () => placed(narrow).every((point) => nclose(point.x, 0)),
      ],
    ]),
    {
      oneRankIsASingleRowInOrder: true,
      oneRankStaysCentredLaterally: true,
      oneFileIsASingleColumnInOrder: true,
      oneFileStandsOnTheAnchorAxis: true,
    },
  );

  const partial: IProbe = { ranks: 4, files: 5, count: 9 };
  const partialCells = cells(partial);
  TestValidator.equals(
    "a count below its wall leaves the circuit open rather than redrawing it",
    namedFacts([
      [
        "itIsThePrefixOfTheSameWalk",
        () => sameCells(partialCells, wallCells.slice(0, 9)),
      ],
      ["noTwoMembersShareACell", () => distinct(partialCells)],
      [
        "noMemberStandsInside",
        () => partialCells.every((cell) => inside(partial, cell) === false),
      ],
      [
        "theCircuitIsLeftOpen",
        () =>
          neighbours(
            partialCells[partialCells.length - 1]!,
            partialCells[0]!,
          ) === false,
      ],
    ]),
    {
      itIsThePrefixOfTheSameWalk: true,
      noTwoMembersShareACell: true,
      noMemberStandsInside: true,
      theCircuitIsLeftOpen: true,
    },
  );

  const overfullWide: IProbe = { ranks: 4, files: 6, count: 4 * 6 + 3 };
  const overfullDeep: IProbe = { ranks: 6, files: 4, count: 6 * 4 + 3 };
  const overfullSmall: IProbe = { ranks: 3, files: 3, count: 3 * 3 + 3 };
  TestValidator.equals(
    "a count above the whole rectangle keeps going instead of stacking",
    namedFacts([
      [
        "aWideRectangleFillsSolidThenContinues",
        () => {
          const list = cells(overfullWide);
          return (
            distinct(list) &&
            list.filter((cell) => cell.rank < overfullWide.ranks).length ===
              overfullWide.ranks * overfullWide.files &&
            list
              .slice(overfullWide.ranks * overfullWide.files)
              .every((cell) => cell.rank >= overfullWide.ranks)
          );
        },
      ],
      [
        "aDeepRectangleFillsSolidThenContinues",
        () => {
          const list = cells(overfullDeep);
          return (
            distinct(list) &&
            list.filter((cell) => cell.rank < overfullDeep.ranks).length ===
              overfullDeep.ranks * overfullDeep.files &&
            list
              .slice(overfullDeep.ranks * overfullDeep.files)
              .every((cell) => cell.rank >= overfullDeep.ranks)
          );
        },
      ],
      [
        "anOddCentreIsFilledBeforeTheOverflow",
        () => {
          const list = cells(overfullSmall);
          return (
            distinct(list) &&
            key(list[3 * 3 - 1]!) === "1:1" &&
            list.slice(3 * 3).every((cell) => cell.rank >= overfullSmall.ranks)
          );
        },
      ],
      [
        "everyOverflowMemberStaysOnTheLattice",
        () =>
          placed(overfullSmall).every((point) =>
            onLattice(overfullSmall, point),
          ),
      ],
    ]),
    {
      aWideRectangleFillsSolidThenContinues: true,
      aDeepRectangleFillsSolidThenContinues: true,
      anOddCentreIsFilledBeforeTheOverflow: true,
      everyOverflowMemberStaysOnTheLattice: true,
    },
  );

  const dressing = { lateral: 0.3, depth: 0.45 };
  const dressed = placed(wall, { dressing });
  TestValidator.equals(
    "dressing moves members off the lattice and stays inside its tolerance",
    namedFacts([
      [
        "aZeroToleranceReproducesTheExactWall",
        () => {
          const flatDressed = placed(wall, {
            dressing: { lateral: 0, depth: 0 },
          });
          return flatDressed.every(
            (point, index) =>
              nclose(point.x, wallPoints[index]!.x, 1e-12) &&
              nclose(point.z, wallPoints[index]!.z, 1e-12),
          );
        },
      ],
      [
        "everyMemberLeavesItsCell",
        () =>
          dressed.every(
            (point, index) =>
              nclose(point.x, wallPoints[index]!.x, 1e-12) === false ||
              nclose(point.z, wallPoints[index]!.z, 1e-12) === false,
          ),
      ],
      [
        "everyDeviationStaysInsideTheBound",
        () =>
          dressed.every(
            (point, index) =>
              Math.abs(point.x - wallPoints[index]!.x) <= dressing.lateral &&
              Math.abs(point.z - wallPoints[index]!.z) <= dressing.depth,
          ),
      ],
      [
        "theSameSeedReproducesTheSameArrangement",
        () =>
          placed(wall, { dressing }).every(
            (point, index) =>
              nclose(point.x, dressed[index]!.x, 1e-12) &&
              nclose(point.z, dressed[index]!.z, 1e-12),
          ),
      ],
    ]),
    {
      aZeroToleranceReproducesTheExactWall: true,
      everyMemberLeavesItsCell: true,
      everyDeviationStaysInsideTheBound: true,
      theSameSeedReproducesTheSameArrangement: true,
    },
  );
};
