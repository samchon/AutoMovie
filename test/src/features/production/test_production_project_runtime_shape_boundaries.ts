import {
  IAutoMovieAcceptanceScenario,
  IAutoMovieDesignTarget,
  IAutoMovieProductionDesign,
  IAutoMovieRenderBundleManifest,
} from "@automovie/interface";
import {
  AutoMovieProductionInputRaceError,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
  productionRenderBundleRelativePath,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { throwsError } from "../internal/predicates";
import {
  acceptanceScenarios,
  formationDesign,
  modelRecipe,
  productionFixture,
  setProductionFixtureShotContract,
  shotContract,
  testRendererIdentity,
} from "./productionFixtures";
import { productionPng } from "./productionMediaFixtures";

interface IBoundaryFailure {
  error: unknown;
}

class BoundaryCleanupError extends AggregateError {}

const preserveCleanup = (
  failure: IBoundaryFailure | undefined,
  cleanup: () => void,
  resource: string,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new BoundaryCleanupError(
      [failure.error, cleanupFailure],
      `${resource} cleanup failed after the boundary assertion failed.`,
    );
  }
};

const withRoot = (scenario: (root: string) => void): void => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-project-boundary-"),
  );
  let failure: IBoundaryFailure | undefined;
  try {
    scenario(root);
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveCleanup(
      failure,
      () => fs.rmSync(root, { force: true, recursive: true }),
      "Boundary root",
    );
  }
};

const withFixture = (
  scenario: (fixture: ReturnType<typeof productionFixture>) => void,
): void => {
  const fixture = productionFixture();
  let failure: IBoundaryFailure | undefined;
  try {
    scenario(fixture);
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveCleanup(failure, fixture.dispose, "Production fixture");
  }
};

const statePath = (root: string, relative: string): string =>
  path.join(root, "automovie", relative);

const writeJson = (file: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

/**
 * Exercise public Project boundaries whose negative twins require unusual but
 * resident filesystem states rather than synthetic calls into private code.
 * Every refusal names its owned resource, and every recovery case proves the
 * authoritative bytes or registration survived.
 *
 * Scenarios:
 *
 * 1. Registry inference, case collision, missing-incarnation repair, legacy-id
 *    mismatch, and malformed legacy identity cover every public selection arm.
 * 2. Legacy migration refuses a linked source, restores a staged source when
 *    its first destination conflicts, and rolls an already-published sibling
 *    back byte-exact when a later namespaced destination conflicts.
 * 3. Pre-open source/content/generated ownership changes refuse files,
 *    junctions, escaped registries, and incomplete read-only namespaces while
 *    resident targets and tracked state stay untouched.
 * 4. Post-open source, generated, prose, content-tree, keyed-design, registry,
 *    state-root, and project-root replacements refuse at ownership fences.
 * 5. Staged-target links, production-lock contention after a shared lock, and
 *    erase-audit obstruction preserve every revision, byte, and temporary.
 * 6. Missing design addresses, repainted consequences, references, dependency
 *    cycles, and absent-production fallback cover graph consequence branches.
 * 7. Render bundles refuse noncanonical paths and every corrupt manifest,
 *    runtime, receipt, duplicate-frame, digest, and raster variant; the
 *    restored canonical twin verifies and enumerates its exact captured view.
 */
export const test_production_project_runtime_shape_boundaries = (): void => {
  withRoot((root) => {
    AutoMovieProductionProject.open(root, "alpha");
    TestValidator.predicate(
      "a writable spelling collision names the registered production",
      throwsError(
        () => AutoMovieProductionProject.open(root, "ALPHA"),
        ["collides", "alpha"],
      ),
    );

    const registryFile = statePath(root, "productions.json");
    const registry = JSON.parse(fs.readFileSync(registryFile, "utf8")) as {
      incarnations?: Record<string, string>;
    };
    delete registry.incarnations;
    writeJson(registryFile, registry);
    const repaired = AutoMovieProductionProject.open(root, "alpha");
    const repairedRegistry = JSON.parse(
      fs.readFileSync(registryFile, "utf8"),
    ) as { incarnations: Record<string, string> };
    const inferred = AutoMovieProductionProject.openReadOnly(root);
    TestValidator.predicate(
      "writable reopen repairs a missing incarnation and read-only infers the sole id",
      typeof repairedRegistry.incarnations.alpha === "string" &&
        repairedRegistry.incarnations.alpha.length > 0 &&
        repaired.productionId === "alpha" &&
        inferred.productionId === "alpha",
    );
    TestValidator.equals(
      "a production without authored screenplay state reports no index",
      repaired.screenplayIndex(),
      null,
    );

    writeJson(registryFile, {
      version: 1,
      layoutVersion: 1,
      productions: [],
      incarnations: {},
    });
    TestValidator.predicate(
      "read-only inference names an empty registry rather than inventing an id",
      throwsError(
        () => AutoMovieProductionProject.openReadOnly(root),
        ["one productionId", "<none>"],
      ),
    );
  });

  withRoot((root) => {
    writeJson(statePath(root, "imports/legacy-v1/plan.json"), {
      legacyRevision: "not-a-number",
    });
    const project = AutoMovieProductionProject.open(root, "alpha");
    TestValidator.equals(
      "an invalid legacy import revision is not promoted into project provenance",
      project.manifest().importedLegacy,
      undefined,
    );
  });

  withRoot((root) => {
    const external = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-registry-outside-"),
    );
    const registry = path.join(external, "productions.json");
    const registryBytes = Buffer.from(
      `${JSON.stringify(
        {
          version: 1,
          layoutVersion: 1,
          productions: ["outside"],
          incarnations: {
            outside: "00000000-0000-4000-8000-000000000001",
          },
        },
        null,
        2,
      )}\n`,
    );
    let outsideFailure: IBoundaryFailure | undefined;
    try {
      fs.writeFileSync(registry, registryBytes);
      fs.symlinkSync(
        external,
        path.join(root, "automovie"),
        process.platform === "win32" ? "junction" : "dir",
      );
      TestValidator.predicate(
        "static registration refuses a registry reached through an escaping state-root ancestor",
        throwsError(
          () => AutoMovieProductionProject.registeredProductionIds(root),
          ["escapes the production root", "productions.json"],
        ),
      );
      TestValidator.equals(
        "escaping registry refusal preserves the external registry byte-exact",
        fs.readFileSync(registry),
        registryBytes,
      );
    } catch (error) {
      outsideFailure = { error };
      throw error;
    } finally {
      preserveCleanup(
        outsideFailure,
        () => fs.rmSync(external, { force: true, recursive: true }),
        "External registry target",
      );
    }
  });

  withRoot((root) => {
    writeJson(statePath(root, "design/production.json"), { id: "legacy" });
    TestValidator.predicate(
      "legacy production identity refuses a different requested id",
      throwsError(
        () => AutoMovieProductionProject.open(root, "requested"),
        ["declares id", "legacy", "requested"],
      ),
    );
  });
  withRoot((root) => {
    writeJson(statePath(root, "design/production.json"), { id: " legacy " });
    TestValidator.predicate(
      "malformed legacy production identity names its source record",
      throwsError(
        () => AutoMovieProductionProject.open(root),
        ["invalid id", "production.json"],
      ),
    );
  });

  withRoot((root) => {
    const external = path.join(root, "external-models");
    const legacy = statePath(root, "design/models");
    fs.mkdirSync(external);
    fs.mkdirSync(path.dirname(legacy), { recursive: true });
    fs.symlinkSync(
      external,
      legacy,
      process.platform === "win32" ? "junction" : "dir",
    );
    TestValidator.predicate(
      "legacy migration refuses a linked source without reading its target",
      throwsError(
        () => AutoMovieProductionProject.open(root, "legacy"),
        ["Legacy production path", "symlink"],
      ) && fs.readdirSync(external).length === 0,
    );
  });
  withRoot((root) => {
    const source = statePath(root, "design/models");
    const destination = statePath(root, "design/shared/models");
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(source, "source.txt"), "legacy-source");
    fs.writeFileSync(path.join(destination, "resident.txt"), "resident-target");
    TestValidator.predicate(
      "legacy destination conflict refuses after staging",
      throwsError(
        () => AutoMovieProductionProject.open(root, "legacy"),
        ["conflicts", "namespaced destination"],
      ),
    );
    TestValidator.equals(
      "migration conflict restores the source and preserves the destination",
      [
        fs.readFileSync(path.join(source, "source.txt"), "utf8"),
        fs.readFileSync(path.join(destination, "resident.txt"), "utf8"),
        fs
          .readdirSync(statePath(root, ""))
          .some((entry) => entry.startsWith(".layout-migration-")),
      ],
      ["legacy-source", "resident-target", false],
    );
  });
  withRoot((root) => {
    const modelSource = statePath(root, "design/models");
    const formationSource = statePath(root, "design/formations");
    const modelDestination = statePath(root, "design/shared/models");
    const formationDestination = statePath(root, "design/shared/formations");
    fs.mkdirSync(modelSource, { recursive: true });
    fs.mkdirSync(formationSource, { recursive: true });
    fs.mkdirSync(formationDestination, { recursive: true });
    fs.writeFileSync(path.join(modelSource, "model.txt"), "legacy-model");
    fs.writeFileSync(
      path.join(formationSource, "formation.txt"),
      "legacy-formation",
    );
    fs.writeFileSync(
      path.join(formationDestination, "resident.txt"),
      "resident-formation",
    );
    TestValidator.predicate(
      "a later legacy destination conflict refuses after publishing its predecessor",
      throwsError(
        () => AutoMovieProductionProject.open(root, "legacy"),
        ["formations", "conflicts", "namespaced destination"],
      ),
    );
    TestValidator.equals(
      "late migration conflict restores every source and removes the earlier publication",
      [
        fs.readFileSync(path.join(modelSource, "model.txt"), "utf8"),
        fs.readFileSync(path.join(formationSource, "formation.txt"), "utf8"),
        fs.readFileSync(
          path.join(formationDestination, "resident.txt"),
          "utf8",
        ),
        fs.existsSync(modelDestination),
        fs
          .readdirSync(statePath(root, ""))
          .some((entry) => entry.startsWith(".layout-migration-")),
      ],
      ["legacy-model", "legacy-formation", "resident-formation", false, false],
    );
  });

  withFixture(({ root }) => {
    const source = path.join(root, "src");
    const parked = path.join(root, "src.parked");
    fs.renameSync(source, parked);
    fs.writeFileSync(source, "not a source directory");
    TestValidator.predicate(
      "pre-open source root must be a physical directory",
      throwsError(
        () => AutoMovieProductionProject.open(root, "fixture-film"),
        ["Owned directory", "not a physical directory"],
      ),
    );
    fs.rmSync(source);
    fs.renameSync(parked, source);
  });
  withFixture(({ root }) => {
    const project = AutoMovieProductionProject.open(root, "fixture-film");
    const registry = statePath(root, "productions.json");
    const incarnation = statePath(root, "incarnation.json");
    const registryBytes = fs.readFileSync(registry);
    const incarnationBytes = fs.readFileSync(incarnation);
    const generatedRoot = project.generatedRoot();
    fs.rmSync(generatedRoot, { recursive: true });
    TestValidator.predicate(
      "read-only reopen refuses a missing required production namespace",
      throwsError(
        () => AutoMovieProductionProject.openReadOnly(root, "fixture-film"),
        ["Owned directory", "does not exist"],
      ),
    );
    TestValidator.equals(
      "read-only namespace refusal performs no repair or tracked-state write",
      [
        fs.existsSync(generatedRoot),
        fs.readFileSync(registry),
        fs.readFileSync(incarnation),
      ],
      [false, registryBytes, incarnationBytes],
    );
  });
  withFixture(({ root }) => {
    const viewer = path.join(root, "viewer");
    const parked = path.join(root, "viewer.parked");
    const replacement = Buffer.from("not a content directory", "utf8");
    fs.renameSync(viewer, parked);
    fs.writeFileSync(viewer, replacement);
    let viewerFailure: IBoundaryFailure | undefined;
    try {
      TestValidator.predicate(
        "pre-open declared content root refuses a file",
        throwsError(
          () => AutoMovieProductionProject.open(root, "fixture-film"),
          ["contentRoots[0]", "physical project directory"],
        ),
      );
      TestValidator.equals(
        "content-root refusal preserves replacement bytes and the parked owner",
        [fs.readFileSync(viewer), fs.statSync(parked).isDirectory()],
        [replacement, true],
      );
    } catch (error) {
      viewerFailure = { error };
      throw error;
    } finally {
      preserveCleanup(
        viewerFailure,
        () => {
          fs.rmSync(viewer);
          fs.renameSync(parked, viewer);
        },
        "Content-root file replacement",
      );
    }
  });
  withFixture(({ root }) => {
    const generated = path.join(root, "generated");
    const outside = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-generated-outside-"),
    );
    let outsideFailure: IBoundaryFailure | undefined;
    try {
      fs.symlinkSync(
        outside,
        generated,
        process.platform === "win32" ? "junction" : "dir",
      );
      TestValidator.predicate(
        "pre-open generated root junction refuses through its real ancestor",
        throwsError(
          () => AutoMovieProductionProject.open(root, "fixture-film"),
          ["escapes the production root", "generated"],
        ) && fs.readdirSync(outside).length === 0,
      );
    } catch (error) {
      outsideFailure = { error };
      throw error;
    } finally {
      preserveCleanup(
        outsideFailure,
        () => fs.rmSync(outside, { force: true, recursive: true }),
        "External generated target",
      );
    }
  });

  withFixture(({ root }) => {
    const project = AutoMovieProductionProject.open(root, "fixture-film");
    const nonSource = path.join(root, "non-source");
    const sourceLink = path.join(root, "src/linked-root");
    fs.mkdirSync(nonSource);
    fs.writeFileSync(path.join(nonSource, "linked.ts"), "export {};\n");
    fs.symlinkSync(
      nonSource,
      sourceLink,
      process.platform === "win32" ? "junction" : "dir",
    );
    TestValidator.predicate(
      "source reader refuses a link outside its declared source root",
      throwsError(
        () => project.readSource("src/linked-root/linked.ts"),
        "escapes",
      ),
    );
    fs.unlinkSync(sourceLink);

    const generatedLink = path.join(project.generatedRoot(), "linked-root");
    fs.symlinkSync(
      path.join(root, "src"),
      generatedLink,
      process.platform === "win32" ? "junction" : "dir",
    );
    TestValidator.predicate(
      "generated reader refuses a file reached through an escaping junction",
      throwsError(
        () => project.readGeneratedFile("linked-root/film.ts"),
        "escapes",
      ),
    );
    fs.unlinkSync(generatedLink);

    const proseTarget = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-prose-outside-"),
    );
    const proseLink = path.join(root, "linked-prose-root");
    let proseFailure: IBoundaryFailure | undefined;
    try {
      fs.writeFileSync(path.join(proseTarget, "prose.md"), "outside prose\n");
      fs.symlinkSync(
        proseTarget,
        proseLink,
        process.platform === "win32" ? "junction" : "dir",
      );
      TestValidator.equals(
        "prose reader omits a document reached through an escaping junction",
        project.readProseDocument("linked-prose-root/prose.md"),
        null,
      );
      fs.unlinkSync(proseLink);
    } catch (error) {
      proseFailure = { error };
      throw error;
    } finally {
      preserveCleanup(
        proseFailure,
        () => fs.rmSync(proseTarget, { force: true, recursive: true }),
        "External prose target",
      );
    }

    const contentLink = path.join(root, "scripts/linked-source");
    fs.symlinkSync(
      path.join(root, "src"),
      contentLink,
      process.platform === "win32" ? "junction" : "dir",
    );
    TestValidator.predicate(
      "content traversal refuses a nested directory junction",
      throwsError(() => project.contentInputs(), "symlink or junction"),
    );
    fs.unlinkSync(contentLink);

    const keyedDesignLink = statePath(root, "design/shared/models/linked.json");
    const sourceBytes = fs.readFileSync(path.join(root, "src/film.ts"));
    let keyedLinkFailure: IBoundaryFailure | undefined;
    try {
      fs.symlinkSync(
        path.join(root, "src"),
        keyedDesignLink,
        process.platform === "win32" ? "junction" : "dir",
      );
      TestValidator.predicate(
        "keyed design enumeration includes then refuses a linked JSON entry",
        throwsError(() => project.graph(), ["Owned file", "symlink"]),
      );
      TestValidator.equals(
        "linked keyed-design refusal leaves its target source byte-exact",
        fs.readFileSync(path.join(root, "src/film.ts")),
        sourceBytes,
      );
    } catch (error) {
      keyedLinkFailure = { error };
      throw error;
    } finally {
      preserveCleanup(
        keyedLinkFailure,
        () => fs.unlinkSync(keyedDesignLink),
        "Keyed design link",
      );
    }

    const registry = statePath(root, "productions.json");
    const registryResident = statePath(root, "productions.resident.json");
    fs.renameSync(registry, registryResident);
    fs.symlinkSync(
      path.join(root, "src"),
      registry,
      process.platform === "win32" ? "junction" : "dir",
    );
    TestValidator.predicate(
      "static registration read refuses a linked owned file",
      throwsError(
        () => AutoMovieProductionProject.registeredProductionIds(root),
        "symlink",
      ),
    );
    fs.unlinkSync(registry);
    fs.renameSync(registryResident, registry);

    fs.renameSync(registry, registryResident);
    fs.mkdirSync(registry);
    let registryFailure: IBoundaryFailure | undefined;
    try {
      TestValidator.predicate(
        "static registration read refuses a physical non-file owner",
        throwsError(
          () => AutoMovieProductionProject.registeredProductionIds(root),
          "not a regular file",
        ),
      );
    } catch (error) {
      registryFailure = { error };
      throw error;
    } finally {
      preserveCleanup(
        registryFailure,
        () => {
          fs.rmdirSync(registry);
          fs.renameSync(registryResident, registry);
        },
        "Registry directory replacement",
      );
    }

    TestValidator.predicate(
      "blank design ids refuse through the public record address",
      throwsError(
        () => project.designRecordPath({ kind: "model", id: " " }),
        "must not be blank",
      ),
    );
  });

  withFixture(({ root }) => {
    const project = AutoMovieProductionProject.open(root, "fixture-film");
    const automovie = path.join(root, "automovie");
    const parked = path.join(root, "automovie.parked");
    fs.renameSync(automovie, parked);
    fs.mkdirSync(automovie);
    TestValidator.predicate(
      "state-root replacement invalidates the live handle",
      (() => {
        try {
          project.revision();
          return false;
        } catch (error) {
          return (
            error instanceof AutoMovieProductionInputRaceError &&
            error.message.includes("state root identity changed")
          );
        }
      })(),
    );
    fs.rmdirSync(automovie);
    fs.renameSync(parked, automovie);
  });
  withRoot((root) => {
    const project = AutoMovieProductionProject.open(root, "alpha");
    const parked = `${root}.parked`;
    fs.renameSync(root, parked);
    fs.mkdirSync(root);
    let replacementFailure: IBoundaryFailure | undefined;
    try {
      TestValidator.predicate(
        "writable confirmation rejects a replacement project root at its lease",
        (() => {
          try {
            project.confirmCurrentSnapshot(() => true);
            return false;
          } catch (error) {
            return (
              error instanceof AutoMovieProductionInputRaceError &&
              error.message.includes("project root identity changed")
            );
          }
        })(),
      );
      TestValidator.equals(
        "root-lease refusal leaves the replacement without production state",
        fs.existsSync(path.join(root, "automovie")),
        false,
      );
    } catch (error) {
      replacementFailure = { error };
      throw error;
    } finally {
      preserveCleanup(
        replacementFailure,
        () => {
          fs.rmSync(root, { force: true, recursive: true });
          fs.renameSync(parked, root);
        },
        "Whole-root replacement",
      );
    }
  });
  withRoot((root) => {
    const project = AutoMovieProductionProject.open(root, "alpha");
    const parked = `${root}.parked`;
    const replacement = Buffer.from("replacement project root", "utf8");
    fs.renameSync(root, parked);
    fs.writeFileSync(root, replacement);
    let replacementFailure: IBoundaryFailure | undefined;
    try {
      TestValidator.predicate(
        "read path rejects a non-directory replacement project root",
        (() => {
          try {
            project.manifest();
            return false;
          } catch (error) {
            return (
              error instanceof AutoMovieProductionInputRaceError &&
              error.message.includes("project root identity changed")
            );
          }
        })(),
      );
      TestValidator.equals(
        "root replacement refusal preserves both replacement bytes and parked owner",
        [fs.readFileSync(root), fs.statSync(parked).isDirectory()],
        [replacement, true],
      );
    } catch (error) {
      replacementFailure = { error };
      throw error;
    } finally {
      preserveCleanup(
        replacementFailure,
        () => {
          fs.rmSync(root, { force: true });
          fs.renameSync(parked, root);
        },
        "Non-directory root replacement",
      );
    }
  });

  withFixture(({ root }) => {
    const project = AutoMovieProductionProject.open(root, "fixture-film");
    const revision = project.revision();
    const targetBytes = fs.readFileSync(path.join(root, "src/film.ts"));
    const target = path.join(
      project.renderRoot(),
      "deliverables/symlink-guard/linked.bin",
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(
      path.join(root, "src"),
      target,
      process.platform === "win32" ? "junction" : "dir",
    );
    let targetFailure: IBoundaryFailure | undefined;
    try {
      TestValidator.predicate(
        "deliverable commit refuses a linked staged target before writing",
        throwsError(
          () =>
            project.commitProductionDeliverableFiles(
              "symlink-guard",
              new Map([["linked.bin", Buffer.from("candidate")]]),
            ),
          ["Owned target", "symlink or junction"],
        ),
      );
      TestValidator.equals(
        "staged-target refusal preserves revision, link identity, and target bytes",
        [
          project.revision(),
          fs.lstatSync(target).isSymbolicLink(),
          fs.readFileSync(path.join(root, "src/film.ts")),
        ],
        [revision, true, targetBytes],
      );
    } catch (error) {
      targetFailure = { error };
      throw error;
    } finally {
      preserveCleanup(
        targetFailure,
        () => fs.unlinkSync(target),
        "Linked staged target",
      );
    }
  });

  withFixture(({ root }) => {
    const project = AutoMovieProductionProject.open(root, "fixture-film");
    const lock = project.trackedStatePath("revision.lock");
    const sharedLock = statePath(root, "shared-design.lock");
    const revision = project.revision();
    fs.mkdirSync(lock);
    let lockFailure: IBoundaryFailure | undefined;
    try {
      TestValidator.predicate(
        "shared design mutation releases its shared lock when the production lock is contended",
        throwsError(
          () =>
            project.setModelRecipe({
              ...modelRecipe(),
              id: "lock-candidate",
            }),
          "project commit lock",
        ),
      );
      TestValidator.equals(
        "production-lock refusal preserves revision and leaves no shared lock",
        [
          project.revision(),
          fs.existsSync(sharedLock),
          fs.statSync(lock).isDirectory(),
        ],
        [revision, false, true],
      );
    } catch (error) {
      lockFailure = { error };
      throw error;
    } finally {
      preserveCleanup(
        lockFailure,
        () => fs.rmdirSync(lock),
        "Contended production lock",
      );
    }
  });

  withFixture(({ root }) => {
    const project = AutoMovieProductionProject.open(root, "fixture-film");
    const registry = statePath(root, "productions.json");
    const revision = project.trackedStatePath("revision.json");
    const design = path.join(
      root,
      project.designRecordPath({ kind: "production" }),
    );
    const before = [registry, design].map((file) => fs.readFileSync(file));
    const revisionBeforeErase = project.revision();
    const revisionFileBeforeErase = fs.existsSync(revision);
    const auditParent = statePath(root, "audit/production-deletions");
    fs.mkdirSync(path.dirname(auditParent), { recursive: true });
    fs.writeFileSync(auditParent, "audit parent obstruction");
    TestValidator.predicate(
      "erase refuses a non-directory audit owner after creating its quarantine",
      throwsError(
        () => project.eraseProduction("runtime-shape audit obstruction"),
        ["Owned directory", "not a physical directory"],
      ),
    );
    TestValidator.equals(
      "erase preflight refusal restores an empty quarantine and preserves tracked state",
      [
        ...[registry, design].map((file, index) =>
          fs.readFileSync(file).equals(before[index]!),
        ),
        project.revision(),
        fs.existsSync(revision),
        fs.readFileSync(auditParent, "utf8"),
        fs
          .readdirSync(statePath(root, ""))
          .some((entry) => entry.startsWith(".erase-")),
        project.inventory().production,
      ],
      [
        true,
        true,
        revisionBeforeErase,
        revisionFileBeforeErase,
        "audit parent obstruction",
        false,
        true,
      ],
    );
  });

  withFixture(({ root }) => {
    const project = AutoMovieProductionProject.open(root, "fixture-film");
    const missingTargets: IAutoMovieDesignTarget[] = [
      { kind: "model", id: "missing" },
      { kind: "formation", id: "missing" },
      { kind: "shot", id: "missing" },
      { kind: "acceptance", id: "missing" },
    ];
    TestValidator.equals(
      "every keyed design address returns null when absent",
      missingTargets.map((target) => project.design(target)),
      [null, null, null, null],
    );
    TestValidator.equals(
      "every absent keyed design erase reports the addressed missing record",
      missingTargets.map((target) => {
        const result = project.eraseDesignArtifact(target);
        return {
          accepted: result.accepted,
          codes: result.diagnostics.map((entry) => entry.code),
          target: result.target,
        };
      }),
      missingTargets.map((target) => ({
        accepted: false,
        codes: ["design-missing" as const],
        target,
      })),
    );

    const acceptance: IAutoMovieAcceptanceScenario = {
      ...acceptanceScenarios()[0]!,
      id: "erasable-acceptance",
    };
    TestValidator.predicate(
      "an additional valid acceptance record commits",
      project.setAcceptanceScenario(acceptance).accepted,
    );
    const filmAcceptance: IAutoMovieAcceptanceScenario = {
      ...acceptanceScenarios()[0]!,
      id: "film-acceptance",
      target: { kind: "film", id: "fixture-film" },
      criterion: {
        kind: "frame",
        shot: "opening",
        frame: "cue-apex",
        pass: "beauty",
        expectation:
          "The film-level criterion resolves the named opening frame.",
      },
    };
    TestValidator.predicate(
      "a film-level frame acceptance names its owning shot",
      project.setAcceptanceScenario(filmAcceptance).accepted,
    );
    const deterministicProduction = project.design({
      kind: "production",
    }) as IAutoMovieProductionDesign;
    const repaintedMutation = project.setProductionDesign({
      ...deterministicProduction,
      visualDelivery: "repainted",
      deliverables: deterministicProduction.deliverables.map((deliverable) =>
        deliverable.kind === "feature"
          ? { ...deliverable, required: true }
          : deliverable,
      ),
    });
    TestValidator.predicate(
      "switching to repaint delivery invalidates each affected shot rendition",
      repaintedMutation.accepted &&
        repaintedMutation.consequences.staleReviews.some(
          (target) => target.kind === "rendition" && target.id === "opening",
        ),
    );
    const deterministicMutation = project.setProductionDesign(
      deterministicProduction,
    );
    TestValidator.predicate(
      "switching back to deterministic delivery filters obsolete rendition reviews",
      deterministicMutation.accepted &&
        deterministicMutation.consequences.staleReviews.some(
          (target) => target.kind === "rendition",
        ) === false,
    );
    const erasedAcceptance = project.eraseDesignArtifact({
      kind: "acceptance",
      id: acceptance.id,
    });
    TestValidator.predicate(
      "an unreferenced acceptance uses the production-local erase audit",
      erasedAcceptance.accepted &&
        fs
          .readdirSync(
            statePath(root, "productions/fixture-film/audit/design-mutations"),
          )
          .some((entry) => entry.endsWith("-erase.json")),
    );

    const productionRefusal = project.eraseDesignArtifact({
      kind: "production",
    });
    const shotRefusal = project.eraseDesignArtifact({
      kind: "shot",
      id: "opening",
    });
    TestValidator.predicate(
      "production and shot erasures name their active graph references",
      productionRefusal.accepted === false &&
        productionRefusal.diagnostics.some((entry) =>
          entry.message.includes("shot:opening"),
        ) &&
        shotRefusal.accepted === false &&
        shotRefusal.diagnostics.some((entry) =>
          entry.message.includes("acceptance:"),
        ),
    );

    const dependent = {
      ...modelRecipe(),
      id: "dependent",
      lod: modelRecipe().lod.map((entry) => ({
        ...entry,
        recipe: "soloist",
      })),
    };
    TestValidator.predicate(
      "a model may declare a reviewed dependency on the resident soloist",
      project.setModelRecipe(dependent).accepted,
    );
    const modelRefusal = project.eraseDesignArtifact({
      kind: "model",
      id: "soloist",
    });
    TestValidator.predicate(
      "model erasure reports another model's active dependency",
      modelRefusal.accepted === false &&
        modelRefusal.diagnostics.some((entry) =>
          entry.message.includes("model:dependent"),
        ),
    );

    const formation = formationDesign();
    TestValidator.predicate(
      "a valid formation commits before its participant reference",
      project.setFormationDesign(formation).accepted,
    );

    const landmarkShot = shotContract();
    landmarkShot.participants = [
      ...landmarkShot.participants,
      { kind: "formation", id: formation.id },
    ];
    landmarkShot.opening = [
      ...landmarkShot.opening,
      {
        id: "distance-to-landmark",
        description: "The performer remains measured from the plaza landmark.",
        predicates: [
          {
            kind: "distance",
            from: { kind: "node", id: "soloist" },
            to: { kind: "landmark", id: "plaza-center" },
            operator: ">=",
            value: 0,
            tolerance: 0,
          },
        ],
      },
    ];
    TestValidator.predicate(
      "a source-synchronized landmark distance predicate commits",
      setProductionFixtureShotContract(project, landmarkShot).accepted,
    );
    const formationRefusal = project.eraseDesignArtifact({
      kind: "formation",
      id: formation.id,
    });
    TestValidator.predicate(
      "formation erasure recognizes the exact shot participant reference",
      formationRefusal.accepted === false &&
        formationRefusal.diagnostics.some((entry) =>
          entry.message.includes("shot:opening"),
        ),
    );
    const worldRefusal = project.eraseDesignArtifact({ kind: "world" });
    TestValidator.predicate(
      "world erasure recognizes a landmark on the distance predicate's to side",
      worldRefusal.accepted === false &&
        worldRefusal.diagnostics.some((entry) =>
          entry.message.includes("shot:opening"),
        ),
    );

    const renderBytes = productionPng(1, 1);
    const manifest: IAutoMovieRenderBundleManifest = {
      version: 5,
      target: { kind: "shot", id: "opening" },
      compileFingerprint: digestAutoMovieBytes(Buffer.from("compile")),
      dialogueRuntimeIdentity: null,
      rendererIdentity: testRendererIdentity(),
      targetFingerprint: digestAutoMovieBytes(Buffer.from("target")),
      renderSpec: {
        target: "opening",
        frameFormat: { width: 1, height: 1, fps: 24 },
        toneMapping: "none",
        codec: "h264",
        pixelFormat: "yuv420p",
        crf: 17,
      },
      frames: [
        {
          index: 0,
          time: 0,
          pass: "beauty",
          path: "beauty-000000.png",
          digest: digestAutoMovieBytes(renderBytes),
          width: 1,
          height: 1,
        },
      ],
    };
    TestValidator.predicate(
      "render bundle refuses a non-content-addressed destination",
      throwsError(
        () =>
          project.commitRenderBundle(
            "wrong/bundle",
            new Map([["beauty-000000.png", renderBytes]]),
            manifest,
          ),
        "content-addressed path",
      ),
    );
    const bundle = productionRenderBundleRelativePath(manifest);
    project.commitRenderBundle(
      bundle,
      new Map([["beauty-000000.png", renderBytes]]),
      manifest,
    );
    TestValidator.equals(
      "canonical render bundle enumerates its verified captured view",
      project.capturedRenderViews(manifest.target, manifest.targetFingerprint),
      [{ time: 0, pass: "beauty" }],
    );

    TestValidator.equals(
      "an absent target fingerprint has no captured views",
      project.capturedRenderViews(manifest.target, `sha256:${"e".repeat(64)}`),
      [],
    );
    const bundleRoot = path.join(project.renderRoot(), ...bundle.split("/"));
    const fingerprintRoot = path.dirname(bundleRoot);
    fs.writeFileSync(path.join(fingerprintRoot, "not-a-bundle.txt"), "ignored");
    fs.mkdirSync(path.join(fingerprintRoot, "invalid-bundle"));
    TestValidator.equals(
      "captured-view enumeration skips non-bundles and unverifiable bundles",
      project.capturedRenderViews(manifest.target, manifest.targetFingerprint),
      [{ time: 0, pass: "beauty" }],
    );

    const manifestFile = path.join(bundleRoot, "manifest.json");
    const frameFile = path.join(bundleRoot, manifest.frames[0]!.path);
    const receiptFile = project.trackedStatePath(
      `render-receipts/${digestAutoMovieBytes(Buffer.from(bundle, "utf8")).slice("sha256:".length)}.json`,
    );
    const canonicalManifestBytes = fs.readFileSync(manifestFile);
    const canonicalReceiptBytes = fs.readFileSync(receiptFile);
    const writeManifestAndReceipt = (value: unknown): void => {
      const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
      fs.writeFileSync(manifestFile, bytes);
      writeJson(receiptFile, {
        version: 1,
        bundle,
        manifestDigest: digestAutoMovieBytes(bytes),
      });
    };
    const writeRawManifestAndReceipt = (bytes: Uint8Array): void => {
      fs.writeFileSync(manifestFile, bytes);
      writeJson(receiptFile, {
        version: 1,
        bundle,
        manifestDigest: digestAutoMovieBytes(bytes),
      });
    };

    writeManifestAndReceipt({ ...manifest, version: 4 });
    TestValidator.equals(
      "a pre-closure render manifest remains historical rather than current evidence",
      project.verifiedRenderManifest(manifestFile),
      null,
    );
    writeManifestAndReceipt({ version: 99 });
    TestValidator.equals(
      "a schema-invalid render manifest is not verified",
      project.verifiedRenderManifest(manifestFile),
      null,
    );
    writeManifestAndReceipt({
      ...manifest,
      rendererIdentity: "not-json",
    });
    TestValidator.equals(
      "a render manifest with an invalid runtime identity is not verified",
      project.verifiedRenderManifest(manifestFile),
      null,
    );
    writeManifestAndReceipt({
      ...manifest,
      targetFingerprint: `sha256:${"d".repeat(64)}`,
    });
    TestValidator.equals(
      "a render manifest outside its own canonical identity path is not verified",
      project.verifiedRenderManifest(manifestFile),
      null,
    );
    fs.writeFileSync(manifestFile, canonicalManifestBytes);
    fs.rmSync(receiptFile);
    TestValidator.equals(
      "a render manifest without its immutable receipt is not verified",
      project.verifiedRenderManifest(manifestFile),
      null,
    );
    writeJson(receiptFile, { version: 2 });
    TestValidator.equals(
      "a render manifest with a mismatched receipt is not verified",
      project.verifiedRenderManifest(manifestFile),
      null,
    );
    writeManifestAndReceipt({
      ...manifest,
      frames: [
        manifest.frames[0]!,
        { ...manifest.frames[0]!, path: "BEAUTY-000000.PNG" },
      ],
    });
    TestValidator.equals(
      "case-colliding frame claims are not verified",
      project.verifiedRenderManifest(manifestFile),
      null,
    );
    writeManifestAndReceipt({
      ...manifest,
      frames: [
        {
          ...manifest.frames[0]!,
          digest: `sha256:${"c".repeat(64)}`,
        },
      ],
    });
    TestValidator.equals(
      "a frame digest that disagrees with resident bytes is not verified",
      project.verifiedRenderManifest(manifestFile),
      null,
    );
    writeManifestAndReceipt({
      ...manifest,
      frames: [{ ...manifest.frames[0]!, width: 2 }],
    });
    TestValidator.equals(
      "frame dimensions must agree with the resident PNG probe",
      project.verifiedRenderManifest(manifestFile),
      null,
    );
    writeRawManifestAndReceipt(Buffer.from("{broken", "utf8"));
    TestValidator.equals(
      "a malformed render manifest is omitted without escaping the verifier",
      project.verifiedRenderManifest(manifestFile),
      null,
    );
    fs.writeFileSync(manifestFile, canonicalManifestBytes);
    fs.writeFileSync(receiptFile, canonicalReceiptBytes);
    TestValidator.predicate(
      "the restored canonical render bundle verifies its exact frame bytes",
      project.verifiedRenderManifest(manifestFile)?.frames[0]?.digest ===
        digestAutoMovieBytes(fs.readFileSync(frameFile)),
    );
  });

  withFixture(({ root }) => {
    const project = AutoMovieProductionProject.open(root, "fixture-film");
    const models = statePath(root, "design/shared/models");
    const cycleA = {
      ...modelRecipe(),
      id: "cycle-a",
      lod: modelRecipe().lod.map((entry) => ({
        ...entry,
        recipe: "cycle-b",
      })),
    };
    const cycleB = {
      ...modelRecipe(),
      id: "cycle-b",
      lod: modelRecipe().lod.map((entry) => ({
        ...entry,
        recipe: "cycle-a",
      })),
    };
    const missingBranch = {
      ...modelRecipe(),
      id: "missing-branch",
      lod: modelRecipe().lod.map((entry) => ({
        ...entry,
        recipe: "not-resident",
      })),
    };
    writeJson(path.join(models, "cycle-a.json"), cycleA);
    writeJson(path.join(models, "cycle-b.json"), cycleB);
    writeJson(path.join(models, "missing-branch.json"), missingBranch);
    const missingDependency = project.eraseDesignArtifact({
      kind: "model",
      id: "not-a-dependency",
    });
    TestValidator.equals(
      "cyclic and missing model dependencies terminate at the addressed missing-model diagnostic",
      [
        missingDependency.accepted,
        missingDependency.diagnostics.map((entry) => entry.code),
        missingDependency.target,
      ],
      [false, ["design-missing"], { kind: "model", id: "not-a-dependency" }],
    );

    const productionFile = path.join(
      root,
      project.designRecordPath({ kind: "production" }),
    );
    const productionBytes = fs.readFileSync(productionFile);
    fs.rmSync(productionFile);
    const worldWithoutProduction = project.eraseDesignArtifact({
      kind: "world",
    });
    TestValidator.predicate(
      "consequences use the stable film fallback when production design is absent",
      worldWithoutProduction.consequences.staleReviews.some(
        (target) => target.kind === "film" && target.id === "film",
      ) &&
        worldWithoutProduction.consequences.staleRenders.includes("film:film"),
    );
    fs.writeFileSync(productionFile, productionBytes);
  });
};
