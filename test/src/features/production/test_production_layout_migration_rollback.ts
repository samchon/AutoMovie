import { AutoMovieProductionProject } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  createTestFileSystem,
  withTestFileSystem,
} from "../internal/testFileSystem";
import { productionFixture } from "./productionFixtures";

const platformError = (code: string): Error =>
  Object.assign(new Error(code), { code });

/** Move the namespaced design of the fixture back to its legacy positions. */
const legacyLayout = (root: string): void => {
  const design = path.join(root, "automovie", "design");
  for (const [from, to] of [
    ["shared/models", "models"],
    ["shared/formations", "formations"],
    ["shared/world.json", "world.json"],
    ["fixture-film/production.json", "production.json"],
    ["fixture-film/shots", "shots"],
    ["fixture-film/acceptance", "acceptance"],
    ["fixture-film/screenplay", "screenplay"],
  ] as const) {
    const source = path.join(design, ...from.split("/"));
    if (fs.existsSync(source))
      fs.renameSync(source, path.join(design, ...to.split("/")));
  }
  for (const directory of ["shared", "fixture-film"])
    fs.rmSync(path.join(design, directory), { recursive: true, force: true });
  fs.rmSync(path.join(root, "automovie", "productions.json"), { force: true });
};

const layout = (root: string): Record<string, boolean> => {
  const design = path.join(root, "automovie", "design");
  return Object.fromEntries(
    [
      "models",
      "production.json",
      "shots",
      "shared/models",
      "fixture-film/production.json",
      "fixture-film/shots",
    ].map((entry) => [
      entry,
      fs.existsSync(path.join(design, ...entry.split("/"))),
    ]),
  );
};

/** Legacy sources in the order the migration stages them. */
const STAGED_SOURCES = [
  "design/models",
  "design/formations",
  "design/world.json",
  "design/production.json",
  "design/shots",
  "design/acceptance",
  "design/screenplay",
];

/** Return staged entries a stopped rollback left behind to their legacy paths. */
const restoreStaged = (root: string): void => {
  const automovie = path.join(root, "automovie");
  for (const temporary of migrationTemporaries(root)) {
    for (const entry of fs.readdirSync(path.join(automovie, temporary))) {
      const source = STAGED_SOURCES[Number(entry)];
      if (source === undefined) continue;
      const target = path.join(automovie, ...source.split("/"));
      if (fs.existsSync(target)) continue;
      fs.renameSync(path.join(automovie, temporary, entry), target);
    }
    fs.rmSync(path.join(automovie, temporary), {
      recursive: true,
      force: true,
    });
  }
};

const migrationTemporaries = (root: string): string[] =>
  fs
    .readdirSync(path.join(root, "automovie"))
    .filter((entry) => entry.startsWith(".layout-migration-"));

const failure = (
  task: () => unknown,
): { message: string; causes: string[] } | null => {
  try {
    task();
    return null;
  } catch (error) {
    return {
      message: (error as Error).message,
      causes:
        error instanceof AggregateError
          ? error.errors.map((cause) => (cause as Error).message)
          : [],
    };
  }
};

/**
 * The legacy layout migration either completes or puts every legacy path back
 * where it was; a failure after the registry commit point says so instead of
 * touching the migrated tree.
 *
 * Scenarios:
 *
 * 1. A rename refused midway through publication rolls every published and
 *    staged move back to its legacy path, leaves no staging directory behind,
 *    and reports the refused rename. When legacy output roots take part, the
 *    empty namespaced root the migration created is removed again so the
 *    staged legacy tree can return to its own path.
 * 2. A legacy entry whose physical identity can no longer be confirmed during
 *    that rollback stops the rollback and reports both failures together.
 * 3. A failure after the migrated registry was published is reported as a
 *    committed migration with no rollback.
 * 4. The next clean open migrates the restored legacy layout completely.
 */
export const test_production_layout_migration_rollback = (): void => {
  const fixture = productionFixture();
  try {
    legacyLayout(fixture.root);
    const before = layout(fixture.root);
    const shots = `${path.sep}shots`;

    // 1. A refused publication rename rolls back. The refusal fires once, so
    //    the rollback that renames the same entry home is not refused too.
    let refused = false;
    const refusedPublish = createTestFileSystem({
      renameSync: ((...args: unknown[]) => {
        if (refused === false && String(args[1]).endsWith(shots)) {
          refused = true;
          throw platformError("EIO");
        }
        return Reflect.apply(fs.renameSync, fs, args);
      }) as typeof fs.renameSync,
    });
    const rolledBack = failure(() =>
      withTestFileSystem(refusedPublish.fileSystem, () =>
        AutoMovieProductionProject.open(fixture.root),
      ),
    );
    const afterRollback = layout(fixture.root);
    const temporariesAfterRollback = migrationTemporaries(fixture.root);

    // 1b. Legacy output roots move into their own production directory, which
    //     the migration creates inside the emptied legacy root. A rollback has
    //     to remove that empty root again before the staged legacy tree can
    //     return to its path, whether the move was already published (the
    //     generated root) or still staged (the render root).
    const legacyOutputs = {
      generated: path.join(fixture.root, "generated", "stale.json"),
      renders: path.join(fixture.root, "renders", "stale.bin"),
    };
    for (const file of Object.values(legacyOutputs)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "legacy");
    }
    let refusedRender = false;
    const refusedRenderPublish = createTestFileSystem({
      renameSync: ((...args: unknown[]) => {
        if (
          refusedRender === false &&
          String(args[1]).endsWith(path.join("renders", "fixture-film"))
        ) {
          refusedRender = true;
          throw platformError("EIO");
        }
        return Reflect.apply(fs.renameSync, fs, args);
      }) as typeof fs.renameSync,
    });
    const outputsRolledBack = failure(() =>
      withTestFileSystem(refusedRenderPublish.fileSystem, () =>
        AutoMovieProductionProject.open(fixture.root),
      ),
    );
    const afterOutputRollback = {
      layout: layout(fixture.root),
      outputs: Object.fromEntries(
        Object.entries(legacyOutputs).map(([name, file]) => [
          name,
          fs.existsSync(file),
        ]),
      ),
      namespaced: fs.existsSync(
        path.join(fixture.root, "generated", "fixture-film"),
      ),
      temporaries: migrationTemporaries(fixture.root),
    };
    for (const file of Object.values(legacyOutputs))
      fs.rmSync(path.dirname(file), { recursive: true, force: true });

    // 2. An identity that cannot be confirmed during rollback stops it.
    let rollingBack = false;
    const lostIdentity = createTestFileSystem({
      renameSync: ((...args: unknown[]) => {
        if (rollingBack === false && String(args[1]).endsWith(shots)) {
          rollingBack = true;
          throw platformError("EIO");
        }
        return Reflect.apply(fs.renameSync, fs, args);
      }) as typeof fs.renameSync,
      statSync: ((...args: unknown[]) => {
        if (
          rollingBack &&
          String(args[0]).endsWith(`${path.sep}shared${path.sep}models`)
        )
          throw platformError("EIO");
        return Reflect.apply(fs.statSync, fs, args);
      }) as typeof fs.statSync,
    });
    const stopped = failure(() =>
      withTestFileSystem(lostIdentity.fileSystem, () =>
        AutoMovieProductionProject.open(fixture.root),
      ),
    );
    // The stopped rollback left the published moves in place; put the legacy
    // layout back by hand for the remaining scenarios.
    legacyLayout(fixture.root);
    restoreStaged(fixture.root);

    // 3. A failure after the registry commit point is reported as committed.
    let staged = false;
    const committedRegistry = createTestFileSystem({
      renameSync: ((...args: unknown[]) => {
        if (String(args[1]).includes(".layout-migration-")) staged = true;
        return Reflect.apply(fs.renameSync, fs, args);
      }) as typeof fs.renameSync,
      rmSync: ((...args: unknown[]) => {
        const target = String(args[0]);
        if (
          staged &&
          target.includes("productions.json") &&
          target.includes(".tmp")
        )
          throw platformError("EIO");
        return Reflect.apply(fs.rmSync, fs, args);
      }) as typeof fs.rmSync,
    });
    const committed = failure(() =>
      withTestFileSystem(committedRegistry.fileSystem, () =>
        AutoMovieProductionProject.open(fixture.root),
      ),
    );
    const afterCommitted = layout(fixture.root);

    // 4. A clean open of an already migrated layout succeeds.
    const migrated = AutoMovieProductionProject.open(fixture.root);
    TestValidator.equals(
      "a refused migration rolls back, a lost identity stops, and a committed registry stays",
      {
        before,
        rolledBack: {
          message: rolledBack?.message,
          causes: rolledBack?.causes,
          layout: afterRollback,
          temporaries: temporariesAfterRollback,
        },
        outputsRolledBack: {
          message: outputsRolledBack?.message,
          causes: outputsRolledBack?.causes,
          ...afterOutputRollback,
        },
        stopped: {
          message: stopped?.message,
          causes: stopped?.causes.map((cause) => cause.split(":")[0]),
        },
        committed: {
          message: committed?.message,
          causes: committed?.causes.map((cause) => cause.split(":")[0]),
          layout: afterCommitted,
        },
        migrated: migrated.productionId,
      },
      {
        before: {
          models: true,
          "production.json": true,
          shots: true,
          "shared/models": false,
          "fixture-film/production.json": false,
          "fixture-film/shots": false,
        },
        rolledBack: {
          message: "EIO",
          causes: [],
          layout: {
            models: true,
            "production.json": true,
            shots: true,
            "shared/models": false,
            "fixture-film/production.json": false,
            "fixture-film/shots": false,
          },
          temporaries: [],
        },
        outputsRolledBack: {
          message: "EIO",
          causes: [],
          layout: {
            models: true,
            "production.json": true,
            shots: true,
            "shared/models": false,
            "fixture-film/production.json": false,
            "fixture-film/shots": false,
          },
          outputs: { generated: true, renders: true },
          namespaced: false,
          temporaries: [],
        },
        stopped: {
          message:
            "Legacy migration stopped after an owned namespace changed physical identity. No stale-path rollback was attempted.",
          causes: ["EIO", "EIO"],
        },
        committed: {
          message:
            "Legacy migration data and registry were committed. No rollback was attempted after the registry commit point.",
          causes: ["EIO"],
          layout: {
            models: false,
            "production.json": false,
            shots: false,
            "shared/models": true,
            "fixture-film/production.json": true,
            "fixture-film/shots": true,
          },
        },
        migrated: "fixture-film",
      },
    );
  } finally {
    fixture.dispose();
  }
};
