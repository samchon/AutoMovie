import { TestValidator } from "@nestia/e2e";
import { closeAutoMovieProjectState } from "automovie";

import {
  createProjectStateClosureFixture,
  projectStateClosureReadFailure,
  projectStateClosureTamperDiagnostic,
} from "../internal/projectStateClosureFixtures";

/**
 * Any failed closing read refuses the snapshot while retaining earlier evidence.
 *
 * Scenarios:
 * 1. Throw from each of the six closing reads; Error and non-Error throws retain
 *    their cause and the read sequence stops at that boundary.
 * 2. A first-ending failure survives a subsequent throw with its diagnostics
 *    and last observed fingerprint; a failed design read keeps the initial design.
 */
export const test_cli_project_state_closure_reads = (): void => {
  const names = [
    "revision",
    "compile",
    "design",
    "compile",
    "manifest",
    "revision",
  ];
  for (let failure = 0; failure < names.length; failure++) {
    const fixture = createProjectStateClosureFixture();
    const diagnostic = projectStateClosureTamperDiagnostic();
    fixture.first.success = false;
    fixture.first.diagnostics = [diagnostic];
    fixture.first.builder.inputFingerprint = `sha256:${"b".repeat(64)}`;
    const injected = projectStateClosureReadFailure(
      fixture.input.read,
      failure,
    );
    fixture.input.read = injected.read;
    const result = closeAutoMovieProjectState(fixture.input);
    TestValidator.equals(
      `read ${failure} status`,
      result.freshness.status,
      "stale",
    );
    TestValidator.equals(
      `read ${failure} boundary`,
      injected.reached,
      names.slice(0, failure + 1),
    );
    TestValidator.equals(
      `read ${failure} causes`,
      result.freshness.problems.map((problem) => problem.code),
      failure > 1
        ? ["project-state-changed", "current-compile-invalid"]
        : ["project-state-changed"],
    );
    TestValidator.equals(
      `read ${failure} message`,
      result.freshness.problems[0]!.message,
      `read ${failure} failed`,
    );
    TestValidator.equals(
      `read ${failure} diagnostics`,
      result.freshness.diagnostics,
      failure > 1 ? [diagnostic] : [],
    );
    TestValidator.equals(
      `read ${failure} fingerprint`,
      result.freshness.currentFingerprint,
      failure === 2 || failure === 3
        ? fixture.first.builder.inputFingerprint
        : fixture.initial.builder.inputFingerprint,
    );
    TestValidator.predicate(
      `read ${failure} design`,
      result.design ===
        (failure > 2 ? fixture.endingDesign : fixture.input.design),
    );
  }
};
