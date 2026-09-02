import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieEnvironmentContext,
  IAutoMovieLibraryRequiredObservation,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { analysisContext } from "../internal/analysisFixtures";
import { rectangularBuilding } from "../internal/envelopeFixtures";
import { namedFacts } from "../internal/predicates";
import { requireSourceModule } from "../internal/requireSourceModule";

const unit = requireSourceModule<{
  autoMovieLibraryObservationRequirements: (
    environments: readonly IAutoMovieBuiltEnvironment[],
    contexts?: readonly IAutoMovieEnvironmentContext[],
  ) => IAutoMovieLibraryRequiredObservation[];
  libraryObservationClosureDiagnostics: (props: {
    target: string;
    path: string;
    required: readonly IAutoMovieLibraryRequiredObservation[];
    declared: readonly string[];
    waivers: readonly [];
  }) => Array<{ message: string }>;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/libraryObservationRequirements.ts",
  ),
  [
    "autoMovieLibraryObservationRequirements",
    "libraryObservationClosureDiagnostics",
  ],
);

/**
 * What a map owner owes, and what it does not make anybody else owe.
 *
 * `docs/requirements/review/subject-inspection.md#review-library-delivery-coverage`
 * requires a map observation that can falsify the current world, and requires
 * that no empty population be reported as complete. Both were violated at once
 * and silently: the derivation read only built environments, a map owner
 * contributed none, and an empty required population passes every check that
 * compares against it -- the owner declared one observation of its own choosing
 * and was complete, whatever that observation was.
 *
 * The world is now an owner's contribution rather than a production-wide
 * design field. That is the part that makes the population per-owner: the
 * design carries exactly one `environmentContext` for the whole production and
 * nobody contributes it, so charging map owners against it would have made two
 * map owners each owe one adopted world twice over.
 *
 * Scenarios:
 *
 * 1. An owner that adopted a world owes exactly one observation of its datum.
 * 2. An owner that adopted none owes none, and adopting one adds nothing to
 *    what a building charges.
 * 3. The refusal names the subject and omits the building clause, because a map
 *    requirement descends from no building and a reader told the building is
 *    `site` would go looking for a building by that name.
 * 4. Neighbouring masses and declared instants add nothing. The record calls
 *    occluders read-only, never owned geometry, and charging an owner to
 *    photograph what it does not own is a reason that stops being true on
 *    another host; instants are weather, which the requirement does not name
 *    among the six things a map observation must be able to falsify.
 */
export const test_production_library_map_population = (): void => {
  const context = analysisContext();
  const buildingOnly = unit.autoMovieLibraryObservationRequirements([
    rectangularBuilding(),
  ]);
  const mapOnly = unit.autoMovieLibraryObservationRequirements([], [context]);
  const both = unit.autoMovieLibraryObservationRequirements(
    [rectangularBuilding()],
    [context],
  );
  const refusal = unit.libraryObservationClosureDiagnostics({
    target: "library:maps:docs/maps/site.md#site",
    path: "docs/maps/site.review.json",
    required: mapOnly,
    declared: [],
    waivers: [],
  });

  TestValidator.equals(
    "a map owner owes its adopted world and charges nobody else",
    namedFacts([
      [
        "anAdoptedWorldIsOneObservationOfItsDatum",
        () =>
          mapOnly
            .map((entry) => `${entry.role} ${entry.subject} ${entry.origin}`)
            .join(" ") === "map-datum map:site datum",
      ],
      [
        // The design carries one context for the whole production and nobody
        // contributes it. Charging against that one would make two map owners
        // each owe the same adopted world.
        "anOwnerThatAdoptedNoWorldOwesNoMapObservation",
        () =>
          buildingOnly.some((entry) => entry.role === "map-datum") === false,
      ],
      [
        // A world with three instants and two neighbouring masses owes one
        // observation, the same as a bare one. A role derived from a
        // definition this deriver invented would measure the deriver.
        "aCrowdedWorldOwesNoMoreThanABareOne",
        () =>
          unit.autoMovieLibraryObservationRequirements(
            [],
            [
              analysisContext({
                occluders: [
                  {
                    id: "neighbour-tower",
                    kind: "neighbour-tower",
                    planes: [],
                  },
                  { id: "boundary-wall", kind: "boundary-wall", planes: [] },
                ],
              }),
            ],
          ).length === mapOnly.length,
      ],
      [
        "adoptingAWorldAddsExactlyOneToWhatABuildingCharges",
        () => both.length === buildingOnly.length + 1,
      ],
      [
        // A map requirement descends from no building, and a reader told the
        // building is `site` would go looking for a building by that name.
        "aMapRequirementDescendsFromNoBuilding",
        () => mapOnly.every((entry) => entry.building === null),
      ],
      [
        "theRefusalNamesTheSubjectAndClaimsNoBuilding",
        () =>
          refusal.length === 1 &&
          refusal[0]!.message.includes('compiled subject "map:site"') &&
          refusal[0]!.message.includes("in building") === false,
      ],
      [
        // The empty population is what the requirement forbids being reported
        // as complete, and it is exactly what an owner with no contribution
        // still produces -- correctly, because it contributed nothing.
        "anOwnerThatContributedNothingStillDerivesNothing",
        () => unit.autoMovieLibraryObservationRequirements([]).length === 0,
      ],
    ]),
    {
      anAdoptedWorldIsOneObservationOfItsDatum: true,
      anOwnerThatAdoptedNoWorldOwesNoMapObservation: true,
      aCrowdedWorldOwesNoMoreThanABareOne: true,
      adoptingAWorldAddsExactlyOneToWhatABuildingCharges: true,
      aMapRequirementDescendsFromNoBuilding: true,
      theRefusalNamesTheSubjectAndClaimsNoBuilding: true,
      anOwnerThatContributedNothingStillDerivesNothing: true,
    },
  );
};
