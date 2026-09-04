import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

type CommandPlan =
  | { command: "help" }
  | { command: "version" }
  | { command: "start"; directory: string; force: boolean }
  | {
      command: "migrate";
      directory: string;
      mode: "apply" | "dry-run" | "rollback";
    }
  | { command: "sync" | "verify" }
  | { command: "render"; arguments: readonly string[] };

const unit = loadSourceModule<{
  readAutoMovieCommandArguments: (args: readonly string[]) => CommandPlan;
  dispatchAutoMovieCommandArguments: <Output>(
    args: readonly string[],
    dispatch: (command: CommandPlan) => Output,
  ) => Output;
}>(path.resolve(__dirname, "../../../../packages/cli/src/commandArguments.ts"));

const read = (...args: readonly string[]): CommandPlan =>
  unit.readAutoMovieCommandArguments(args);

const refuses = (args: readonly string[], fragment: string): boolean => {
  try {
    read(...args);
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(fragment);
  }
};

/** The root CLI consumes one complete command before dispatching any work. */
export const test_cli_command_arguments = (): void => {
  const start = read("start", "--force", "film");
  const migrate = [
    read("migrate", "film"),
    read("migrate", "--dry-run", "film"),
    read("migrate", "film", "--rollback"),
  ];
  const render = read(
    "render",
    "all",
    "--chunk-frames",
    "24",
    "--deliverable",
    "feature",
    "--tier",
    "proxy",
    "--workers",
    "2",
  );
  let dispatches = 0;
  const dispatched = unit.dispatchAutoMovieCommandArguments(
    ["start", "film"],
    (command) => {
      ++dispatches;
      return command;
    },
  );
  try {
    unit.dispatchAutoMovieCommandArguments(
      ["start", "film", "--dryrun"],
      () => ++dispatches,
    );
  } catch {}

  TestValidator.equals(
    "the root CLI admits only one complete command-specific plan",
    namedFacts([
      [
        "helpAndVersionAreSingletonRequests",
        () =>
          read().command === "help" &&
          read("-h").command === "help" &&
          read("--help").command === "help" &&
          read("-v").command === "version" &&
          read("--version").command === "version" &&
          refuses(["--help", "extra"], "Unknown command") &&
          refuses(["--version", "extra"], "Unknown command"),
      ],
      [
        "startConsumesItsDirectoryAndOptionalFlag",
        () =>
          start.command === "start" &&
          start.directory === "film" &&
          start.force &&
          JSON.stringify(read("start", "film")) ===
            JSON.stringify({
              command: "start",
              directory: "film",
              force: false,
            }),
      ],
      [
        "migrateResolvesExactlyOneMode",
        () =>
          migrate.every((plan) => plan.command === "migrate") &&
          migrate
            .map((plan) => (plan.command === "migrate" ? plan.mode : ""))
            .join(",") === "apply,dry-run,rollback",
      ],
      [
        "zeroArgumentCommandsConsumeNothingElse",
        () =>
          read("sync").command === "sync" &&
          read("verify").command === "verify" &&
          refuses(["sync", "extra"], "sync takes no arguments") &&
          refuses(["verify", "--force"], "verify takes no arguments"),
      ],
      [
        "renderConsumesTheGeneratedRunnerGrammar",
        () =>
          render.command === "render" &&
          JSON.stringify(render.arguments) ===
            JSON.stringify([
              "all",
              "--chunk-frames",
              "24",
              "--deliverable",
              "feature",
              "--tier",
              "proxy",
              "--workers",
              "2",
            ]) &&
          read("render", "plan", "--chunk-frames", "1", "--tier", "final")
            .command === "render" &&
          read("render", "run", "--deliverable", "feature").command ===
            "render" &&
          read("render", "status", "--tier", "proxy").command === "render" &&
          read("render", "verify", "--tier", "final").command === "render" &&
          read("render", "finalize").command === "render" &&
          read("render", "gc", "--apply").command === "render",
      ],
      [
        "unknownDuplicateInapplicableAndExtraTokensAreRefused",
        () =>
          refuses(["launch", "film"], "Unknown command") &&
          refuses(["start", "film", "--dryrun"], "start option") &&
          refuses(["start", "film", "--dry-run"], "start option") &&
          refuses(["start", "-h"], "start option") &&
          refuses(["start", "film", "--force", "--force"], "only once") &&
          refuses(["start", "film", "other"], "received 2") &&
          refuses(["migrate", "film", "--force"], "migrate option") &&
          refuses(["migrate", "film", "--dry-run", "--dry-run"], "only once") &&
          refuses(["migrate", "film", "--dry-run", "--rollback"], "only one") &&
          refuses(["migrate", "film", "other"], "received 2"),
      ],
      [
        "missingAndBlankDirectoriesAreRefused",
        () =>
          refuses(["start"], "non-blank target") &&
          refuses(["start", "  "], "non-blank target") &&
          refuses(["migrate"], "non-blank target"),
      ],
      [
        "renderRejectsEveryMalformedTokenClass",
        () =>
          refuses(["render"], "render needs one of") &&
          refuses(["render", "later"], "render needs one of") &&
          refuses(["render", "all", "--fast"], "Unknown render option") &&
          refuses(["render", "all", "extra"], "Unexpected render argument") &&
          refuses(["render", "gc", "--tier", "proxy"], "not valid") &&
          refuses(
            ["render", "status", "--tier", "proxy", "--tier", "final"],
            "only once",
          ) &&
          refuses(["render", "all", "--workers"], "requires a value") &&
          refuses(
            ["render", "all", "--workers", "--tier", "proxy"],
            "requires a value",
          ) &&
          refuses(["render", "all", "--workers", "0"], "positive integer") &&
          refuses(
            ["render", "all", "--workers", "999999999999999999999999"],
            "positive integer",
          ) &&
          refuses(["render", "all", "--deliverable", " "], "non-blank") &&
          refuses(["render", "all", "--deliverable", " padded"], "unpadded") &&
          refuses(["render", "all", "--tier", "draft"], "proxy") &&
          refuses(["render", "gc", "--apply", "--apply"], "only once"),
      ],
      [
        "dispatchRunsOnlyAfterAdmission",
        () =>
          dispatches === 1 &&
          dispatched.command === "start" &&
          dispatched.directory === "film",
      ],
    ]),
    {
      helpAndVersionAreSingletonRequests: true,
      startConsumesItsDirectoryAndOptionalFlag: true,
      migrateResolvesExactlyOneMode: true,
      zeroArgumentCommandsConsumeNothingElse: true,
      renderConsumesTheGeneratedRunnerGrammar: true,
      unknownDuplicateInapplicableAndExtraTokensAreRefused: true,
      missingAndBlankDirectoriesAreRefused: true,
      renderRejectsEveryMalformedTokenClass: true,
      dispatchRunsOnlyAfterAdmission: true,
    },
  );
};
