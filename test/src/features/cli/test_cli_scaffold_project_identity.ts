import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts, throwsError } from "../internal/predicates";
import { requireSourceModule } from "../internal/requireSourceModule";

const projectIdentityPath = path.resolve(
  __dirname,
  "../../../../packages/template/scaffold/scripts/projectIdentity.ts",
);

const identity = requireSourceModule<{
  readAutoMovieProjectProductionId: (root: string) => string;
  currentAutoMovieProductionId: () => string;
}>(projectIdentityPath, [
  "readAutoMovieProjectProductionId",
  "currentAutoMovieProductionId",
]);

interface IProjectIdentityFailure {
  error: unknown;
}

class ProjectIdentityFixtureCleanupError extends AggregateError {}

/** Remove one identity fixture root without replacing its primary failure. */
const preserveProjectIdentityCleanup = (
  failure: IProjectIdentityFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProjectIdentityFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Project-identity fixture cleanup failed after the test failed.",
    );
  }
};

/** Write one package manifest body into a fresh child directory. */
const manifest = (root: string, name: string, body: string): string => {
  const directory = path.join(root, name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "package.json"), body, "utf8");
  return directory;
};

/**
 * The production namespace a generated project derives from its own manifest.
 *
 * A project already writes its identity once, in `package.json`, and every
 * script that opens the production reads that file anyway. Declaring the
 * namespace a second time could only restate it or disagree with it, and the
 * disagreement is the failure that matters: a renamed package would leave its
 * production state stranded under the old name. So the namespace is derived,
 * and the read refuses rather than guessing, because a guessed namespace puts
 * state under a name nothing else in the project knows.
 *
 * Scenarios:
 *
 * 1. A manifest declaring a trimmed non-empty `name` yields exactly that name,
 *    including a scoped one, and `currentAutoMovieProductionId` reads the
 *    manifest of the working directory rather than of any other root.
 * 2. A missing manifest is refused and the refusal names the file it looked
 *    for, so the reader learns where the project was expected to be.
 * 3. A manifest that is not JSON, and manifests parsing to an array, to `null`,
 *    and to a primitive, are each refused separately: parsing is not the same
 *    check as being a JSON object, and `null` passes a bare `typeof` test.
 * 4. A manifest with no `name`, a non-string `name`, an empty `name`, and an
 *    untrimmed `name` are all refused. The untrimmed case is the one that would
 *    otherwise pass silently and address a namespace differing only by
 *    whitespace.
 */
export const test_cli_scaffold_project_identity = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-identity-"));
  let identityFailure: IProjectIdentityFailure | undefined;
  try {
    const named = manifest(root, "named", '{ "name": "starter-film" }\n');
    const scoped = manifest(root, "scoped", '{ "name": "@studio/feature" }\n');
    const absent = path.join(root, "absent");
    fs.mkdirSync(absent, { recursive: true });
    const unparsable = manifest(root, "unparsable", "{ not json ");
    const array = manifest(root, "array", "[]");
    const primitive = manifest(root, "primitive", '"starter-film"');
    const nullish = manifest(root, "nullish", "null");
    const nameless = manifest(root, "nameless", '{ "version": "0.1.0" }');
    const numeric = manifest(root, "numeric", '{ "name": 7 }');
    const empty = manifest(root, "empty", '{ "name": "" }');
    const untrimmed = manifest(root, "untrimmed", '{ "name": " starter " }');
    const originalDirectory = process.cwd();
    let current = "";
    try {
      process.chdir(scoped);
      current = identity.currentAutoMovieProductionId();
    } finally {
      process.chdir(originalDirectory);
    }

    TestValidator.equals(
      "a declared namespace is read verbatim from the project's own manifest",
      [
        identity.readAutoMovieProjectProductionId(named),
        identity.readAutoMovieProjectProductionId(scoped),
        current,
      ],
      ["starter-film", "@studio/feature", "@studio/feature"],
    );

    TestValidator.equals(
      "a manifest that cannot name a production is refused instead of guessed",
      namedFacts([
        [
          "missingManifestNamesTheFile",
          () =>
            throwsError(
              () => identity.readAutoMovieProjectProductionId(absent),
              [path.join(absent, "package.json"), "is unreadable"],
            ),
        ],
        [
          "unparsableManifest",
          () =>
            throwsError(
              () => identity.readAutoMovieProjectProductionId(unparsable),
              "is not valid JSON",
            ),
        ],
        [
          "arrayManifest",
          () =>
            throwsError(
              () => identity.readAutoMovieProjectProductionId(array),
              "is not a JSON object",
            ),
        ],
        [
          "primitiveManifest",
          () =>
            throwsError(
              () => identity.readAutoMovieProjectProductionId(primitive),
              "is not a JSON object",
            ),
        ],
        [
          "nullManifest",
          () =>
            throwsError(
              () => identity.readAutoMovieProjectProductionId(nullish),
              "is not a JSON object",
            ),
        ],
        [
          "namelessManifest",
          () =>
            throwsError(
              () => identity.readAutoMovieProjectProductionId(nameless),
              'declares no trimmed non-empty "name"',
            ),
        ],
        [
          "numericName",
          () =>
            throwsError(
              () => identity.readAutoMovieProjectProductionId(numeric),
              'declares no trimmed non-empty "name"',
            ),
        ],
        [
          "emptyName",
          () =>
            throwsError(
              () => identity.readAutoMovieProjectProductionId(empty),
              'declares no trimmed non-empty "name"',
            ),
        ],
        [
          "untrimmedName",
          () =>
            throwsError(
              () => identity.readAutoMovieProjectProductionId(untrimmed),
              'declares no trimmed non-empty "name"',
            ),
        ],
      ]),
      {
        missingManifestNamesTheFile: true,
        unparsableManifest: true,
        arrayManifest: true,
        primitiveManifest: true,
        nullManifest: true,
        namelessManifest: true,
        numericName: true,
        emptyName: true,
        untrimmedName: true,
      },
    );
  } catch (error) {
    identityFailure = { error };
    throw error;
  } finally {
    preserveProjectIdentityCleanup(identityFailure, () =>
      fs.rmSync(root, { recursive: true, force: true }),
    );
  }
};
