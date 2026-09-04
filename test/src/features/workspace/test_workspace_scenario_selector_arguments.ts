import { TestValidator } from "@nestia/e2e";

import {
  ScenarioSelectorArgumentError,
  parseScenarioSelectorArguments,
} from "../../integrity/scenarioSelectorArguments";

const refusal = (argv: readonly string[]): string | null => {
  try {
    parseScenarioSelectorArguments(argv);
    return null;
  } catch (error) {
    return error instanceof ScenarioSelectorArgumentError
      ? error.message
      : `unexpected:${String(error)}`;
  }
};

export const test_workspace_scenario_selector_arguments = (): void => {
  TestValidator.equals(
    "no selector is valid",
    parseScenarioSelectorArguments([]),
    {
      include: [],
      exclude: [],
    },
  );
  TestValidator.equals(
    "separated groups consume every term",
    parseScenarioSelectorArguments([
      "--include",
      "alpha",
      "beta",
      "--exclude",
      "slow",
    ]),
    { include: ["alpha", "beta"], exclude: ["slow"] },
  );
  TestValidator.equals(
    "repeated and equals groups accumulate in encounter order",
    parseScenarioSelectorArguments([
      "--exclude=slow",
      "--include",
      "alpha",
      "--include=beta",
      "--exclude",
      "network",
    ]),
    { include: ["alpha", "beta"], exclude: ["slow", "network"] },
  );
  TestValidator.equals(
    "quoted terms are normalized",
    parseScenarioSelectorArguments(["--include", " alpha "]),
    { include: ["alpha"], exclude: [] },
  );

  const invalid = [
    ["--inculde", "alpha"],
    ["alpha", "--include", "beta"],
    ["--include"],
    ["--exclude"],
    ["--include", "--exclude", "slow"],
    ["--include="],
    ["--exclude=   "],
    ["--include", "   "],
  ];
  TestValidator.predicate(
    "every malformed request is refused before discovery",
    invalid.every((argv) => refusal(argv) !== null),
  );
  TestValidator.predicate(
    "unknown and positional diagnostics identify the rejected token",
    refusal(["--inculde", "alpha"])!.includes("--inculde") &&
      refusal(["alpha"])!.includes("alpha"),
  );
};
