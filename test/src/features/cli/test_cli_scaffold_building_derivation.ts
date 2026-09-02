import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { rectangularBuilding } from "../internal/envelopeFixtures";
import { namedFacts } from "../internal/predicates";
import { requireSourceModule } from "../internal/requireSourceModule";

interface IAction {
  kind: "write" | "say";
  sidecar?: { segments: readonly string[]; text: string };
  line?: string;
}

const unit = requireSourceModule<{
  collectAutoMovieStagedRecords: <T extends { id: string }>(props: {
    shots: ReadonlyArray<readonly [string, unknown]>;
    select: (compiled: never) => readonly T[] | undefined;
    what: string;
  }) => T[];
  deriveAutoMovieBuildingActions: (props: {
    encode: (segment: string) => string;
    records: ReadonlyArray<{
      environment: { id: string };
      source: "materialized" | "staged";
    }>;
    report: (record: { environment: { id: string } }) => unknown;
    tally: (records: readonly unknown[]) => string;
  }) => IAction[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/buildingDerivation.ts",
  ),
  ["collectAutoMovieStagedRecords", "deriveAutoMovieBuildingActions"],
);

const REPORT = {
  gaps: [
    {
      status: "partial",
      subject: "west-elevation",
      reason: "no wall build-up is stated",
      remedy: "state one in materials",
    },
  ],
  quantities: { findings: [1, 2] },
  runs: [1],
  schedules: [{ subject: "room", total: 3 }],
  services: [],
  sheets: [{ view: { id: "plan-level-0" }, svg: "<svg/>" }],
};

const record = (id: string, source: "materialized" | "staged" = "staged") => ({
  environment: { ...rectangularBuilding(), id },
  source,
});

const run = (
  records: ReadonlyArray<{
    environment: { id: string };
    source: "materialized" | "staged";
  }>,
) =>
  unit.deriveAutoMovieBuildingActions({
    encode: (segment) => segment,
    records,
    report: () => REPORT,
    tally: (all) => `${all.length} building record(s)`,
  });

/**
 * What one derivation run writes and says, and what it refuses to derive.
 *
 * The command that used to hold all of this opens project state at module level
 * and refuses unless it is current, so nothing in this project could load it.
 * The report loop, the empty-production message, the tally guard and the
 * refusal of two shots that disagree about one building all went unread for as
 * long as they lived there -- including the refusal, which is the one place a
 * real contradiction between two shots is caught.
 *
 * Scenarios:
 *
 * 1. A production with nothing to draw says so and stops, with no tally: a row
 *    of zeroes beside that sentence invites reading it as a result.
 * 2. Each building's sheets land before its lines, and the run's tally comes
 *    last, which is the order a reader would open the directory in.
 * 3. Two shots staging one building carry one record, because the compiler
 *    copies one declaration into every artifact that stages it.
 * 4. Two shots staging two different records under one id are refused by name
 *    rather than resolved by whichever was read first.
 */
export const test_cli_scaffold_building_derivation = (): void => {
  const empty = run([]);
  const two = run([record("annex", "materialized"), record("hall")]);
  const shots = (
    left: Record<string, unknown>,
    right: Record<string, unknown>,
  ): ReadonlyArray<readonly [string, unknown]> => [
    ["wide", { builtEnvironments: [left] }] as const,
    ["close", { builtEnvironments: [right] }] as const,
  ];

  TestValidator.equals(
    "a derivation says what it drew, in the order the pages land",
    namedFacts([
      [
        // A tally of zeroes beside "there is nothing to draw" invites reading
        // it as a result.
        "anEmptyProductionSaysSoAndTalliesNothing",
        () =>
          empty.length === 1 &&
          empty[0]!.line?.startsWith("no built environment is staged") === true,
      ],
      [
        "eachBuildingsSheetsLandBeforeItsLines",
        () =>
          two
            .map((action) =>
              action.kind === "write"
                ? `w:${action.sidecar!.segments.join("/")}`
                : `s:${action.line!.slice(0, 5)}`,
            )
            .join(" ") ===
          "w:annex/plan-level-0.svg w:annex/report.json s:annex s:annex s:  par w:hall/plan-level-0.svg w:hall/report.json s:hall s:hall s:  par s:2 bui",
      ],
      [
        "theRunsTallyIsSaidOnceAndLast",
        () => two[two.length - 1]?.line === "2 building record(s)",
      ],
      [
        // The compiler copies the source's own declaration into every artifact
        // that stages it, so two shots staging one building carry one record.
        "twoShotsStagingOneBuildingCarryOneRecord",
        () =>
          unit.collectAutoMovieStagedRecords({
            shots: shots({ id: "hall", h: 1 }, { id: "hall", h: 1 }),
            select: (compiled: never) =>
              (compiled as { builtEnvironments: Array<{ id: string }> })
                .builtEnvironments,
            what: "built environment",
          }).length === 1,
      ],
      [
        // A document silently derived from whichever shot happened to be read
        // first is exactly the kind of evidence nobody can act on.
        "twoShotsDisagreeingAboutOneBuildingAreRefusedByName",
        () => {
          try {
            unit.collectAutoMovieStagedRecords({
              shots: shots({ id: "hall", h: 1 }, { id: "hall", h: 2 }),
              select: (compiled: never) =>
                (compiled as { builtEnvironments: Array<{ id: string }> })
                  .builtEnvironments,
              what: "built environment",
            });
            return false;
          } catch (error) {
            return (
              error instanceof Error &&
              error.message.includes(
                'shots "wide" and "close" stage two different built environment records under the id "hall"',
              )
            );
          }
        },
      ],
    ]),
    {
      anEmptyProductionSaysSoAndTalliesNothing: true,
      eachBuildingsSheetsLandBeforeItsLines: true,
      theRunsTallyIsSaidOnceAndLast: true,
      twoShotsStagingOneBuildingCarryOneRecord: true,
      twoShotsDisagreeingAboutOneBuildingAreRefusedByName: true,
    },
  );
};
