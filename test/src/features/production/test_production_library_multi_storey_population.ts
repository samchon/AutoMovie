import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieLibraryRequiredObservation,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { twoStoreyBuilding } from "../internal/envelopeFixtures";
import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

const unit = loadSourceModule<{
  autoMovieLibraryObservationRequirements: (
    environments: readonly IAutoMovieBuiltEnvironment[],
  ) => IAutoMovieLibraryRequiredObservation[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/libraryObservationRequirements.ts",
  ),
);

/**
 * A building with two storeys owes both of them.
 *
 * Every envelope fixture beside this one is a single room under a single set of
 * four walls, so nothing said what happens when a unit owns more than one space
 * and its envelope is stacked. The benchmark's own inputs are two-storey
 * houses, which is why this is the shape that had to be read.
 *
 * The building's own space encloses and states no volume, so it is charged no
 * interior station of its own and the two storeys under it are the rooms that
 * answer. That is what a container should do here: a house is not a room, and a
 * derivation that charged it as one would ask for nine views of a volume nobody
 * built.
 *
 * Scenarios:
 *
 * 1. Each storey is charged its own interior population, so the totals are per
 *    room rather than per building.
 * 2. The stacked envelope is charged per storey too: eight facade faces where a
 *    single-storey hall has four, and the corners they meet at.
 * 3. The container space is charged nothing, because it states no volume.
 * 4. The stair lands twice in one connector at two heights, and the two
 *    landings are separate addresses. Addressing a landing by its space alone
 *    would collapse them, and a lift serving one atrium at three levels would
 *    read complete having been looked at on one floor.
 * 5. Every observation is attributed to the one building, including the ones
 *    derived from a space the building's own record does not name directly.
 * 6. A connector between two buildings charges each endpoint to its own unit
 *    under a distinct observation id.
 */
export const test_production_library_multi_storey_population = (): void => {
  const derived = unit.autoMovieLibraryObservationRequirements([
    twoStoreyBuilding(),
  ]);

  const containerPopulation = twoStoreyBuilding();
  containerPopulation.populations = [
    {
      space: "house-interior",
      prototypeBounds: {
        min: { x: -0.5, y: 0, z: -0.5 },
        max: { x: 0.5, y: 1, z: 0.5 },
      },
      set: {
        id: "roof-markers",
        modelRecipe: "marker",
        count: 2,
        layout: {
          kind: "grid",
          rows: 1,
          columns: 2,
          spacing: { x: 1, z: 1 },
        },
        anchor: { x: 0, y: 6, z: 0 },
        facingDeg: 0,
        seed: 17,
        variation: {
          scale: { min: 1, max: 1 },
          palette: [],
          traits: [],
        },
      },
    },
  ];
  const withContainerPopulation = unit.autoMovieLibraryObservationRequirements([
    containerPopulation,
  ]);

  // An operable hatch cut through the slab between the storeys. It is not an
  // entrance -- nothing enters the building through it -- and attributing an
  // opening by the building's entrance list therefore charged nothing for it,
  // which in a house is what happens to most of the doors.
  const hatched = twoStoreyBuilding();
  hatched.openings.push({
    id: "loft-hatch",
    kind: "hatch",
    boundary: "storey-slab",
    fill: null,
    profile: {
      outline: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
    },
    operation: {
      panels: [
        {
          id: "lid",
          element: "house-root",
          width: 1,
          height: 1,
          motion: {
            kind: "revolute",
            axis: { x: 1, y: 0, z: 0 },
            pivot: { x: 1, y: 3, z: 1 },
            min: 0,
            max: 90,
          },
        },
      ],
      states: [
        { id: "shut", panels: [{ panel: "lid", value: 0 }] },
        { id: "lifted", panels: [{ panel: "lid", value: 90 }] },
      ],
      state: "shut",
      hardware: [],
    },
  });
  const withHatch = unit.autoMovieLibraryObservationRequirements([hatched]);
  const linkedAll = unit.autoMovieLibraryObservationRequirements([
    {
      version: 1,
      id: "linked",
      units: "meter",
      buildings: [
        { id: "west", element: "west-root", space: "west-space" },
        { id: "east", element: "east-root", space: "east-space" },
      ],
      models: [],
      modelReferences: [],
      elements: [
        {
          id: "west-root",
          kind: "building",
          parent: null,
          transform: {
            translation: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
          model: null,
          space: "west-space",
        },
        {
          id: "east-root",
          kind: "building",
          parent: null,
          transform: {
            translation: { x: 10, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
          model: null,
          space: "east-space",
        },
      ],
      spaces: [
        { id: "west-space", kind: "building", parent: null, cells: [] },
        { id: "east-space", kind: "building", parent: null, cells: [] },
      ],
      boundaries: [
        {
          id: "shared-wall",
          kind: "wall",
          spaces: ["west-space", "east-space"],
          elements: [],
          face: {
            origin: { x: 5, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            outline: [
              { x: 0, y: 0 },
              { x: 2, y: 0 },
              { x: 2, y: 2 },
              { x: 0, y: 2 },
            ],
            thickness: 0.2,
          },
        },
      ],
      openings: [
        {
          id: "shared-door",
          kind: "door",
          boundary: "shared-wall",
          fill: null,
          profile: {
            outline: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 1, y: 2 },
              { x: 0, y: 2 },
            ],
          },
          operation: {
            panels: [
              {
                id: "leaf",
                element: "west-root",
                width: 1,
                height: 2,
                motion: {
                  kind: "revolute",
                  axis: { x: 0, y: 1, z: 0 },
                  pivot: { x: 5, y: 0, z: 0 },
                  min: 0,
                  max: 90,
                },
              },
            ],
            states: [
              { id: "closed", panels: [{ panel: "leaf", value: 0 }] },
              { id: "open", panels: [{ panel: "leaf", value: 90 }] },
            ],
            state: "closed",
            hardware: [],
          },
        },
      ],
      connectors: [
        {
          id: "bridge",
          kind: "bridge",
          from: "west-space",
          to: "east-space",
          bidirectional: true,
          route: [
            { x: 0, y: 1, z: 0 },
            { x: 10, y: 1, z: 0 },
          ],
          elements: [],
        },
      ],
      surfaces: [],
      walkable: [],
    },
  ]);
  const linked = linkedAll.filter((entry) => entry.role === "service-landing");
  const linkedOpening = linkedAll.filter((entry) =>
    entry.role.startsWith("operation-"),
  );
  const count = (role: string): number =>
    derived.filter((entry) => entry.role === role).length;

  TestValidator.equals(
    "a two-storey building is charged for both of its storeys",
    namedFacts([
      [
        // Four from each room's centre along the cardinals, four from its own
        // corners looking inward, for two rooms.
        "eachStoreyIsChargedItsOwnInterior",
        () => count("interior-center") === 8 && count("interior-corner") === 8,
      ],
      [
        // One door, in the ground storey's south wall.
        "theOneThresholdIsCharged",
        () => count("interior-threshold") === 1,
      ],
      [
        // The stacked envelope: four wall faces per storey, one roof over the
        // top and one underside beneath the bottom, and the setting view once.
        "theStackedEnvelopeIsChargedPerStorey",
        () =>
          count("facade") === 8 &&
          count("roof") === 1 &&
          count("underside") === 1 &&
          count("context") === 1 &&
          count("entrance") === 1,
      ],
      [
        // The container states no volume, so no station derives from it and no
        // interior observation names it as the space an eye stood in.
        "theContainerSpaceIsChargedNothing",
        () =>
          derived.some(
            (entry) =>
              entry.subject.includes("house-interior") ||
              entry.pose?.space === "house-interior",
          ) === false,
      ],
      [
        // A semantic container can still own things. Space ownership follows
        // the building tree, not only the subset whose cells produce interior
        // camera stations.
        "aPopulationInTheVolumeLessContainerStillBelongsToTheBuilding",
        () =>
          withContainerPopulation.filter((entry) =>
            entry.role.startsWith("instance-"),
          ).length === 3 &&
          withContainerPopulation
            .filter((entry) => entry.role.startsWith("instance-"))
            .every((entry) => entry.building === "house"),
      ],
      [
        // Two landings, one connector, two heights, two addresses.
        "theStairLandsTwiceAtTwoAddresses",
        () =>
          derived
            .filter((entry) => entry.role === "service-landing")
            .map((entry) => entry.id)
            .sort((left, right) => (left < right ? -1 : 1))
            .join(" ") ===
          "service:storey-house/stair/house/service-landing/ground@0 service:storey-house/stair/house/service-landing/upper@3",
      ],
      [
        "aConnectorBetweenBuildingsHasOneDistinctLandingPerOwner",
        () =>
          linked.map((entry) => `${entry.id}:${entry.building}`).join(" ") ===
          "service:linked/bridge/east/service-landing/east-space@to:east service:linked/bridge/west/service-landing/west-space@from:west",
      ],
      [
        "anOpeningBetweenBuildingsHasDistinctRequirementsForBothOwners",
        () =>
          linkedOpening.length === 8 &&
          new Set(linkedOpening.map((entry) => entry.id)).size === 8 &&
          linkedOpening.filter((entry) => entry.building === "east").length ===
            4 &&
          linkedOpening.filter((entry) => entry.building === "west").length ===
            4,
      ],
      [
        // Including the ones derived from `upper`, which the building record
        // names only through its container.
        "everythingIsOwedByTheOneBuilding",
        () => derived.every((entry) => entry.building === "house"),
      ],
      [
        // Six, in two kinds. Four are the hatch as a working thing -- two
        // states, the one travel between them, and the panel that moves -- and
        // those are the four that were charged to nothing before, because the
        // hatch is not an entrance and the attribution read the entrance list.
        // The other two are the hatch as a way through: a threshold station
        // from each storey it joins, which the interior derivation charges for
        // any opening either room can be looked at through.
        "anInteriorOperableOpeningIsChargedTwice",
        () =>
          withHatch.length === derived.length + 6 &&
          withHatch.filter(
            (entry) =>
              entry.role.startsWith("operation-") &&
              entry.subject.includes("loft-hatch"),
          ).length === 4 &&
          withHatch
            .filter((entry) => entry.id.includes("threshold-loft-hatch"))
            .map((entry) => entry.subject)
            .sort((left, right) => (left < right ? -1 : 1))
            .join(" ") ===
            "space:storey-house/ground space:storey-house/upper" &&
          // The front door is unaffected: attributing by the boundary's space
          // resolves an envelope opening exactly as the entrance list did.
          withHatch.every((entry) => entry.building === "house"),
      ],
    ]),
    {
      eachStoreyIsChargedItsOwnInterior: true,
      theOneThresholdIsCharged: true,
      theStackedEnvelopeIsChargedPerStorey: true,
      theContainerSpaceIsChargedNothing: true,
      aPopulationInTheVolumeLessContainerStillBelongsToTheBuilding: true,
      theStairLandsTwiceAtTwoAddresses: true,
      aConnectorBetweenBuildingsHasOneDistinctLandingPerOwner: true,
      anOpeningBetweenBuildingsHasDistinctRequirementsForBothOwners: true,
      everythingIsOwedByTheOneBuilding: true,
      anInteriorOperableOpeningIsChargedTwice: true,
    },
  );
};
