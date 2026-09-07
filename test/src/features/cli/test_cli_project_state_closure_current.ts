import { TestValidator } from "@nestia/e2e";
import { closeAutoMovieProjectState } from "automovie";

import {
  createProjectStateClosureFixture,
  projectStateClosureTamperDiagnostic,
} from "../internal/projectStateClosureFixtures";

/**
 * Current status requires a stable closing window after successful compilation.
 *
 * Scenarios:
 * 1. Three successes with equal manifest, revisions, and fingerprints remain
 *    current and preserve the two compile reads around the final design read.
 * 2. Empty diagnostic and problem populations remain empty and unmodified.
 * 3. A nonblocking warning retains current status and remains observable.
 */
export const test_cli_project_state_closure_current = (): void => {
  const fixture = createProjectStateClosureFixture();
  const before = structuredClone(fixture.input.design);
  const result = closeAutoMovieProjectState(fixture.input);
  TestValidator.equals("freshness", result.freshness, {
    status: "current",
    compileFingerprint: fixture.manifest.inputFingerprint,
    currentFingerprint: fixture.manifest.inputFingerprint,
    diagnostics: [],
    problems: [],
  });
  TestValidator.equals("closing read order", fixture.events, [
    "revision",
    "compile",
    "design",
    "compile",
    "manifest",
    "revision",
  ]);
  TestValidator.predicate(
    "last read design",
    result.design === fixture.endingDesign,
  );
  TestValidator.equals(
    "initial design preserved",
    fixture.input.design,
    before,
  );
  TestValidator.equals(
    "initial problems preserved",
    fixture.input.problems,
    [],
  );

  const warned = createProjectStateClosureFixture();
  const diagnostic = {
    ...projectStateClosureTamperDiagnostic(),
    category: "warning" as const,
  };
  warned.initial.diagnostics = [diagnostic];
  const warningResult = closeAutoMovieProjectState(warned.input);
  TestValidator.equals(
    "warning stays current",
    warningResult.freshness.status,
    "current",
  );
  TestValidator.equals(
    "warning stays visible",
    warningResult.freshness.diagnostics,
    [diagnostic],
  );
};
