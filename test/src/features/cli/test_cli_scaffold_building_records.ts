import type { IAutoMovieBuiltEnvironment } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { rectangularBuilding } from "../internal/envelopeFixtures";
import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

interface IBuildingRecord {
  environment: IAutoMovieBuiltEnvironment;
  source: "materialized" | "staged";
}

const unit = loadSourceModule<{
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
  describeAutoMovieBuildingGaps: (
    gaps: ReadonlyArray<{
      status: string;
      subject: string;
      reason: string;
      remedy: string;
    }>,
  ) => string[];
  describeAutoMovieBuildingReport: (props: {
    gaps: number;
    id: string;
    networks: number;
    quantitySubjects: number;
    runs: number;
    schedules: ReadonlyArray<{ subject: string; total: number }>;
    sheets: number;
    source: "materialized" | "staged";
  }) => readonly [string, string];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/buildingRecords.ts",
  ),
);

const NEWLINE = String.fromCharCode(10);

/** One gap of the kind every sheet declares, so copies of it can be counted. */
const LIMIT = {
  status: "partial",
  subject: "west-elevation",
  reason: "no wall build-up is stated",
  remedy: "state one in materials",
};

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
        // The provenance is repeated per building on purpose: a reader scanning
        // one id must not have to hold the run's tally in their head to know
        // whether frames exist for the building in front of them. And the gap
        // count is its own line, because a statement about what the report
        // could not do reads wrongly when queued behind five about what it did.
        "eachBuildingIsDescribedWithItsProvenanceAndItsGapsApart",
        () => {
          const [derived, gaps] = unit.describeAutoMovieBuildingReport({
            gaps: 2,
            id: "hall-house",
            networks: 1,
            quantitySubjects: 3,
            runs: 4,
            schedules: [
              { subject: "room", total: 2 },
              { subject: "opening", total: 5 },
            ],
            sheets: 6,
            source: "materialized",
          });
          return (
            derived ===
              "hall-house (materialized): 6 sheet(s), 2 room(s), 5 opening(s), 3 quantity subject(s), 1 network(s), 4 analysis run(s)" &&
            gaps === "hall-house (materialized): 2 declared gap(s)"
          );
        },
      ],
      [
        // Every sheet declares the same three limits of the drawing
        // derivation, so a work of two units prints thirty-six copies of them
        // unless they are collapsed, and the gaps actually about this building
        // disappear underneath.
        "aLimitEveryArtifactDeclaresIsPrintedOnceAndCounted",
        () =>
          unit
            .describeAutoMovieBuildingGaps([
              LIMIT,
              { ...LIMIT, subject: "north-elevation" },
              { ...LIMIT, subject: "section-a" },
            ])
            .join("") ===
          `  partial west-elevation (and 2 more like it): no wall build-up is stated${NEWLINE}    remedy: state one in materials`,
      ],
      [
        // The subject is deliberately outside the key: it is what the row
        // names, and folding by it would split the constant limits back into
        // one row per sheet, which is the thing being collapsed.
        "twoGapsThatSayDifferentThingsStayTwoRows",
        () =>
          unit.describeAutoMovieBuildingGaps([
            LIMIT,
            { ...LIMIT, reason: "no opening schedule exists" },
          ]).length === 2,
      ],
      [
        // A reader compares this against the sidecar's own rows, so the order
        // is first-seen; sorting would make the two listings unalignable.
        "theOrderIsTheOrderTheArtifactsRaisedThem",
        () =>
          unit
            .describeAutoMovieBuildingGaps([
              { ...LIMIT, reason: "second" },
              { ...LIMIT, reason: "first" },
              { ...LIMIT, reason: "second" },
            ])
            .map((line) => line.split(": ")[1]?.split(NEWLINE)[0])
            .join(" ") === "second first",
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
      eachBuildingIsDescribedWithItsProvenanceAndItsGapsApart: true,
      aLimitEveryArtifactDeclaresIsPrintedOnceAndCounted: true,
      twoGapsThatSayDifferentThingsStayTwoRows: true,
      theOrderIsTheOrderTheArtifactsRaisedThem: true,
      theTallyNamesBothCountsIncludingTheZero: true,
    },
  );
};
