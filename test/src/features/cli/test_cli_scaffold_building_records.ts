import type { IAutoMovieBuiltEnvironment } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { rectangularBuilding } from "../internal/envelopeFixtures";
import { namedFacts } from "../internal/predicates";
import { requireSourceModule } from "../internal/requireSourceModule";

interface IBuildingRecord {
  environment: IAutoMovieBuiltEnvironment;
  source: "materialized" | "staged";
}

const unit = requireSourceModule<{
  collectAutoMovieBuildingRecords: (props: {
    materialized: readonly IAutoMovieBuiltEnvironment[];
    staged: readonly IAutoMovieBuiltEnvironment[];
  }) => IBuildingRecord[];
  collectAutoMovieMaterializedEnvironments: (props: {
    owners: ReadonlyArray<{
      branch: string;
      path: string;
      units: ReadonlyArray<{ anchor: string }>;
    }>;
    resolve: (request: {
      branch: string;
      owner: string;
      anchor: string;
    }) => readonly IAutoMovieBuiltEnvironment[];
  }) => IAutoMovieBuiltEnvironment[];
  describeAutoMovieBuildingRecords: (
    records: readonly IBuildingRecord[],
  ) => string;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/buildingRecords.ts",
  ),
  [
    "collectAutoMovieBuildingRecords",
    "collectAutoMovieMaterializedEnvironments",
    "describeAutoMovieBuildingRecords",
  ],
);

/** One building record under a chosen id, with a marker to tell copies apart. */
const named = (id: string, door: string): IAutoMovieBuiltEnvironment => {
  const environment = rectangularBuilding();
  environment.id = id;
  environment.openings[0]!.id = door;
  return environment;
};

/**
 * Which building record the report draws, when a production holds two of one.
 *
 * A production may hold both: a library owner publishes a building and a shot
 * stages the same one to film it. `deriveBuilding.ts` opens project state at
 * module level and refuses unless it is current, so nothing could load it to
 * see which record wins a collision -- the rule that decides it, and the tally
 * a reviewer reads afterwards, went unread.
 *
 * Scenarios:
 *
 * 1. Each provenance is carried on its own record, so the report can say which
 *    it drew and a reviewer can tell the frames apart from the drawings.
 * 2. One id held by both is taken once, and the staged record wins: it is the
 *    one a frame was actually drawn from, and preferring the other would
 *    describe a building nobody photographed.
 * 3. The order is by id, so re-deriving an unchanged production writes the same
 *    sheets in the same order.
 * 4. The tally names both counts, including the zero, because "none
 *    materialized" and "not looked for" read the same to anyone who is only
 *    shown the number that is not zero.
 */
export const test_cli_scaffold_building_records = (): void => {
  const mixed = unit.collectAutoMovieBuildingRecords({
    materialized: [named("hall", "library-door"), named("annex", "a")],
    staged: [named("hall", "staged-door"), named("tower", "t")],
  });

  TestValidator.equals(
    "a building held twice is drawn once, from the record a frame came from",
    namedFacts([
      [
        "eachProvenanceIsCarriedOnItsOwnRecord",
        () =>
          mixed
            .map((entry) => `${entry.environment.id}:${entry.source}`)
            .join(" ") === "annex:materialized hall:staged tower:staged",
      ],
      [
        // The marker says which of the two `hall` records survived. Preferring
        // the library's would draw a building nobody photographed.
        "theStagedRecordWinsTheCollision",
        () =>
          mixed.find((entry) => entry.environment.id === "hall")?.environment
            .openings[0]?.id === "staged-door",
      ],
      [
        "theOrderIsByIdSoAnUnchangedProductionRedrawsTheSame",
        () =>
          JSON.stringify(mixed.map((entry) => entry.environment.id)) ===
          JSON.stringify(
            [...mixed]
              .map((entry) => entry.environment.id)
              .sort((left, right) => (left < right ? -1 : 1)),
          ),
      ],
      [
        // The address every other caller of the reader uses. Passing the
        // document path alone matched nothing, every time, in silence -- which
        // is what this command did until it was measured.
        "eachOwnerIsAddressedByItsFullPathAndAnchor",
        () => {
          const asked: string[] = [];
          unit.collectAutoMovieMaterializedEnvironments({
            owners: [
              {
                branch: "spaces",
                path: "docs/spaces/hall.md",
                units: [{ anchor: "hall-delivery" }, { anchor: "hall-annex" }],
              },
            ],
            resolve: (request) => {
              asked.push(request.owner);
              return [];
            },
          });
          return (
            asked.join(" ") ===
            "docs/spaces/hall.md#hall-delivery docs/spaces/hall.md#hall-annex"
          );
        },
      ],
      [
        // Two owners naming one building id. The compiler refuses duplicate
        // publication at its own address; a report that drew both would put one
        // sheet on the page twice and double its take-off.
        "oneBuildingIdIsGatheredOnce",
        () =>
          unit.collectAutoMovieMaterializedEnvironments({
            owners: [
              { branch: "spaces", path: "a.md", units: [{ anchor: "one" }] },
              { branch: "spaces", path: "b.md", units: [{ anchor: "two" }] },
            ],
            resolve: () => [named("hall", "d")],
          }).length === 1,
      ],
      [
        "theTallyNamesBothCountsIncludingTheZero",
        () =>
          unit.describeAutoMovieBuildingRecords(mixed) ===
            "3 building record(s): 2 staged by a shot, 1 materialized by a library and photographed by nothing" &&
          unit.describeAutoMovieBuildingRecords(
            unit.collectAutoMovieBuildingRecords({
              materialized: [],
              staged: [named("hall", "d")],
            }),
          ) ===
            "1 building record(s): 1 staged by a shot, 0 materialized by a library and photographed by nothing",
      ],
    ]),
    {
      eachProvenanceIsCarriedOnItsOwnRecord: true,
      theStagedRecordWinsTheCollision: true,
      theOrderIsByIdSoAnUnchangedProductionRedrawsTheSame: true,
      eachOwnerIsAddressedByItsFullPathAndAnchor: true,
      oneBuildingIdIsGatheredOnce: true,
      theTallyNamesBothCountsIncludingTheZero: true,
    },
  );
};
