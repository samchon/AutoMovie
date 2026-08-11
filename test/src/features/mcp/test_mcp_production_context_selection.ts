import { AutoMovieProductionContext } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts, throwsError } from "../internal/predicates";

interface IContextFixtureFailure {
  error: unknown;
}

class ContextFixtureCleanupError extends AggregateError {}

/** Remove one context fixture root without replacing its primary failure. */
const preserveContextFixtureCleanup = (
  failure: IContextFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ContextFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Context fixture cleanup failed after the test failed.",
    );
  }
};

/**
 * How a session picks the production it is talking about.
 *
 * A host opens one context per session and every tool call resolves through it,
 * so the selection rules are what stand between a host and evidence published
 * into the wrong namespace. They had no test: the suite's fixtures all register
 * exactly one production and pass its id explicitly.
 *
 * Scenarios:
 *
 * 1. A blank or untrimmed `productionId` is refused at construction and at
 *    resolution, because a namespace that differs only by whitespace would
 *    address a directory no compile owns.
 * 2. A project with no registry is refused by the registry reader, which runs
 *    before the selection rules and names the repair; naming a production does
 *    not skip it.
 * 3. A guide receives session credit only once recorded, and only under its own
 *    name.
 */
export const test_mcp_production_context_selection = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-context-"));
  let contextFailure: IContextFixtureFailure | undefined;
  try {
    fs.writeFileSync(path.join(root, "automovie.config.ts"), "export {};");
    TestValidator.equals(
      "a session resolves one production, or says exactly why it cannot",
      namedFacts([
        [
          "aBlankIdIsRefusedAtConstruction",
          () =>
            throwsError(
              () => new AutoMovieProductionContext(undefined, root, "  "),
              "trimmed non-empty production namespace",
            ),
        ],
        [
          "anUntrimmedIdIsRefusedAtConstruction",
          () =>
            throwsError(
              () => new AutoMovieProductionContext(undefined, root, "film "),
              "trimmed non-empty production namespace",
            ),
        ],
        [
          "anUntrimmedIdIsRefusedAtResolution",
          () =>
            throwsError(
              () =>
                new AutoMovieProductionContext(undefined, root).forProduction(
                  " film",
                ),
              "trimmed non-empty production namespace",
            ),
        ],
        [
          // A project with no registry never reaches the selection rules: the
          // registry read refuses first, and names the repair.
          "aProjectWithNoRegistryIsRefusedByTheRegistryReader",
          () =>
            throwsError(
              () =>
                new AutoMovieProductionContext(undefined, root).forProduction(),
              ["Invalid production registry", "Restore version 1"],
            ),
        ],
        [
          "namingAProductionDoesNotSkipTheRegistryReader",
          () =>
            throwsError(
              () =>
                new AutoMovieProductionContext(undefined, root).forProduction(
                  "ghost",
                ),
              "Invalid production registry",
            ),
        ],
        [
          "aGuideHasNoCreditBeforeItIsRecorded",
          () =>
            new AutoMovieProductionContext(undefined, root).hasGuide(
              "AUTOMOVIE_OVERALL",
            ) === false,
        ],
        [
          "aRecordedGuideHasCreditUnderItsOwnNameOnly",
          () => {
            const context = new AutoMovieProductionContext(undefined, root);
            context.recordGuide("AUTOMOVIE_OVERALL");
            return (
              context.hasGuide("AUTOMOVIE_OVERALL") &&
              context.hasGuide("CAPTURE_FRAME") === false
            );
          },
        ],
      ]),
      {
        aBlankIdIsRefusedAtConstruction: true,
        anUntrimmedIdIsRefusedAtConstruction: true,
        anUntrimmedIdIsRefusedAtResolution: true,
        aProjectWithNoRegistryIsRefusedByTheRegistryReader: true,
        namingAProductionDoesNotSkipTheRegistryReader: true,
        aGuideHasNoCreditBeforeItIsRecorded: true,
        aRecordedGuideHasCreditUnderItsOwnNameOnly: true,
      },
    );
  } catch (error) {
    contextFailure = { error };
    throw error;
  } finally {
    preserveContextFixtureCleanup(contextFailure, () =>
      fs.rmSync(root, { recursive: true, force: true }),
    );
  }
};
