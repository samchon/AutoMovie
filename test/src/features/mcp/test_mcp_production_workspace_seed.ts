import { findAutoMovieProjectRoot } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts, throwsError } from "../internal/predicates";

interface IWorkspaceSeedFixtureFailure {
  error: unknown;
}

class WorkspaceSeedFixtureCleanupError extends AggregateError {}

/** Remove one seed fixture root without replacing its primary failure. */
const preserveWorkspaceSeedFixtureCleanup = (
  failure: IWorkspaceSeedFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new WorkspaceSeedFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Workspace-seed fixture cleanup failed after the test failed.",
    );
  }
};

/**
 * The workspace a host-owned seed resolves to, and the refusal when there is
 * none.
 *
 * Every MCP entry point starts here: the host hands in whatever path it happens
 * to hold -- a directory, a file inside the project, or nothing at all -- and
 * this walk decides which immutable workspace the session belongs to. Its
 * branches had no test of their own, because every caller in the suite passed a
 * root that already carried a marker.
 *
 * Scenarios:
 *
 * 1. A directory carrying `automovie.config.ts` resolves to itself, and so does
 *    one carrying only `.automovie/manifest.json`.
 * 2. A seed that is a FILE resolves to the directory holding it, which is what a
 *    host passing `__filename` relies on.
 * 3. A seed nested below the marker walks up to the nearest one, and a nested
 *    marker wins over its ancestor.
 * 4. A seed with no marker above it is refused by name, with the two ways to make
 *    it resolvable stated in the message rather than implied.
 */
export const test_mcp_production_workspace_seed = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-seed-"));
  let workspaceSeedFailure: IWorkspaceSeedFixtureFailure | undefined;
  try {
    const configured = path.join(root, "configured");
    const manifested = path.join(root, "manifested");
    const nested = path.join(configured, "src", "shots");
    const inner = path.join(configured, "inner");
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(path.join(manifested, ".automovie"), { recursive: true });
    fs.mkdirSync(inner, { recursive: true });
    fs.writeFileSync(
      path.join(configured, "automovie.config.ts"),
      "export {};",
    );
    fs.writeFileSync(
      path.join(manifested, ".automovie", "manifest.json"),
      "{}\n",
    );
    fs.writeFileSync(path.join(inner, "automovie.config.ts"), "export {};");
    const seedFile = path.join(nested, "opening.ts");
    fs.writeFileSync(seedFile, "export {};");
    TestValidator.equals(
      "a host seed resolves to the nearest workspace marker above it",
      namedFacts([
        [
          "configDirectoryResolvesToItself",
          () => findAutoMovieProjectRoot(configured) === configured,
        ],
        [
          "manifestDirectoryResolvesToItself",
          () => findAutoMovieProjectRoot(manifested) === manifested,
        ],
        [
          "fileSeedResolvesToItsWorkspace",
          () => findAutoMovieProjectRoot(seedFile) === configured,
        ],
        [
          "nestedDirectoryWalksUp",
          () => findAutoMovieProjectRoot(nested) === configured,
        ],
        [
          "nearestMarkerWinsOverAncestor",
          () => findAutoMovieProjectRoot(inner) === inner,
        ],
      ]),
      {
        configDirectoryResolvesToItself: true,
        manifestDirectoryResolvesToItself: true,
        fileSeedResolvesToItsWorkspace: true,
        nestedDirectoryWalksUp: true,
        nearestMarkerWinsOverAncestor: true,
      },
    );
    TestValidator.predicate(
      "a seed with no workspace above it is refused with both remedies named",
      throwsError(
        () => findAutoMovieProjectRoot(path.parse(root).root),
        [
          "No AutoMovie workspace marker was found",
          "automovie.config.ts",
          ".automovie/manifest.json",
        ],
      ),
    );
  } catch (error) {
    workspaceSeedFailure = { error };
    throw error;
  } finally {
    preserveWorkspaceSeedFixtureCleanup(workspaceSeedFailure, () =>
      fs.rmSync(root, { recursive: true, force: true }),
    );
  }
};
