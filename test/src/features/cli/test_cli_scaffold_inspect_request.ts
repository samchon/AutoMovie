import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { requireSourceModule } from "../internal/requireSourceModule";

interface IInspectRequest {
  shot: string;
  subject: string;
  azimuthCount: number | undefined;
  elevationsDeg: number[] | undefined;
  height: number | undefined;
  width: number | undefined;
}

const unit = requireSourceModule<{
  readAutoMovieInspectRequest: (argv: readonly string[]) => IInspectRequest;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/inspectRequest.ts",
  ),
  ["readAutoMovieInspectRequest"],
);

const read = (...argv: readonly string[]): IInspectRequest =>
  unit.readAutoMovieInspectRequest(argv);

const refuses = (argv: readonly string[], fragment: string): boolean => {
  try {
    unit.readAutoMovieInspectRequest(argv);
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(fragment);
  }
};

const MINIMUM = ["--shot", "opening", "--subject", "space:hall-house/hall"];

/**
 * What `npm run inspect` was asked for, and what it refuses to be asked.
 *
 * The command shipped and nothing drove it. It imports the inspection
 * instrument, which imports Vite and Playwright at module level, so no reader
 * in this project could load it to see what it does with a flag -- every
 * refusal below was written and never read, and the argument list a generated
 * project's author types is the first thing they get wrong.
 *
 * Scenarios:
 *
 * 1. The two required flags are enough, and every override is absent rather
 *    than defaulted, so the service decides the sweep when the author does not.
 * 2. Each override is read as its own type: whole numbers for counts and pixel
 *    sizes, a comma-separated list for the elevation ring.
 * 3. A missing, blank, or absent required flag is refused by name.
 * 4. A flag repeated is refused rather than resolved by read order, because two
 *    answers to one question is a mistake and picking either hides it.
 * 5. A flag whose value is another flag is refused, so `--shot --subject x`
 *    does not inspect a shot named `--subject`.
 * 6. A fractional or non-numeric count is refused, and so is an elevation list
 *    with an entry that is not a number.
 */
export const test_cli_scaffold_inspect_request = (): void => {
  const minimal = read(...MINIMUM);
  const full = read(
    ...MINIMUM,
    "--azimuth-count",
    "12",
    "--elevations-deg",
    "-15, 0 ,30",
    "--width",
    "800",
    "--height",
    "600",
  );

  TestValidator.equals(
    "the inspect command reads its request and refuses a malformed one by name",
    namedFacts([
      [
        // Absent, not defaulted. The service derives the sweep from the
        // subject's own bounds, and an author who could choose the angles could
        // choose flattering ones.
        "theTwoRequiredFlagsAreEnoughAndOverridesStayAbsent",
        () =>
          minimal.shot === "opening" &&
          minimal.subject === "space:hall-house/hall" &&
          minimal.azimuthCount === undefined &&
          minimal.elevationsDeg === undefined &&
          minimal.width === undefined &&
          minimal.height === undefined,
      ],
      [
        "everyOverrideIsReadAsItsOwnType",
        () =>
          full.azimuthCount === 12 &&
          JSON.stringify(full.elevationsDeg) === "[-15,0,30]" &&
          full.width === 800 &&
          full.height === 600,
      ],
      [
        "aMissingRequiredFlagIsRefusedByName",
        () =>
          refuses(["--subject", "space:x"], "inspect requires --shot") &&
          refuses(["--shot", "opening"], "inspect requires --subject"),
      ],
      [
        "aBlankRequiredFlagIsRefusedByName",
        () =>
          refuses(
            ["--shot", "  ", "--subject", "space:x"],
            "inspect requires --shot",
          ) &&
          refuses(
            ["--shot", "opening", "--subject", "  "],
            "inspect requires --subject",
          ),
      ],
      [
        "aRepeatedFlagIsRefused",
        () =>
          refuses(
            [...MINIMUM, "--shot", "closing"],
            "--shot may be supplied exactly once",
          ),
      ],
      [
        "aFlagWhoseValueIsAnotherFlagIsRefused",
        () =>
          refuses(
            ["--shot", "--subject", "space:x"],
            "--shot requires one value",
          ) && refuses([...MINIMUM, "--width"], "--width requires one value"),
      ],
      [
        "aCountThatIsNotAWholeNumberIsRefused",
        () =>
          refuses(
            [...MINIMUM, "--azimuth-count", "12.5"],
            "--azimuth-count must be one whole number",
          ) &&
          refuses(
            [...MINIMUM, "--height", "tall"],
            "--height must be one whole number",
          ),
      ],
      [
        "anElevationThatIsNotANumberIsRefused",
        () =>
          refuses(
            [...MINIMUM, "--elevations-deg", "0,up"],
            "--elevations-deg must be comma-separated numbers",
          ),
      ],
    ]),
    {
      theTwoRequiredFlagsAreEnoughAndOverridesStayAbsent: true,
      everyOverrideIsReadAsItsOwnType: true,
      aMissingRequiredFlagIsRefusedByName: true,
      aBlankRequiredFlagIsRefusedByName: true,
      aRepeatedFlagIsRefused: true,
      aFlagWhoseValueIsAnotherFlagIsRefused: true,
      aCountThatIsNotAWholeNumberIsRefused: true,
      anElevationThatIsNotANumberIsRefused: true,
    },
  );
};
