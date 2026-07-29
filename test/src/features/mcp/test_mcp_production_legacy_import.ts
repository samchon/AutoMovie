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

const createLegacy = (): {
  root: string;
  dispose: () => void;
} => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-import-test-"));
  const project = AutoMovieProject.open(root);
  project.saveSlate(slate);
  project.registerAsset("assets/reference.bin", Buffer.from("legacy-asset"));
  fs.mkdirSync(path.join(root, "actors/archive"), { recursive: true });
  fs.writeFileSync(path.join(root, "actors/archive/README.txt"), "legacy");
  return {
    root,
    dispose: () => fs.rmSync(root, { force: true, recursive: true }),
  };
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
 */
export const test_mcp_production_legacy_import = (): void => {
  const fixture = createLegacy();
  try {
    const before = legacyFiles(fixture.root);
    const importer = new AutoMovieLegacyImporter(fixture.root);
    const nativePlanWrite = fs.writeFileSync;
    const planLockPaths: string[] = [];
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
    let plan: IAutoMovieLegacyImportPlan;
    try {
      plan = importer.plan();
    } finally {
      fs.writeFileSync = nativePlanWrite;
    }
    TestValidator.predicate(
      "planning is read-only and captures drafts, source gaps, and exact bytes",
      equalFiles(before, legacyFiles(fixture.root)) &&
        fs.existsSync(path.join(fixture.root, ".automovie")) === false &&
        planLockPaths.length === 2 &&
        planLockPaths.every((file) => fs.existsSync(file) === false) &&
        plan.legacyRevision === 2 &&
        plan.productionDraft.frameFormat.fps === 24 &&
        plan.shotContractDrafts[0]?.id === shot.id &&
        plan.sourceTodos[0]?.shot === shot.id &&
        plan.diagnostics.some(
          (diagnostic) => diagnostic.code === "legacy-source-unrecoverable",
        ) &&
        plan.inventory.some(
          (entry) =>
            entry.path === "assets/reference.bin" &&
            entry.kind === "asset" &&
            entry.digest !== null,
        ) &&
        plan.inventory.some(
          (entry) => entry.path === "actors/archive/README.txt",
        ),
    );
    const applied = importer.apply();
    const repeated = importer.apply();
    const production = AutoMovieProductionProject.open(fixture.root);
    const repeatedAfterOpen = importer.apply();
    TestValidator.predicate(
      "apply is atomic, idempotent, and production provenance reopens",
      applied.status === "applied" &&
        repeated.status === "unchanged" &&
        repeatedAfterOpen.status === "unchanged" &&
        repeated.plan.fingerprint === plan.fingerprint &&
        repeatedAfterOpen.plan.fingerprint === plan.fingerprint &&
        production.manifest().importedLegacy?.revision === 2 &&
        production.manifest().importedLegacy?.sourceRoot === "." &&
        equalFiles(before, legacyFiles(fixture.root)),
    );
    const rolledBack = importer.rollback();
    TestValidator.predicate(
      "rollback removes only untouched import state and empty owned roots",
      rolledBack.fingerprint === plan.fingerprint &&
        fs.existsSync(path.join(fixture.root, ".automovie")) === false &&
        fs.existsSync(path.join(fixture.root, "src")) === false &&
        fs.existsSync(path.join(fixture.root, "generated")) === false &&
        equalFiles(before, legacyFiles(fixture.root)) &&
        throws(() => importer.rollback(), "Nothing was rolled back"),
    );
  } finally {
    fixture.dispose();
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

  const publishRootSwap = createLegacy();
  const parkedPublishRoot = `${publishRootSwap.root}-parked`;
  try {
    const stateRoot = path.join(publishRootSwap.root, ".automovie");
    const nativeRename = fs.renameSync;
    let swapped = false;
    fs.renameSync = ((oldPath: fs.PathLike, newPath: fs.PathLike): void => {
      nativeRename(oldPath, newPath);
      if (swapped === false && path.resolve(newPath.toString()) === stateRoot) {
        swapped = true;
        nativeRename(publishRootSwap.root, parkedPublishRoot);
        fs.mkdirSync(publishRootSwap.root);
      }
    }) as typeof fs.renameSync;
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
    } finally {
      fs.renameSync = nativeRename;
      if (swapped) {
        fs.rmSync(publishRootSwap.root, { force: true, recursive: true });
        nativeRename(parkedPublishRoot, publishRootSwap.root);
      }
    }
  } finally {
    publishRootSwap.dispose();
    if (fs.existsSync(parkedPublishRoot))
      fs.rmSync(parkedPublishRoot, { force: true, recursive: true });
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
    AutoMovieProductionProject.open(productionWork.root);
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
    importer.apply();
    AutoMovieProductionProject.open(rollbackFailure.root);
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
    try {
      TestValidator.predicate(
        "a partial rollback failure restores the complete applied state",
        throws(() => importer.rollback(), "state was restored") &&
          fs.existsSync(path.join(rollbackFailure.root, ".automovie")) &&
          importer.apply().status === "unchanged" &&
          quarantineCleanupDenied,
      );
    } finally {
      fs.rmdirSync = nativeRmdir;
      fs.mkdirSync = nativeMkdir;
      fs.writeFileSync = nativeWrite;
      fs.rmSync = nativeRm;
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
  try {
    const importer = new AutoMovieLegacyImporter(rollbackRootSwap.root);
    importer.apply();
    AutoMovieProductionProject.open(rollbackRootSwap.root);
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
    try {
      TestValidator.predicate(
        "rollback abandons restoration when the physical root changes",
        throws(() => importer.rollback(), "changed physical identity") &&
          swapped &&
          fs.readdirSync(rollbackRootSwap.root).length === 0,
      );
    } finally {
      fs.rmdirSync = nativeRmdir;
      if (swapped) {
        fs.rmSync(rollbackRootSwap.root, { force: true, recursive: true });
        fs.renameSync(parkedRollbackRoot, rollbackRootSwap.root);
      }
    }
  } finally {
    rollbackRootSwap.dispose();
    if (fs.existsSync(parkedRollbackRoot))
      fs.rmSync(parkedRollbackRoot, { force: true, recursive: true });
  }

  const incompleteRestoration = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(incompleteRestoration.root);
    importer.apply();
    AutoMovieProductionProject.open(incompleteRestoration.root);
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
    try {
      TestValidator.predicate(
        "rollback reports every failed state and owned-directory restoration",
        throws(() => importer.rollback(), "restoration was incomplete"),
      );
    } finally {
      fs.rmdirSync = nativeRmdir;
      fs.renameSync = nativeRename;
      fs.mkdirSync = nativeMkdir;
    }
  } finally {
    incompleteRestoration.dispose();
  }

  const preservedQuarantine = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(preservedQuarantine.root);
    importer.apply();
    AutoMovieProductionProject.open(preservedQuarantine.root);
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
    try {
      TestValidator.predicate(
        "rollback reports an authoritative quarantine when restoration cannot publish",
        throws(() => importer.rollback(), "remains preserved"),
      );
    } finally {
      fs.rmdirSync = nativeRmdir;
      fs.renameSync = nativeRename;
    }
  } finally {
    preservedQuarantine.dispose();
  }

  const incarnationRace = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(incarnationRace.root);
    importer.apply();
    const stale = AutoMovieProductionProject.open(incarnationRace.root);
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
    AutoMovieProductionProject.open(incarnationRace.root);
    TestValidator.predicate(
      "a stale production handle cannot cross rollback and re-apply ABA",
      freshReappliedLock &&
        retiredOwnerPreservesFreshLock &&
        throws(() => stale.manifest(), "incarnation changed") &&
        throws(
          () =>
            stale.commitProductionDeliverableFiles(
              "stale",
              new Map([["frame.bin", Buffer.from("stale")]]),
            ),
          "incarnation changed",
        ) &&
        fs.existsSync(
          path.join(incarnationRace.root, "renders/deliverables/stale"),
        ) === false,
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
  const linkedParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-linked-import-root-"),
  );
  try {
    const link = path.join(linkedParent, "project");
    fs.symlinkSync(linkedRoot.root, link, "junction");
    TestValidator.predicate(
      "apply validates a physical root before creating its resident lock",
      throws(
        () => new AutoMovieLegacyImporter(link).apply(),
        "physical, dedicated",
      ) && fs.existsSync(path.join(linkedRoot.root, "revision.lock")) === false,
    );
  } finally {
    linkedRoot.dispose();
    fs.rmSync(linkedParent, { force: true, recursive: true });
  }

  const replacedDuringAcquire = createLegacy();
  const replacementTarget = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-import-root-race-target-"),
  );
  const parkedRoot = `${replacedDuringAcquire.root}-parked`;
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
    try {
      TestValidator.predicate(
        "root replacement after namespace acquisition is detected before import",
        throws(
          () => new AutoMovieLegacyImporter(replacedDuringAcquire.root).apply(),
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
    } finally {
      fs.writeFileSync = nativeWrite;
      if (fs.lstatSync(replacedDuringAcquire.root).isSymbolicLink())
        fs.rmSync(replacedDuringAcquire.root);
      if (fs.existsSync(parkedRoot)) {
        fs.renameSync(parkedRoot, replacedDuringAcquire.root);
      }
    }
  } finally {
    replacedDuringAcquire.dispose();
    fs.rmSync(replacementTarget, { force: true, recursive: true });
    if (fs.existsSync(parkedRoot))
      fs.rmSync(parkedRoot, { force: true, recursive: true });
  }

  const replacedAfterResidentLock = createLegacy();
  const residentReplacement = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-import-resident-race-target-"),
  );
  const parkedResidentRoot = `${replacedAfterResidentLock.root}-parked`;
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
            new AutoMovieLegacyImporter(replacedAfterResidentLock.root).apply(),
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
          fs.existsSync(path.join(residentReplacement, ".automovie")) === false,
      );
    } finally {
      releaseCommitLock(residentLock, retryToken);
    }
  } finally {
    if (
      fs.existsSync(replacedAfterResidentLock.root) &&
      fs.lstatSync(replacedAfterResidentLock.root).isSymbolicLink()
    )
      fs.rmSync(replacedAfterResidentLock.root);
    if (fs.existsSync(parkedResidentRoot)) {
      fs.renameSync(parkedResidentRoot, replacedAfterResidentLock.root);
      const parkedLock = path.join(
        replacedAfterResidentLock.root,
        "revision.lock",
      );
      if (fs.existsSync(parkedLock))
        releaseCommitLock(parkedLock, fs.readFileSync(parkedLock, "utf8"));
    }
    replacedAfterResidentLock.dispose();
    fs.rmSync(residentReplacement, { force: true, recursive: true });
    if (fs.existsSync(parkedResidentRoot))
      fs.rmSync(parkedResidentRoot, { force: true, recursive: true });
  }

  const revisionRace = createLegacy();
  try {
    const revisionPath = path.join(revisionRace.root, "revision.json");
    const nativeRead = fs.readFileSync;
    let changed = false;
    fs.readFileSync = ((file: fs.PathOrFileDescriptor, ...args: unknown[]) => {
      const output = Reflect.apply(nativeRead, fs, [file, ...args]) as unknown;
      if (
        changed === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === revisionPath
      ) {
        changed = true;
        const revision = JSON.parse(
          Buffer.from(output as Uint8Array).toString("utf8"),
        ) as { revision: number };
        fs.writeFileSync(
          revisionPath,
          `${JSON.stringify({ revision: revision.revision + 1 }, null, 2)}\n`,
        );
      }
      return output;
    }) as typeof fs.readFileSync;
    try {
      TestValidator.predicate(
        "a changing resident revision cannot produce a mixed import plan",
        throws(
          () => new AutoMovieLegacyImporter(revisionRace.root).plan(),
          "revision changed",
        ),
      );
    } finally {
      fs.readFileSync = nativeRead;
    }
  } finally {
    revisionRace.dispose();
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

  const collidingCase = createLegacy();
  try {
    fs.writeFileSync(path.join(collidingCase.root, "actors/Officer.txt"), "A");
    fs.writeFileSync(path.join(collidingCase.root, "actors/officer.txt"), "B");
    TestValidator.predicate(
      "portable legacy inventory refuses case-colliding paths",
      throws(
        () => new AutoMovieLegacyImporter(collidingCase.root).plan(),
        "collide by case",
      ),
    );
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
  const linkedRevisionTarget = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-linked-revision-"),
  );
  try {
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
  } finally {
    linkedRevision.dispose();
    fs.rmSync(linkedRevisionTarget, { force: true, recursive: true });
  }

  for (const lockMutation of [
    "missing",
    "symlink",
    "directory",
    "foreign-token",
  ] as const) {
    const changingLock = createLegacy();
    const outsideLock = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-changing-lock-"),
    );
    try {
      const manifestPath = path.join(changingLock.root, "automovie.json");
      const lockPath = path.join(changingLock.root, "revision.lock");
      const outsideLockPath = path.join(outsideLock, "revision.lock");
      fs.writeFileSync(outsideLockPath, "external-owner");
      const nativeRead = fs.readFileSync;
      let changed = false;
      fs.readFileSync = ((
        file: fs.PathOrFileDescriptor,
        ...args: unknown[]
      ): unknown => {
        const output = Reflect.apply(nativeRead, fs, [file, ...args]);
        if (
          changed === false &&
          typeof file !== "number" &&
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
        return output;
      }) as typeof fs.readFileSync;
      try {
        TestValidator.predicate(
          `resident lock mutation ${lockMutation} aborts legacy apply`,
          throws(
            () => new AutoMovieLegacyImporter(changingLock.root).apply(),
            "changed during import apply",
          ),
        );
      } finally {
        fs.readFileSync = nativeRead;
      }
    } finally {
      changingLock.dispose();
      fs.rmSync(outsideLock, { force: true, recursive: true });
    }
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
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-outside-"));
  try {
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
  } finally {
    unsafe.dispose();
    fs.rmSync(outside, { force: true, recursive: true });
  }
};
