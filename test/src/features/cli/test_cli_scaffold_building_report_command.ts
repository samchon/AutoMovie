import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { requireSourceModule } from "../internal/requireSourceModule";
import {
  libraryAuthoring,
  libraryFixture,
} from "../production/libraryFixtures";

const command = requireSourceModule<{
  runAutoMovieBuildingDerivation: (props: {
    productionId: string;
    evidence: unknown;
    read: () => unknown;
    write?: (file: string, text: string) => void;
    say?: (line: string) => void;
    state: unknown;
  }) => void;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/deriveBuilding.ts",
  ),
  ["runAutoMovieBuildingDerivation"],
);

/**
 * `building:report` run against a library that actually published a building.
 *
 * Every decision this command makes was moved into modules a test can load, one
 * at a time, because the command itself read the project at module level and
 * refused unless it was current -- so nothing could import it, and the lines
 * that put those decisions together were the last in the repository that no run
 * reached.
 *
 * They are reachable now for the same reason `library-review` is: the
 * derivation takes its world as arguments and a one-call entry file supplies
 * the process's own. This drives it against a compiled fixture and reads what
 * came out, which is the first time the whole command has been executed by
 * anything.
 *
 * Scenarios:
 *
 * 1. A library that materialized one building writes that building's report
 *    into a directory named for it, and says what it drew.
 * 2. The provenance is `materialized`, because no frame was ever drawn of it,
 *    and the run's tally says so once at the end.
 */
export const test_cli_scaffold_building_report_command = (): void => {
  const fixture = libraryFixture();
  try {
    const authoring = libraryAuthoring({ root: fixture.root });
    const compiled = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
      authoring,
    ).compile({ scope: "source" });
    const written: string[] = [];
    const said: string[] = [];
    command.runAutoMovieBuildingDerivation({
      evidence: {},
      productionId: AutoMovieProductionProject.openReadOnly(fixture.root)
        .productionId,
      read: () => authoring,
      // Supplied rather than loaded, which is what the injection is for. A
      // library has no shot, so the staged half is empty and everything drawn
      // comes from the published index; refusing a stale project is the entry
      // file's job and not this derivation's.
      state: {
        root: fixture.root,
        generated: {
          shots: [],
          manifest: { inputFingerprint: `sha256:${"0".repeat(64)}` },
          design: { production: {} },
        },
      },
      say: (line) => void said.push(line),
      write: (file) =>
        void written.push(file.split(/[\\/]/u).slice(-2).join("/")),
    });

    TestValidator.equals(
      "a materialized building is drawn, counted and tallied",
      namedFacts([
        ["theCompileMaterializedABuilding", () => compiled.success],
        [
          // Into a directory named for the building, which is the whole of
          // what a reader needs to find it. How many sheets come with it is
          // the view set's answer, not this command's.
          "itWroteThatBuildingsReport",
          () => written.includes("hall-house/report.json"),
        ],
        [
          // No frame was ever drawn of it, so a review citing it has to cite
          // these drawings.
          "itSaidTheProvenanceIsMaterialized",
          () => said.some((line) => line.includes("(materialized):")),
        ],
        [
          "theRunsTallyIsSaidOnceAndLast",
          () =>
            said.filter((line) => line.includes("building record(s):"))
              .length === 1 &&
            said[said.length - 1]?.includes("building record(s):") === true,
        ],
      ]),
      {
        theCompileMaterializedABuilding: true,
        itWroteThatBuildingsReport: true,
        itSaidTheProvenanceIsMaterialized: true,
        theRunsTallyIsSaidOnceAndLast: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
