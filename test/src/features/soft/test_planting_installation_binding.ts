import {
  lowerPlantingInstallation,
  validatePlantingInstallations,
} from "@automovie/engine";
import {
  IAutoMovieFluidDomain,
  IAutoMoviePlantingCluster,
  IAutoMoviePlantingDomain,
  IAutoMoviePlantingInstallation,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation, namedFacts } from "../internal/predicates";
import {
  plantingCluster,
  plantingInstallation,
  plantingRecipe,
  roomEnvironment,
} from "../internal/softFixtures";

/** A pond the aquatic cases stand in: one metre of water over a flat bed. */
const pond = (
  overrides: Partial<IAutoMovieFluidDomain> = {},
): IAutoMovieFluidDomain => ({
  version: 1,
  id: "atrium-pond",
  units: "meter",
  grid: {
    columns: 4,
    rows: 4,
    cellX: 1,
    cellZ: 1,
    origin: { x: -2, y: -1, z: -2 },
  },
  solver: {
    fixedStepSeconds: 0.03125,
    gravity: 8,
    drag: 0,
    dryDepth: 0,
    referenceDepth: 2,
    maxSteps: 100,
  },
  boundaries: { xMin: "wall", xMax: "wall", zMin: "wall", zMax: "wall" },
  bed: new Array(16).fill(0),
  depth: new Array(16).fill(1.5),
  solid: new Array(16).fill(false),
  sources: [],
  drains: [],
  sprays: [],
  ...overrides,
});

const check = (props: {
  installations?: IAutoMoviePlantingInstallation[];
  clusters?: IAutoMoviePlantingCluster[];
  domains?: IAutoMoviePlantingDomain[];
  fluidDomains?: IAutoMovieFluidDomain[];
  semantic?: boolean;
}) =>
  validatePlantingInstallations({
    environment: roomEnvironment({ semantic: props.semantic }),
    installations: props.installations ?? [plantingInstallation()],
    clusters: props.clusters ?? [plantingCluster()],
    domains: props.domains ?? [plantingRecipe()],
    fluidDomains: props.fluidDomains,
  });

/**
 * The binding between a building and a planting cluster resolves, its typed
 * rules hold, and what could not be derived is reported rather than drawn.
 *
 * This is the seam where three independent records meet — the building graph,
 * the branching recipe and the arrangement — so it is the only place their
 * agreement can be checked. The rules it enforces are the ones no single record
 * can: that a green wall is trained against something upright rather than
 * resting on a floor patch, that aquatic planting really stands in water and
 * that dry planting does not claim to, and that the members the arrangement
 * generated actually land inside the room they were bound to.
 *
 * Scenarios:
 *
 * 1. A complete installation validates clean, and so does one with no irrigation
 *    at all: a dry binding is a legitimate authoring state a services pass
 *    needs to see, not a silent failure.
 * 2. Every reference is checked: a wrong environment, an unknown space, an unknown
 *    support of each of the three kinds, an unknown irrigation port, an
 *    unsupplied cluster, an unsupplied recipe, and duplicated recipe, cluster
 *    and installation ids.
 * 3. The typed rules: an unknown kind, an unknown medium, a non-positive demand, a
 *    green wall carried by a floor patch, aquatic planting with no fluid
 *    domain, dry planting citing one, and a cited fluid domain nobody
 *    supplied.
 * 4. Aquatic geometry: a member rooted below the authored free surface is
 *    accepted, one rooted above it is refused with the overshoot measured, and
 *    one standing outside the lattice entirely is named as such rather than
 *    read off the edge of an array.
 * 5. Containment: members landing outside the room are refused, while a purely
 *    semantic space with no convex cells is not geometrically checked at all.
 * 6. A recipe's or a cluster's own refusal is re-pathed onto the binding, and the
 *    lowering reports `not-run` with no geometry for either, `derived`
 *    otherwise — one structure grown and every member instancing it.
 */
export const test_planting_installation_binding = (): void => {
  TestValidator.equals(
    "a complete installation validates clean, with or without a supply",
    namedFacts([
      ["watered", () => check({}).success === true],
      [
        "dry",
        () =>
          check({
            installations: [plantingInstallation({ irrigation: null })],
          }).success === true,
      ],
    ]),
    { watered: true, dry: true },
  );

  TestValidator.equals(
    "every reference is checked",
    namedFacts([
      [
        "environment",
        () =>
          hasViolation(
            check({
              installations: [plantingInstallation({ environment: "other" })],
            }),
            "type",
            "installations[0].environment",
          ),
      ],
      [
        "space",
        () =>
          hasViolation(
            check({
              installations: [plantingInstallation({ space: "attic" })],
            }),
            "type",
            "installations[0].space",
          ),
      ],
      [
        "surface",
        () =>
          hasViolation(
            check({
              installations: [
                plantingInstallation({
                  support: { kind: "surface", surface: "terrace" },
                }),
              ],
            }),
            "type",
            "installations[0].support.surface",
          ),
      ],
      [
        "element",
        () =>
          hasViolation(
            check({
              installations: [
                plantingInstallation({
                  support: { kind: "element", element: "shelf" },
                }),
              ],
            }),
            "type",
            "installations[0].support.element",
          ),
      ],
      [
        "boundary",
        () =>
          hasViolation(
            check({
              installations: [
                plantingInstallation({
                  kind: "green-wall",
                  support: { kind: "boundary", boundary: "party-wall" },
                }),
              ],
            }),
            "type",
            "installations[0].support.boundary",
          ),
      ],
      [
        "port",
        () =>
          hasViolation(
            check({
              installations: [
                plantingInstallation({
                  irrigation: {
                    port: "hydrant",
                    demandLitresPerDay: 4,
                    medium: "potable",
                    fluidDomain: null,
                  },
                }),
              ],
            }),
            "type",
            "installations[0].irrigation.port",
          ),
      ],
      [
        "cluster",
        () =>
          hasViolation(
            check({
              installations: [plantingInstallation({ cluster: "absent" })],
            }),
            "type",
            "installations[0].cluster",
          ),
      ],
      [
        "recipe",
        () =>
          hasViolation(
            check({ clusters: [plantingCluster({ domain: "absent" })] }),
            "type",
            "clusters[0].domain",
          ),
      ],
      [
        "duplicateRecipe",
        () =>
          hasViolation(
            check({ domains: [plantingRecipe(), plantingRecipe()] }),
            "type",
            "domains[1].id",
          ),
      ],
      [
        "duplicateCluster",
        () =>
          hasViolation(
            check({ clusters: [plantingCluster(), plantingCluster()] }),
            "type",
            "clusters[1].id",
          ),
      ],
      [
        "duplicateInstallation",
        () =>
          hasViolation(
            check({
              installations: [plantingInstallation(), plantingInstallation()],
            }),
            "type",
            "installations[1].id",
          ),
      ],
      [
        "blankInstallation",
        () =>
          hasViolation(
            check({ installations: [plantingInstallation({ id: " " })] }),
            "type",
            "installations[0].id",
          ),
      ],
    ]),
    {
      environment: true,
      space: true,
      surface: true,
      element: true,
      boundary: true,
      port: true,
      cluster: true,
      recipe: true,
      duplicateRecipe: true,
      duplicateCluster: true,
      duplicateInstallation: true,
      blankInstallation: true,
    },
  );

  TestValidator.equals(
    "the typed rules hold",
    namedFacts([
      [
        "kind",
        () =>
          hasViolation(
            check({
              installations: [
                plantingInstallation({
                  kind: "hydroponic" as unknown as "potted",
                }),
              ],
            }),
            "type",
            "installations[0].kind",
          ),
      ],
      [
        "medium",
        () =>
          hasViolation(
            check({
              installations: [
                plantingInstallation({
                  irrigation: {
                    port: "stand-pipe",
                    demandLitresPerDay: 4,
                    medium: "brine" as unknown as "potable",
                    fluidDomain: null,
                  },
                }),
              ],
            }),
            "type",
            "installations[0].irrigation.medium",
          ),
      ],
      [
        "demand",
        () =>
          hasViolation(
            check({
              installations: [
                plantingInstallation({
                  irrigation: {
                    port: "stand-pipe",
                    demandLitresPerDay: 0,
                    medium: "potable",
                    fluidDomain: null,
                  },
                }),
              ],
            }),
            "range",
            "installations[0].irrigation.demandLitresPerDay",
          ),
      ],
      [
        "greenWallOnFloor",
        () =>
          hasViolation(
            check({
              installations: [plantingInstallation({ kind: "green-wall" })],
            }),
            "type",
            "installations[0].support",
          ),
      ],
      [
        "greenWallOnBoundary",
        () =>
          check({
            installations: [
              plantingInstallation({
                kind: "green-wall",
                support: { kind: "boundary", boundary: "window-wall" },
              }),
            ],
          }).success === true,
      ],
      [
        "aquaticWithoutWater",
        () =>
          hasViolation(
            check({
              installations: [plantingInstallation({ kind: "aquatic" })],
            }),
            "type",
            "installations[0].irrigation",
          ),
      ],
      [
        "dryWithWater",
        () =>
          hasViolation(
            check({
              installations: [
                plantingInstallation({
                  irrigation: {
                    port: "stand-pipe",
                    demandLitresPerDay: 4,
                    medium: "pond",
                    fluidDomain: "atrium-pond",
                  },
                }),
              ],
              fluidDomains: [pond()],
            }),
            "type",
            "installations[0].irrigation.fluidDomain",
          ),
      ],
      [
        "unsuppliedWater",
        () =>
          hasViolation(
            check({
              installations: [
                plantingInstallation({
                  kind: "aquatic",
                  irrigation: {
                    port: "stand-pipe",
                    demandLitresPerDay: 4,
                    medium: "pond",
                    fluidDomain: "atrium-pond",
                  },
                }),
              ],
            }),
            "type",
            "installations[0].irrigation.fluidDomain",
          ),
      ],
    ]),
    {
      kind: true,
      medium: true,
      demand: true,
      greenWallOnFloor: true,
      greenWallOnBoundary: true,
      aquaticWithoutWater: true,
      dryWithWater: true,
      unsuppliedWater: true,
    },
  );

  const aquatic = (anchor: { x: number; y: number; z: number }) => ({
    installations: [
      plantingInstallation({
        kind: "aquatic" as const,
        irrigation: {
          port: "stand-pipe",
          demandLitresPerDay: 4,
          medium: "pond" as const,
          fluidDomain: "atrium-pond",
        },
      }),
    ],
    clusters: [
      plantingCluster({ count: 3, anchor, extent: { x: 0.5, z: 0.5 } }),
    ],
    fluidDomains: [pond()],
  });
  TestValidator.equals(
    "aquatic planting is checked against the water it stands in",
    namedFacts([
      [
        "submerged",
        () => check(aquatic({ x: 0, y: 0, z: 0 })).success === true,
      ],
      [
        "aboveSurface",
        () =>
          hasViolation(
            check(aquatic({ x: 0, y: 1, z: 0 })),
            "range",
            "installations[0].irrigation.fluidDomain",
          ),
      ],
      [
        "outsideLattice",
        () =>
          hasViolation(
            check(aquatic({ x: 5, y: 0, z: 0 })),
            "type",
            "installations[0].irrigation.fluidDomain",
          ),
      ],
    ]),
    { submerged: true, aboveSurface: true, outsideLattice: true },
  );

  TestValidator.equals(
    "containment is checked only where the space has a volume",
    namedFacts([
      [
        "outside",
        () =>
          hasViolation(
            check({
              clusters: [
                plantingCluster({ anchor: { x: 40, y: 0, z: 0 }, count: 2 }),
              ],
            }),
            "type",
            "installations[0].cluster",
          ),
      ],
      [
        "semantic",
        () =>
          check({
            clusters: [
              plantingCluster({ anchor: { x: 40, y: 0, z: 0 }, count: 2 }),
            ],
            semantic: true,
          }).success === true,
      ],
    ]),
    { outside: true, semantic: true },
  );

  const brokenRecipe = plantingRecipe({
    structure: { ...plantingRecipe().structure, length: 0 },
  });
  const brokenCluster = plantingCluster({ count: 0 });
  const derived = lowerPlantingInstallation({
    installation: plantingInstallation(),
    cluster: plantingCluster(),
    domain: plantingRecipe(),
  });
  TestValidator.equals(
    "a nested refusal is re-pathed, and the lowering reports what it derived",
    namedFacts([
      [
        "recipeRepathed",
        () =>
          hasViolation(
            check({ domains: [brokenRecipe] }),
            "range",
            "domains[0].structure.length",
          ),
      ],
      [
        "clusterRepathed",
        () =>
          hasViolation(
            check({ clusters: [brokenCluster] }),
            "type",
            "clusters[0].count",
          ),
      ],
      [
        "notRunRecipe",
        () => {
          const frame = lowerPlantingInstallation({
            installation: plantingInstallation(),
            cluster: plantingCluster(),
            domain: brokenRecipe,
          });
          return (
            frame.analysis.status === "not-run" &&
            frame.plant === null &&
            frame.arrangement === null &&
            frame.analysis.reason !== null
          );
        },
      ],
      [
        "notRunCluster",
        () => {
          const frame = lowerPlantingInstallation({
            installation: plantingInstallation(),
            cluster: brokenCluster,
            domain: plantingRecipe(),
          });
          return frame.analysis.status === "not-run" && frame.plant === null;
        },
      ],
      [
        "derived",
        () =>
          derived.analysis.status === "derived" &&
          derived.analysis.kind === "planting" &&
          derived.analysis.reason === null &&
          derived.plant?.branches.length === 7 &&
          derived.arrangement?.placements.length === 6,
      ],
      ["installation", () => derived.installation === "lobby-planting"],
    ]),
    {
      recipeRepathed: true,
      clusterRepathed: true,
      notRunRecipe: true,
      notRunCluster: true,
      derived: true,
      installation: true,
    },
  );
};
