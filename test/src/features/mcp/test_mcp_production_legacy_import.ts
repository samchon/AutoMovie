import {
  IAutoMovieLegacyImportPlan,
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import {
  AutoMovieLegacyImporter,
  AutoMovieProductionProject,
  AutoMovieProject,
  IAutoMovieMcpWritableSlate,
  acquireCommitLock,
  digestAutoMovieBytes,
  releaseCommitLock,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const script: IAutoMovieScript = {
  logline: "A legacy door opens.",
  theme: "recovery",
  cast: [{ node: "hero", character: "Hero", modelRef: null }],
  beats: [
    {
      id: "b1",
      name: "open",
      summary: "The hero opens the door.",
      durationHint: 1,
    },
  ],
};

const shot: IAutoMovieShot = {
  id: "shot:b1",
  name: "Door",
  scene: "room",
  camera: "camera",
  cameraMotion: null,
  performances: [{ node: "hero", motion: null, startOffset: 0 }],
  objectMotions: [],
  duration: 1,
};

const film: IAutoMovieSequence = {
  id: "legacy-film",
  name: "Legacy film",
  fps: 24,
  shots: [{ shot: shot.id, trim: null, transition: null }],
};

const slate: IAutoMovieMcpWritableSlate = {
  script,
  scenes: [],
  shots: [shot],
  beatEnds: [],
  notes: [],
  film,
};

const throws = (task: () => unknown, fragment?: string): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    return (
      error instanceof Error &&
      (fragment === undefined || error.message.includes(fragment))
    );
  }
};

const captureFailure = (task: () => unknown): unknown => {
  try {
    task();
    return undefined;
  } catch (error) {
    return error;
  }
};

const aggregateContainsExactly = (
  error: unknown,
  expected: unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

interface ILegacyImportFixtureFailure {
  error: unknown;
}

interface ILegacyImportFixtureCleanup {
  cleanup: () => unknown;
  resource: string;
}

class LegacyImportFixtureCleanupError extends AggregateError {}

/** Attempt every acquired legacy-import cleanup without hiding failure. */
export const preserveLegacyImportFixtureCleanup = (
  failure: ILegacyImportFixtureFailure | undefined,
  resources: readonly ILegacyImportFixtureCleanup[],
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
    throw new LegacyImportFixtureCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `Legacy-import fixture cleanup failed${
        failure === undefined ? "" : " after the test failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};

class LegacyFixtureConstructionCleanupError extends AggregateError {}

/** Remove a partial legacy fixture without replacing its setup failure. */
export const throwLegacyFixtureConstructionFailure = (
  failure: unknown,
  cleanup: () => unknown,
): never => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    throw new LegacyFixtureConstructionCleanupError(
      [failure, cleanupFailure],
      "Legacy fixture construction and partial-root cleanup failed.",
    );
  }
  throw failure as Error;
};

const createLegacy = (): {
  root: string;
  dispose: () => void;
} => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-import-test-"));
  try {
    const project = AutoMovieProject.open(root);
    project.saveSlate(slate);
    project.registerAsset("assets/reference.bin", Buffer.from("legacy-asset"));
    fs.mkdirSync(path.join(root, "actors/archive"), { recursive: true });
    fs.writeFileSync(path.join(root, "actors/archive/README.txt"), "legacy");
    return {
      root,
      dispose: () => fs.rmSync(root, { force: true, recursive: true }),
    };
  } catch (error) {
    return throwLegacyFixtureConstructionFailure(error, () =>
      fs.rmSync(root, { force: true, recursive: true }),
    );
  }
};

const legacyFiles = (root: string): Map<string, Uint8Array> => {
  const output = new Map<string, Uint8Array>();
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".automovie")) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile())
        output.set(
          path.relative(root, absolute).split(path.sep).join("/"),
          fs.readFileSync(absolute),
        );
    }
  };
  visit(root);
  return output;
};

const equalFiles = (
  left: ReadonlyMap<string, Uint8Array>,
  right: ReadonlyMap<string, Uint8Array>,
): boolean =>
  left.size === right.size &&
  [...left].every(([file, bytes]) =>
    Buffer.from(right.get(file) ?? []).equals(Buffer.from(bytes)),
  );

const createMissingOwnedRoots = (
  root: string,
  plan: IAutoMovieLegacyImportPlan,
): void => {
  for (const baseline of plan.rollbackBaseline)
    if (baseline.existed === false)
      fs.mkdirSync(path.join(root, baseline.path));
};

const rejectsTamperedRollbackBaseline = (
  prepare: (root: string) => void,
  mutate: (plan: IAutoMovieLegacyImportPlan) => void,
): boolean => {
  const fixture = createLegacy();
  try {
    prepare(fixture.root);
    const importer = new AutoMovieLegacyImporter(fixture.root);
    importer.apply();
    const planPath = path.join(
      fixture.root,
      ".automovie/imports/legacy-v1/plan.json",
    );
    const plan = JSON.parse(
      fs.readFileSync(planPath, "utf8"),
    ) as IAutoMovieLegacyImportPlan;
    mutate(plan);
    fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
    return throws(() => importer.rollback(), "changed after import");
  } finally {
    fixture.dispose();
  }
};

/**
 * Legacy import plans, applies, reopens, and rolls back without byte loss.
 *
 * Scenarios:
 *
 * 1. Planning and applying preserve legacy bytes, publish bounded production
 *    drafts, reopen provenance, remain idempotent, and roll back exactly.
 * 2. Collisions, tamper, concurrent work, namespace replacement, and injected
 *    publication or restoration failures refuse destructive progress.
 * 3. A pre-existing owned directory that disappears after import must be restored
 *    before rollback, while an unexpected filesystem denial propagates instead
 *    of being misclassified as absence.
 * 4. Actorless shots report that their readable subject needs reconstruction, and
 *    canonical rollback plans reject wrong roots, escaping directories, and
 *    duplicate file entries.
 */
export const test_mcp_production_legacy_import = (): void => {
  const fixture = createLegacy();
  try {
    const before = legacyFiles(fixture.root);
    const importer = new AutoMovieLegacyImporter(fixture.root);
    const nativePlanWrite = fs.writeFileSync;
    const nativePlanRead = fs.readFileSync;
    const planLockPaths: string[] = [];
    const planManifestPath = path.join(fixture.root, "automovie.json");
    const planNestedPath = path.join(fixture.root, "actors/archive/README.txt");
    const planManifestBytes = fs.readFileSync(planManifestPath);
    const planNestedBytes = fs.readFileSync(planNestedPath);
    const planReadTargets = new Map(
      [
        {
          file: planManifestPath,
          parked: `${planManifestPath}.read-parked`,
          transient: Buffer.concat([planManifestBytes, Buffer.from(" ")]),
        },
        {
          file: planNestedPath,
          parked: `${planNestedPath}.read-parked`,
          transient: Buffer.from("transient nested legacy bytes"),
        },
      ].map((target) => [path.resolve(target.file), target] as const),
    );
    const planPathReads = new Set<string>();
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      Reflect.apply(nativePlanWrite, fs, [file, ...args]);
      if (
        typeof file !== "number" &&
        path.basename(path.dirname(file.toString())) ===
          ".automovie-root-locks" &&
        path.basename(file.toString()).startsWith("root-")
      )
        planLockPaths.push(path.resolve(file.toString()));
    }) as typeof fs.writeFileSync;
    fs.readFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      const resolved =
        typeof file === "number" ? null : path.resolve(file.toString());
      const target =
        resolved === null ? undefined : planReadTargets.get(resolved);
      if (target !== undefined) {
        planPathReads.add(resolved!);
        fs.renameSync(target.file, target.parked);
        fs.writeFileSync(target.file, target.transient);
        let planReadFailure: ILegacyImportFixtureFailure | undefined;
        try {
          return Reflect.apply(nativePlanRead, fs, [file, ...args]);
        } catch (error) {
          planReadFailure = { error };
          throw error;
        } finally {
          preserveLegacyImportFixtureCleanup(planReadFailure, [
            {
              resource: "plan-read transient source",
              cleanup: () => fs.rmSync(target.file),
            },
            {
              resource: "plan-read resident source",
              cleanup: () => fs.renameSync(target.parked, target.file),
            },
          ]);
        }
      }
      return Reflect.apply(nativePlanRead, fs, [file, ...args]);
    }) as typeof fs.readFileSync;
    let plan: IAutoMovieLegacyImportPlan;
    let planFailure: ILegacyImportFixtureFailure | undefined;
    try {
      plan = importer.plan();
    } catch (error) {
      planFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(planFailure, [
        {
          resource: "plan read hook",
          cleanup: () => {
            fs.readFileSync = nativePlanRead;
          },
        },
        {
          resource: "plan write hook",
          cleanup: () => {
            fs.writeFileSync = nativePlanWrite;
          },
        },
        ...Array.from(planReadTargets.values()).flatMap((target) => [
          {
            resource: `plan fallback transient ${target.file}`,
            cleanup: () => {
              if (fs.existsSync(target.parked))
                fs.rmSync(target.file, { force: true });
            },
          },
          {
            resource: `plan fallback resident ${target.file}`,
            cleanup: () => {
              if (fs.existsSync(target.parked))
                fs.renameSync(target.parked, target.file);
            },
          },
        ]),
      ]);
    }
    // Name each planning fact instead of collapsing them into one boolean, so a
    // regression reports which observation drifted.
    TestValidator.equals(
      "planning is read-only and captures drafts, source gaps, and exact bytes",
      {
        assetInventoryDigested: plan.inventory.some(
          (entry) =>
            entry.path === "assets/reference.bin" &&
            entry.kind === "asset" &&
            entry.digest !== null,
        ),
        draftFps: plan.productionDraft.frameFormat.fps,
        firstShotDraft: plan.shotContractDrafts[0]?.id,
        legacyRevision: plan.legacyRevision,
        legacyStateAbsent:
          fs.existsSync(path.join(fixture.root, ".automovie")) === false,
        // Planning fences the root namespace once per fenced operation, so the
        // owned identity is the coordinate set, not how many times each was
        // taken.
        lockCoordinates: new Set(planLockPaths).size,
        lockPathsAbsent: planLockPaths.every(
          (file) => fs.existsSync(file) === false,
        ),
        manifestInventoryDigest: plan.inventory.some(
          (entry) =>
            entry.path === "automovie.json" &&
            entry.digest === digestAutoMovieBytes(planManifestBytes),
        ),
        nestedInventoryDigest: plan.inventory.some(
          (entry) =>
            entry.path === "actors/archive/README.txt" &&
            entry.digest === digestAutoMovieBytes(planNestedBytes),
        ),
        pathReads: planPathReads.size,
        sourceTodoShot: plan.sourceTodos[0]?.shot,
        unchangedBytes: equalFiles(before, legacyFiles(fixture.root)),
        unrecoverableSource: plan.diagnostics.some(
          (diagnostic) => diagnostic.code === "legacy-source-unrecoverable",
        ),
      },
      {
        assetInventoryDigested: true,
        draftFps: 24,
        firstShotDraft: shot.id,
        legacyRevision: 2,
        legacyStateAbsent: true,
        lockCoordinates: 2,
        lockPathsAbsent: true,
        manifestInventoryDigest: true,
        nestedInventoryDigest: true,
        pathReads: 0,
        sourceTodoShot: shot.id,
        unchangedBytes: true,
        unrecoverableSource: true,
      },
    );
    const legacyLockPath = path.join(fixture.root, "revision.lock");
    const legacyLockParked = `${legacyLockPath}.read-parked`;
    const nativeLegacyLockRead = fs.readFileSync;
    let legacyAssertionPathRead = false;
    fs.readFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === path.resolve(legacyLockPath) &&
        fs.existsSync(path.join(fixture.root, ".automovie")) === false
      ) {
        legacyAssertionPathRead = true;
        fs.renameSync(legacyLockPath, legacyLockParked);
        fs.writeFileSync(
          legacyLockPath,
          nativeLegacyLockRead(legacyLockParked),
        );
        let legacyLockReadFailure: ILegacyImportFixtureFailure | undefined;
        try {
          return Reflect.apply(nativeLegacyLockRead, fs, [file, ...args]);
        } catch (error) {
          legacyLockReadFailure = { error };
          throw error;
        } finally {
          preserveLegacyImportFixtureCleanup(legacyLockReadFailure, [
            {
              resource: "legacy-lock transient",
              cleanup: () => fs.rmSync(legacyLockPath),
            },
            {
              resource: "legacy-lock resident",
              cleanup: () => fs.renameSync(legacyLockParked, legacyLockPath),
            },
          ]);
        }
      }
      return Reflect.apply(nativeLegacyLockRead, fs, [file, ...args]);
    }) as typeof fs.readFileSync;
    const applied = (() => {
      let legacyApplyFailure: ILegacyImportFixtureFailure | undefined;
      try {
        return importer.apply();
      } catch (error) {
        legacyApplyFailure = { error };
        throw error;
      } finally {
        preserveLegacyImportFixtureCleanup(legacyApplyFailure, [
          {
            resource: "legacy-lock read hook",
            cleanup: () => {
              fs.readFileSync = nativeLegacyLockRead;
            },
          },
          {
            resource: "legacy-lock fallback transient",
            cleanup: () => {
              if (fs.existsSync(legacyLockParked))
                fs.rmSync(legacyLockPath, { force: true });
            },
          },
          {
            resource: "legacy-lock fallback resident",
            cleanup: () => {
              if (fs.existsSync(legacyLockParked))
                fs.renameSync(legacyLockParked, legacyLockPath);
            },
          },
        ]);
      }
    })();
    const appliedPlanPath = path.join(
      fixture.root,
      ".automovie/imports/legacy-v1/plan.json",
    );
    const appliedPlanBytes = fs.readFileSync(appliedPlanPath);
    const appliedPlanParked = `${appliedPlanPath}.read-parked`;
    const nativeAppliedPlanRead = fs.readFileSync;
    let appliedPlanPathRead = false;
    fs.readFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === path.resolve(appliedPlanPath)
      ) {
        appliedPlanPathRead = true;
        fs.renameSync(appliedPlanPath, appliedPlanParked);
        fs.writeFileSync(
          appliedPlanPath,
          Buffer.concat([appliedPlanBytes, Buffer.from(" ")]),
        );
        let appliedPlanReadFailure: ILegacyImportFixtureFailure | undefined;
        try {
          return Reflect.apply(nativeAppliedPlanRead, fs, [file, ...args]);
        } catch (error) {
          appliedPlanReadFailure = { error };
          throw error;
        } finally {
          preserveLegacyImportFixtureCleanup(appliedPlanReadFailure, [
            {
              resource: "applied-plan transient",
              cleanup: () => fs.rmSync(appliedPlanPath),
            },
            {
              resource: "applied-plan resident",
              cleanup: () => fs.renameSync(appliedPlanParked, appliedPlanPath),
            },
          ]);
        }
      }
      return Reflect.apply(nativeAppliedPlanRead, fs, [file, ...args]);
    }) as typeof fs.readFileSync;
    let repeated: ReturnType<AutoMovieLegacyImporter["apply"]> | null = null;
    let repeatedRejected = false;
    try {
      repeated = importer.apply();
    } catch {
      repeatedRejected = true;
    } finally {
      preserveLegacyImportFixtureCleanup(undefined, [
        {
          resource: "applied-plan read hook",
          cleanup: () => {
            fs.readFileSync = nativeAppliedPlanRead;
          },
        },
        {
          resource: "applied-plan fallback transient",
          cleanup: () => {
            if (fs.existsSync(appliedPlanParked))
              fs.rmSync(appliedPlanPath, { force: true });
          },
        },
        {
          resource: "applied-plan fallback resident",
          cleanup: () => {
            if (fs.existsSync(appliedPlanParked))
              fs.renameSync(appliedPlanParked, appliedPlanPath);
          },
        },
      ]);
    }
    const production = AutoMovieProductionProject.open(fixture.root);
    TestValidator.predicate(
      "apply is atomic and idempotent until production provenance reopens",
      applied.status === "applied" &&
        legacyAssertionPathRead === false &&
        repeatedRejected === false &&
        appliedPlanPathRead === false &&
        repeated?.status === "unchanged" &&
        repeated.plan.fingerprint === plan.fingerprint &&
        production.manifest().importedLegacy?.revision === 2 &&
        production.manifest().importedLegacy?.sourceRoot === "." &&
        equalFiles(before, legacyFiles(fixture.root)) &&
        throws(
          () => importer.apply(),
          "already exists with a different or incomplete import",
        ) &&
        throws(() => importer.rollback(), "changed after import"),
    );
  } finally {
    fixture.dispose();
  }

  const untouched = createLegacy();
  try {
    const before = legacyFiles(untouched.root);
    const importer = new AutoMovieLegacyImporter(untouched.root);
    const plan = importer.plan();
    importer.apply();
    createMissingOwnedRoots(untouched.root, plan);
    const rolledBack = importer.rollback();
    TestValidator.predicate(
      "rollback removes only untouched import state and empty owned roots",
      rolledBack.fingerprint === plan.fingerprint &&
        fs.existsSync(path.join(untouched.root, ".automovie")) === false &&
        fs.existsSync(path.join(untouched.root, "src")) === false &&
        fs.existsSync(path.join(untouched.root, "generated")) === false &&
        plan.rollbackBaseline.find((baseline) => baseline.path === "renders")
          ?.existed === true &&
        fs.existsSync(path.join(untouched.root, "renders")) &&
        equalFiles(before, legacyFiles(untouched.root)) &&
        throws(() => importer.rollback(), "Nothing was rolled back"),
    );
  } finally {
    untouched.dispose();
  }

  const actorless = createLegacy();
  try {
    AutoMovieProject.open(actorless.root).saveSlate({
      ...slate,
      shots: [{ ...shot, performances: [] }],
    });
    const actorlessPlan = new AutoMovieLegacyImporter(actorless.root).plan();
    TestValidator.predicate(
      "an actorless legacy shot does not misrepresent its camera as a scene subject",
      actorlessPlan.shotContractDrafts[0]?.camera.requiredSubjects.length ===
        0 &&
        actorlessPlan.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "legacy-camera-subject-reconstruction-required",
        ),
    );
  } finally {
    actorless.dispose();
  }

  const empty = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-empty-import-"),
  );
  try {
    AutoMovieProject.open(empty);
    const plan = new AutoMovieLegacyImporter(empty).plan();
    TestValidator.predicate(
      "an empty legacy project gets a one-frame conservative draft",
      plan.productionDraft.targetRuntimeSeconds === 1 / 30 &&
        plan.productionDraft.visualDelivery === "deterministic" &&
        plan.shotContractDrafts.length === 0 &&
        plan.sourceTodos.length === 0,
    );
  } finally {
    fs.rmSync(empty, { force: true, recursive: true });
  }

  const missingAsset = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-missing-asset-"),
  );
  try {
    AutoMovieProject.open(missingAsset).registerAsset("assets/missing.bin");
    const plan = new AutoMovieLegacyImporter(missingAsset).plan();
    TestValidator.predicate(
      "a registered absent asset stays explicit",
      plan.inventory.some(
        (entry) =>
          entry.path === "assets/missing.bin" &&
          entry.digest === null &&
          entry.bytes === 0,
      ) &&
        plan.diagnostics.some(
          (diagnostic) => diagnostic.code === "legacy-asset-missing",
        ),
    );
  } finally {
    fs.rmSync(missingAsset, { force: true, recursive: true });
  }

  const planningCleanup = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(planningCleanup.root);
    const nativeWrite = fs.writeFileSync;
    const nativeRm = fs.rmSync;
    const standaloneCleanupFailure = new Error(
      "injected planning cleanup failure",
    );
    fs.rmSync = ((target: fs.PathLike, ...args: unknown[]): void => {
      Reflect.apply(nativeRm, fs, [target, ...args]);
      if (
        path.basename(target.toString()).startsWith("automovie-legacy-import-")
      )
        throw standaloneCleanupFailure;
    }) as typeof fs.rmSync;
    let standaloneCaught: unknown;
    try {
      standaloneCaught = captureFailure(() => importer.plan());
    } finally {
      fs.rmSync = nativeRm;
    }

    const planningFailure = new Error("injected legacy planning failure");
    const combinedCleanupFailure = new Error(
      "injected combined planning cleanup failure",
    );
    const belongsToPlanningTemporary = (file: fs.PathLike): boolean =>
      path
        .resolve(file.toString())
        .split(path.sep)
        .some((component) => component.startsWith("automovie-legacy-import-"));
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      if (typeof file !== "number" && belongsToPlanningTemporary(file))
        throw planningFailure;
      Reflect.apply(nativeWrite, fs, [file, ...args]);
    }) as typeof fs.writeFileSync;
    fs.rmSync = ((target: fs.PathLike, ...args: unknown[]): void => {
      Reflect.apply(nativeRm, fs, [target, ...args]);
      if (belongsToPlanningTemporary(target)) throw combinedCleanupFailure;
    }) as typeof fs.rmSync;
    let combinedCaught: unknown;
    let combinedPlanningHookFailure: ILegacyImportFixtureFailure | undefined;
    try {
      combinedCaught = captureFailure(() => importer.plan());
    } catch (error) {
      combinedPlanningHookFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(combinedPlanningHookFailure, [
        {
          resource: "planning write hook",
          cleanup: () => {
            fs.writeFileSync = nativeWrite;
          },
        },
        {
          resource: "planning remove hook",
          cleanup: () => {
            fs.rmSync = nativeRm;
          },
        },
      ]);
    }
    TestValidator.predicate(
      "legacy planning cleanup preserves standalone and combined failures",
      standaloneCaught === standaloneCleanupFailure &&
        aggregateContainsExactly(combinedCaught, [
          planningFailure,
          combinedCleanupFailure,
        ]),
    );
  } finally {
    planningCleanup.dispose();
  }

  const collisions = createLegacy();
  try {
    fs.mkdirSync(path.join(collisions.root, ".automovie"));
    TestValidator.predicate(
      "a pre-existing production state collision is refused",
      throws(
        () => new AutoMovieLegacyImporter(collisions.root).apply(),
        "already exists",
      ),
    );
    fs.rmSync(path.join(collisions.root, ".automovie"), { recursive: true });
    fs.writeFileSync(path.join(collisions.root, ".automovie"), "collision");
    TestValidator.predicate(
      "a non-directory production state collision is refused",
      throws(
        () => new AutoMovieLegacyImporter(collisions.root).apply(),
        "not a physical directory",
      ),
    );
  } finally {
    collisions.dispose();
  }

  const renameFailure = createLegacy();
  try {
    const nativeRename = fs.renameSync;
    fs.renameSync = () => {
      throw new Error("injected rename failure");
    };
    try {
      TestValidator.predicate(
        "a failed atomic publish removes its staging directory",
        throws(
          () => new AutoMovieLegacyImporter(renameFailure.root).apply(),
          "injected rename failure",
        ) &&
          fs
            .readdirSync(renameFailure.root)
            .every((entry) => entry.startsWith(".automovie-import-") === false),
      );
    } finally {
      fs.renameSync = nativeRename;
    }
  } finally {
    renameFailure.dispose();
  }

  const importCleanupFailure = createLegacy();
  try {
    const publicationFailure = new Error("injected import publication failure");
    const stagingCleanupFailure = new Error(
      "injected import staging cleanup failure",
    );
    const nativeRename = fs.renameSync;
    const nativeRm = fs.rmSync;
    fs.renameSync = ((oldPath: fs.PathLike, newPath: fs.PathLike): void => {
      if (
        path.basename(oldPath.toString()).startsWith(".automovie-import-") &&
        path.basename(newPath.toString()) === ".automovie"
      )
        throw publicationFailure;
      nativeRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    fs.rmSync = ((target: fs.PathLike, ...args: unknown[]): void => {
      Reflect.apply(nativeRm, fs, [target, ...args]);
      if (path.basename(target.toString()).startsWith(".automovie-import-"))
        throw stagingCleanupFailure;
    }) as typeof fs.rmSync;
    let caught: unknown;
    let importCleanupHookFailure: ILegacyImportFixtureFailure | undefined;
    try {
      caught = captureFailure(() =>
        new AutoMovieLegacyImporter(importCleanupFailure.root).apply(),
      );
    } catch (error) {
      importCleanupHookFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(importCleanupHookFailure, [
        {
          resource: "import cleanup rename hook",
          cleanup: () => {
            fs.renameSync = nativeRename;
          },
        },
        {
          resource: "import cleanup remove hook",
          cleanup: () => {
            fs.rmSync = nativeRm;
          },
        },
      ]);
    }
    TestValidator.predicate(
      "legacy import staging cleanup retains publication and cleanup failures",
      aggregateContainsExactly(caught, [
        publicationFailure,
        stagingCleanupFailure,
      ]) &&
        fs
          .readdirSync(importCleanupFailure.root)
          .every((entry) => entry.startsWith(".automovie-import-") === false),
    );
  } finally {
    importCleanupFailure.dispose();
  }

  const publishRootSwap = createLegacy();
  const parkedPublishRoot = `${publishRootSwap.root}-parked`;
  {
    let publishRootSwapFailure: ILegacyImportFixtureFailure | undefined;
    try {
      const stateRoot = path.join(publishRootSwap.root, ".automovie");
      const nativeRename = fs.renameSync;
      let swapped = false;
      fs.renameSync = ((oldPath: fs.PathLike, newPath: fs.PathLike): void => {
        nativeRename(oldPath, newPath);
        if (
          swapped === false &&
          path.resolve(newPath.toString()) === stateRoot
        ) {
          swapped = true;
          nativeRename(publishRootSwap.root, parkedPublishRoot);
          fs.mkdirSync(publishRootSwap.root);
        }
      }) as typeof fs.renameSync;
      let publishRootSwapRecoveryFailure:
        | ILegacyImportFixtureFailure
        | undefined;
      try {
        TestValidator.predicate(
          "a root replaced immediately after import publication receives no stale cleanup",
          throws(
            () => new AutoMovieLegacyImporter(publishRootSwap.root).apply(),
            "root identity",
          ) &&
            swapped &&
            fs.readdirSync(publishRootSwap.root).length === 0,
        );
      } catch (error) {
        publishRootSwapRecoveryFailure = { error };
        throw error;
      } finally {
        preserveLegacyImportFixtureCleanup(publishRootSwapRecoveryFailure, [
          {
            resource: "publish root-swap rename hook",
            cleanup: () => {
              fs.renameSync = nativeRename;
            },
          },
          {
            resource: "publish root-swap transient root",
            cleanup: () => {
              if (swapped)
                fs.rmSync(publishRootSwap.root, {
                  force: true,
                  recursive: true,
                });
            },
          },
          {
            resource: "publish root-swap resident root",
            cleanup: () => {
              if (swapped)
                nativeRename(parkedPublishRoot, publishRootSwap.root);
            },
          },
        ]);
      }
    } catch (error) {
      publishRootSwapFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(publishRootSwapFailure, [
        {
          resource: "publish root-swap legacy fixture",
          cleanup: () => publishRootSwap.dispose(),
        },
        {
          resource: "publish root-swap parked fallback",
          cleanup: () => {
            if (fs.existsSync(parkedPublishRoot))
              fs.rmSync(parkedPublishRoot, {
                force: true,
                recursive: true,
              });
          },
        },
      ]);
    }
  }

  const tampered = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(tampered.root);
    importer.apply();
    const planPath = path.join(
      tampered.root,
      ".automovie/imports/legacy-v1/plan.json",
    );
    fs.writeFileSync(planPath, "{}");
    TestValidator.predicate(
      "a changed import plan refuses rollback",
      throws(() => importer.rollback(), "changed after import"),
    );
  } finally {
    tampered.dispose();
  }

  TestValidator.predicate(
    "rollback plans reject a baseline in the wrong canonical slot",
    rejectsTamperedRollbackBaseline(
      () => {},
      (plan) => {
        plan.rollbackBaseline[0]!.path = "generated";
      },
    ),
  );
  TestValidator.predicate(
    "rollback plans reject an escaping baseline directory",
    rejectsTamperedRollbackBaseline(
      (root) => {
        fs.mkdirSync(path.join(root, "src/nested"), { recursive: true });
      },
      (plan) => {
        plan.rollbackBaseline[0]!.directories[0] = "src/../escape";
      },
    ),
  );
  TestValidator.predicate(
    "rollback plans reject duplicate baseline files",
    rejectsTamperedRollbackBaseline(
      (root) => {
        fs.mkdirSync(path.join(root, "src"));
        fs.writeFileSync(path.join(root, "src/baseline.ts"), "export {};\n");
      },
      (plan) => {
        const file = plan.rollbackBaseline[0]!.files[0]!;
        plan.rollbackBaseline[0]!.files = [file, file];
      },
    ),
  );

  const tamperedState = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(tamperedState.root);
    importer.apply();
    const statePath = path.join(
      tamperedState.root,
      ".automovie/imports/legacy-v1/state.json",
    );
    const state = JSON.parse(fs.readFileSync(statePath, "utf8")) as {
      fingerprint: string;
      version: number;
    };
    fs.writeFileSync(
      statePath,
      `${JSON.stringify({ ...state, unexpected: true }, null, 2)}\n`,
    );
    TestValidator.predicate(
      "a changed import marker refuses idempotent apply and rollback",
      throws(() => importer.apply(), "different or incomplete import") &&
        throws(() => importer.rollback(), "changed after import"),
    );
  } finally {
    tamperedState.dispose();
  }

  const productionWork = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(productionWork.root);
    importer.apply();
    fs.mkdirSync(path.join(productionWork.root, "src"));
    fs.writeFileSync(path.join(productionWork.root, "src/work.ts"), "work");
    TestValidator.predicate(
      "production work in a newly owned directory refuses rollback",
      throws(() => importer.rollback(), "contains work"),
    );
  } finally {
    productionWork.dispose();
  }

  const preexistingSource = createLegacy();
  try {
    const sourceRoot = path.join(preexistingSource.root, "src");
    const sourceFile = path.join(sourceRoot, "preserved.ts");
    fs.mkdirSync(sourceRoot);
    fs.writeFileSync(sourceFile, "export const preserved = true;\n");
    const importer = new AutoMovieLegacyImporter(preexistingSource.root);
    const plan = importer.plan();
    importer.apply();
    fs.writeFileSync(path.join(sourceRoot, "new-work.ts"), "new work");
    TestValidator.predicate(
      "a changed pre-existing source baseline refuses rollback",
      plan.rollbackBaseline[0]?.existed === true &&
        plan.rollbackBaseline[0].files.some(
          (entry) => entry.path === "src/preserved.ts",
        ) &&
        throws(() => importer.rollback(), "changed after import"),
    );
    fs.rmSync(path.join(sourceRoot, "new-work.ts"));
    importer.rollback();
    TestValidator.predicate(
      "an unchanged pre-existing source baseline survives rollback",
      fs.readFileSync(sourceFile, "utf8") ===
        "export const preserved = true;\n" && fs.existsSync(sourceRoot),
    );
  } finally {
    preexistingSource.dispose();
  }

  const missingPreexistingSource = createLegacy();
  try {
    const sourceRoot = path.join(missingPreexistingSource.root, "src");
    fs.mkdirSync(sourceRoot);
    fs.writeFileSync(path.join(sourceRoot, "preserved.ts"), "preserved");
    const importer = new AutoMovieLegacyImporter(missingPreexistingSource.root);
    importer.apply();
    fs.rmSync(sourceRoot, { recursive: true });
    TestValidator.predicate(
      "a disappeared pre-import owned directory refuses rollback",
      throws(() => importer.rollback(), "Restore its pre-import contents"),
    );
  } finally {
    missingPreexistingSource.dispose();
  }

  const deniedImportState = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(deniedImportState.root);
    importer.apply();
    const deniedPath = path.join(
      deniedImportState.root,
      ".automovie/imports/legacy-v1/state.json",
    );
    const nativeLstat = fs.lstatSync;
    const nativeLstatDescriptor = Object.getOwnPropertyDescriptor(
      fs,
      "lstatSync",
    )!;
    Object.defineProperty(fs, "lstatSync", {
      ...nativeLstatDescriptor,
      value: ((
        file: fs.PathLike,
        ...args: unknown[]
      ): fs.Stats | fs.BigIntStats => {
        if (path.resolve(file.toString()) === path.resolve(deniedPath)) {
          const error = new Error(
            "injected import-state lstat denial",
          ) as NodeJS.ErrnoException;
          error.code = "EACCES";
          throw error;
        }
        return Reflect.apply(nativeLstat, fs, [file, ...args]) as
          | fs.Stats
          | fs.BigIntStats;
      }) as typeof fs.lstatSync,
    });
    try {
      TestValidator.predicate(
        "an unexpected import-state lstat denial propagates through apply and rollback",
        throws(() => importer.apply(), "injected import-state lstat denial") &&
          throws(
            () => importer.rollback(),
            "injected import-state lstat denial",
          ),
      );
    } finally {
      Object.defineProperty(fs, "lstatSync", nativeLstatDescriptor);
    }
  } finally {
    deniedImportState.dispose();
  }

  const emptyDirectoryTopology = createLegacy();
  try {
    const original = path.join(
      emptyDirectoryTopology.root,
      "src/original-empty",
    );
    const replacement = path.join(
      emptyDirectoryTopology.root,
      "src/replacement-empty",
    );
    fs.mkdirSync(original, { recursive: true });
    const importer = new AutoMovieLegacyImporter(emptyDirectoryTopology.root);
    const plan = importer.plan();
    importer.apply();
    fs.rmdirSync(original);
    fs.mkdirSync(replacement);
    TestValidator.predicate(
      "changed empty-directory topology refuses rollback",
      plan.rollbackBaseline[0]?.directories.includes("src/original-empty") ===
        true && throws(() => importer.rollback(), "changed after import"),
    );
    fs.rmdirSync(replacement);
    fs.mkdirSync(original);
    importer.rollback();
    TestValidator.predicate(
      "unchanged empty-directory topology survives rollback",
      fs.existsSync(original),
    );
  } finally {
    emptyDirectoryTopology.dispose();
  }

  const sortedEmptyDirectoryTopology = createLegacy();
  try {
    fs.mkdirSync(path.join(sortedEmptyDirectoryTopology.root, "src/a/z"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(sortedEmptyDirectoryTopology.root, "src/a-"));
    const importer = new AutoMovieLegacyImporter(
      sortedEmptyDirectoryTopology.root,
    );
    const plan = importer.plan();
    const directories = plan.rollbackBaseline[0]?.directories ?? [];
    TestValidator.predicate(
      "nested empty directories use one global canonical order",
      directories.join("|") === "src/a|src/a-|src/a/z" &&
        importer.apply().status === "applied" &&
        importer.apply().status === "unchanged" &&
        importer.rollback().status === "rolled-back",
    );
  } finally {
    sortedEmptyDirectoryTopology.dispose();
  }

  const rollbackFailure = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(rollbackFailure.root);
    const plan = importer.plan();
    importer.apply();
    createMissingOwnedRoots(rollbackFailure.root, plan);
    const nativeRmdir = fs.rmdirSync;
    const nativeMkdir = fs.mkdirSync;
    const nativeWrite = fs.writeFileSync;
    const nativeRm = fs.rmSync;
    const activeNamespaceLocks: string[] = [];
    let removals = 0;
    let quarantineCleanupDenied = false;
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      Reflect.apply(nativeWrite, fs, [file, ...args]);
      if (
        typeof file !== "number" &&
        path.basename(path.dirname(file.toString())) ===
          ".automovie-root-locks" &&
        path.basename(file.toString()).startsWith("root-")
      )
        activeNamespaceLocks.push(path.resolve(file.toString()));
    }) as typeof fs.writeFileSync;
    fs.rmdirSync = ((directory: fs.PathLike): void => {
      ++removals;
      if (removals === 2) {
        if (
          activeNamespaceLocks.length !== 2 ||
          activeNamespaceLocks.some((file) => fs.existsSync(file) === false)
        )
          throw new Error("rollback released the canonical root reservation");
        const quarantine = fs
          .readdirSync(rollbackFailure.root)
          .find((entry) => entry.startsWith(".automovie-rollback-"));
        if (quarantine === undefined)
          throw new Error("rollback quarantine was not published");
        fs.writeFileSync(
          path.join(rollbackFailure.root, quarantine, "incarnation.json"),
          "{}",
        );
        throw new Error("injected owned-directory removal failure");
      }
      nativeRmdir(directory);
    }) as typeof fs.rmdirSync;
    fs.mkdirSync = ((directory: fs.PathLike, ...args: unknown[]) => {
      if (
        ["src", "generated", "renders"].some(
          (relative) =>
            path.resolve(directory.toString()) ===
            path.join(rollbackFailure.root, relative),
        ) &&
        fs.existsSync(path.join(rollbackFailure.root, ".automovie")) === false
      )
        throw new Error(
          "owned directory restoration ran before canonical state restoration",
        );
      return Reflect.apply(nativeMkdir, fs, [directory, ...args]) as unknown;
    }) as typeof fs.mkdirSync;
    fs.rmSync = ((target: fs.PathLike, ...args: unknown[]): void => {
      if (
        quarantineCleanupDenied === false &&
        path.basename(target.toString()).startsWith(".automovie-rollback-") &&
        fs.existsSync(path.join(rollbackFailure.root, ".automovie"))
      ) {
        quarantineCleanupDenied = true;
        throw new Error("injected obsolete quarantine cleanup failure");
      }
      Reflect.apply(nativeRm, fs, [target, ...args]);
    }) as typeof fs.rmSync;
    let rollbackHookFailure: ILegacyImportFixtureFailure | undefined;
    try {
      TestValidator.predicate(
        "a partial rollback failure restores the complete applied state",
        throws(() => importer.rollback(), "state was restored") &&
          fs.existsSync(path.join(rollbackFailure.root, ".automovie")) &&
          importer.apply().status === "unchanged" &&
          quarantineCleanupDenied,
      );
    } catch (error) {
      rollbackHookFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(rollbackHookFailure, [
        {
          resource: "rollback rmdir hook",
          cleanup: () => {
            fs.rmdirSync = nativeRmdir;
          },
        },
        {
          resource: "rollback mkdir hook",
          cleanup: () => {
            fs.mkdirSync = nativeMkdir;
          },
        },
        {
          resource: "rollback write hook",
          cleanup: () => {
            fs.writeFileSync = nativeWrite;
          },
        },
        {
          resource: "rollback remove hook",
          cleanup: () => {
            fs.rmSync = nativeRm;
          },
        },
      ]);
    }
    TestValidator.predicate(
      "a restored import remains safely roll-backable",
      importer.rollback().status === "rolled-back" &&
        fs.existsSync(path.join(rollbackFailure.root, ".automovie")) === false,
    );
  } finally {
    rollbackFailure.dispose();
  }

  const rollbackRootSwap = createLegacy();
  const parkedRollbackRoot = `${rollbackRootSwap.root}-parked`;
  {
    let rollbackRootSwapFailure: ILegacyImportFixtureFailure | undefined;
    try {
      const importer = new AutoMovieLegacyImporter(rollbackRootSwap.root);
      const plan = importer.plan();
      importer.apply();
      createMissingOwnedRoots(rollbackRootSwap.root, plan);
      const nativeRmdir = fs.rmdirSync;
      let swapped = false;
      fs.rmdirSync = ((directory: fs.PathLike): void => {
        nativeRmdir(directory);
        if (swapped === false) {
          swapped = true;
          fs.renameSync(rollbackRootSwap.root, parkedRollbackRoot);
          fs.mkdirSync(rollbackRootSwap.root);
          throw new Error("injected rollback root replacement");
        }
      }) as typeof fs.rmdirSync;
      let rollbackRootSwapRecoveryFailure:
        | ILegacyImportFixtureFailure
        | undefined;
      try {
        TestValidator.predicate(
          "rollback abandons restoration when the physical root changes",
          throws(() => importer.rollback(), "changed physical identity") &&
            swapped &&
            fs.readdirSync(rollbackRootSwap.root).length === 0,
        );
      } catch (error) {
        rollbackRootSwapRecoveryFailure = { error };
        throw error;
      } finally {
        preserveLegacyImportFixtureCleanup(rollbackRootSwapRecoveryFailure, [
          {
            resource: "rollback root-swap rmdir hook",
            cleanup: () => {
              fs.rmdirSync = nativeRmdir;
            },
          },
          {
            resource: "rollback root-swap transient root",
            cleanup: () => {
              if (swapped)
                fs.rmSync(rollbackRootSwap.root, {
                  force: true,
                  recursive: true,
                });
            },
          },
          {
            resource: "rollback root-swap resident root",
            cleanup: () => {
              if (swapped)
                fs.renameSync(parkedRollbackRoot, rollbackRootSwap.root);
            },
          },
        ]);
      }
    } catch (error) {
      rollbackRootSwapFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(rollbackRootSwapFailure, [
        {
          resource: "rollback root-swap legacy fixture",
          cleanup: () => rollbackRootSwap.dispose(),
        },
        {
          resource: "rollback root-swap parked fallback",
          cleanup: () => {
            if (fs.existsSync(parkedRollbackRoot))
              fs.rmSync(parkedRollbackRoot, {
                force: true,
                recursive: true,
              });
          },
        },
      ]);
    }
  }

  const incompleteRestoration = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(incompleteRestoration.root);
    const plan = importer.plan();
    importer.apply();
    createMissingOwnedRoots(incompleteRestoration.root, plan);
    const stateRoot = path.join(incompleteRestoration.root, ".automovie");
    const nativeRmdir = fs.rmdirSync;
    const nativeRename = fs.renameSync;
    const nativeMkdir = fs.mkdirSync;
    let removals = 0;
    let removedDirectory: string | null = null;
    fs.rmdirSync = ((directory: fs.PathLike): void => {
      ++removals;
      if (removals === 1) {
        removedDirectory = path.resolve(directory.toString());
        nativeRmdir(directory);
        return;
      }
      const quarantine = fs
        .readdirSync(incompleteRestoration.root)
        .find((entry) => entry.startsWith(".automovie-rollback-"));
      if (quarantine === undefined)
        throw new Error("rollback quarantine was not published");
      fs.writeFileSync(
        path.join(incompleteRestoration.root, quarantine, "incarnation.json"),
        "{}",
      );
      throw new Error("injected rollback removal failure");
    }) as typeof fs.rmdirSync;
    fs.renameSync = ((oldPath: fs.PathLike, newPath: fs.PathLike): void => {
      if (
        path.basename(oldPath.toString()).startsWith(".automovie-restore-") &&
        path.resolve(newPath.toString()) === stateRoot
      )
        throw new Error("injected applied-state restoration failure");
      nativeRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    fs.mkdirSync = ((directory: fs.PathLike, ...args: unknown[]) => {
      if (
        removedDirectory !== null &&
        path.resolve(directory.toString()) === removedDirectory
      )
        throw new Error("injected owned-directory restoration failure");
      return Reflect.apply(nativeMkdir, fs, [directory, ...args]) as unknown;
    }) as typeof fs.mkdirSync;
    let incompleteRestorationHookFailure:
      | ILegacyImportFixtureFailure
      | undefined;
    try {
      TestValidator.predicate(
        "rollback reports every failed state and owned-directory restoration",
        throws(() => importer.rollback(), "restoration was incomplete"),
      );
    } catch (error) {
      incompleteRestorationHookFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(incompleteRestorationHookFailure, [
        {
          resource: "incomplete restoration rmdir hook",
          cleanup: () => {
            fs.rmdirSync = nativeRmdir;
          },
        },
        {
          resource: "incomplete restoration rename hook",
          cleanup: () => {
            fs.renameSync = nativeRename;
          },
        },
        {
          resource: "incomplete restoration mkdir hook",
          cleanup: () => {
            fs.mkdirSync = nativeMkdir;
          },
        },
      ]);
    }
  } finally {
    incompleteRestoration.dispose();
  }

  const restorationCleanupFailure = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(
      restorationCleanupFailure.root,
    );
    const plan = importer.plan();
    importer.apply();
    createMissingOwnedRoots(restorationCleanupFailure.root, plan);
    const stateRoot = path.join(restorationCleanupFailure.root, ".automovie");
    const rollbackFailure = new Error("injected rollback failure");
    const restorationFailure = new Error(
      "injected authoritative restoration failure",
    );
    const cleanupFailure = new Error(
      "injected restoration staging cleanup failure",
    );
    const nativeRmdir = fs.rmdirSync;
    const nativeRename = fs.renameSync;
    const nativeRm = fs.rmSync;
    let removals = 0;
    fs.rmdirSync = ((directory: fs.PathLike): void => {
      if (++removals === 2) {
        const quarantine = fs
          .readdirSync(restorationCleanupFailure.root)
          .find((entry) => entry.startsWith(".automovie-rollback-"));
        if (quarantine === undefined)
          throw new Error("rollback quarantine was not published");
        fs.writeFileSync(
          path.join(
            restorationCleanupFailure.root,
            quarantine,
            "incarnation.json",
          ),
          "{}",
        );
        throw rollbackFailure;
      }
      nativeRmdir(directory);
    }) as typeof fs.rmdirSync;
    fs.renameSync = ((oldPath: fs.PathLike, newPath: fs.PathLike): void => {
      if (
        path.basename(oldPath.toString()).startsWith(".automovie-restore-") &&
        path.resolve(newPath.toString()) === stateRoot
      )
        throw restorationFailure;
      nativeRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    fs.rmSync = ((target: fs.PathLike, ...args: unknown[]): void => {
      Reflect.apply(nativeRm, fs, [target, ...args]);
      if (path.basename(target.toString()).startsWith(".automovie-restore-"))
        throw cleanupFailure;
    }) as typeof fs.rmSync;
    let caught: unknown;
    let restorationCleanupHookFailure: ILegacyImportFixtureFailure | undefined;
    try {
      caught = captureFailure(() => importer.rollback());
    } catch (error) {
      restorationCleanupHookFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(restorationCleanupHookFailure, [
        {
          resource: "restoration cleanup rmdir hook",
          cleanup: () => {
            fs.rmdirSync = nativeRmdir;
          },
        },
        {
          resource: "restoration cleanup rename hook",
          cleanup: () => {
            fs.renameSync = nativeRename;
          },
        },
        {
          resource: "restoration cleanup remove hook",
          cleanup: () => {
            fs.rmSync = nativeRm;
          },
        },
      ]);
    }
    const nestedCleanup =
      caught instanceof AggregateError ? caught.errors[1] : undefined;
    const retainedQuarantine = fs
      .readdirSync(restorationCleanupFailure.root)
      .find((entry) => entry.startsWith(".automovie-rollback-"));
    TestValidator.predicate(
      "legacy rollback retains restoration and staging cleanup failures",
      nestedCleanup instanceof AggregateError &&
        aggregateContainsExactly(nestedCleanup, [
          restorationFailure,
          cleanupFailure,
        ]) &&
        aggregateContainsExactly(caught, [rollbackFailure, nestedCleanup]) &&
        removals === 2 &&
        fs.existsSync(stateRoot) === false &&
        fs
          .readdirSync(restorationCleanupFailure.root)
          .every(
            (entry) => entry.startsWith(".automovie-restore-") === false,
          ) &&
        retainedQuarantine !== undefined &&
        fs.existsSync(
          path.join(restorationCleanupFailure.root, retainedQuarantine),
        ),
    );
  } finally {
    restorationCleanupFailure.dispose();
  }

  const preservedQuarantine = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(preservedQuarantine.root);
    const plan = importer.plan();
    importer.apply();
    createMissingOwnedRoots(preservedQuarantine.root, plan);
    const stateRoot = path.join(preservedQuarantine.root, ".automovie");
    const nativeRmdir = fs.rmdirSync;
    const nativeRename = fs.renameSync;
    let removals = 0;
    fs.rmdirSync = ((directory: fs.PathLike): void => {
      if (++removals === 2)
        throw new Error("injected rollback removal failure");
      nativeRmdir(directory);
    }) as typeof fs.rmdirSync;
    fs.renameSync = ((oldPath: fs.PathLike, newPath: fs.PathLike): void => {
      if (
        path.basename(oldPath.toString()).startsWith(".automovie-rollback-") &&
        path.resolve(newPath.toString()) === stateRoot
      )
        return;
      nativeRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let preservedQuarantineHookFailure: ILegacyImportFixtureFailure | undefined;
    try {
      TestValidator.predicate(
        "rollback reports an authoritative quarantine when restoration cannot publish",
        throws(() => importer.rollback(), "remains preserved"),
      );
    } catch (error) {
      preservedQuarantineHookFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(preservedQuarantineHookFailure, [
        {
          resource: "preserved quarantine rmdir hook",
          cleanup: () => {
            fs.rmdirSync = nativeRmdir;
          },
        },
        {
          resource: "preserved quarantine rename hook",
          cleanup: () => {
            fs.renameSync = nativeRename;
          },
        },
      ]);
    }
  } finally {
    preservedQuarantine.dispose();
  }

  const incarnationRace = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(incarnationRace.root);
    importer.apply();
    const reappliedLock = path.join(
      incarnationRace.root,
      ".automovie/revision.lock",
    );
    const retiredToken = acquireCommitLock(reappliedLock);
    importer.rollback();
    importer.apply();
    const reappliedToken = acquireCommitLock(reappliedLock);
    const freshReappliedLock =
      fs.existsSync(reappliedLock) &&
      fs.readFileSync(reappliedLock, "utf8") === reappliedToken;
    releaseCommitLock(reappliedLock, retiredToken);
    const retiredOwnerPreservesFreshLock =
      fs.readFileSync(reappliedLock, "utf8") === reappliedToken;
    releaseCommitLock(reappliedLock, reappliedToken);
    const fresh = AutoMovieProductionProject.open(incarnationRace.root);
    TestValidator.predicate(
      "a retired rollback lock owner cannot cross re-apply ABA",
      freshReappliedLock &&
        retiredOwnerPreservesFreshLock &&
        fresh.manifest().importedLegacy?.revision === 2,
    );
  } finally {
    incarnationRace.dispose();
  }

  const extraState = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(extraState.root);
    importer.apply();
    fs.writeFileSync(
      path.join(extraState.root, ".automovie/design/production.json"),
      "{}",
    );
    TestValidator.predicate(
      "new tracked production state refuses rollback",
      throws(() => importer.rollback(), "changed after import"),
    );
  } finally {
    extraState.dispose();
  }

  const malformedAppliedState = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(malformedAppliedState.root);
    importer.apply();
    fs.writeFileSync(
      path.join(
        malformedAppliedState.root,
        ".automovie/imports/legacy-v1/state.json",
      ),
      "{bad",
    );
    TestValidator.predicate(
      "malformed applied state is treated as an incomplete import",
      throws(() => importer.apply(), "different or incomplete") &&
        throws(() => importer.rollback(), "changed after import"),
    );
  } finally {
    malformedAppliedState.dispose();
  }

  const activeCommit = createLegacy();
  try {
    const lockPath = path.join(activeCommit.root, "revision.lock");
    fs.writeFileSync(lockPath, "external-owner");
    TestValidator.predicate(
      "planning refuses an active resident commit",
      throws(
        () => new AutoMovieLegacyImporter(activeCommit.root).plan(),
        "is active",
      ),
    );
    fs.rmSync(lockPath);
  } finally {
    activeCommit.dispose();
  }

  const linkedRoot = createLegacy();
  let linkedParent: string | undefined;
  let linkedRootFailure: ILegacyImportFixtureFailure | undefined;
  try {
    linkedParent = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-linked-import-root-"),
    );
    const link = path.join(linkedParent, "project");
    fs.symlinkSync(linkedRoot.root, link, "junction");
    TestValidator.predicate(
      "apply validates a physical root before creating its resident lock",
      throws(
        () => new AutoMovieLegacyImporter(link).apply(),
        "physical, dedicated",
      ) && fs.existsSync(path.join(linkedRoot.root, "revision.lock")) === false,
    );
  } catch (error) {
    linkedRootFailure = { error };
    throw error;
  } finally {
    const completedLinkedParent = linkedParent;
    preserveLegacyImportFixtureCleanup(linkedRootFailure, [
      {
        resource: "linked-root legacy fixture",
        cleanup: () => linkedRoot.dispose(),
      },
      ...(completedLinkedParent === undefined
        ? []
        : [
            {
              resource: "linked-root outside root",
              cleanup: () =>
                fs.rmSync(completedLinkedParent, {
                  force: true,
                  recursive: true,
                }),
            },
          ]),
    ]);
  }

  const replacedDuringAcquire = createLegacy();
  const replacementTarget = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-import-root-race-target-"),
  );
  const parkedRoot = `${replacedDuringAcquire.root}-parked`;
  {
    let acquireRootSwapFailure: ILegacyImportFixtureFailure | undefined;
    try {
      const namespaceLocks: string[] = [];
      const nativeWrite = fs.writeFileSync;
      let replaced = false;
      fs.writeFileSync = ((
        file: fs.PathOrFileDescriptor,
        ...args: unknown[]
      ): void => {
        Reflect.apply(nativeWrite, fs, [file, ...args]);
        if (
          typeof file !== "number" &&
          path.basename(path.dirname(file.toString())) ===
            ".automovie-root-locks" &&
          path.basename(file.toString()).startsWith("root-")
        ) {
          namespaceLocks.push(path.resolve(file.toString()));
          if (replaced === false) {
            replaced = true;
            fs.renameSync(replacedDuringAcquire.root, parkedRoot);
            fs.symlinkSync(
              replacementTarget,
              replacedDuringAcquire.root,
              "junction",
            );
          }
        }
      }) as typeof fs.writeFileSync;
      let acquireRootSwapRecoveryFailure:
        | ILegacyImportFixtureFailure
        | undefined;
      try {
        TestValidator.predicate(
          "root replacement after namespace acquisition is detected before import",
          throws(
            () =>
              new AutoMovieLegacyImporter(replacedDuringAcquire.root).apply(),
            // Whichever fence catches it, the refusal names the root identity.
            // The claim is that the swap is caught before any import writes, and
            // the absent resident lock below is what proves that.
            "root identity",
          ) &&
            fs.existsSync(path.join(replacementTarget, "revision.lock")) ===
              false &&
            namespaceLocks.length === 2 &&
            namespaceLocks.every((file) => fs.existsSync(file) === false),
        );
      } catch (error) {
        acquireRootSwapRecoveryFailure = { error };
        throw error;
      } finally {
        preserveLegacyImportFixtureCleanup(acquireRootSwapRecoveryFailure, [
          {
            resource: "acquire root-swap write hook",
            cleanup: () => {
              fs.writeFileSync = nativeWrite;
            },
          },
          {
            resource: "acquire root-swap transient root",
            cleanup: () => {
              if (fs.lstatSync(replacedDuringAcquire.root).isSymbolicLink())
                fs.rmSync(replacedDuringAcquire.root);
            },
          },
          {
            resource: "acquire root-swap resident root",
            cleanup: () => {
              if (fs.existsSync(parkedRoot))
                fs.renameSync(parkedRoot, replacedDuringAcquire.root);
            },
          },
        ]);
      }
    } catch (error) {
      acquireRootSwapFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(acquireRootSwapFailure, [
        {
          resource: "acquire root-swap legacy fixture",
          cleanup: () => replacedDuringAcquire.dispose(),
        },
        {
          resource: "acquire root-swap replacement target",
          cleanup: () =>
            fs.rmSync(replacementTarget, { force: true, recursive: true }),
        },
        {
          resource: "acquire root-swap parked fallback",
          cleanup: () => {
            if (fs.existsSync(parkedRoot))
              fs.rmSync(parkedRoot, { force: true, recursive: true });
          },
        },
      ]);
    }
  }

  const replacedAfterResidentLock = createLegacy();
  const residentReplacement = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-import-resident-race-target-"),
  );
  const parkedResidentRoot = `${replacedAfterResidentLock.root}-parked`;
  {
    let applyResidentLockCleanupFailure:
      | ILegacyImportFixtureFailure
      | undefined;
    try {
      const residentLock = path.join(
        replacedAfterResidentLock.root,
        "revision.lock",
      );
      const nativeWrite = fs.writeFileSync;
      let replaced = false;
      fs.writeFileSync = ((
        file: fs.PathOrFileDescriptor,
        ...args: unknown[]
      ): void => {
        Reflect.apply(nativeWrite, fs, [file, ...args]);
        if (
          replaced === false &&
          typeof file !== "number" &&
          path.resolve(file.toString()) === residentLock
        ) {
          replaced = true;
          fs.renameSync(replacedAfterResidentLock.root, parkedResidentRoot);
          fs.symlinkSync(
            residentReplacement,
            replacedAfterResidentLock.root,
            "junction",
          );
        }
      }) as typeof fs.writeFileSync;
      try {
        TestValidator.predicate(
          "root replacement after resident lock acquisition abandons only process-local ownership",
          throws(
            () =>
              new AutoMovieLegacyImporter(
                replacedAfterResidentLock.root,
              ).apply(),
            "root identity",
          ),
        );
      } finally {
        fs.writeFileSync = nativeWrite;
      }
      const parkedToken = fs.readFileSync(
        path.join(parkedResidentRoot, "revision.lock"),
        "utf8",
      );
      const replacementLock = path.join(residentReplacement, "revision.lock");
      const retryToken = acquireCommitLock(residentLock);
      try {
        TestValidator.predicate(
          "the replacement namespace receives a fresh resident lock instead of a poisoned re-entrant token",
          retryToken !== parkedToken &&
            fs.readFileSync(replacementLock, "utf8") === retryToken &&
            fs.existsSync(path.join(residentReplacement, ".automovie")) ===
              false,
        );
      } finally {
        releaseCommitLock(residentLock, retryToken);
      }
    } catch (error) {
      applyResidentLockCleanupFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(applyResidentLockCleanupFailure, [
        {
          resource: "apply resident-lock transient root",
          cleanup: () => {
            if (
              fs.existsSync(replacedAfterResidentLock.root) &&
              fs.lstatSync(replacedAfterResidentLock.root).isSymbolicLink()
            )
              fs.rmSync(replacedAfterResidentLock.root);
          },
        },
        {
          resource: "apply resident-lock resident root",
          cleanup: () => {
            if (fs.existsSync(parkedResidentRoot)) {
              fs.renameSync(parkedResidentRoot, replacedAfterResidentLock.root);
              const parkedLock = path.join(
                replacedAfterResidentLock.root,
                "revision.lock",
              );
              if (fs.existsSync(parkedLock))
                releaseCommitLock(
                  parkedLock,
                  fs.readFileSync(parkedLock, "utf8"),
                );
            }
          },
        },
        {
          resource: "apply resident-lock legacy fixture",
          cleanup: () => replacedAfterResidentLock.dispose(),
        },
        {
          resource: "apply resident-lock replacement target",
          cleanup: () =>
            fs.rmSync(residentReplacement, {
              force: true,
              recursive: true,
            }),
        },
        {
          resource: "apply resident-lock parked fallback",
          cleanup: () => {
            if (fs.existsSync(parkedResidentRoot))
              fs.rmSync(parkedResidentRoot, {
                force: true,
                recursive: true,
              });
          },
        },
      ]);
    }
  }

  const replacedAfterRollbackLock = createLegacy();
  const rollbackReplacement = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-rollback-resident-race-target-"),
  );
  const parkedRollbackResidentRoot = `${replacedAfterRollbackLock.root}-parked`;
  {
    let rollbackResidentLockCleanupFailure:
      | ILegacyImportFixtureFailure
      | undefined;
    try {
      const importer = new AutoMovieLegacyImporter(
        replacedAfterRollbackLock.root,
      );
      importer.apply();
      fs.mkdirSync(path.join(rollbackReplacement, ".automovie"));
      const residentLock = path.join(
        replacedAfterRollbackLock.root,
        ".automovie/revision.lock",
      );
      const nativeWrite = fs.writeFileSync;
      let replaced = false;
      fs.writeFileSync = ((
        file: fs.PathOrFileDescriptor,
        ...args: unknown[]
      ): void => {
        Reflect.apply(nativeWrite, fs, [file, ...args]);
        if (
          replaced === false &&
          typeof file !== "number" &&
          path.resolve(file.toString()) === residentLock
        ) {
          replaced = true;
          fs.renameSync(
            replacedAfterRollbackLock.root,
            parkedRollbackResidentRoot,
          );
          fs.symlinkSync(
            rollbackReplacement,
            replacedAfterRollbackLock.root,
            "junction",
          );
        }
      }) as typeof fs.writeFileSync;
      try {
        TestValidator.predicate(
          "root replacement after rollback lock acquisition abandons only process-local ownership",
          throws(() => importer.rollback(), "root identity"),
        );
      } finally {
        fs.writeFileSync = nativeWrite;
      }
      const parkedToken = fs.readFileSync(
        path.join(parkedRollbackResidentRoot, ".automovie/revision.lock"),
        "utf8",
      );
      const replacementLock = path.join(
        rollbackReplacement,
        ".automovie/revision.lock",
      );
      const retryToken = acquireCommitLock(residentLock);
      try {
        TestValidator.predicate(
          "the rollback replacement namespace receives a fresh resident lock instead of a poisoned re-entrant token",
          retryToken !== parkedToken &&
            fs.readFileSync(replacementLock, "utf8") === retryToken,
        );
      } finally {
        releaseCommitLock(residentLock, retryToken);
      }
    } catch (error) {
      rollbackResidentLockCleanupFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(rollbackResidentLockCleanupFailure, [
        {
          resource: "rollback resident-lock transient root",
          cleanup: () => {
            if (
              fs.existsSync(replacedAfterRollbackLock.root) &&
              fs.lstatSync(replacedAfterRollbackLock.root).isSymbolicLink()
            )
              fs.rmSync(replacedAfterRollbackLock.root);
          },
        },
        {
          resource: "rollback resident-lock resident root",
          cleanup: () => {
            if (fs.existsSync(parkedRollbackResidentRoot)) {
              fs.renameSync(
                parkedRollbackResidentRoot,
                replacedAfterRollbackLock.root,
              );
              const parkedLock = path.join(
                replacedAfterRollbackLock.root,
                ".automovie/revision.lock",
              );
              if (fs.existsSync(parkedLock))
                releaseCommitLock(
                  parkedLock,
                  fs.readFileSync(parkedLock, "utf8"),
                );
            }
          },
        },
        {
          resource: "rollback resident-lock legacy fixture",
          cleanup: () => replacedAfterRollbackLock.dispose(),
        },
        {
          resource: "rollback resident-lock replacement target",
          cleanup: () =>
            fs.rmSync(rollbackReplacement, {
              force: true,
              recursive: true,
            }),
        },
        {
          resource: "rollback resident-lock parked fallback",
          cleanup: () => {
            if (fs.existsSync(parkedRollbackResidentRoot))
              fs.rmSync(parkedRollbackResidentRoot, {
                force: true,
                recursive: true,
              });
          },
        },
      ]);
    }
  }

  const revisionRace = createLegacy();
  try {
    const revisionPath = path.join(revisionRace.root, "revision.json");
    const revisionParked = `${revisionPath}.read-parked`;
    const nativeOpen = fs.openSync;
    let changed = false;
    fs.openSync = ((file: fs.PathLike, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, fs, [
        file,
        ...args,
      ]) as number;
      if (changed === false && path.resolve(file.toString()) === revisionPath) {
        changed = true;
        const revision = JSON.parse(fs.readFileSync(revisionPath, "utf8")) as {
          revision: number;
        };
        fs.renameSync(revisionPath, revisionParked);
        fs.writeFileSync(
          revisionPath,
          `${JSON.stringify({ revision: revision.revision + 1 }, null, 2)}\n`,
        );
      }
      return descriptor;
    }) as typeof fs.openSync;
    let revisionRaceCleanupFailure: ILegacyImportFixtureFailure | undefined;
    try {
      TestValidator.predicate(
        "a changing resident revision cannot produce a mixed import plan",
        throws(
          () => new AutoMovieLegacyImporter(revisionRace.root).plan(),
          "changed physical identity",
        ) && changed,
      );
    } catch (error) {
      revisionRaceCleanupFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(revisionRaceCleanupFailure, [
        {
          resource: "revision-race open hook",
          cleanup: () => {
            fs.openSync = nativeOpen;
          },
        },
        {
          resource: "revision-race transient revision",
          cleanup: () => {
            if (fs.existsSync(revisionParked))
              fs.rmSync(revisionPath, { force: true });
          },
        },
        {
          resource: "revision-race resident revision",
          cleanup: () => {
            if (fs.existsSync(revisionParked))
              fs.renameSync(revisionParked, revisionPath);
          },
        },
      ]);
    }
  } finally {
    revisionRace.dispose();
  }

  const revisionAfterReadRace = createLegacy();
  try {
    const revisionPath = path.join(revisionAfterReadRace.root, "revision.json");
    const nativeOpen = fs.openSync;
    const nativeClose = fs.closeSync;
    let byteSourceDescriptor: number | null = null;
    let changedAfterRead = false;
    fs.openSync = ((file: fs.PathLike, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, fs, [
        file,
        ...args,
      ]) as number;
      if (
        byteSourceDescriptor === null &&
        path.resolve(file.toString()) === revisionPath
      )
        byteSourceDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    fs.closeSync = ((descriptor: number): void => {
      nativeClose(descriptor);
      if (changedAfterRead === false && descriptor === byteSourceDescriptor) {
        changedAfterRead = true;
        const revision = JSON.parse(fs.readFileSync(revisionPath, "utf8")) as {
          revision: number;
        };
        fs.writeFileSync(
          revisionPath,
          `${JSON.stringify({ revision: revision.revision + 1 }, null, 2)}\n`,
        );
      }
    }) as typeof fs.closeSync;
    let revisionAfterReadHookFailure: ILegacyImportFixtureFailure | undefined;
    try {
      TestValidator.predicate(
        "a revision changed after its descriptor read cannot bless a mixed import plan",
        throws(
          () => new AutoMovieLegacyImporter(revisionAfterReadRace.root).plan(),
          "revision changed",
        ) && changedAfterRead,
      );
    } catch (error) {
      revisionAfterReadHookFailure = { error };
      throw error;
    } finally {
      preserveLegacyImportFixtureCleanup(revisionAfterReadHookFailure, [
        {
          resource: "revision-after-read open hook",
          cleanup: () => {
            fs.openSync = nativeOpen;
          },
        },
        {
          resource: "revision-after-read close hook",
          cleanup: () => {
            fs.closeSync = nativeClose;
          },
        },
      ]);
    }
  } finally {
    revisionAfterReadRace.dispose();
  }

  const invalidRollbackBaseline = createLegacy();
  try {
    fs.writeFileSync(path.join(invalidRollbackBaseline.root, "src"), "file");
    TestValidator.predicate(
      "a production-owned rollback baseline must be a physical directory",
      throws(
        () => new AutoMovieLegacyImporter(invalidRollbackBaseline.root).plan(),
        "rollback baseline",
      ),
    );
  } finally {
    invalidRollbackBaseline.dispose();
  }

  const requiredLegacyDirectory = createLegacy();
  try {
    const manifestPath = path.join(
      requiredLegacyDirectory.root,
      "automovie.json",
    );
    fs.rmSync(manifestPath);
    fs.mkdirSync(manifestPath);
    TestValidator.predicate(
      "a required legacy project file must remain a regular file",
      throws(
        () => new AutoMovieLegacyImporter(requiredLegacyDirectory.root).plan(),
        "not a regular file",
      ),
    );
  } finally {
    requiredLegacyDirectory.dispose();
  }

  const collidingCase = createLegacy();
  try {
    fs.writeFileSync(path.join(collidingCase.root, "actors/Officer.txt"), "A");
    fs.writeFileSync(path.join(collidingCase.root, "actors/officer.txt"), "B");
    const collidingActorDirectory = path.join(collidingCase.root, "actors");
    const nativeReaddir = fs.readdirSync;
    fs.readdirSync = ((
      directory: fs.PathLike,
      options?: { withFileTypes?: boolean },
    ): fs.Dirent[] => {
      const entries = Reflect.apply(nativeReaddir, fs, [
        directory,
        options,
      ]) as fs.Dirent[];
      if (
        path.resolve(directory.toString()) === collidingActorDirectory &&
        options?.withFileTypes === true
      )
        return [
          ...entries.filter(
            (entry) => entry.name.toLowerCase() !== "officer.txt",
          ),
          ...["Officer.txt", "officer.txt"].map(
            (name) =>
              ({
                name,
                isSymbolicLink: () => false,
                isDirectory: () => false,
                isFile: () => true,
              }) as fs.Dirent,
          ),
        ];
      return entries;
    }) as typeof fs.readdirSync;
    try {
      TestValidator.predicate(
        "portable legacy inventory refuses case-colliding paths",
        throws(
          () => new AutoMovieLegacyImporter(collidingCase.root).plan(),
          "collide by case",
        ),
      );
    } finally {
      fs.readdirSync = nativeReaddir;
    }
  } finally {
    collidingCase.dispose();
  }

  const inventoryRootFile = createLegacy();
  try {
    fs.rmSync(path.join(inventoryRootFile.root, "actors"), {
      recursive: true,
    });
    fs.writeFileSync(path.join(inventoryRootFile.root, "actors"), "file");
    TestValidator.predicate(
      "a legacy inventory root must remain a physical directory",
      throws(
        () => new AutoMovieLegacyImporter(inventoryRootFile.root).plan(),
        "inventory directory",
      ),
    );
  } finally {
    inventoryRootFile.dispose();
  }

  const specialInventoryEntry = createLegacy();
  try {
    const nativeReaddir = fs.readdirSync;
    fs.readdirSync = ((
      directory: fs.PathLike,
      options?: { withFileTypes?: boolean },
    ): fs.Dirent[] => {
      const entries = Reflect.apply(nativeReaddir, fs, [
        directory,
        options,
      ]) as fs.Dirent[];
      if (
        path.resolve(directory.toString()) ===
          path.join(specialInventoryEntry.root, "actors") &&
        options?.withFileTypes === true
      )
        return [
          ...entries,
          {
            name: "special-device",
            isSymbolicLink: () => false,
            isDirectory: () => false,
            isFile: () => false,
          } as fs.Dirent,
        ];
      return entries;
    }) as typeof fs.readdirSync;
    try {
      TestValidator.predicate(
        "special filesystem entries cannot enter legacy inventory",
        throws(
          () => new AutoMovieLegacyImporter(specialInventoryEntry.root).plan(),
          "not a regular file or directory",
        ),
      );
    } finally {
      fs.readdirSync = nativeReaddir;
    }
  } finally {
    specialInventoryEntry.dispose();
  }

  const linkedRevision = createLegacy();
  let linkedRevisionTarget: string | undefined;
  let linkedRevisionFailure: ILegacyImportFixtureFailure | undefined;
  try {
    linkedRevisionTarget = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-linked-revision-"),
    );
    const revisionPath = path.join(linkedRevision.root, "revision.json");
    fs.writeFileSync(
      path.join(linkedRevisionTarget, "revision.json"),
      '{"revision":2}',
    );
    fs.rmSync(revisionPath);
    fs.symlinkSync(
      path.join(linkedRevisionTarget, "revision.json"),
      revisionPath,
    );
    TestValidator.predicate(
      "legacy project files cannot be read through symlinks",
      throws(
        () => new AutoMovieLegacyImporter(linkedRevision.root).plan(),
        "symlink or junction",
      ),
    );
  } catch (error) {
    linkedRevisionFailure = { error };
    throw error;
  } finally {
    const completedLinkedRevisionTarget = linkedRevisionTarget;
    preserveLegacyImportFixtureCleanup(linkedRevisionFailure, [
      {
        resource: "linked-revision legacy fixture",
        cleanup: () => linkedRevision.dispose(),
      },
      ...(completedLinkedRevisionTarget === undefined
        ? []
        : [
            {
              resource: "linked-revision outside root",
              cleanup: () =>
                fs.rmSync(completedLinkedRevisionTarget, {
                  force: true,
                  recursive: true,
                }),
            },
          ]),
    ]);
  }

  for (const lockMutation of [
    "missing",
    "symlink",
    "directory",
    "foreign-token",
  ] as const) {
    const changingLock = createLegacy();
    let outsideLock: string | undefined;
    let changingLockFailure: ILegacyImportFixtureFailure | undefined;
    try {
      outsideLock = fs.mkdtempSync(
        path.join(os.tmpdir(), "automovie-changing-lock-"),
      );
      const manifestPath = path.join(changingLock.root, "automovie.json");
      const lockPath = path.join(changingLock.root, "revision.lock");
      const outsideLockPath = path.join(outsideLock, "revision.lock");
      fs.writeFileSync(outsideLockPath, "external-owner");
      const nativeOpen = fs.openSync;
      let changed = false;
      fs.openSync = ((file: fs.PathLike, ...args: unknown[]): number => {
        const descriptor = Reflect.apply(nativeOpen, fs, [
          file,
          ...args,
        ]) as number;
        if (
          changed === false &&
          path.resolve(file.toString()) === manifestPath
        ) {
          changed = true;
          fs.rmSync(lockPath, { force: true });
          if (lockMutation === "symlink")
            fs.symlinkSync(outsideLockPath, lockPath);
          else if (lockMutation === "directory") fs.mkdirSync(lockPath);
          else if (lockMutation === "foreign-token")
            fs.writeFileSync(lockPath, "external-owner");
        }
        return descriptor;
      }) as typeof fs.openSync;
      try {
        TestValidator.predicate(
          `resident lock mutation ${lockMutation} aborts legacy apply`,
          throws(
            () => new AutoMovieLegacyImporter(changingLock.root).apply(),
            "changed during import apply",
          ) && changed,
        );
      } finally {
        fs.openSync = nativeOpen;
      }
    } catch (error) {
      changingLockFailure = { error };
      throw error;
    } finally {
      const completedOutsideLock = outsideLock;
      preserveLegacyImportFixtureCleanup(changingLockFailure, [
        {
          resource: "changing-lock legacy fixture",
          cleanup: () => changingLock.dispose(),
        },
        ...(completedOutsideLock === undefined
          ? []
          : [
              {
                resource: "changing-lock outside root",
                cleanup: () =>
                  fs.rmSync(completedOutsideLock, {
                    force: true,
                    recursive: true,
                  }),
              },
            ]),
      ]);
    }
  }

  const mismatchedRollbackLock = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(mismatchedRollbackLock.root);
    importer.apply();
    const lockPath = path.join(
      mismatchedRollbackLock.root,
      ".automovie/revision.lock",
    );
    const nativeWrite = fs.writeFileSync;
    let corrupted = false;
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      Reflect.apply(nativeWrite, fs, [file, ...args]);
      if (
        corrupted === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === lockPath
      ) {
        corrupted = true;
        nativeWrite(lockPath, "foreign-owner");
      }
    }) as typeof fs.writeFileSync;
    try {
      TestValidator.predicate(
        "rollback verifies the exact resident lock token",
        throws(() => importer.rollback(), "changed after import") && corrupted,
      );
    } finally {
      fs.writeFileSync = nativeWrite;
    }
  } finally {
    mismatchedRollbackLock.dispose();
  }

  const linkedAppliedState = createLegacy();
  let linkedAppliedStateTarget: string | undefined;
  let linkedAppliedStateFailure: ILegacyImportFixtureFailure | undefined;
  try {
    linkedAppliedStateTarget = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-linked-applied-state-"),
    );
    const importer = new AutoMovieLegacyImporter(linkedAppliedState.root);
    importer.apply();
    const linkedPath = path.join(linkedAppliedState.root, ".automovie/linked");
    const target = path.join(linkedAppliedStateTarget, "outside.txt");
    fs.writeFileSync(target, "outside");
    fs.symlinkSync(target, linkedPath);
    TestValidator.predicate(
      "symbolic links cannot enter an applied import state tree",
      throws(() => importer.rollback(), "changed after import"),
    );
  } catch (error) {
    linkedAppliedStateFailure = { error };
    throw error;
  } finally {
    const completedLinkedAppliedStateTarget = linkedAppliedStateTarget;
    preserveLegacyImportFixtureCleanup(linkedAppliedStateFailure, [
      {
        resource: "linked-applied-state legacy fixture",
        cleanup: () => linkedAppliedState.dispose(),
      },
      ...(completedLinkedAppliedStateTarget === undefined
        ? []
        : [
            {
              resource: "linked-applied-state outside root",
              cleanup: () =>
                fs.rmSync(completedLinkedAppliedStateTarget, {
                  force: true,
                  recursive: true,
                }),
            },
          ]),
    ]);
  }

  const directoryImportPlan = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(directoryImportPlan.root);
    importer.apply();
    const planPath = path.join(
      directoryImportPlan.root,
      ".automovie/imports/legacy-v1/plan.json",
    );
    fs.rmSync(planPath);
    fs.mkdirSync(planPath);
    TestValidator.predicate(
      "import metadata must remain a physical regular file",
      throws(() => importer.rollback(), "not a physical file"),
    );
  } finally {
    directoryImportPlan.dispose();
  }

  const specialAppliedState = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(specialAppliedState.root);
    importer.apply();
    const stateRoot = path.join(specialAppliedState.root, ".automovie");
    const nativeReaddir = fs.readdirSync;
    fs.readdirSync = ((
      directory: fs.PathLike,
      options?: { withFileTypes?: boolean },
    ): fs.Dirent[] => {
      const entries = Reflect.apply(nativeReaddir, fs, [
        directory,
        options,
      ]) as fs.Dirent[];
      if (
        path.resolve(directory.toString()) === stateRoot &&
        options?.withFileTypes === true
      )
        return [
          ...entries,
          {
            name: "special-device",
            isSymbolicLink: () => false,
            isDirectory: () => false,
            isFile: () => false,
          } as fs.Dirent,
        ];
      return entries;
    }) as typeof fs.readdirSync;
    try {
      TestValidator.predicate(
        "special applied-state entries invalidate rollback verification",
        throws(() => importer.rollback(), "changed after import"),
      );
    } finally {
      fs.readdirSync = nativeReaddir;
    }
  } finally {
    specialAppliedState.dispose();
  }

  const malformedRoots = [
    {
      name: "missing manifest",
      prepare: (_root: string): void => {},
      fragment: "absent",
    },
    {
      name: "malformed manifest JSON",
      prepare: (root: string): void => {
        fs.writeFileSync(path.join(root, "automovie.json"), "{bad");
      },
      fragment: "Invalid JSON",
    },
    {
      name: "invalid manifest shape",
      prepare: (root: string): void => {
        fs.writeFileSync(path.join(root, "automovie.json"), "{}");
      },
      fragment: "version 1",
    },
    {
      name: "invalid revision",
      prepare: (root: string): void => {
        fs.writeFileSync(
          path.join(root, "automovie.json"),
          '{"version":1,"assets":[]}',
        );
        fs.writeFileSync(path.join(root, "revision.json"), '{"revision":-1}');
      },
      fragment: "non-negative",
    },
    {
      name: "noncanonical asset",
      prepare: (root: string): void => {
        fs.writeFileSync(
          path.join(root, "automovie.json"),
          '{"version":1,"assets":["assets\\\\bad.bin"]}',
        );
      },
      fragment: "canonical",
    },
  ];
  for (const malformed of malformedRoots) {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-bad-import-"),
    );
    try {
      malformed.prepare(root);
      TestValidator.predicate(
        malformed.name,
        throws(
          () => new AutoMovieLegacyImporter(root).plan(),
          malformed.fragment,
        ),
      );
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  }

  const unsafe = createLegacy();
  let outside: string | undefined;
  let unsafeFailure: ILegacyImportFixtureFailure | undefined;
  try {
    outside = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-outside-"));
    fs.writeFileSync(path.join(outside, "shot.json"), "{}");
    fs.symlinkSync(
      path.join(outside, "shot.json"),
      path.join(unsafe.root, "shots/unsafe.json"),
    );
    TestValidator.predicate(
      "symlinked legacy inventory is refused",
      throws(
        () => new AutoMovieLegacyImporter(unsafe.root).plan(),
        "symlink or junction",
      ),
    );
  } catch (error) {
    unsafeFailure = { error };
    throw error;
  } finally {
    const completedOutside = outside;
    preserveLegacyImportFixtureCleanup(unsafeFailure, [
      {
        resource: "unsafe-inventory legacy fixture",
        cleanup: () => unsafe.dispose(),
      },
      ...(completedOutside === undefined
        ? []
        : [
            {
              resource: "unsafe-inventory outside root",
              cleanup: () =>
                fs.rmSync(completedOutside, {
                  force: true,
                  recursive: true,
                }),
            },
          ]),
    ]);
  }
};
