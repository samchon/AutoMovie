import { AutoMovieProductionProject } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { throwsError } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

interface IRefusalCleanupFailure {
  error: unknown;
}

class RefusalCleanupError extends AggregateError {}

const preserveRefusalCleanup = (
  failure: IRefusalCleanupFailure | undefined,
  cleanup: () => void,
  resource: string,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new RefusalCleanupError(
      [failure.error, cleanupFailure],
      `${resource} cleanup failed after the assertion failed.`,
    );
  }
};

const withRoot = (
  scenario: (root: string) => void,
  prefix = "automovie-project-refusal-",
): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  let failure: IRefusalCleanupFailure | undefined;
  try {
    scenario(root);
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveRefusalCleanup(
      failure,
      () => fs.rmSync(root, { force: true, recursive: true }),
      "Project refusal fixture",
    );
  }
};

const stateFile = (root: string, relative: string): string =>
  path.join(root, "automovie", relative);

const rewriteJson = (
  file: string,
  mutate: (value: Record<string, unknown>) => unknown,
): void => {
  const current = JSON.parse(fs.readFileSync(file, "utf8")) as Record<
    string,
    unknown
  >;
  fs.writeFileSync(file, `${JSON.stringify(mutate(current), null, 2)}\n`);
};

/**
 * Exercise construction and owned-input refusals using resident filesystem
 * states an author or concurrent process can actually create. Every malformed
 * twin is isolated in a fresh root and checked for the repair-oriented public
 * diagnostic instead of merely expecting an exception.
 *
 * Scenarios:
 *
 * 1. Filesystem roots, state-root files/junctions, invalid ids, reserved ids,
 *    and ambiguous production selection refuse initialization or reopening.
 * 2. Malformed/legacy/colliding registries, invalid or absent incarnations,
 *    invalid revisions, and malformed JSON name the resident repair boundary.
 * 3. Source/content/asset root and file type changes refuse enumeration without
 *    reading outside their physical owner.
 * 4. Invalid keyed design shape and filename/id mismatch refuse graph reads.
 * 5. Source, tracked, generated, prose, and render readers exercise traversal,
 *    absence, type, extension, and successful-text twins.
 * 6. A physical legacy design tree migrates into shared and production
 *    namespaces and publishes layout version 1.
 */
export const test_production_project_runtime_shape_refusals = (): void => {
  TestValidator.predicate(
    "writable open refuses a filesystem root",
    throwsError(
      () => AutoMovieProductionProject.open(path.parse(process.cwd()).root),
      "filesystem root",
    ),
  );
  TestValidator.predicate(
    "read-only open refuses a filesystem root",
    throwsError(
      () =>
        AutoMovieProductionProject.openReadOnly(path.parse(process.cwd()).root),
      "filesystem root",
    ),
  );

  withRoot((root) => {
    fs.writeFileSync(path.join(root, "automovie"), "blocked");
    TestValidator.predicate(
      "state root must be a physical directory",
      throwsError(
        () => AutoMovieProductionProject.open(root),
        ["automovie", "physical directory"],
      ),
    );
  });
  withRoot((root) => {
    fs.mkdirSync(path.join(root, "state-target"));
    fs.symlinkSync(
      path.join(root, "state-target"),
      path.join(root, "automovie"),
      "junction",
    );
    TestValidator.predicate(
      "state root junction refuses before initialization",
      throwsError(() => AutoMovieProductionProject.open(root), "symlink"),
    );
  });
  withRoot((root) => {
    fs.writeFileSync(path.join(root, "automovie"), "blocked");
    TestValidator.predicate(
      "read-only state root must already be a directory",
      throwsError(
        () => AutoMovieProductionProject.openReadOnly(root),
        "missing or not a directory",
      ),
    );
  });

  for (const id of [" ", ".", "..", "trailing."])
    withRoot((root) => {
      TestValidator.predicate(
        `invalid production id ${JSON.stringify(id)} refuses initialization`,
        throwsError(
          () => AutoMovieProductionProject.open(root, id),
          "Production id",
        ),
      );
    });
  withRoot((root) => {
    TestValidator.predicate(
      "reserved shared production id refuses initialization",
      throwsError(
        () => AutoMovieProductionProject.open(root, "shared"),
        "reserved",
      ),
    );
  });

  withRoot((root) => {
    AutoMovieProductionProject.open(root, "alpha");
    AutoMovieProductionProject.open(root, "beta");
    TestValidator.predicate(
      "ambiguous writable open names registered choices",
      throwsError(
        () => AutoMovieProductionProject.open(root),
        ["2 productions", "alpha", "beta"],
      ),
    );
    TestValidator.predicate(
      "ambiguous read-only open requires an explicit production",
      throwsError(
        () => AutoMovieProductionProject.openReadOnly(root),
        ["one productionId", "alpha", "beta"],
      ),
    );
    TestValidator.predicate(
      "read-only open cannot register a missing production",
      throwsError(
        () => AutoMovieProductionProject.openReadOnly(root, "missing"),
        "cannot register missing production",
      ),
    );
    TestValidator.predicate(
      "read-only open preserves the reserved-id refusal",
      throwsError(
        () => AutoMovieProductionProject.openReadOnly(root, "shared"),
        "reserved",
      ),
    );
  });
  withRoot((root) => {
    AutoMovieProductionProject.open(root, "alpha");
    fs.rmSync(stateFile(root, "incarnation.json"));
    TestValidator.predicate(
      "read-only reopen never repairs a missing state incarnation",
      throwsError(
        () => AutoMovieProductionProject.openReadOnly(root, "alpha"),
        "requires existing state incarnation",
      ),
    );
  });

  const registryCases: Array<{
    label: string;
    mutate: (value: Record<string, unknown>) => unknown;
    message: string;
  }> = [
    {
      label: "malformed registry json shape",
      mutate: () => null,
      message: "Invalid production registry",
    },
    {
      label: "legacy registry in read-only mode",
      mutate: (value) => ({ ...value, layoutVersion: 0 }),
      message: "cannot migrate legacy",
    },
    {
      label: "blank registered production",
      mutate: (value) => ({ ...value, productions: [" "] }),
      message: "trimmed, portable",
    },
    {
      label: "portable registry collision",
      mutate: (value) => ({
        ...value,
        productions: ["alpha", "ALPHA"],
        incarnations: {},
      }),
      message: "collides",
    },
    {
      label: "foreign incarnation key",
      mutate: (value) => ({
        ...value,
        incarnations: { foreign: "not-a-uuid" },
      }),
      message: "incarnations must be UUIDs",
    },
  ];
  for (const entry of registryCases)
    withRoot((root) => {
      AutoMovieProductionProject.open(root, "alpha");
      rewriteJson(stateFile(root, "productions.json"), entry.mutate);
      TestValidator.predicate(
        entry.label,
        throwsError(
          () => AutoMovieProductionProject.openReadOnly(root, "alpha"),
          entry.message,
        ),
      );
    });

  withRoot((root) => {
    AutoMovieProductionProject.open(root, "alpha");
    rewriteJson(stateFile(root, "productions.json"), (value) => ({
      ...value,
      incarnations: {},
    }));
    TestValidator.predicate(
      "read-only production requires its resident incarnation",
      throwsError(
        () => AutoMovieProductionProject.openReadOnly(root, "alpha"),
        "requires an existing incarnation",
      ),
    );
  });

  withRoot((root) => {
    AutoMovieProductionProject.open(root, "alpha");
    fs.writeFileSync(stateFile(root, "incarnation.json"), "{}\n");
    TestValidator.predicate(
      "invalid state incarnation refuses reopen",
      throwsError(
        () => AutoMovieProductionProject.openReadOnly(root, "alpha"),
        "Invalid production state incarnation",
      ),
    );
  });
  withRoot((root) => {
    const project = AutoMovieProductionProject.open(root, "alpha");
    fs.writeFileSync(
      stateFile(root, "productions/alpha/revision.json"),
      '{"revision":-1}\n',
    );
    TestValidator.predicate(
      "negative revision refuses the next public read",
      throwsError(() => project.revision(), "non-negative safe integer"),
    );
  });
  withRoot((root) => {
    AutoMovieProductionProject.open(root, "alpha");
    fs.writeFileSync(stateFile(root, "productions.json"), "{broken");
    TestValidator.predicate(
      "malformed registry json names the owning file",
      throwsError(
        () => AutoMovieProductionProject.registeredProductionIds(root),
        ["Invalid AutoMovie JSON", "productions.json"],
      ),
    );
  });

  const fixture = productionFixture();
  let fixtureFailure: IRefusalCleanupFailure | undefined;
  try {
    const project = AutoMovieProductionProject.open(
      fixture.root,
      "fixture-film",
    );
    const src = path.join(fixture.root, "src");
    const savedSrc = path.join(fixture.root, "src.saved");
    fs.renameSync(src, savedSrc);
    fs.writeFileSync(src, "not a directory");
    TestValidator.predicate(
      "declared source root must remain a physical directory",
      throwsError(() => project.contentInputs(), "must be a physical"),
    );
    fs.rmSync(src);
    fs.renameSync(savedSrc, src);

    const optionalFile = path.join(fixture.root, "package-lock.json");
    fs.mkdirSync(optionalFile);
    TestValidator.predicate(
      "declared content file cannot become a directory",
      throwsError(() => project.contentInputs(), "physical regular file"),
    );
    fs.rmdirSync(optionalFile);

    const assets = path.join(fixture.root, "automovie/assets.json");
    const assetBytes = fs.readFileSync(assets);
    fs.rmSync(assets);
    fs.mkdirSync(assets);
    TestValidator.predicate(
      "asset manifest cannot become a directory",
      throwsError(() => project.contentInputs(), "asset manifest"),
    );
    fs.rmdirSync(assets);
    fs.writeFileSync(assets, assetBytes);

    const invalidDesign = path.join(
      fixture.root,
      "automovie/design/shared/formations/invalid.json",
    );
    fs.writeFileSync(invalidDesign, "{}\n");
    TestValidator.predicate(
      "stored design shape is revalidated on every graph read",
      throwsError(
        () => project.graph(),
        ["Invalid AutoMovie file", "invalid.json"],
      ),
    );
    fs.rmSync(invalidDesign);

    const mismatchedDesign = path.join(
      fixture.root,
      "automovie/design/shared/formations/wrong-name.json",
    );
    fs.writeFileSync(
      mismatchedDesign,
      `${JSON.stringify({
        id: "different-id",
        modelRecipe: "soloist",
        count: 1,
        layout: {
          kind: "line",
          ranks: 1,
          files: 1,
          spacing: { lateral: 1, depth: 1 },
        },
        anchor: { x: 0, y: 0, z: 0 },
        facingDeg: 0,
        seed: 1,
        capabilities: [],
        heroOverrides: [],
      })}\n`,
    );
    TestValidator.predicate(
      "keyed design filename must equal its internal id",
      throwsError(() => project.graph(), "does not match its content id"),
    );
    fs.rmSync(mismatchedDesign);

    TestValidator.predicate(
      "tracked-state traversal refuses before reading",
      throwsError(() => project.readTrackedStateFile("../outside"), "escapes"),
    );
    TestValidator.predicate(
      "generated traversal refuses before reading",
      throwsError(() => project.readGeneratedFile("../outside"), "escapes"),
    );
    TestValidator.predicate(
      "render traversal refuses before reading",
      throwsError(() => project.readRenderFile("../outside"), "escapes"),
    );
    TestValidator.predicate(
      "absolute source path refuses structured ownership",
      throwsError(
        () => project.resolveSourcePath(path.join(fixture.root, "src/film.ts")),
        "is absolute",
      ),
    );
    TestValidator.predicate(
      "project file outside source roots refuses source binding",
      throwsError(
        () => project.resolveSourcePath("package.json"),
        "outside configured source roots",
      ),
    );
    fs.writeFileSync(path.join(fixture.root, "src/not-source.txt"), "text");
    TestValidator.predicate(
      "non-TypeScript source extension refuses binding",
      throwsError(
        () => project.resolveSourcePath("src/not-source.txt"),
        "not TypeScript",
      ),
    );

    TestValidator.predicate(
      "missing generated file names the absent path",
      throwsError(
        () => project.readGeneratedFile("missing.json"),
        "does not exist",
      ),
    );
    fs.mkdirSync(path.join(project.generatedRoot(), "directory.json"));
    TestValidator.predicate(
      "generated directory cannot masquerade as a file",
      throwsError(
        () => project.readGeneratedFile("directory.json"),
        "is not a file",
      ),
    );
    TestValidator.equals(
      "prose reader returns null for traversal, absence, and directory",
      [
        project.readProseDocument("../outside"),
        project.readProseDocument("docs/missing.md"),
        project.readProseDocument("src"),
      ],
      [null, null, null],
    );
    TestValidator.predicate(
      "prose reader returns exact author-owned text",
      project
        .readProseDocument("src/film.ts")
        ?.includes("export const film") === true,
    );

    TestValidator.predicate(
      "missing render file names the absent path",
      throwsError(
        () => project.readRenderFile("missing.bin"),
        "does not exist",
      ),
    );
    fs.mkdirSync(path.join(project.renderRoot(), "directory.bin"));
    TestValidator.predicate(
      "render directory cannot masquerade as bytes",
      throwsError(
        () => project.readRenderFile("directory.bin"),
        "not a regular file",
      ),
    );
  } catch (error) {
    fixtureFailure = { error };
    throw error;
  } finally {
    preserveRefusalCleanup(
      fixtureFailure,
      fixture.dispose,
      "Content-refusal fixture",
    );
  }

  const migration = productionFixture();
  let migrationFailure: IRefusalCleanupFailure | undefined;
  try {
    const design = path.join(migration.root, "automovie/design");
    const production = path.join(design, "fixture-film");
    const shared = path.join(design, "shared");
    for (const directory of ["models", "formations"])
      if (fs.existsSync(path.join(shared, directory)))
        fs.renameSync(
          path.join(shared, directory),
          path.join(design, directory),
        );
    fs.renameSync(
      path.join(shared, "world.json"),
      path.join(design, "world.json"),
    );
    fs.rmdirSync(shared);
    for (const directory of ["shots", "acceptance", "screenplay"])
      fs.renameSync(
        path.join(production, directory),
        path.join(design, directory),
      );
    fs.renameSync(
      path.join(production, "production.json"),
      path.join(design, "production.json"),
    );
    fs.rmdirSync(production);

    const opened = AutoMovieProductionProject.open(
      migration.root,
      "fixture-film",
    );
    const migratedGraph = opened.graph();
    TestValidator.equals(
      "legacy layout migrates byte-bearing designs into canonical namespaces",
      [
        opened.productionId,
        opened.inventory(),
        migratedGraph.models.get("soloist")?.id,
        migratedGraph.world?.id,
        migratedGraph.shots.get("opening")?.id,
        [...migratedGraph.acceptance.keys()],
        (
          JSON.parse(
            fs.readFileSync(
              stateFile(migration.root, "productions.json"),
              "utf8",
            ),
          ) as { layoutVersion: number }
        ).layoutVersion,
      ],
      [
        "fixture-film",
        {
          production: true,
          models: ["soloist"],
          world: true,
          formations: [],
          shots: ["opening"],
          acceptance: ["opening-beauty", "opening-pose"],
        },
        "soloist",
        "starter-world",
        "opening",
        ["opening-beauty", "opening-pose"],
        1,
      ],
    );
    TestValidator.equals(
      "legacy source paths are absent after their semantic residents migrate",
      [
        "models",
        "formations",
        "world.json",
        "production.json",
        "shots",
        "acceptance",
        "screenplay",
      ].map((entry) => fs.existsSync(path.join(design, entry))),
      [false, false, false, false, false, false, false],
    );
  } catch (error) {
    migrationFailure = { error };
    throw error;
  } finally {
    preserveRefusalCleanup(
      migrationFailure,
      migration.dispose,
      "Migration fixture",
    );
  }
};
