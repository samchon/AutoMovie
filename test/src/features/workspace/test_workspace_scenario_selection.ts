import { TestValidator } from "@nestia/e2e";

import {
  parseScenarioSelection,
  prepareScenarioFilter,
  selectScenarioNames,
} from "../../scenarioSelection";

/**
 * A narrow test request never degrades into the default full selection.
 *
 * Scenarios:
 * 1. Empty argv, repeated groups, multiple terms, and equals forms preserve the
 *    complete request; every blank, valueless, unknown, or positional token fails.
 * 2. Include and exclude terms each match a synthetic basename, and their final
 *    intersection must retain a scenario without changing substring semantics.
 * 3. Invalid argv never reaches discovery; valid discovery admits no module and
 *    returns an execution filter for exactly the frozen selected basenames.
 * 4. Empty discovery and discovery failure cannot produce an execution filter.
 */
export const test_workspace_scenario_selection = async (): Promise<void> => {
  TestValidator.equals("default request", parseScenarioSelection([]), {
    include: [],
    exclude: [],
  });
  TestValidator.equals(
    "all groups and equals options accumulate",
    parseScenarioSelection([
      "--include",
      "alpha",
      "beta",
      "--exclude",
      "slow",
      "--include=gamma",
      "--exclude=old",
      "--include",
      "delta",
      "--exclude",
      "stale",
    ]),
    {
      include: ["alpha", "beta", "gamma", "delta"],
      exclude: ["slow", "old", "stale"],
    },
  );
  for (const argv of [
    ["--include"],
    ["--exclude"],
    ["--include", "--exclude", "slow"],
    ["--include", "alpha", "--include"],
    ["--exclude", "slow", "--exclude"],
    ["--include="],
    ["--exclude=   "],
    ["--include", "\t"],
    ["--include", ""],
    ["--exclude", "\n"],
    ["--include=-wrong"],
    ["--inculde", "alpha"],
    ["--include", "alpha", "--typo"],
    ["alpha", "--include", "beta"],
    ["--"],
    ["-x"],
    ["--include=alpha", "beta"],
    ["--include", "alpha", "-x"],
  ]) {
    let discovered = false;
    let rejected = false;
    try {
      await prepareScenarioFilter(argv, async () => {
        discovered = true;
      });
    } catch {
      rejected = true;
    }
    TestValidator.predicate(
      `invalid argv ${JSON.stringify(argv)}`,
      rejected && !discovered,
    );
  }

  const names = ["test_alpha.ts", "test_alpha_slow.ts", "test_beta.ts"];
  TestValidator.equals(
    "default retains all",
    [...selectScenarioNames(parseScenarioSelection([]), names)],
    names,
  );
  TestValidator.equals(
    "exclude-only request",
    [...selectScenarioNames(parseScenarioSelection(["--exclude=slow"]), names)],
    [names[0], names[2]],
  );
  TestValidator.equals(
    "include and exclude intersect",
    [
      ...selectScenarioNames(
        parseScenarioSelection(["--include", "alpha", "--exclude", "slow"]),
        names,
      ),
    ],
    [names[0]],
  );
  for (const argv of [
    ["--include=unknown"],
    ["--exclude=unknown"],
    ["--include", "alpha", "unknown"],
    ["--exclude", "slow", "unknown"],
    ["--include=alpha", "--exclude=alpha"],
  ]) {
    let rejected = false;
    try {
      selectScenarioNames(parseScenarioSelection(argv), names);
    } catch {
      rejected = true;
    }
    TestValidator.predicate(
      `unmatched or empty selection ${JSON.stringify(argv)}`,
      rejected,
    );
  }
  const admitted: boolean[] = [];
  const filter = await prepareScenarioFilter(
    ["--include=alpha", "--exclude=slow"],
    async (probe) => {
      for (const name of names) admitted.push(probe(name));
    },
  );
  TestValidator.equals(
    "discovery admits no module",
    admitted,
    names.map(() => false),
  );
  TestValidator.equals(
    "frozen execution set",
    [...names, "test_new_alpha.ts"].filter(filter),
    [names[0]],
  );
  let emptyRejected = false;
  try {
    await prepareScenarioFilter([], async () => undefined);
  } catch {
    emptyRejected = true;
  }
  TestValidator.predicate("empty discovery refuses execution", emptyRejected);
  const failure = new Error("synthetic discovery failure");
  let caught: unknown;
  try {
    await prepareScenarioFilter([], async () => {
      throw failure;
    });
  } catch (error) {
    caught = error;
  }
  TestValidator.predicate("discovery failure is preserved", caught === failure);
};
