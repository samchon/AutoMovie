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

/** Legacy import plans, applies, reopens, and rolls back without byte loss. */
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
        path
          .basename(path.dirname(file.toString()))
          .startsWith("automovie-root-locks-") &&
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
        planLockPaths.length === 1 &&
        fs.existsSync(planLockPaths[0]!) === false &&
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
    let removals = 0;
    fs.rmdirSync = ((directory: fs.PathLike): void => {
      ++removals;
      if (removals === 2) {
        if (
          fs.existsSync(rootNamespaceLockPath(rollbackFailure.root)) === false
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
    try {
      TestValidator.predicate(
        "a partial rollback failure restores the complete applied state",
        throws(() => importer.rollback(), "state was restored") &&
          fs.existsSync(path.join(rollbackFailure.root, ".automovie")) &&
          importer.apply().status === "unchanged",
      );
    } finally {
      fs.rmdirSync = nativeRmdir;
      fs.mkdirSync = nativeMkdir;
    }
    TestValidator.predicate(
      "a restored import remains safely roll-backable",
      importer.rollback().status === "rolled-back" &&
        fs.existsSync(path.join(rollbackFailure.root, ".automovie")) === false,
    );
  } finally {
    rollbackFailure.dispose();
  }

  const incarnationRace = createLegacy();
  try {
    const importer = new AutoMovieLegacyImporter(incarnationRace.root);
    importer.apply();
    const stale = AutoMovieProductionProject.open(incarnationRace.root);
    importer.rollback();
    importer.apply();
    AutoMovieProductionProject.open(incarnationRace.root);
    TestValidator.predicate(
      "a stale production handle cannot cross rollback and re-apply ABA",
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
    let namespaceLock: string | null = null;
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
        path
          .basename(path.dirname(file.toString()))
          .startsWith("automovie-root-locks-") &&
        path.basename(file.toString()).startsWith("root-")
      ) {
        namespaceLock = path.resolve(file.toString());
        replaced = true;
        fs.renameSync(replacedDuringAcquire.root, parkedRoot);
        fs.symlinkSync(
          replacementTarget,
          replacedDuringAcquire.root,
          "junction",
        );
      }
    }) as typeof fs.writeFileSync;
    try {
      TestValidator.predicate(
        "root replacement after namespace acquisition is detected before import",
        throws(
          () => new AutoMovieLegacyImporter(replacedDuringAcquire.root).apply(),
          "identity changed",
        ) &&
          fs.existsSync(path.join(replacementTarget, "revision.lock")) ===
            false &&
          namespaceLock !== null &&
          fs.existsSync(namespaceLock) === false,
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
