import {
  propAnchorFrame,
  propBlockedPassages,
  propBoundsOverlap,
  propClearanceBounds,
  propOccupancyBounds,
  propSpaceContainsBounds,
  validatePropPlacements,
} from "@automovie/engine";
import {
  IAutoMoviePropBox,
  IAutoMoviePropSpec,
  IAutoMovieStageSetPiece,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { namedFacts, throwsError, vclose } from "../internal/predicates";
import {
  inSpace,
  lamp,
  propEnvironment,
  propRegistry,
  propSet,
  sculpture,
  table,
} from "./propPlacementFixtures";

const box = (
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): IAutoMoviePropBox => ({
  min: { x: minX, y: minY, z: minZ },
  max: { x: maxX, y: maxY, z: maxZ },
});

const boxClose = (
  actual: IAutoMoviePropBox,
  expected: IAutoMoviePropBox,
): boolean =>
  vclose(actual.min, expected.min) && vclose(actual.max, expected.max);

const UNIT: IAutoMovieStageSetPiece = {
  node: "probe",
  model: "probe",
  position: { x: 0, y: 0, z: 0 },
};

/**
 * A ring of chairs authored the way a production would: one loop, one anchor, a
 * declared seed, and no hand-typed world coordinate.
 *
 * The angular offset is drawn from a small integer hash of the seed and the
 * slot index rather than from a global generator, so the layout depends on the
 * inputs alone: the same seed and the same count reproduce byte for byte
 * regardless of the order the slots are evaluated in.
 */
const chairRing = (props: {
  count: number;
  seed: number;
}): { specs: IAutoMoviePropSpec[]; set: IAutoMovieStageSetPiece[] } => {
  const environment = propEnvironment();
  const anchor = propAnchorFrame({
    target: { kind: "surface", environment: "house", surface: "floor" },
    environments: [environment],
  })!;
  const specs: IAutoMoviePropSpec[] = [];
  const set: IAutoMovieStageSetPiece[] = [];
  for (let slot = 0; slot < props.count; ++slot) {
    const node = `chair-${slot}`;
    const jitter = ((props.seed * 2654435761 + slot * 40503) % 360) / 3600;
    const angle = ((slot / props.count) * 2 + jitter) * Math.PI;
    specs.push({
      node,
      model: { ...createModel(null), id: node },
      articulation: null,
      placement: {
        relations: [
          inSpace("room"),
          {
            kind: "on-support",
            target: { kind: "surface", environment: "house", surface: "floor" },
          },
        ],
        footprint: null,
        clearance: [],
      },
    });
    set.push({
      node,
      model: node,
      position: {
        x: anchor.translation.x + Math.cos(angle) * 3,
        y: anchor.translation.y + 0.3,
        z: anchor.translation.z + Math.sin(angle) * 3,
      },
    });
  }
  return { specs, set };
};

/**
 * The pure placement predicates answer the questions the validator asks, so a
 * source-side loop or search reaches the same verdict the compiler will.
 *
 * Scenarios:
 *
 * 1. Occupancy comes from a declared footprint when there is one and from the
 *    visible parts otherwise, through the full staged TRS; a prop with no
 *    vertices collapses to its staged origin instead of an empty bound.
 * 2. Clearance volumes transform with the same TRS, and a prop that declares no
 *    placement declares no clearance.
 * 3. Overlap is strict on all six comparisons: a shared face is contact, one axis
 *    of separation on either side is enough to say no.
 * 4. Containment tests every corner, is vacuously true inside a cell-less semantic
 *    partition, and refuses an undeclared space by throwing.
 * 5. Blocked passages name the filled opening and the swept connector, and stay
 *    silent for an open cut, an unmodelled fill, and a degenerate route.
 * 6. Every relation target that carries a frame answers with it and every one that
 *    cannot answers `null`, including each way a citation can dangle.
 * 7. Twelve chairs authored as one seeded loop validate, reproduce byte for byte
 *    across runs, and move as a body when the seed changes.
 */
export const test_film_prop_placement_utility = (): void => {
  const environment = propEnvironment();

  TestValidator.equals(
    "occupancy, clearance, overlap and containment agree with hand math",
    namedFacts([
      [
        "derivedOccupancy",
        () =>
          boxClose(
            propOccupancyBounds({
              prop: table(),
              piece: {
                node: "table",
                model: "table",
                position: { x: 0, y: 0.3, z: 0 },
              },
            }),
            box(-0.2, 0, -0.1, 0.2, 0.6, 0.1),
          ),
      ],
      [
        "declaredFootprintWins",
        () =>
          boxClose(
            propOccupancyBounds({
              prop: {
                ...table(),
                placement: {
                  ...table().placement!,
                  footprint: box(-1, 0, -1, 1, 2, 1),
                },
              },
              piece: { ...UNIT, scale: { x: 2, y: 1, z: 0.5 } },
            }),
            box(-2, 0, -0.5, 2, 2, 0.5),
          ),
      ],
      [
        "placementlessOccupancyIsDerived",
        () =>
          boxClose(
            propOccupancyBounds({
              prop: sculpture(),
              piece: {
                node: "sculpture",
                model: "sculpture",
                position: { x: -3, y: 0, z: 0 },
                rotation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
                scale: { x: 1, y: 2, z: 0.5 },
              },
            }),
            box(-3, 0, -1.1, -2.5, 2, -0.1),
          ),
      ],
      [
        "verticeslessPropCollapsesToItsOrigin",
        () =>
          boxClose(
            propOccupancyBounds({
              prop: {
                node: "empty",
                model: { ...createModel(null), id: "empty", parts: [] },
                articulation: null,
              },
              piece: { ...UNIT, position: { x: 1, y: 2, z: 3 } },
            }),
            box(1, 2, 3, 1, 2, 3),
          ),
      ],
      [
        "facingDegDrivesTheSameTransform",
        () =>
          boxClose(
            propOccupancyBounds({
              prop: sculpture(),
              piece: {
                node: "sculpture",
                model: "sculpture",
                position: { x: -3, y: 0, z: 0 },
                facingDeg: 90,
                scale: { x: 1, y: 2, z: 0.5 },
              },
            }),
            box(-3, 0, -1.1, -2.5, 2, -0.1),
          ),
      ],
      [
        "clearanceTransformsWithTheProp",
        () =>
          propClearanceBounds({
            prop: lamp(),
            piece: { ...UNIT, position: { x: 0, y: 0.9, z: 0 }, scale: 1.2 },
          }).length === 1 &&
          propClearanceBounds({
            prop: lamp(),
            piece: { ...UNIT, position: { x: 0, y: 0.9, z: 0 }, scale: 1.2 },
          }).every(
            (clearance) =>
              clearance.id === "shade-service" &&
              boxClose(clearance, box(1.2, 0.3, -0.6, 2.4, 1.5, 0.6)),
          ),
      ],
      [
        "placementlessPropDeclaresNoClearance",
        () =>
          propClearanceBounds({ prop: sculpture(), piece: UNIT }).length === 0,
      ],
      [
        "overlapIsTrueWhenVolumesIntersect",
        () =>
          propBoundsOverlap(box(0, 0, 0, 1, 1, 1), box(0.5, 0.5, 0.5, 2, 2, 2)),
      ],
      [
        "eachAxisSeparatesOnEitherSide",
        () =>
          (
            [
              box(1, 0, 0, 2, 1, 1),
              box(-2, 0, 0, -1, 1, 1),
              box(0, 1, 0, 1, 2, 1),
              box(0, -2, 0, 1, -1, 1),
              box(0, 0, 1, 1, 1, 2),
              box(0, 0, -2, 1, 1, -1),
            ] as const
          ).every(
            (other) =>
              propBoundsOverlap(box(0, 0, 0, 1, 1, 1), other) === false,
          ),
      ],
      [
        "containedBoundsAreInside",
        () =>
          propSpaceContainsBounds({
            environment,
            space: "room",
            bounds: box(-1, 0, -1, 1, 1, 1),
          }),
      ],
      [
        "oneCornerOutsideIsOutside",
        () =>
          propSpaceContainsBounds({
            environment,
            space: "room",
            bounds: box(-1, 0, -1, 6, 1, 1),
          }) === false,
      ],
      [
        "cellLessPartitionExcludesNothing",
        () =>
          propSpaceContainsBounds({
            environment,
            space: "annex",
            bounds: box(900, 900, 900, 901, 901, 901),
          }),
      ],
      [
        "undeclaredSpaceThrows",
        () =>
          throwsError(
            () =>
              propSpaceContainsBounds({
                environment,
                space: "missing",
                bounds: box(0, 0, 0, 1, 1, 1),
              }),
            'no logical space "missing"',
          ),
      ],
    ]),
    {
      derivedOccupancy: true,
      declaredFootprintWins: true,
      placementlessOccupancyIsDerived: true,
      verticeslessPropCollapsesToItsOrigin: true,
      facingDegDrivesTheSameTransform: true,
      clearanceTransformsWithTheProp: true,
      placementlessPropDeclaresNoClearance: true,
      overlapIsTrueWhenVolumesIntersect: true,
      eachAxisSeparatesOnEitherSide: true,
      containedBoundsAreInside: true,
      oneCornerOutsideIsOutside: true,
      cellLessPartitionExcludesNothing: true,
      undeclaredSpaceThrows: true,
    },
  );

  TestValidator.equals(
    "passages and anchors answer only what the record can support",
    namedFacts([
      [
        "filledOpeningIsBlocked",
        () =>
          propBlockedPassages({
            environment,
            bounds: box(3.9, 0.5, -0.02, 4.1, 1.5, 0.02),
          }).some(
            (blockage) =>
              blockage.kind === "opening" && blockage.id === "doorway",
          ),
      ],
      [
        "sweptConnectorIsBlocked",
        () =>
          propBlockedPassages({
            environment,
            bounds: box(-4.6, 0.5, -3.1, -4.4, 1.5, -2.9),
          }).some(
            (blockage) =>
              blockage.kind === "connector" && blockage.id === "stair",
          ),
      ],
      [
        "openCutIsNeverBlocked",
        () =>
          propBlockedPassages({
            environment,
            bounds: box(3.9, 0.5, -0.02, 4.1, 1.5, 0.02),
          }).length === 1,
      ],
      [
        "unmodelledFillIsNeverBlocked",
        () =>
          propBlockedPassages({
            environment: { ...environment, models: [] },
            bounds: box(3.9, 0.5, -0.02, 4.1, 1.5, 0.02),
          }).length === 0,
      ],
      [
        "degenerateRouteSweepsNothing",
        () =>
          propBlockedPassages({
            environment: {
              ...environment,
              connectors: [
                {
                  ...environment.connectors[0]!,
                  route: [{ x: -4.5, y: 0, z: -3 }],
                },
              ],
            },
            bounds: box(-4.6, 0.5, -3.1, -4.4, 1.5, -2.9),
          }).length === 0,
      ],
      [
        "clearOfEverythingBlocksNothing",
        () =>
          propBlockedPassages({
            environment,
            bounds: box(0, 0, 0, 0.1, 0.1, 0.1),
          }).length === 0,
      ],
      [
        "spaceHasNoFrame",
        () =>
          propAnchorFrame({
            target: { kind: "space", environment: "house", space: "room" },
            environments: [environment],
          }) === null,
      ],
      [
        "elementFrameIsItsWorldTransform",
        () =>
          vclose(
            propAnchorFrame({
              target: {
                kind: "element",
                environment: "house",
                element: "door-leaf",
              },
              environments: [environment],
            })!.translation,
            { x: 4, y: 1, z: 0 },
          ),
      ],
      [
        "boundaryFrameIsItsFirstElement",
        () =>
          vclose(
            propAnchorFrame({
              target: {
                kind: "boundary",
                environment: "house",
                boundary: "room-wall",
              },
              environments: [environment],
            })!.translation,
            { x: 0, y: 0, z: 0 },
          ),
      ],
      [
        "openingFrameIsItsFill",
        () =>
          vclose(
            propAnchorFrame({
              target: {
                kind: "opening",
                environment: "house",
                opening: "doorway",
              },
              environments: [environment],
            })!.translation,
            { x: 4, y: 1, z: 0 },
          ),
      ],
      [
        "anchoredSurfaceFrameIsItsCentroid",
        () =>
          vclose(
            propAnchorFrame({
              target: {
                kind: "surface",
                environment: "house",
                surface: "floor",
              },
              environments: [environment],
            })!.translation,
            { x: 0, y: 0, z: 0 },
          ),
      ],
      [
        "ruledSurfaceFrameReadsItsHeightRule",
        () =>
          vclose(
            propAnchorFrame({
              target: {
                kind: "surface",
                environment: "house",
                surface: "annex-floor",
              },
              environments: [environment],
            })!.translation,
            { x: 7.5, y: 0.5, z: 0 },
          ),
      ],
      [
        "affordanceFrameRidesItsStagedProp",
        () =>
          vclose(
            propAnchorFrame({
              target: {
                kind: "prop-affordance",
                prop: "table",
                affordance: "top",
              },
              environments: [environment],
              props: propRegistry(),
              set: propSet(),
            })!.translation,
            { x: 0, y: 0.3, z: 0 },
          ),
      ],
      [
        "everyDanglingCitationAnswersNull",
        () =>
          (
            [
              {
                target: {
                  kind: "element",
                  environment: "elsewhere",
                  element: "wall",
                },
              },
              {
                target: {
                  kind: "element",
                  environment: "house",
                  element: "missing",
                },
              },
              {
                target: {
                  kind: "boundary",
                  environment: "house",
                  boundary: "missing",
                },
              },
              {
                target: {
                  kind: "boundary",
                  environment: "house",
                  boundary: "bare-boundary",
                },
              },
              {
                target: {
                  kind: "opening",
                  environment: "house",
                  opening: "missing",
                },
              },
              {
                target: {
                  kind: "opening",
                  environment: "house",
                  opening: "arch",
                },
              },
              {
                target: {
                  kind: "surface",
                  environment: "house",
                  surface: "missing",
                },
              },
              {
                target: {
                  kind: "prop-affordance",
                  prop: "missing",
                  affordance: "top",
                },
              },
              {
                target: {
                  kind: "prop-affordance",
                  prop: "table",
                  affordance: "missing",
                },
              },
            ] as const
          ).every(
            (probe) =>
              propAnchorFrame({
                target: probe.target,
                environments: [environment],
                props: propRegistry(),
                set: propSet(),
              }) === null,
          ),
      ],
      [
        "unstagedAffordanceAnswersNull",
        () =>
          propAnchorFrame({
            target: {
              kind: "prop-affordance",
              prop: "table",
              affordance: "top",
            },
            environments: [environment],
            props: propRegistry(),
          }) === null,
      ],
      [
        "unregisteredPropsAnswerNull",
        () =>
          propAnchorFrame({
            target: {
              kind: "prop-affordance",
              prop: "table",
              affordance: "top",
            },
            environments: [environment],
            set: propSet(),
          }) === null,
      ],
      [
        "cyclicElementChainAnswersNull",
        () =>
          (
            [
              { kind: "element", environment: "house", element: "door-leaf" },
              { kind: "boundary", environment: "house", boundary: "room-wall" },
              { kind: "opening", environment: "house", opening: "doorway" },
            ] as const
          ).every(
            (target) =>
              propAnchorFrame({
                target,
                environments: [
                  {
                    ...environment,
                    elements: environment.elements.map((element) =>
                      element.id === "root"
                        ? { ...element, parent: "door-leaf" }
                        : element,
                    ),
                  },
                ],
              }) === null,
          ),
      ],
      [
        "emptyPolygonSurfaceAnswersNull",
        () =>
          propAnchorFrame({
            target: {
              kind: "surface",
              environment: "house",
              surface: "floor",
            },
            environments: [
              {
                ...environment,
                surfaces: environment.surfaces.map((entry) =>
                  entry.surface.id === "floor"
                    ? { ...entry, surface: { ...entry.surface, polygon: [] } }
                    : entry,
                ),
              },
            ],
          }) === null,
      ],
    ]),
    {
      filledOpeningIsBlocked: true,
      sweptConnectorIsBlocked: true,
      openCutIsNeverBlocked: true,
      unmodelledFillIsNeverBlocked: true,
      degenerateRouteSweepsNothing: true,
      clearOfEverythingBlocksNothing: true,
      spaceHasNoFrame: true,
      elementFrameIsItsWorldTransform: true,
      boundaryFrameIsItsFirstElement: true,
      openingFrameIsItsFill: true,
      anchoredSurfaceFrameIsItsCentroid: true,
      ruledSurfaceFrameReadsItsHeightRule: true,
      affordanceFrameRidesItsStagedProp: true,
      everyDanglingCitationAnswersNull: true,
      unstagedAffordanceAnswersNull: true,
      unregisteredPropsAnswerNull: true,
      cyclicElementChainAnswersNull: true,
      emptyPolygonSurfaceAnswersNull: true,
    },
  );

  const first = chairRing({ count: 12, seed: 7 });
  const again = chairRing({ count: 12, seed: 7 });
  const reseeded = chairRing({ count: 12, seed: 11 });
  TestValidator.equals(
    "a seeded loop of twelve chairs validates and reproduces",
    namedFacts([
      [
        "theRingValidates",
        () =>
          validatePropPlacements({
            props: first.specs,
            set: first.set,
            builtEnvironments: [environment],
          }).success,
      ],
      [
        "sameSeedSameBytes",
        () => JSON.stringify(first.set) === JSON.stringify(again.set),
      ],
      [
        "anotherSeedMovesTheRing",
        () => JSON.stringify(first.set) !== JSON.stringify(reseeded.set),
      ],
      [
        "theReseededRingAlsoValidates",
        () =>
          validatePropPlacements({
            props: reseeded.specs,
            set: reseeded.set,
            builtEnvironments: [environment],
          }).success,
      ],
      [
        "sameSeedSameSpecs",
        () => JSON.stringify(first.specs) === JSON.stringify(again.specs),
      ],
    ]),
    {
      theRingValidates: true,
      sameSeedSameBytes: true,
      anotherSeedMovesTheRing: true,
      theReseededRingAlsoValidates: true,
      sameSeedSameSpecs: true,
    },
  );
};
