import { TestValidator } from "@nestia/e2e";
import { closeAutoMovieProjectState } from "automovie";

import { createProjectStateClosureFixture } from "../internal/projectStateClosureFixtures";

/**
 * A successful final pass cannot grant current status over any earlier failure.
 *
 * Scenarios:
 * 1. Every initial/first-ending/second-ending success combination is supplied
 *    at one fixed fingerprint; only three successes may be current.
 * 2. A false verdict with no diagnostic still refuses current use, and several
 *    failures produce one compile problem rather than duplicate causes.
 */
export const test_cli_project_state_closure_verdicts = (): void => {
  for (const [initial, first, second, expected] of [
    [true, true, true, "current"],
    [false, true, true, "stale"],
    [true, false, true, "stale"],
    [true, true, false, "stale"],
    [false, false, true, "stale"],
    [false, true, false, "stale"],
    [true, false, false, "stale"],
    [false, false, false, "stale"],
  ] as const) {
    const fixture = createProjectStateClosureFixture();
    fixture.initial.success = initial;
    fixture.first.success = first;
    fixture.second.success = second;
    const result = closeAutoMovieProjectState(fixture.input);
    const label = `${initial}/${first}/${second}`;
    TestValidator.equals(`${label} status`, result.freshness.status, expected);
    TestValidator.equals(
      `${label} failure count`,
      result.freshness.problems.map((problem) => problem.code),
      expected === "current" ? [] : ["current-compile-invalid"],
    );
    TestValidator.equals(
      `${label} diagnostics`,
      result.freshness.diagnostics,
      [],
    );
    TestValidator.equals(
      `${label} input identity unchanged`,
      result.freshness.currentFingerprint,
      result.freshness.compileFingerprint,
    );
  }
};
