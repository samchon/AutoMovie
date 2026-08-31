import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  requestedScenarioTerms,
  scenarioSelectionDiagnostics,
} from "../../integrity/scenarioSelection";

const ROOT = path.resolve(__dirname, "../../../..");

/** Every scenario name the suite ships, read the way the runner discovers them. */
const discoveredScenarioNames = (): string[] => {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.name.startsWith("test_") && entry.name.endsWith(".ts"))
        found.push(entry.name.replace(/\.ts$/u, ""));
    }
  };
  walk(path.join(ROOT, "test", "src", "features"));
  return found;
};

/**
 * A filter that selected nothing is refused, and the terms this repository
 * passes are still real.
 *
 * `--include test_this_does_not_exist` printed `0/0 passed`, `All tests
 * passed`, and exited 0. Two build-lane steps and a package script pass exactly
 * one term each, and each is the only place its check runs, so a renamed
 * scenario switched a check off silently under a green lane. A fourth caller
 * had already done it: `start:subprocess` named a scenario deleted with
 * `@automovie/lint` in #1811 and had been running nothing ever since.
 *
 * Scenarios:
 *
 * 1. An `--include` term naming nothing is refused and says how many scenarios
 *    it was compared against; the same term matching something is accepted.
 * 2. Each term is judged alone, so `--include a b` where only `a` matches is
 *    still refused, which is the case a whole-selection check would pass.
 * 3. An `--exclude` term that excludes nothing is refused for the same reason,
 *    and a combination whose halves are each real but which together leave
 *    nothing is refused as a combination rather than blamed on a term.
 * 4. No filter at all is not a filter that selected nothing.
 * 5. The terms this repository's own commands pass name scenarios that exist,
 *    read from the files that pass them and checked against the shipped
 *    population rather than against a list somebody maintains.
 */
export const test_workspace_scenario_selection = (): void => {
  const discovered = ["test_alpha_one", "test_beta_two", "test_gamma_three"];

  TestValidator.equals(
    "a term naming nothing is refused and a term naming something is not",
    {
      missing: scenarioSelectionDiagnostics({
        discovered,
        exclude: [],
        include: ["test_delta"],
        selected: 0,
      }),
      present: scenarioSelectionDiagnostics({
        discovered,
        exclude: [],
        include: ["test_alpha"],
        selected: 1,
      }),
    },
    {
      missing: [
        "--include test_delta names no scenario among the 3 discovered; correct the term or restore the scenario",
      ],
      present: [],
    },
  );

  TestValidator.equals(
    "each term is judged alone, and an exclude that excludes nothing is too",
    {
      // One real term and one typo. A check on the selection as a whole passes
      // this, because `test_alpha` ran something.
      partial: scenarioSelectionDiagnostics({
        discovered,
        exclude: [],
        include: ["test_alpha", "test_delta"],
        selected: 1,
      }),
      excluded: scenarioSelectionDiagnostics({
        discovered,
        exclude: ["test_delta"],
        include: [],
        selected: 3,
      }),
    },
    {
      partial: [
        "--include test_delta names no scenario among the 3 discovered; correct the term or restore the scenario",
      ],
      excluded: [
        "--exclude test_delta names no scenario among the 3 discovered, so it excluded nothing",
      ],
    },
  );

  TestValidator.equals(
    "a combination whose halves are each real is refused as a combination",
    {
      // Both terms name something; together they leave nothing. No term is
      // wrong here, so naming one would send the reader to the wrong place.
      combination: scenarioSelectionDiagnostics({
        discovered,
        exclude: ["test_alpha"],
        include: ["test_alpha"],
        selected: 0,
      }),
      // And no filter at all, which is every ordinary run: nothing was asked
      // for, so nothing failed to be found.
      unfiltered: scenarioSelectionDiagnostics({
        discovered,
        exclude: [],
        include: [],
        selected: 0,
      }),
    },
    {
      combination: [
        "the requested filter selected none of the 3 discovered scenarios",
      ],
      unfiltered: [],
    },
  );

  // Read from the files that pass them and checked against the scenarios
  // actually shipped, which is what stops the next rename from switching a
  // build-lane step off.
  const names = discoveredScenarioNames();
  const requested = requestedScenarioTerms(ROOT);
  TestValidator.equals(
    "every term the repository's own commands pass names a shipped scenario",
    {
      unmatched: requested.filter(
        (one) => names.some((name) => name.includes(one.term)) === false,
      ),
      // The terms themselves rather than how many there are: a count says the
      // population's size and this says which checks depend on the filter. One
      // of them was `test_lint_plugin_walking_skeleton`, deleted with
      // `@automovie/lint` in #1811 and left behind here, running nothing and
      // exiting 0 ever since.
      requested,
      population: names.length >= 100,
    },
    {
      unmatched: [],
      requested: [
        {
          source: ".github/workflows/build.yml",
          term: "test_evidence_authoring_reachability",
        },
        {
          source: ".github/workflows/build.yml",
          term: "test_cli_scaffold_evidence_gate",
        },
        {
          source: "test/package.json",
          term: "test_workspace_public_api_consumers",
        },
      ],
      population: true,
    },
  );
};
