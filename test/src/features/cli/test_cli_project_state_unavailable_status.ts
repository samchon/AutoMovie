import { loadAutoMovieProjectState } from "@automovie/cli";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import { productionFixture } from "../mcp/productionFixtures";
import { preserveCliRootFixtureCleanup } from "./CliRootFixtureCleanup";

/**
 * The project-state reader keeps unavailable compiler status explicit.
 *
 * Scenarios:
 *
 * 1. Every read-only compiler probe throws. The returned state has no invented
 *    fingerprint or diagnostics, records both probe failures, and remains
 *    missing rather than presenting unavailable evidence as current.
 * 2. The initial probe succeeds and the ending fence throws. The state keeps the
 *    initial compiler fingerprint and diagnostics as the last available
 *    evidence while naming the failed ending fence.
 */
export const test_cli_project_state_unavailable_status = (): void => {
  const fixture = productionFixture();
  const lint = AutoMovieProductionCompiler.prototype.lint;
  let failure: { error: unknown } | undefined;
  try {
    AutoMovieProductionProject.open(fixture.root);
    AutoMovieProductionCompiler.prototype.lint = function (): never {
      throw new Error("compiler unavailable");
    };
    const state = loadAutoMovieProjectState({ root: fixture.root });
    TestValidator.equals(
      "unavailable status stays absent and identifies both read fences",
      namedFacts([
        ["missing", () => state.freshness.status === "missing"],
        [
          "currentFingerprintAbsent",
          () => state.freshness.currentFingerprint === null,
        ],
        ["diagnosticsAbsent", () => state.freshness.diagnostics.length === 0],
        [
          "initialProbeNamed",
          () =>
            state.freshness.problems.some(
              (problem) =>
                problem.code === "compile-status-unavailable" &&
                problem.message === "compiler unavailable",
            ),
        ],
        [
          "endingFenceNamed",
          () =>
            state.freshness.problems.some(
              (problem) =>
                problem.code === "project-state-changed" &&
                problem.message === "compiler unavailable",
            ),
        ],
      ]),
      {
        missing: true,
        currentFingerprintAbsent: true,
        diagnosticsAbsent: true,
        initialProbeNamed: true,
        endingFenceNamed: true,
      },
    );

    let calls = 0;
    let initialStatus: ReturnType<AutoMovieProductionCompiler["lint"]> | null =
      null;
    AutoMovieProductionCompiler.prototype.lint = function (input) {
      if (++calls !== 1) throw new Error("ending compiler unavailable");
      initialStatus = lint.call(this, input);
      return initialStatus;
    };
    const fallback = loadAutoMovieProjectState({ root: fixture.root });
    TestValidator.equals(
      "ending-fence failure preserves the initial compiler evidence",
      namedFacts([
        [
          "fingerprintPreserved",
          () =>
            fallback.freshness.currentFingerprint ===
            initialStatus?.compiler.inputFingerprint,
        ],
        [
          "diagnosticsPreserved",
          () =>
            JSON.stringify(fallback.freshness.diagnostics) ===
            JSON.stringify(initialStatus?.diagnostics),
        ],
        [
          "endingFenceNamed",
          () =>
            fallback.freshness.problems.some(
              (problem) =>
                problem.code === "project-state-changed" &&
                problem.message === "ending compiler unavailable",
            ),
        ],
      ]),
      {
        fingerprintPreserved: true,
        diagnosticsPreserved: true,
        endingFenceNamed: true,
      },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    AutoMovieProductionCompiler.prototype.lint = lint;
    preserveCliRootFixtureCleanup(
      failure,
      fixture.dispose,
      "project-state unavailable-status fixture",
    );
  }
};
