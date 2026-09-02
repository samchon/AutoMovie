import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieLibraryRequiredObservation,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { twoStoreyBuilding } from "../internal/envelopeFixtures";
import { namedFacts } from "../internal/predicates";
import { requireSourceModule } from "../internal/requireSourceModule";

const unit = requireSourceModule<{
  autoMovieLibraryObservationRequirements: (
    environments: readonly IAutoMovieBuiltEnvironment[],
  ) => IAutoMovieLibraryRequiredObservation[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/libraryObservationRequirements.ts",
  ),
  ["autoMovieLibraryObservationRequirements"],
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
 */
export const test_production_library_multi_storey_population = (): void => {
  const derived = unit.autoMovieLibraryObservationRequirements([
    twoStoreyBuilding(),
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
        // observation names it as the space an eye stood in.
        "theContainerSpaceIsChargedNothing",
        () =>
          derived.some(
            (entry) =>
              entry.subject.includes("house-interior") ||
              entry.pose?.space === "house-interior",
          ) === false,
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
          "service:storey-house/stair/service-landing/ground@0 service:storey-house/stair/service-landing/upper@3",
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
      [
        // Read once so a change to any rule above shows here as well as in its
        // own fact. Forty-seven is what a two-room house with one door and one
        // stair costs, and it is worth knowing that the number is this size.
        "theWholeHouseIsFortySeven",
        () => derived.length === 47,
      ],
    ]),
    {
      eachStoreyIsChargedItsOwnInterior: true,
      theOneThresholdIsCharged: true,
      theStackedEnvelopeIsChargedPerStorey: true,
      theContainerSpaceIsChargedNothing: true,
      theStairLandsTwiceAtTwoAddresses: true,
      everythingIsOwedByTheOneBuilding: true,
      anInteriorOperableOpeningIsChargedTwice: true,
      theWholeHouseIsFortySeven: true,
    },
  );
};
