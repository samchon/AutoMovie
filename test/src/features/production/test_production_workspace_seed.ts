import { findAutoMovieProjectRoot } from "@automovie/production";
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
 * Every production entry point starts here: the caller hands in whatever path
 * it happens to hold -- a directory, a file inside the project, or nothing at
 * all -- and this walk decides which immutable workspace the session belongs
 * to. Its branches had no test of their own, because every caller in the suite
 * passed a root that already carried a marker.
 *
 * A project is recognized by markers it already has for reasons of its own: the
 * `package.json` that names it and the `lint.config.ts` that declares its
 * production kind, populations, stages, and graph. Both are required, which is
 * what keeps a seed inside an ordinary Node package from resolving to that
 * package and having a production namespace created underneath it, and the
 * requirement is `every` rather than `some` for exactly that reason. The legacy
 * `automovie/manifest.json` is deliberately not a marker any more: import input
 * is not a shape a current project is asked to carry, so discovery must not
 * wait for a state tree to exist. `automovie.config.ts` is no longer one
 * either, because the delivery decisions it carried moved onto the production
 * design record and no file is left whose only job is to be found.
 *
 * Scenarios:
 *
 * 1. A directory carrying both markers resolves to itself.
 * 2. A directory carrying only `package.json`, one carrying only
 *    `lint.config.ts`, and one carrying only the legacy
 *    `automovie/manifest.json` are each walked past rather than resolved.
 * 3. A seed that is a FILE resolves to the directory holding it, which is what
 *    a host passing `__filename` relies on.
 * 4. A seed nested below a project walks up to the nearest one, and a nested
 *    project wins over its ancestor.
 * 5. A seed with no project above it is refused by name, with both markers
 *    stated in the message rather than implied.
 */
export const test_production_workspace_seed = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-seed-"));
  let workspaceSeedFailure: IWorkspaceSeedFixtureFailure | undefined;
  try {
    /** Give one directory the complete generated-project marker pair. */
    const project = (directory: string): string => {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, "package.json"), '{ "name": "p" }');
      fs.writeFileSync(
        path.join(directory, "lint.config.ts"),
        "export default {};",
      );
      return directory;
    };
    const complete = project(path.join(root, "complete"));
    const nested = path.join(complete, "src", "shots");
    const inner = project(path.join(complete, "inner"));
    const packageOnly = path.join(root, "package-only");
    const graphOnly = path.join(root, "graph-only");
    const legacyOnly = path.join(root, "legacy-only");
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(packageOnly, { recursive: true });
    fs.mkdirSync(graphOnly, { recursive: true });
    fs.mkdirSync(path.join(legacyOnly, "automovie"), { recursive: true });
    fs.writeFileSync(path.join(packageOnly, "package.json"), '{ "name": "p" }');
    fs.writeFileSync(
      path.join(graphOnly, "lint.config.ts"),
      "export default {};",
    );
    fs.writeFileSync(
      path.join(legacyOnly, "automovie", "manifest.json"),
      "{}\n",
    );
    const seedFile = path.join(nested, "opening.ts");
    fs.writeFileSync(seedFile, "export {};");
    TestValidator.equals(
      "a host seed resolves to the nearest complete project above it",
      namedFacts([
        [
          "completeProjectResolvesToItself",
          () => findAutoMovieProjectRoot(complete) === complete,
        ],
        [
          "packageAloneIsNotAProject",
          () =>
            throwsError(
              () => findAutoMovieProjectRoot(packageOnly),
              "No AutoMovie project was found",
            ),
        ],
        [
          "graphDeclarationAloneIsNotAProject",
          () =>
            throwsError(
              () => findAutoMovieProjectRoot(graphOnly),
              "No AutoMovie project was found",
            ),
        ],
        [
          "legacyStateTreeIsNotAProject",
          () =>
            throwsError(
              () => findAutoMovieProjectRoot(legacyOnly),
              "No AutoMovie project was found",
            ),
        ],
        [
          "fileSeedResolvesToItsWorkspace",
          () => findAutoMovieProjectRoot(seedFile) === complete,
        ],
        [
          "nestedDirectoryWalksUp",
          () => findAutoMovieProjectRoot(nested) === complete,
        ],
        [
          "nearestMarkerWinsOverAncestor",
          () => findAutoMovieProjectRoot(inner) === inner,
        ],
      ]),
      {
        completeProjectResolvesToItself: true,
        packageAloneIsNotAProject: true,
        graphDeclarationAloneIsNotAProject: true,
        legacyStateTreeIsNotAProject: true,
        fileSeedResolvesToItsWorkspace: true,
        nestedDirectoryWalksUp: true,
        nearestMarkerWinsOverAncestor: true,
      },
    );
    TestValidator.predicate(
      "a seed with no project above it is refused with both markers named",
      throwsError(
        () => findAutoMovieProjectRoot(path.parse(root).root),
        ["No AutoMovie project was found", "package.json", "lint.config.ts"],
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
