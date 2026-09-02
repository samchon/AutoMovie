import { encodeAutoMoviePathSegment } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

const unit = loadSourceModule<{
  planAutoMovieBuildingSidecars: (props: {
    encode: (segment: string) => string;
    id: string;
    report: { sheets: ReadonlyArray<{ view: { id: string }; svg: string }> };
  }) => Array<{ segments: readonly string[]; text: string }>;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/buildingSidecars.ts",
  ),
);

const NEWLINE = String.fromCharCode(10);

const plan = (id: string, views: readonly string[]) =>
  unit.planAutoMovieBuildingSidecars({
    encode: encodeAutoMoviePathSegment,
    id,
    report: {
      sheets: views.map((view) => ({ view: { id: view }, svg: "<svg/>" })),
    },
  });

/**
 * Where one building's report lands, when the author named it and not a
 * filesystem.
 *
 * A building id and a view id are author-chosen text. They reach this report as
 * directory and file names, and nothing in between had a reader:
 * `deriveBuilding.ts` opens project state at module level and refuses unless it
 * is current, so no test in this project could load the line that joins them.
 *
 * Scenarios:
 *
 * 1. One sheet per view plus one manifest, sheets first, which is the order a
 *    reader watching the log would check the directory in.
 * 2. Every segment is encoded. A building called `wing/a` lands in one
 *    directory named for it, not in a `wing` directory the author never asked
 *    for; a view called `..` does not name the report root's parent.
 * 3. The manifest is indented and newline-terminated, because these files are
 *    tracked so a take-off can be diffed across revisions.
 */
export const test_cli_scaffold_building_sidecars = (): void => {
  const ordinary = plan("hall-house", ["plan-level-0", "north-elevation"]);
  const hostile = plan("wing/a", ["..", "section a"]);

  TestValidator.equals(
    "a report's files are named for the building, not by it",
    namedFacts([
      [
        "oneSheetPerViewAndOneManifest",
        () =>
          ordinary.map((entry) => entry.segments.join("/")).join(" ") ===
          "hall-house/plan-level-0.svg hall-house/north-elevation.svg hall-house/report.json",
      ],
      [
        // The sheets come first on purpose: a reader watching the log sees each
        // page as it lands and the record of them last.
        "theManifestIsWrittenLast",
        () => ordinary[ordinary.length - 1]?.segments[1] === "report.json",
      ],
      [
        // An id is author-chosen text, not a filename. The separator has to be
        // gone from the segment itself: counting segments proves nothing,
        // because `path.join` spreads a slash inside one of them into the
        // `wing` directory nobody asked for just the same.
        "aBuildingIdWithASeparatorStaysOneDirectory",
        () =>
          hostile.every((entry) =>
            entry.segments.every(
              (segment) =>
                segment.includes("/") === false &&
                segment.includes(String.fromCharCode(92)) === false,
            ),
          ) && hostile[0]?.segments[0] === "wing%2Fa",
      ],
      [
        // And a view called `..` would name the report root's parent.
        "aViewIdCannotClimbOutOfTheReportRoot",
        () =>
          hostile[0]?.segments[1] !== "...svg" &&
          hostile[0]?.segments[1]?.endsWith(".svg") === true,
      ],
      [
        "eachSheetIsItsOwnSvgAndNewlineTerminated",
        () => ordinary[0]?.text === `<svg/>${NEWLINE}`,
      ],
      [
        // Tracked rather than ignored, so a take-off is worth diffing across
        // revisions -- and a one-line document diffs as one changed line no
        // matter what moved inside it.
        "theManifestIsIndentedAndNewlineTerminated",
        () => {
          const text = ordinary[ordinary.length - 1]?.text ?? "";
          return (
            text.includes(`${NEWLINE}  "sheets"`) && text.endsWith(NEWLINE)
          );
        },
      ],
    ]),
    {
      oneSheetPerViewAndOneManifest: true,
      theManifestIsWrittenLast: true,
      aBuildingIdWithASeparatorStaysOneDirectory: true,
      aViewIdCannotClimbOutOfTheReportRoot: true,
      eachSheetIsItsOwnSvgAndNewlineTerminated: true,
      theManifestIsIndentedAndNewlineTerminated: true,
    },
  );
};
