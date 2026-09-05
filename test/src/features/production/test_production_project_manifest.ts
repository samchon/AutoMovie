import { AutoMovieProject } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts, throwsError } from "../internal/predicates";
import { isolatedFileSystemTest } from "../internal/testFileSystem";

interface IProjectManifestFixtureFailure {
  error: unknown;
}

class ProjectManifestFixtureCleanupError extends AggregateError {}

/** Remove the project-manifest fixture without replacing its primary failure. */
const preserveProjectManifestFixtureCleanup = (
  failure: IProjectManifestFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProjectManifestFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Project-manifest fixture cleanup failed after the test failed.",
    );
  }
};

interface IProjectManifestRaceCleanup {
  cleanup: () => unknown;
  resource: string;
}

class ProjectManifestRaceCleanupError extends AggregateError {}

/** Attempt every project-manifest race cleanup without hiding failure. */
const preserveProjectManifestRaceCleanup = (
  failure: IProjectManifestFixtureFailure | undefined,
  resources: readonly IProjectManifestRaceCleanup[],
): void => {
  const cleanupFailures: Array<{ error: unknown; resource: string }> = [];
  for (const resource of resources)
    try {
      resource.cleanup();
    } catch (error) {
      cleanupFailures.push({ error, resource: resource.resource });
    }
  if (cleanupFailures.length === 1 && failure === undefined)
    throw cleanupFailures[0]!.error;
  if (cleanupFailures.length !== 0)
    throw new ProjectManifestRaceCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `Project-manifest race cleanup failed${
        failure === undefined ? "" : " after the race failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};

/**
 * Opening an existing project is a pure read (#700): a fresh directory gets its
 * manifest created once, but reopening an unchanged project must not rewrite
 * the file: an activation that churned the mtime would turn a `get*` read into
 * a disk write, and a round-trip that reserialized through the known-fields
 * type would drop any host/future manifest field. A real mutation
 * (`registerAsset`) still rewrites, and must carry the unknown field through.
 *
 * Scenarios:
 *
 * 1. A fresh dir → the manifest is created with `{version, assets}`.
 * 2. Reopening an unchanged project leaves the manifest file byte-identical (no
 *    write on open), including an unknown `future` field a newer host wrote.
 * 3. A mutation (`registerAsset`) rewrites the manifest yet preserves the unknown
 *    `future` field (the spread keeps it).
 * 4. A parseable but invalid manifest shape reports a project-state repair error
 *    on open, not a later raw TypeError.
 * 5. Parseable manifest assets still obey the same project-relative path policy as
 *    new registrations.
 * 6. Manifest asset entries remain a unique index after path normalization.
 */
const runProjectManifest = (fileSystem: typeof fs): void => {
  const mutableFileSystem = fileSystem as {
    lstatSync: typeof fs.lstatSync;
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-manifest-"));
  let projectManifestFailure: IProjectManifestFixtureFailure | undefined;
  try {
    const manifestPath = path.join(root, "automovie.json");
    // 1. fresh dir initializes the manifest once.
    AutoMovieProject.open(root);
    TestValidator.equals(
      "fresh manifest created",
      JSON.parse(fs.readFileSync(manifestPath, "utf8")),
      { version: 1, assets: [] },
    );

    // 2. hand-write a manifest carrying an unknown host/future field, then open
    //    the project and assert the file was NOT touched (read purity).
    const withUnknown = `${JSON.stringify(
      { version: 1, assets: ["models/a.glb"], future: { theme: "noir" } },
      null,
      2,
    )}\n`;
    fs.writeFileSync(manifestPath, withUnknown);
    const before = fs.readFileSync(manifestPath, "utf8");
    const nativeManifestExists = fs.existsSync;
    const nativeManifestLstat = fs.lstatSync;
    const parkedManifest = `${manifestPath}.read-parked`;
    let manifestSwapBoundary: "exists" | "lstat" | null = null;
    const swapManifest = (): void => {
      fs.renameSync(manifestPath, parkedManifest);
      fs.writeFileSync(
        manifestPath,
        `${JSON.stringify({
          version: 1,
          assets: ["models/transient.glb"],
        })}\n`,
      );
    };
    fileSystem.existsSync = ((file: fs.PathLike): boolean => {
      const exists = nativeManifestExists(file);
      if (
        exists &&
        manifestSwapBoundary === null &&
        path.resolve(file.toString()) === path.resolve(manifestPath)
      ) {
        manifestSwapBoundary = "exists";
        swapManifest();
      }
      return exists;
    }) as typeof fs.existsSync;
    mutableFileSystem.lstatSync = ((file, options) => {
      const status = nativeManifestLstat(file, options);
      if (
        manifestSwapBoundary === null &&
        path.resolve(file.toString()) === path.resolve(manifestPath)
      ) {
        manifestSwapBoundary = "lstat";
        swapManifest();
      }
      return status;
    }) as typeof fs.lstatSync;
    let manifestSwapRejected = false;
    let manifestRaceFailure: IProjectManifestFixtureFailure | undefined;
    try {
      manifestSwapRejected = throwsError(
        () => AutoMovieProject.open(root),
        ["changed physical identity", "automovie.json"],
      );
    } catch (error) {
      manifestRaceFailure = { error };
      throw error;
    } finally {
      preserveProjectManifestRaceCleanup(manifestRaceFailure, [
        {
          resource: "manifest exists hook",
          cleanup: () => {
            fileSystem.existsSync = nativeManifestExists;
          },
        },
        {
          resource: "manifest lstat hook",
          cleanup: () => {
            mutableFileSystem.lstatSync = nativeManifestLstat;
          },
        },
        {
          resource: "manifest transient replacement",
          cleanup: () => {
            if (nativeManifestExists(parkedManifest))
              fs.rmSync(manifestPath, { force: true });
          },
        },
        {
          resource: "manifest parked resident",
          cleanup: () => {
            if (nativeManifestExists(parkedManifest))
              fs.renameSync(parkedManifest, manifestPath);
          },
        },
      ]);
    }
    TestValidator.equals(
      "manifest reads reject replacement between first observation and descriptor open",
      namedFacts([
        ["manifestSwapBoundaryLstat", () => manifestSwapBoundary === "lstat"],
        [
          "manifestSwapRejected",
          () => manifestSwapBoundary === "lstat" && manifestSwapRejected,
        ],
      ]),
      { manifestSwapBoundaryLstat: true, manifestSwapRejected: true },
    );
    const project = AutoMovieProject.open(root);
    TestValidator.equals(
      "opening an existing project does not rewrite the manifest",
      fs.readFileSync(manifestPath, "utf8"),
      before,
    );
    TestValidator.equals(
      "the opened project sees the existing assets",
      project.assets,
      ["models/a.glb"],
    );

    // 3. a real mutation rewrites the manifest but keeps the unknown field.
    project.registerAsset("models/b.glb");
    const after = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    TestValidator.equals("mutation appends the asset", after.assets, [
      "models/a.glb",
      "models/b.glb",
    ]);
    TestValidator.equals(
      "mutation preserves the unknown future field",
      after.future,
      { theme: "noir" },
    );

    fs.writeFileSync(
      manifestPath,
      `${JSON.stringify({ version: 1 }, null, 2)}\n`,
    );
    TestValidator.predicate(
      "invalid manifest has project guidance",
      throwsError(
        () => AutoMovieProject.open(root),
        ["AutoMovie project file", "automovie.json", "Fix or remove", "assets"],
      ),
    );

    for (const bad of [
      "../escape.glb",
      "/etc/passwd",
      "models//gap.glb",
      " ",
    ]) {
      fs.writeFileSync(
        manifestPath,
        `${JSON.stringify({ version: 1, assets: [bad] }, null, 2)}\n`,
      );
      TestValidator.predicate(
        `invalid manifest asset refuses: "${bad}"`,
        throwsError(
          () => AutoMovieProject.open(root),
          [
            "AutoMovie project file",
            "automovie.json",
            "Fix or remove",
            "assets[0]",
            "asset path",
          ],
        ),
      );
    }

    for (const assets of [
      ["models/a.glb", "models/a.glb"],
      ["models/a.glb", "models\\a.glb"],
    ]) {
      fs.writeFileSync(
        manifestPath,
        `${JSON.stringify({ version: 1, assets }, null, 2)}\n`,
      );
      TestValidator.predicate(
        `duplicate manifest asset refuses: ${assets.join(", ")}`,
        throwsError(
          () => AutoMovieProject.open(root),
          [
            "AutoMovie project file",
            "automovie.json",
            "Fix or remove",
            "assets[1]",
            "duplicate",
            "models/a.glb",
          ],
        ),
      );
    }

    fs.rmSync(manifestPath);
    fs.mkdirSync(manifestPath);
    TestValidator.predicate(
      "a non-file optional manifest keeps project repair diagnostics",
      throwsError(
        () => AutoMovieProject.open(root),
        ["AutoMovie project file", "automovie.json", "physical file"],
      ),
    );
    fs.rmSync(manifestPath, { recursive: true });

    const optionalRoot = path.join(root, "optional-root-race");
    const optionalParked = `${optionalRoot}.parked`;
    fs.mkdirSync(optionalRoot);
    const optionalRevision = path.join(optionalRoot, "revision.json");
    const nativeOptionalLstat = fs.lstatSync;
    let optionalRootSwapped = false;
    let optionalReplacementUntouched = false;
    mutableFileSystem.lstatSync = ((file, options) => {
      try {
        return nativeOptionalLstat(file, options);
      } catch (error) {
        if (
          optionalRootSwapped === false &&
          path.resolve(file.toString()) === path.resolve(optionalRevision) &&
          (error as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          fs.renameSync(optionalRoot, optionalParked);
          fs.mkdirSync(optionalRoot);
          optionalRootSwapped = true;
        }
        throw error;
      }
    }) as typeof fs.lstatSync;
    let optionalSwapRejected = false;
    let optionalRaceFailure: IProjectManifestFixtureFailure | undefined;
    try {
      optionalSwapRejected = throwsError(
        () => AutoMovieProject.open(optionalRoot),
        ["changed physical identity", "optional-root-race"],
      );
    } catch (error) {
      optionalRaceFailure = { error };
      throw error;
    } finally {
      preserveProjectManifestRaceCleanup(optionalRaceFailure, [
        {
          resource: "optional-root lstat hook",
          cleanup: () => {
            mutableFileSystem.lstatSync = nativeOptionalLstat;
          },
        },
        {
          resource: "optional-root replacement observation",
          cleanup: () => {
            optionalReplacementUntouched =
              fs.existsSync(optionalRoot) &&
              fs.readdirSync(optionalRoot).length === 0;
          },
        },
        {
          resource: "optional-root active replacement",
          cleanup: () =>
            fs.rmSync(optionalRoot, { recursive: true, force: true }),
        },
        {
          resource: "optional-root parked resident",
          cleanup: () => {
            if (fs.existsSync(optionalParked))
              fs.renameSync(optionalParked, optionalRoot);
          },
        },
      ]);
    }
    TestValidator.equals(
      "optional absence revalidates its captured project ancestry",
      namedFacts([
        ["optionalRootSwapped", () => optionalRootSwapped],
        ["optionalSwapRejected", () => optionalSwapRejected],
        ["optionalReplacementUntouched", () => optionalReplacementUntouched],
      ]),
      {
        optionalRootSwapped: true,
        optionalSwapRejected: true,
        optionalReplacementUntouched: true,
      },
    );
    fs.rmSync(optionalRoot, { recursive: true, force: true });

    const linkedRoot = `${root}-linked`;
    fs.symlinkSync(
      root,
      linkedRoot,
      process.platform === "win32" ? "junction" : "dir",
    );
    let linkedRootFailure: IProjectManifestFixtureFailure | undefined;
    try {
      TestValidator.predicate(
        "project roots reject symlinks before creating resident state",
        throwsError(
          () => AutoMovieProject.open(linkedRoot),
          ["AutoMovie project root", "symbolic link"],
        ),
      );
    } catch (error) {
      linkedRootFailure = { error };
      throw error;
    } finally {
      preserveProjectManifestRaceCleanup(linkedRootFailure, [
        {
          resource: "linked project root",
          cleanup: () => fs.unlinkSync(linkedRoot),
        },
      ]);
    }
  } catch (error) {
    projectManifestFailure = { error };
    throw error;
  } finally {
    preserveProjectManifestFixtureCleanup(projectManifestFailure, () =>
      fs.rmSync(root, { recursive: true, force: true }),
    );
  }
};

export const test_production_project_manifest =
  isolatedFileSystemTest(runProjectManifest);
