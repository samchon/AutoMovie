import { TestValidator } from "@nestia/e2e";
import {
  closeAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "automovie";

import { throwsError } from "../internal/predicates";
import {
  createProjectStateClosureFixture,
  projectStateClosureTamperDiagnostic,
  projectStateWithClosureFailure,
} from "../internal/projectStateClosureFixtures";

/**
 * Measurement callers must refuse the same-fingerprint closing tamper witness.
 *
 * Scenarios:
 * 1. Tampering reported only by the initial or either closing pass reaches the
 *    actual current guard as stale, with the generated-tampered diagnostic intact.
 * 2. A missing manifest reaches the same guard as missing instead of stale.
 */
export const test_cli_project_state_closure_refusal = (): void => {
  for (const ending of ["initial", "first", "second"] as const) {
    const fixture = createProjectStateClosureFixture();
    const tamper = projectStateClosureTamperDiagnostic();
    fixture[ending].success = false;
    fixture[ending].diagnostics = [tamper];
    const result = closeAutoMovieProjectState(fixture.input);
    TestValidator.equals(
      `${ending} failure arranged`,
      result.freshness.currentFingerprint,
      result.freshness.compileFingerprint,
    );
    TestValidator.equals(
      `${ending} original cause`,
      result.freshness.diagnostics,
      [tamper],
    );
    const state = projectStateWithClosureFailure(result.freshness);
    TestValidator.predicate(
      `${ending} current-only refusal`,
      throwsError(
        () => requireCurrentAutoMovieProjectState(state),
        ["stale", "revision 7", "current-compile-invalid"],
      ),
    );
  }
  const fixture = createProjectStateClosureFixture();
  fixture.input.manifest = null;
  fixture.input.read.manifest = () => null;
  const result = closeAutoMovieProjectState(fixture.input);
  const state = projectStateWithClosureFailure(result.freshness);
  state.generated.manifest = null;
  TestValidator.predicate(
    "missing current-only refusal",
    throwsError(
      () => requireCurrentAutoMovieProjectState(state),
      ["missing", "revision 7"],
    ),
  );
};
