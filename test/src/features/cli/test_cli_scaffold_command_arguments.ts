import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

interface IPreviewRequest {
  shot: string;
  pass: string;
  time: number;
  width: number | undefined;
  height: number | undefined;
}

interface ITurntableRequest {
  asset: string;
  width: number | undefined;
  height: number | undefined;
}

interface ILintRequest {
  scope: "design" | "source" | "review" | "final";
}

const unit = loadSourceModule<{
  readAutoMoviePreviewArguments: (args: readonly string[]) => IPreviewRequest;
  readAutoMovieTurntableArguments: (
    args: readonly string[],
  ) => ITurntableRequest;
  readAutoMovieLintArguments: (args: readonly string[]) => ILintRequest;
  assertAutoMovieNoArguments: (
    command: string,
    args: readonly string[],
  ) => void;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/commandArguments.ts",
  ),
);

const refuses = (operation: () => unknown, fragment: string): boolean => {
  try {
    operation();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(fragment);
  }
};

/** Generated commands admit every token before opening production state. */
export const test_cli_scaffold_command_arguments = (): void => {
  const preview = unit.readAutoMoviePreviewArguments([
    "--shot",
    "opening",
    "--pass",
    "normal",
    "--time",
    "1.25",
    "--width",
    "800",
    "--height",
    "600",
  ]);
  const positionalPreview = unit.readAutoMoviePreviewArguments([
    "2.5",
    "closing",
  ]);
  const turntable = unit.readAutoMovieTurntableArguments([
    "--asset",
    "hero",
    "--width",
    "640",
    "--height",
    "480",
  ]);
  const zeroArgumentCommands = [
    "capture:doctor",
    "capture:install",
    "compile",
    "building:report",
    "derive:example",
    "design",
    "texture:scale",
    "verify",
  ];

  TestValidator.equals(
    "the generated command parsers consume their complete closed schemas",
    namedFacts([
      [
        "previewReadsNamedAndCompatiblePositionalRequests",
        () =>
          JSON.stringify(preview) ===
            JSON.stringify({
              shot: "opening",
              pass: "normal",
              time: 1.25,
              width: 800,
              height: 600,
            }) &&
          JSON.stringify(positionalPreview) ===
            JSON.stringify({
              shot: "closing",
              pass: "beauty",
              time: 2.5,
            }),
      ],
      [
        "previewRejectsUnknownDuplicateAndExtraTokens",
        () =>
          refuses(
            () =>
              unit.readAutoMoviePreviewArguments([
                "--shot",
                "opening",
                "--pas",
                "pose",
              ]),
            "Unknown preview option",
          ) &&
          refuses(
            () =>
              unit.readAutoMoviePreviewArguments([
                "--shot",
                "opening",
                "--shot",
                "closing",
              ]),
            "only once",
          ) &&
          refuses(
            () => unit.readAutoMoviePreviewArguments(["0", "opening", "extra"]),
            "at most two",
          ),
      ],
      [
        "previewRejectsMissingAndConflictingValues",
        () =>
          refuses(
            () => unit.readAutoMoviePreviewArguments([]),
            "requires --shot",
          ) &&
          refuses(
            () => unit.readAutoMoviePreviewArguments(["--shot", "  "]),
            "non-blank",
          ) &&
          refuses(
            () => unit.readAutoMoviePreviewArguments(["--shot"]),
            "requires one value",
          ) &&
          refuses(
            () => unit.readAutoMoviePreviewArguments(["--shot", "--time", "0"]),
            "requires one value",
          ) &&
          refuses(
            () =>
              unit.readAutoMoviePreviewArguments([
                "0",
                "opening",
                "--time",
                "1",
              ]),
            "combine --time",
          ) &&
          refuses(
            () =>
              unit.readAutoMoviePreviewArguments([
                "0",
                "opening",
                "--shot",
                "closing",
              ]),
            "combine --shot",
          ),
      ],
      [
        "previewRejectsInvalidTypedValues",
        () =>
          refuses(
            () =>
              unit.readAutoMoviePreviewArguments([
                "--shot",
                "opening",
                "--pass",
                "wire",
              ]),
            "--pass must be one of",
          ) &&
          [" ", "NaN", "Infinity", "-1"].every((time) =>
            refuses(
              () =>
                unit.readAutoMoviePreviewArguments([
                  "--shot",
                  "opening",
                  "--time",
                  time,
                ]),
              "finite nonnegative",
            ),
          ) &&
          ["0", "1.5", "Infinity"].every((width) =>
            refuses(
              () =>
                unit.readAutoMoviePreviewArguments([
                  "--shot",
                  "opening",
                  "--width",
                  width,
                ]),
              "positive whole number",
            ),
          ) &&
          refuses(
            () =>
              unit.readAutoMoviePreviewArguments([
                "--shot",
                "opening",
                "--height",
                "999999999999999999999999",
              ]),
            "positive whole number",
          ),
      ],
      [
        "turntableReadsNamedAndCompatiblePositionalRequests",
        () =>
          JSON.stringify(turntable) ===
            JSON.stringify({ asset: "hero", width: 640, height: 480 }) &&
          JSON.stringify(unit.readAutoMovieTurntableArguments(["prop"])) ===
            JSON.stringify({ asset: "prop" }),
      ],
      [
        "turntableRejectsEveryMalformedTokenClass",
        () =>
          refuses(
            () => unit.readAutoMovieTurntableArguments([]),
            "requires --asset",
          ) &&
          refuses(
            () => unit.readAutoMovieTurntableArguments(["--asset", " "]),
            "non-blank",
          ) &&
          refuses(
            () =>
              unit.readAutoMovieTurntableArguments([
                "hero",
                "--asset",
                "other",
              ]),
            "combine --asset",
          ) &&
          refuses(
            () => unit.readAutoMovieTurntableArguments(["hero", "extra"]),
            "at most one",
          ) &&
          refuses(
            () =>
              unit.readAutoMovieTurntableArguments([
                "--asset",
                "hero",
                "--widht",
                "1",
              ]),
            "Unknown turntable option",
          ) &&
          refuses(
            () =>
              unit.readAutoMovieTurntableArguments([
                "--asset",
                "hero",
                "--width",
                "1",
                "--width",
                "2",
              ]),
            "only once",
          ) &&
          refuses(
            () =>
              unit.readAutoMovieTurntableArguments([
                "--asset",
                "hero",
                "--height",
                "-1",
              ]),
            "positive whole number",
          ),
      ],
      [
        "lintDefaultsAndAcceptsOnlyItsClosedScope",
        () =>
          unit.readAutoMovieLintArguments([]).scope === "review" &&
          ["design", "source", "review", "final"].every(
            (scope) =>
              unit.readAutoMovieLintArguments(["--scope", scope]).scope ===
              scope,
          ) &&
          refuses(
            () => unit.readAutoMovieLintArguments(["--scop", "source"]),
            "Unknown lint option",
          ) &&
          refuses(
            () =>
              unit.readAutoMovieLintArguments([
                "--scope",
                "source",
                "--scope",
                "final",
              ]),
            "only once",
          ) &&
          refuses(
            () => unit.readAutoMovieLintArguments(["--scope"]),
            "requires one value",
          ) &&
          refuses(
            () => unit.readAutoMovieLintArguments(["--scope", " "]),
            "Unknown lint scope",
          ) &&
          refuses(
            () => unit.readAutoMovieLintArguments(["--scope", "draft"]),
            "Unknown lint scope",
          ) &&
          refuses(
            () => unit.readAutoMovieLintArguments(["review"]),
            "no positional values",
          ),
      ],
      [
        "zeroOptionCommandsRejectBeforeTheyCanRun",
        () =>
          zeroArgumentCommands.every((command) => {
            unit.assertAutoMovieNoArguments(command, []);
            return refuses(
              () => unit.assertAutoMovieNoArguments(command, ["--force"]),
              `${command} takes no arguments`,
            );
          }),
      ],
    ]),
    {
      previewReadsNamedAndCompatiblePositionalRequests: true,
      previewRejectsUnknownDuplicateAndExtraTokens: true,
      previewRejectsMissingAndConflictingValues: true,
      previewRejectsInvalidTypedValues: true,
      turntableReadsNamedAndCompatiblePositionalRequests: true,
      turntableRejectsEveryMalformedTokenClass: true,
      lintDefaultsAndAcceptsOnlyItsClosedScope: true,
      zeroOptionCommandsRejectBeforeTheyCanRun: true,
    },
  );
};
