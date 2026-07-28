import {
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
    const plan = importer.plan();
    TestValidator.predicate(
      "planning is read-only and captures drafts, source gaps, and exact bytes",
      equalFiles(before, legacyFiles(fixture.root)) &&
        fs.existsSync(path.join(fixture.root, ".automovie")) === false &&
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
    TestValidator.predicate(
      "apply is atomic, idempotent, and production provenance reopens",
      applied.status === "applied" &&
        repeated.status === "unchanged" &&
        repeated.plan.fingerprint === plan.fingerprint &&
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
