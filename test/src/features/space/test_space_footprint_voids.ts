import {
  builtEnvironmentSpaceFidelity,
  footprintArea,
  footprintContains,
  footprintConvexPieces,
  footprintInteriorPoint,
  footprintRing,
  footprintRingPlacement,
  heightAt,
  isWalkable,
  measureAutoMovieQuantities,
  propSupportFace,
  propSupportGap,
  spaceGround,
  supportContactsFor,
  surfaceContains,
  surfaceFootprint,
  surfaceHeightAt,
  tessellateSurface,
  validateSpace,
} from "@automovie/engine";
import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieSpace,
  IAutoMovieSurface,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { namedFacts, nclose } from "../internal/predicates";

const v = (x: number, z: number, y = 0) => ({ x, y, z });

/** An 8x8 floor plate with a 4x4 atrium void cut through the middle of it. */
const plate: IAutoMovieSurface = {
  id: "plate",
  kind: "floor",
  polygon: [v(0, 0), v(8, 0), v(8, 8), v(0, 8)],
  holes: [[v(2, 2), v(6, 2), v(6, 6), v(2, 6)]],
  anchor: { x: 0, y: 3, z: 0 },
  rampTo: null,
};

/** The same plate without the void, as the shape the hull query used to see. */
const solid: IAutoMovieSurface = {
  id: "plate",
  kind: "floor",
  polygon: plate.polygon,
  anchor: plate.anchor,
  rampTo: null,
};

/** An L-shaped plate: the notch is the quadrant x>2, z>2. */
const ell: IAutoMovieSurface = {
  id: "ell",
  kind: "floor",
  polygon: [v(0, 0), v(4, 0), v(4, 2), v(2, 2), v(2, 4), v(0, 4)],
  anchor: { x: 0, y: 1, z: 0 },
  rampTo: null,
};

/**
 * A diamond plate with a square void, whose slabs are trapezoids that close to
 * a point at the west apex of one band and the east apex of another.
 */
const diamond: IAutoMovieSurface = {
  id: "diamond",
  kind: "floor",
  polygon: [v(0, 4), v(4, 0), v(8, 4), v(4, 8)],
  holes: [[v(3, 3), v(5, 3), v(5, 5), v(3, 5)]],
  anchor: { x: 0, y: 0, z: 0 },
  rampTo: null,
};

/** The holed plate again, stating its ground as a lattice instead of anchors. */
const relief: IAutoMovieSurface = {
  id: "relief",
  kind: "floor",
  polygon: plate.polygon,
  holes: plate.holes,
  height: {
    kind: "heightfield",
    originX: 0,
    originZ: 0,
    spacingX: 4,
    spacingZ: 4,
    columns: 3,
    rows: 3,
    samples: [0, 1, 0, 1, 2, 1, 0, 1, 0],
  },
};

/** A one-room building whose only support patch is the holed plate. */
const gallery = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "gallery",
  units: "meter",
  buildings: [{ id: "block", element: "root", space: "hall" }],
  models: [{ ...createModel(null), id: "stone" }],
  modelReferences: [],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      model: "stone",
      space: "hall",
    },
  ],
  spaces: [{ id: "hall", kind: "room", parent: null, cells: [] }],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [{ space: "hall", surface: plate }],
  walkable: [plate.id],
});

const spaceOf = (surface: IAutoMovieSurface): IAutoMovieSpace => ({
  id: "set",
  surfaces: [surface],
  walkable: [surface.id],
});

/** Twice the plan area of one convex piece, by the shoelace formula. */
const pieceArea = (piece: { x: number; z: number }[]): number =>
  Math.abs(footprintRing(piece.map((p) => v(p.x, p.z))).doubleArea) / 2;

/**
 * A support patch is the region its own rings describe, notch and void
 * included.
 *
 * Until #1868 the ground query classified a plan point against
 * `convexHull2D(polygon)`, so the only shapes it could tell the truth about
 * were convex ones — and `validateSpace` refused the rest, correctly, because a
 * hull fills an L-shaped plate's notch and floors a slab's atrium without ever
 * saying so. This case pins the inverse from the query side: the rings are read
 * as authored, a point over the void is off the surface everywhere that fact is
 * consumed, and a convex patch answers exactly what it always did.
 *
 * Scenarios:
 *
 * 1. A holed plate is one surface. A point inside the void is outside the
 *    footprint; points in each of the four arms around it are inside; a point
 *    beyond the outer ring is outside.
 * 2. The region is closed at both rims: a point exactly on the void's own rim is
 *    on the slab (the concrete reaches its own edge), and so is a point on the
 *    outer rim.
 * 3. Regression: over the same plate without the void, every one of those probes
 *    answers what the convex query answered — the void is the only difference
 *    the change makes.
 * 4. An L-shaped plate's notch is outside while both arms are inside; the notch
 *    probe is the exact point the old refusal existed to prevent.
 * 5. The void is off the surface in every query built on containment, not only the
 *    predicate: `heightAt`, `isWalkable`, `supportContactsFor` and
 *    `spaceGround`'s fallback all read it as nothing.
 * 6. Plan area is the outer ring less its holes: a donut is 64 - 16 = 48 m².
 * 7. The convex decomposition covers exactly the region: its pieces sum to the
 *    footprint's own area, and a solid convex patch decomposes to one piece.
 * 8. An interior anchor lands on the region, not in the notch a vertex mean would
 *    fall into.
 * 9. The drawn surface is the queried surface: no tessellated vertex of the holed
 *    plate falls strictly inside the void.
 * 10. Degenerate and negative twins: a collinear ring holds nothing, a ring of two
 *     points holds nothing, and the validator accepts the holed plate the
 *     queries just answered for.
 * 11. A slab band that closes to a point at either end is emitted as the triangle
 *     it is: a diamond plate with a void has one at its west apex and one at
 *     its east, and the decomposition still sums to the plate's own area.
 * 12. Relief over a holed plate: every drawn vertex reads `surfaceHeightAt` at its
 *     own plan position and none of them falls in the void, so the lattice path
 *     and the void agree rather than one of them winning.
 * 13. The void is honoured by what reads the patch, not only by the patch: a prop
 *     over the atrium bears on nothing while the same prop over an arm bears on
 *     the slab, a patch with no area is no face at all, and the take-off
 *     subtracts the void from the floor area somebody orders against.
 * 14. Two vertices a hair apart in plan produce no sliver band: the slab between
 *     them is thinner than the tolerance and is skipped, so the decomposition
 *     is still exactly the region rather than the region plus a piece whose own
 *     arithmetic divides by nearly nothing.
 * 15. A ring that crosses itself has no region to be decomposed into, and none is
 *     invented for it: both readings stay finite and deterministic, and
 *     validation refuses the ring rather than letting either of them stand for
 *     a shape nobody wrote.
 */
export const test_space_footprint_voids = (): void => {
  const holed = surfaceFootprint(plate);
  const filled = surfaceFootprint(solid);

  TestValidator.equals(
    "a void in a plate is off the surface while its arms are on it",
    namedFacts([
      ["inTheVoid", () => surfaceContains(plate, 4, 4) === false],
      ["southArm", () => surfaceContains(plate, 4, 1)],
      ["northArm", () => surfaceContains(plate, 4, 7)],
      ["westArm", () => surfaceContains(plate, 1, 4)],
      ["eastArm", () => surfaceContains(plate, 7, 4)],
      ["beyondThePlate", () => surfaceContains(plate, 9, 4) === false],
      ["voidCorner", () => surfaceContains(plate, 5.9, 5.9) === false],
    ]),
    {
      inTheVoid: true,
      southArm: true,
      northArm: true,
      westArm: true,
      eastArm: true,
      beyondThePlate: true,
      voidCorner: true,
    },
  );

  TestValidator.equals(
    "both rims belong to the slab, because the concrete reaches them",
    namedFacts([
      ["onTheVoidRim", () => surfaceContains(plate, 2, 4)],
      ["onTheVoidCorner", () => surfaceContains(plate, 6, 6)],
      ["onTheOuterRim", () => surfaceContains(plate, 0, 4)],
      [
        "ringPlacementSaysBoundary",
        () =>
          footprintRingPlacement(holed.holes[0]!, 2, 4) === "boundary" &&
          footprintRingPlacement(holed.holes[0]!, 4, 4) === "inside" &&
          footprintRingPlacement(holed.holes[0]!, 7, 4) === "outside",
      ],
    ]),
    {
      onTheVoidRim: true,
      onTheVoidCorner: true,
      onTheOuterRim: true,
      ringPlacementSaysBoundary: true,
    },
  );

  TestValidator.equals(
    "without the void the same plate answers what the convex query answered",
    namedFacts([
      ["theVoidsPlace", () => surfaceContains(solid, 4, 4)],
      ["southArm", () => surfaceContains(solid, 4, 1)],
      ["northArm", () => surfaceContains(solid, 4, 7)],
      ["westArm", () => surfaceContains(solid, 1, 4)],
      ["eastArm", () => surfaceContains(solid, 7, 4)],
      ["beyondThePlate", () => surfaceContains(solid, 9, 4) === false],
      ["onTheOuterRim", () => surfaceContains(solid, 0, 4)],
    ]),
    {
      theVoidsPlace: true,
      southArm: true,
      northArm: true,
      westArm: true,
      eastArm: true,
      beyondThePlate: true,
      onTheOuterRim: true,
    },
  );

  TestValidator.equals(
    "an L-shaped plate keeps its notch out and both arms in",
    namedFacts([
      ["inTheNotch", () => surfaceContains(ell, 3, 3) === false],
      ["longArm", () => surfaceContains(ell, 3, 1)],
      ["shortArm", () => surfaceContains(ell, 1, 3)],
      ["onTheInnerCorner", () => surfaceContains(ell, 2, 2)],
      ["outside", () => surfaceContains(ell, 5, 5) === false],
    ]),
    {
      inTheNotch: true,
      longArm: true,
      shortArm: true,
      onTheInnerCorner: true,
      outside: true,
    },
  );

  const holedSpace = spaceOf(plate);
  TestValidator.equals(
    "every query built on containment reads the void as nothing",
    namedFacts([
      ["heightOverTheArm", () => heightAt(holedSpace, 4, 1) === 3],
      ["heightOverTheVoid", () => heightAt(holedSpace, 4, 4) === null],
      ["walkableOverTheArm", () => isWalkable(holedSpace, 4, 1)],
      ["walkableOverTheVoid", () => isWalkable(holedSpace, 4, 4) === false],
      [
        "onlyTheArmCornersSupport",
        () =>
          supportContactsFor(holedSpace, [v(4, 1), v(4, 4), v(4, 7)]).length ===
          2,
      ],
      ["groundOverTheArm", () => spaceGround(holedSpace)(4, 1) === 3],
      ["groundOverTheVoid", () => spaceGround(holedSpace, -1)(4, 4) === -1],
    ]),
    {
      heightOverTheArm: true,
      heightOverTheVoid: true,
      walkableOverTheArm: true,
      walkableOverTheVoid: true,
      onlyTheArmCornersSupport: true,
      groundOverTheArm: true,
      groundOverTheVoid: true,
    },
  );

  TestValidator.equals(
    "the plate's plan area is its outer ring less the void",
    namedFacts([
      ["holed", () => nclose(footprintArea(holed), 8 * 8 - 4 * 4)],
      ["filled", () => nclose(footprintArea(filled), 8 * 8)],
    ]),
    { holed: true, filled: true },
  );

  const holedPieces = footprintConvexPieces(holed);
  const ellPieces = footprintConvexPieces(surfaceFootprint(ell));
  TestValidator.equals(
    "the convex decomposition is exactly the region, no more and no less",
    namedFacts([
      [
        "holedPiecesSumToTheHoledArea",
        () =>
          nclose(
            holedPieces.reduce((sum, piece) => sum + pieceArea(piece), 0),
            48,
          ),
      ],
      [
        "ellPiecesSumToTheEllArea",
        () =>
          nclose(
            ellPieces.reduce((sum, piece) => sum + pieceArea(piece), 0),
            4 * 2 + 2 * 2,
          ),
      ],
      [
        "noPieceReachesIntoTheVoid",
        () =>
          holedPieces.every(
            (piece) =>
              footprintContains(
                holed,
                piece.reduce((sum, point) => sum + point.x, 0) / piece.length,
                piece.reduce((sum, point) => sum + point.z, 0) / piece.length,
              ) === true,
          ),
      ],
      [
        "aConvexPatchIsOnePiece",
        () => footprintConvexPieces(filled).length === 1,
      ],
    ]),
    {
      holedPiecesSumToTheHoledArea: true,
      ellPiecesSumToTheEllArea: true,
      noPieceReachesIntoTheVoid: true,
      aConvexPatchIsOnePiece: true,
    },
  );

  TestValidator.equals(
    "an interior anchor stands on the patch rather than in its hole",
    namedFacts([
      [
        "holedAnchorIsOnTheSlab",
        () => {
          const anchor = footprintInteriorPoint(holed);
          return (
            anchor !== null && footprintContains(holed, anchor.x, anchor.z)
          );
        },
      ],
      [
        "ellAnchorIsOutOfTheNotch",
        () => {
          const anchor = footprintInteriorPoint(surfaceFootprint(ell));
          return (
            anchor !== null &&
            footprintContains(surfaceFootprint(ell), anchor.x, anchor.z)
          );
        },
      ],
      [
        "aConvexPatchKeepsItsOwnCentre",
        () => {
          const anchor = footprintInteriorPoint(filled);
          return anchor !== null && nclose(anchor.x, 4) && nclose(anchor.z, 4);
        },
      ],
      [
        "aRegionWithNoAreaHasNoAnchor",
        () =>
          footprintInteriorPoint({
            outer: footprintRing([v(0, 0), v(1, 1), v(2, 2)]),
            holes: [],
          }) === null,
      ],
    ]),
    {
      holedAnchorIsOnTheSlab: true,
      ellAnchorIsOutOfTheNotch: true,
      aConvexPatchKeepsItsOwnCentre: true,
      aRegionWithNoAreaHasNoAnchor: true,
    },
  );

  const drawn = tessellateSurface(plate)!;
  TestValidator.equals(
    "the drawn plate has the void open, exactly where the query says it is",
    namedFacts([
      ["itDrewSomething", () => drawn.indices.length >= 3],
      [
        "noVertexFallsInsideTheVoid",
        () =>
          Array.from(
            { length: drawn.positions.length / 3 },
            (_, index) =>
              footprintRingPlacement(
                holed.holes[0]!,
                drawn.positions[index * 3]!,
                drawn.positions[index * 3 + 2]!,
              ) !== "inside",
          ).every(Boolean),
      ],
      [
        "everyTriangleCentroidIsOnTheSlab",
        () => {
          for (let face = 0; face < drawn.indices.length; face += 3) {
            let x = 0;
            let z = 0;
            for (let corner = 0; corner < 3; ++corner) {
              const at = drawn.indices[face + corner]! * 3;
              x += drawn.positions[at]! / 3;
              z += drawn.positions[at + 2]! / 3;
            }
            if (footprintContains(holed, x, z) === false) return false;
          }
          return true;
        },
      ],
    ]),
    {
      itDrewSomething: true,
      noVertexFallsInsideTheVoid: true,
      everyTriangleCentroidIsOnTheSlab: true,
    },
  );

  TestValidator.equals(
    "rings with no area hold nothing, and the holed plate validates",
    namedFacts([
      [
        "collinearHoldsNothing",
        () =>
          footprintContains(
            { outer: footprintRing([v(0, 0), v(1, 1), v(2, 2)]), holes: [] },
            1,
            1,
          ) === false,
      ],
      [
        "twoPointsHoldNothing",
        () =>
          footprintRingPlacement(footprintRing([v(0, 0), v(1, 0)]), 0.5, 0) ===
          "outside",
      ],
      [
        "noPiecesFromNoArea",
        () =>
          footprintConvexPieces({
            outer: footprintRing([v(0, 0), v(1, 1), v(2, 2)]),
            holes: [],
          }).length === 0,
      ],
      [
        "nothingIsDrawnForNoArea",
        () =>
          tessellateSurface({
            ...plate,
            polygon: [v(0, 0), v(1, 1), v(2, 2)],
          }) === null,
      ],
      [
        "theHoledPlateValidates",
        () => validateSpace({ space: holedSpace }).success,
      ],
    ]),
    {
      collinearHoldsNothing: true,
      twoPointsHoldNothing: true,
      noPiecesFromNoArea: true,
      nothingIsDrawnForNoArea: true,
      theHoledPlateValidates: true,
    },
  );

  const diamondPieces = footprintConvexPieces(surfaceFootprint(diamond));
  TestValidator.equals(
    "a band that closes to a point is the triangle it is",
    namedFacts([
      [
        "piecesSumToTheDiamondLessItsVoid",
        () =>
          nclose(
            diamondPieces.reduce((sum, piece) => sum + pieceArea(piece), 0),
            32 - 4,
          ),
      ],
      [
        "someBandClosedAtItsWestEnd",
        () =>
          diamondPieces.some(
            (piece) =>
              piece.length === 3 &&
              piece.filter((point) => nclose(point.x, 0)).length === 1,
          ),
      ],
      [
        "someBandClosedAtItsEastEnd",
        () =>
          diamondPieces.some(
            (piece) =>
              piece.length === 3 &&
              piece.filter((point) => nclose(point.x, 8)).length === 1,
          ),
      ],
      [
        "everyPieceStandsOnTheDiamond",
        () =>
          diamondPieces.every((piece) =>
            footprintContains(
              surfaceFootprint(diamond),
              piece.reduce((sum, point) => sum + point.x, 0) / piece.length,
              piece.reduce((sum, point) => sum + point.z, 0) / piece.length,
            ),
          ),
      ],
    ]),
    {
      piecesSumToTheDiamondLessItsVoid: true,
      someBandClosedAtItsWestEnd: true,
      someBandClosedAtItsEastEnd: true,
      everyPieceStandsOnTheDiamond: true,
    },
  );

  const relieved = tessellateSurface(relief)!;
  TestValidator.equals(
    "relief over a holed plate keeps both the lattice and the void",
    namedFacts([
      [
        "everyVertexReadsTheEnginesOwnHeight",
        () =>
          Array.from({ length: relieved.positions.length / 3 }, (_, index) =>
            nclose(
              relieved.positions[index * 3 + 1]!,
              surfaceHeightAt(
                relief,
                relieved.positions[index * 3]!,
                relieved.positions[index * 3 + 2]!,
              ),
              1e-12,
            ),
          ).every(Boolean),
      ],
      [
        "theLatticeSplitTheFootprint",
        () => relieved.indices.length > drawn.indices.length,
      ],
      [
        "noVertexFallsInsideTheVoid",
        () =>
          Array.from(
            { length: relieved.positions.length / 3 },
            (_, index) =>
              footprintRingPlacement(
                holed.holes[0]!,
                relieved.positions[index * 3]!,
                relieved.positions[index * 3 + 2]!,
              ) !== "inside",
          ).every(Boolean),
      ],
    ]),
    {
      everyVertexReadsTheEnginesOwnHeight: true,
      theLatticeSplitTheFootprint: true,
      noVertexFallsInsideTheVoid: true,
    },
  );

  const environment = gallery();
  const face = propSupportFace({
    target: { kind: "surface", environment: "gallery", surface: "plate" },
    environments: [environment],
  })!;
  const crate = (x: number, z: number) => ({
    min: { x: x - 0.5, y: 3, z: z - 0.5 },
    max: { x: x + 0.5, y: 4, z: z + 0.5 },
  });
  TestValidator.equals(
    "what reads the patch reads its void too",
    namedFacts([
      ["theFaceCarriesTheVoid", () => face.polygon.holes.length === 1],
      [
        "aCrateOverAnArmBears",
        () => propSupportGap({ face, bounds: crate(1, 4) }) === 0,
      ],
      [
        "aCrateOverTheAtriumBearsOnNothing",
        () => propSupportGap({ face, bounds: crate(4, 4) }) === null,
      ],
      [
        "aPatchWithNoAreaIsNoFace",
        () =>
          propSupportFace({
            target: {
              kind: "surface",
              environment: "gallery",
              surface: "plate",
            },
            environments: [
              {
                ...environment,
                surfaces: [
                  {
                    space: "hall",
                    surface: { ...plate, polygon: [v(0, 0), v(1, 1), v(2, 2)] },
                  },
                ],
              },
            ],
          }) === null,
      ],
      [
        "theTakeOffSubtractsTheVoid",
        () =>
          nclose(
            measureAutoMovieQuantities({ environment }).findings.find(
              (entry) => entry.subject === "space-floor-area",
            )!.total,
            48,
            1e-6,
          ),
      ],
      [
        "aPatchIsNotAVolume",
        () => builtEnvironmentSpaceFidelity(environment, "hall") === "unstated",
      ],
    ]),
    {
      theFaceCarriesTheVoid: true,
      aCrateOverAnArmBears: true,
      aCrateOverTheAtriumBearsOnNothing: true,
      aPatchWithNoAreaIsNoFace: true,
      theTakeOffSubtractsTheVoid: true,
      aPatchIsNotAVolume: true,
    },
  );

  const skewed = surfaceFootprint({
    ...ell,
    polygon: [v(0, 0), v(4, 0), v(4, 2), v(2, 2), v(2 + 1e-10, 4), v(0, 4)],
  });
  const skewedPieces = footprintConvexPieces(skewed);
  TestValidator.equals(
    "a band thinner than the tolerance is skipped, not slivered",
    namedFacts([
      [
        "itStillSumsToTheRegion",
        () =>
          nclose(
            skewedPieces.reduce((sum, piece) => sum + pieceArea(piece), 0),
            12,
            1e-6,
          ),
      ],
      [
        "noPieceIsASliver",
        () =>
          skewedPieces.every(
            (piece) =>
              Math.max(...piece.map((point) => point.x)) -
                Math.min(...piece.map((point) => point.x)) >
              1e-9,
          ),
      ],
      ["theNotchIsStillOut", () => footprintContains(skewed, 3, 3) === false],
    ]),
    {
      itStillSumsToTheRegion: true,
      noPieceIsASliver: true,
      theNotchIsStillOut: true,
    },
  );

  const crossing = { ...ell, polygon: [v(0, 0), v(4, 4), v(4, 0), v(0, 6)] };
  const bowtie = surfaceFootprint(crossing);
  TestValidator.equals(
    "a ring that crosses itself is refused, not resolved",
    namedFacts([
      [
        "validationRefusesIt",
        () => validateSpace({ space: spaceOf(crossing) }).success === false,
      ],
      [
        "theDecompositionStaysFinite",
        () =>
          footprintConvexPieces(bowtie).every((piece) =>
            piece.every(
              (point) =>
                Number.isFinite(point.x) &&
                Number.isFinite(point.z) &&
                Number.isFinite(point.y),
            ),
          ),
      ],
      [
        "andContainmentStaysABoolean",
        () => typeof footprintContains(bowtie, 2, 2) === "boolean",
      ],
    ]),
    {
      validationRefusesIt: true,
      theDecompositionStaysFinite: true,
      andContainmentStaysABoolean: true,
    },
  );
};
