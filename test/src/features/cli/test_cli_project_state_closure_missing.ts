import { TestValidator } from "@nestia/e2e";
import { closeAutoMovieProjectState } from "automovie";

import { createProjectStateClosureFixture } from "../internal/projectStateClosureFixtures";

/**
 * Missing generated evidence remains distinct from a failed manifest read.
 *
 * Scenarios:
 * 1. A normally absent manifest stays missing even if compilation failed.
 * 2. A failed manifest read stays stale and retains the adapter's exact problem.
 * 3. Unavailable initial compile identity refuses a later successful closure;
 *    with no completed compile read the current fingerprint stays null.
 */
export const test_cli_project_state_closure_missing = (): void => {
  for (const success of [true, false]) {
    const fixture = createProjectStateClosureFixture();
    fixture.input.manifest = null;
    fixture.input.read.manifest = () => null;
    fixture.initial.success = success;
    const result = closeAutoMovieProjectState(fixture.input);
    TestValidator.equals(
      `absent manifest ${success}`,
      result.freshness.status,
      "missing",
    );
    TestValidator.equals(
      `absent identity ${success}`,
      result.freshness.compileFingerprint,
      null,
    );
    TestValidator.equals(
      `absence preserves failure ${success}`,
      result.freshness.problems.map((problem) => problem.code),
      success ? [] : ["current-compile-invalid"],
    );
  }
  const invalid = createProjectStateClosureFixture();
  invalid.input.manifest = null;
  invalid.input.manifestReadFailed = true;
  invalid.input.read.manifest = () => null;
  invalid.input.problems = [
    {
      code: "generated-manifest-invalid",
      path: null,
      message: "Manifest read failed.",
    },
  ];
  const invalidResult = closeAutoMovieProjectState(invalid.input);
  TestValidator.equals(
    "unreadable is stale",
    invalidResult.freshness.status,
    "stale",
  );
  TestValidator.equals(
    "adapter problem preserved",
    invalidResult.freshness.problems,
    invalid.input.problems,
  );
  TestValidator.predicate(
    "input problems are not mutated",
    invalidResult.freshness.problems !== invalid.input.problems,
  );

  for (const endingAvailable of [true, false]) {
    const fixture = createProjectStateClosureFixture();
    fixture.input.compileStatus = null;
    fixture.input.problems = [
      {
        code: "compile-status-unavailable",
        path: null,
        message: "Initial lint threw.",
      },
    ];
    if (endingAvailable === false)
      fixture.input.read.compile = () => {
        throw new Error("Ending lint threw.");
      };
    const result = closeAutoMovieProjectState(fixture.input);
    TestValidator.equals(
      `initial unavailable ${endingAvailable}`,
      result.freshness.status,
      "stale",
    );
    TestValidator.equals(
      `unavailable causes ${endingAvailable}`,
      result.freshness.problems.map((problem) => problem.code),
      ["compile-status-unavailable", "project-state-changed"],
    );
    TestValidator.equals(
      `last available identity ${endingAvailable}`,
      result.freshness.currentFingerprint,
      endingAvailable ? fixture.initial.compiler.inputFingerprint : null,
    );
    TestValidator.equals(
      `input problems unchanged ${endingAvailable}`,
      fixture.input.problems.length,
      1,
    );
  }
};
