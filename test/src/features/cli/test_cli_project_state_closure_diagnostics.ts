import { TestValidator } from "@nestia/e2e";
import { closeAutoMovieProjectState } from "automovie";

import {
  createProjectStateClosureFixture,
  projectStateClosureTamperDiagnostic,
} from "../internal/projectStateClosureFixtures";

/**
 * Diagnostics are the union of observed causes, independent of the final pass.
 *
 * Scenarios:
 * 1. An initially observed warning survives, and a same-fingerprint
 *    tamper error survives a successful final pass.
 * 2. Exact duplicate records collapse despite different object property order;
 *    a changed category, phase, target, path, code, or message remains distinct.
 * 3. Later mutation of compiler-owned records cannot rewrite returned evidence.
 */
export const test_cli_project_state_closure_diagnostics = (): void => {
  const fixture = createProjectStateClosureFixture();
  const tamper = projectStateClosureTamperDiagnostic();
  const warning = { ...tamper, category: "warning" as const };
  const variants = [
    { ...tamper, phase: "source" as const },
    { ...tamper, target: "second-generated-owner" },
    { ...tamper, path: null },
    { ...tamper, code: "source-execution-failed" as const },
    { ...tamper, message: "A second generated record changed." },
  ];
  fixture.initial.diagnostics = [warning];
  fixture.first.success = false;
  fixture.first.diagnostics = [
    tamper,
    ...variants,
    {
      message: tamper.message,
      path: tamper.path,
      target: tamper.target,
      phase: tamper.phase,
      category: tamper.category,
      code: tamper.code,
    },
  ];
  fixture.second.diagnostics = [warning];
  const expected = structuredClone([warning, tamper, ...variants]);
  const result = closeAutoMovieProjectState(fixture.input);
  TestValidator.equals(
    "same identity tamper refuses",
    result.freshness.status,
    "stale",
  );
  TestValidator.equals("ordered union", result.freshness.diagnostics, expected);
  tamper.message = "mutated after closing";
  warning.path = "different.json";
  fixture.first.diagnostics.length = 0;
  TestValidator.equals(
    "diagnostic snapshot retained",
    result.freshness.diagnostics,
    expected,
  );
};
