import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  modelRecipe,
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

const mutableFs = fs as unknown as {
  lstatSync: typeof fs.lstatSync;
};

interface IFaultFailure {
  error: unknown;
}

class FaultCleanupError extends AggregateError {}

const preserveCleanup = (
  failure: IFaultFailure | undefined,
  cleanup: () => void,
  resource: string,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new FaultCleanupError(
      [failure.error, cleanupFailure],
      `${resource} cleanup failed after the fault assertion failed.`,
    );
  }
};

const withFixture = (
  scenario: (
    fixture: ReturnType<typeof productionFixture> & {
      project: AutoMovieProductionProject;
    },
  ) => void,
): void => {
  const fixture = productionFixture();
  const subject = {
    ...fixture,
    project: AutoMovieProductionProject.open(fixture.root, "fixture-film"),
  };
  let failure: IFaultFailure | undefined;
  try {
    scenario(subject);
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveCleanup(failure, fixture.dispose, "Production fixture");
  }
};

const withRoot = (scenario: (root: string) => void): void => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-project-fault-"),
  );
  let failure: IFaultFailure | undefined;
  try {
    scenario(root);
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveCleanup(
      failure,
      () => fs.rmSync(root, { force: true, recursive: true }),
      "Project fault root",
    );
  }
};

const refusal = (call: () => unknown): unknown => {
  try {
    call();
    return null;
  } catch (error) {
    return error;
  }
};

const messageIncludes = (error: unknown, fragment: string): boolean =>
  error instanceof Error && error.message.includes(fragment);

/**
 * Exercise Project fault boundaries that require a filesystem state change
 * between two identity-fenced observations.
 *
 * Scenarios:
 *
 * 1. Render reads classify a disappearing open, preserve a foreign open fault,
 *    and refuse a resident that changes file kind or physical identity.
 * 2. Nested descriptor failures preserve both the read failure and both close
 *    failures in one aggregate instead of losing the original cause.
 * 3. Declared content roots, nested content files, standalone content files,
 *    and the asset manifest refuse a realpath that escapes after lstat passed.
 * 4. A non-ENOENT lstat failure is preserved rather than being mistaken for an
 *    absent render file.
 * 5. Legacy migration refuses a staged identity replacement without touching
 *    it, restores output roots after a later publish fault, and never rolls a
 *    committed registry back when its post-publish cleanup fails.
 */
export const test_production_project_runtime_shape_faults = (): void => {
  withFixture(({ project }) => {
    const relative = "faults/read.bin";
    const target = path.join(project.renderRoot(), ...relative.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "render bytes");

    const nativeOpen = fs.openSync;
    const missing = Object.assign(new Error("disappeared during open"), {
      code: "ENOENT",
    });
    fs.openSync = ((file: fs.PathLike, flags: fs.OpenMode) => {
      if (path.resolve(file.toString()) === path.resolve(target)) throw missing;
      return nativeOpen(file, flags);
    }) as typeof fs.openSync;
    try {
      TestValidator.predicate(
        "render open disappearance is classified as an absent render file",
        messageIncludes(
          refusal(() => project.readRenderFile(relative)),
          "does not exist",
        ),
      );
    } finally {
      fs.openSync = nativeOpen;
    }

    const denied = Object.assign(new Error("render open denied"), {
      code: "EACCES",
    });
    fs.openSync = ((file: fs.PathLike, flags: fs.OpenMode) => {
      if (path.resolve(file.toString()) === path.resolve(target)) throw denied;
      return nativeOpen(file, flags);
    }) as typeof fs.openSync;
    try {
      TestValidator.equals(
        "render open preserves a non-disappearance failure",
        refusal(() => project.readRenderFile(relative)),
        denied,
      );
    } finally {
      fs.openSync = nativeOpen;
    }

    const nativeLstat = fs.lstatSync;
    let targetLstats = 0;
    mutableFs.lstatSync = ((file: fs.PathLike) => {
      if (path.resolve(file.toString()) === path.resolve(target)) {
        targetLstats += 1;
        if (targetLstats === 2) return nativeLstat(path.dirname(target));
      }
      return nativeLstat(file);
    }) as typeof fs.lstatSync;
    try {
      TestValidator.predicate(
        "render read refuses a resident that changes into a non-file",
        messageIncludes(
          refusal(() => project.readRenderFile(relative)),
          "changed into a link or non-file",
        ),
      );
    } finally {
      mutableFs.lstatSync = nativeLstat;
    }

    const alternate = path.join(path.dirname(target), "alternate.bin");
    fs.writeFileSync(alternate, "other inode");
    const alternateDescriptor = nativeOpen(alternate, "r");
    const nativeFstat = fs.fstatSync;
    const identityDescriptors: number[] = [];
    let targetFstats = 0;
    fs.openSync = ((file: fs.PathLike, flags: fs.OpenMode) => {
      const descriptor = nativeOpen(file, flags);
      if (path.resolve(file.toString()) === path.resolve(target))
        identityDescriptors.push(descriptor);
      return descriptor;
    }) as typeof fs.openSync;
    fs.fstatSync = ((descriptor: number, options?: { bigint?: boolean }) => {
      if (identityDescriptors.includes(descriptor)) {
        targetFstats += 1;
        if (targetFstats === 2)
          return nativeFstat(alternateDescriptor, { bigint: true });
      }
      return nativeFstat(descriptor, options as { bigint: true });
    }) as typeof fs.fstatSync;
    try {
      TestValidator.predicate(
        "render read refuses a resident that changes physical identity",
        messageIncludes(
          refusal(() => project.readRenderFile(relative)),
          "changed physical identity",
        ),
      );
    } finally {
      fs.openSync = nativeOpen;
      fs.fstatSync = nativeFstat;
      fs.closeSync(alternateDescriptor);
    }

    const nativeClose = fs.closeSync;
    const opened: number[] = [];
    let cleanupFstats = 0;
    fs.openSync = ((file: fs.PathLike, flags: fs.OpenMode) => {
      const descriptor = nativeOpen(file, flags);
      if (path.resolve(file.toString()) === path.resolve(target))
        opened.push(descriptor);
      return descriptor;
    }) as typeof fs.openSync;
    fs.fstatSync = ((descriptor: number, options?: { bigint?: boolean }) => {
      if (opened.includes(descriptor)) {
        cleanupFstats += 1;
        if (cleanupFstats === 2) throw new Error("resident fstat failed");
      }
      return nativeFstat(descriptor, options as { bigint: true });
    }) as typeof fs.fstatSync;
    fs.closeSync = ((descriptor: number) => {
      if (opened.includes(descriptor))
        throw new Error("descriptor close failed");
      return nativeClose(descriptor);
    }) as typeof fs.closeSync;
    try {
      const error = refusal(() => project.readRenderFile(relative));
      TestValidator.predicate(
        "render descriptor cleanup aggregates the read and nested close failures",
        error instanceof AggregateError &&
          error.message.includes("cleanup failed after the read failed") &&
          error.errors.length === 3,
      );
    } finally {
      fs.openSync = nativeOpen;
      fs.fstatSync = nativeFstat;
      fs.closeSync = nativeClose;
      for (const descriptor of opened)
        try {
          nativeClose(descriptor);
        } catch {}
    }

    let outerDescriptor: number | undefined;
    const closeOnlyFailure = new Error("successful read close failed");
    fs.openSync = ((file: fs.PathLike, flags: fs.OpenMode) => {
      const descriptor = nativeOpen(file, flags);
      if (
        outerDescriptor === undefined &&
        path.resolve(file.toString()) === path.resolve(target)
      )
        outerDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    fs.closeSync = ((descriptor: number) => {
      if (descriptor === outerDescriptor) throw closeOnlyFailure;
      return nativeClose(descriptor);
    }) as typeof fs.closeSync;
    try {
      TestValidator.equals(
        "successful render reads preserve an outer descriptor close failure",
        refusal(() => project.readRenderFile(relative)),
        closeOnlyFailure,
      );
    } finally {
      fs.openSync = nativeOpen;
      fs.closeSync = nativeClose;
      if (outerDescriptor !== undefined)
        try {
          nativeClose(outerDescriptor);
        } catch {}
    }

    const lstatDenied = Object.assign(new Error("render lstat denied"), {
      code: "EACCES",
    });
    mutableFs.lstatSync = ((file: fs.PathLike) => {
      if (path.resolve(file.toString()) === path.resolve(target))
        throw lstatDenied;
      return nativeLstat(file);
    }) as typeof fs.lstatSync;
    try {
      TestValidator.equals(
        "render lstat preserves a non-ENOENT failure",
        refusal(() => project.readRenderFile(relative)),
        lstatDenied,
      );
    } finally {
      mutableFs.lstatSync = nativeLstat;
    }
  });

  withFixture(({ root }) => {
    TestValidator.equals(
      "open chooses the sole registered production when no id is supplied",
      AutoMovieProductionProject.open(root).productionId,
      "fixture-film",
    );
  });

  withFixture(({ root, project }) => {
    const sharedLock = path.join(root, "automovie/shared-design.lock");
    const revisionLock = project.trackedStatePath("revision.lock");
    const incarnation = path.join(root, "automovie/incarnation.json");
    const nativeRename = fs.renameSync;
    let releaseFaults = 0;
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      const result = nativeRename(from, to);
      if (
        path.resolve(from.toString()) === path.resolve(revisionLock) &&
        path.basename(to.toString()).startsWith(".automovie-lock-release-")
      ) {
        ++releaseFaults;
        fs.writeFileSync(
          incarnation,
          `${JSON.stringify(
            {
              version: 1,
              id: "00000000-0000-4000-8000-000000000099",
            },
            null,
            2,
          )}\n`,
        );
      }
      return result;
    }) as typeof fs.renameSync;
    try {
      const result = project.setModelRecipe({
        ...modelRecipe(),
        id: "shared-release-fault",
      });
      TestValidator.predicate(
        "shared mutation preserves its commit after shared-lock unlink fails",
        result.accepted && releaseFaults === 1 && fs.existsSync(sharedLock),
      );
    } finally {
      fs.renameSync = nativeRename;
    }
  });

  for (const fault of [
    {
      label: "declared content root realpath",
      relative: "viewer",
      occurrence: 1,
      message: "content root",
    },
    {
      label: "visited content directory realpath",
      relative: "viewer",
      occurrence: 2,
      message: "content directory",
    },
    {
      label: "nested content file realpath",
      relative: "viewer/index.html",
      occurrence: 1,
      message: "content file",
    },
    {
      label: "standalone content file realpath",
      relative: "automovie.config.ts",
      occurrence: 1,
      message: "content file",
    },
    {
      label: "asset manifest realpath",
      relative: "automovie/assets.json",
      occurrence: 1,
      message: "asset manifest",
    },
  ] as const)
    withFixture(({ root, project }) => {
      const external = fs.mkdtempSync(
        path.join(os.tmpdir(), "automovie-project-realpath-fault-"),
      );
      const nativeRealpath = fs.realpathSync;
      const target = path.resolve(root, ...fault.relative.split("/"));
      let observations = 0;
      let faultFailure: IFaultFailure | undefined;
      fs.realpathSync = ((file: fs.PathLike) => {
        if (path.resolve(file.toString()) === target) {
          observations += 1;
          if (observations === fault.occurrence) return external;
        }
        return nativeRealpath(file);
      }) as typeof fs.realpathSync;
      try {
        TestValidator.predicate(
          `${fault.label} refuses an escape outside the verified project root`,
          messageIncludes(
            refusal(() => project.contentInputs()),
            fault.message,
          ),
        );
      } catch (error) {
        faultFailure = { error };
        throw error;
      } finally {
        fs.realpathSync = nativeRealpath;
        preserveCleanup(
          faultFailure,
          () => fs.rmSync(external, { force: true, recursive: true }),
          "External realpath target",
        );
      }
    });

  withFixture(({ root, project }) => {
    const designRoot = path.join(root, "automovie/design/fixture-film");
    const nativeLstat = fs.lstatSync;
    let observations = 0;
    mutableFs.lstatSync = ((file: fs.PathLike) => {
      const state = nativeLstat(file);
      if (path.resolve(file.toString()) !== path.resolve(designRoot))
        return state;
      observations += 1;
      return observations === 4
        ? (Object.assign(
            Object.create(Object.getPrototypeOf(state)) as fs.Stats,
            state,
            { isSymbolicLink: () => true },
          ) as fs.Stats)
        : state;
    }) as typeof fs.lstatSync;
    try {
      const error = refusal(() => project.eraseProduction("unsafe source"));
      TestValidator.predicate(
        "erase refuses a source namespace that changes into a symbolic link after preflight",
        observations >= 4 && messageIncludes(error, "refused unsafe namespace"),
      );
    } finally {
      mutableFs.lstatSync = nativeLstat;
    }
  });

  withFixture(({ root, project }) => {
    const models = path.join(root, "automovie/design/shared/models");
    const target = fs
      .readdirSync(models)
      .filter((entry) => entry.endsWith(".json"))
      .sort((left, right) => left.localeCompare(right))[0]!;
    const nativeReadDirectory = fs.readdirSync;
    let removed = false;
    fs.readdirSync = ((directory: fs.PathLike, options?: unknown) => {
      const entries = nativeReadDirectory(directory, options as never);
      if (
        removed === false &&
        path.resolve(directory.toString()) === path.resolve(models)
      ) {
        fs.rmSync(path.join(models, target));
        removed = true;
      }
      return entries;
    }) as typeof fs.readdirSync;
    try {
      const error = refusal(() => project.inventory());
      TestValidator.predicate(
        "design enumeration refuses a file that disappears before its owned read",
        removed && messageIncludes(error, "disappeared"),
      );
    } finally {
      fs.readdirSync = nativeReadDirectory;
    }
  });

  withFixture(({ root, project }) => {
    const models = path.join(root, "automovie/design/shared/models");
    const templatePath = fs
      .readdirSync(models)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => path.join(models, entry))[0]!;
    const template = JSON.parse(fs.readFileSync(templatePath, "utf8")) as {
      id: string;
    };
    for (const id of ["K", "K"]) {
      const value = { ...template, id };
      fs.writeFileSync(
        path.join(models, `${encodeURIComponent(id)}.json`),
        `${JSON.stringify(value)}\n`,
      );
    }
    TestValidator.predicate(
      "design enumeration refuses Unicode ids that collide under case folding",
      messageIncludes(
        refusal(() => project.inventory()),
        "collide by case",
      ),
    );
  });

  withFixture(({ root }) => {
    const registry = path.join(root, "automovie/productions.json");
    const nativeOpen = fs.openSync;
    const denied = Object.assign(new Error("registry read denied"), {
      code: "EACCES",
    });
    fs.openSync = ((file: fs.PathLike, flags: fs.OpenMode) => {
      if (path.resolve(file.toString()) === path.resolve(registry))
        throw denied;
      return nativeOpen(file, flags);
    }) as typeof fs.openSync;
    try {
      TestValidator.equals(
        "registry read preserves a non-disappearance owned-file failure",
        refusal(() => AutoMovieProductionProject.registeredProductionIds(root)),
        denied,
      );
    } finally {
      fs.openSync = nativeOpen;
    }
  });

  {
    const fixture = productionFixture();
    const external = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-manifest-content-root-"),
    );
    const viewer = path.join(fixture.root, "viewer");
    const nativeRealpath = fs.realpathSync;
    let failure: IFaultFailure | undefined;
    fs.realpathSync = ((file: fs.PathLike) =>
      path.resolve(file.toString()) === path.resolve(viewer)
        ? external
        : nativeRealpath(file)) as typeof fs.realpathSync;
    try {
      TestValidator.predicate(
        "open refuses a declared content-root junction that escapes the project",
        messageIncludes(
          refusal(() =>
            AutoMovieProductionProject.open(fixture.root, "fixture-film"),
          ),
          "escapes the project through a directory junction",
        ),
      );
    } catch (error) {
      failure = { error };
      throw error;
    } finally {
      fs.realpathSync = nativeRealpath;
      preserveCleanup(
        failure,
        fixture.dispose,
        "Manifest content-root fixture",
      );
      preserveCleanup(
        failure,
        () => fs.rmSync(external, { force: true, recursive: true }),
        "Manifest content-root target",
      );
    }
  }

  withFixture(({ project }) => {
    const nativeRename = fs.renameSync;
    let firstDestination: string | undefined;
    let sourceMoves = 0;
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      const destination = path.resolve(to.toString());
      if (path.basename(path.dirname(destination)).startsWith(".erase-")) {
        sourceMoves += 1;
        if (sourceMoves === 1) {
          const result = nativeRename(from, to);
          firstDestination = destination;
          return result;
        }
        if (firstDestination !== undefined) {
          nativeRename(firstDestination, `${firstDestination}.parked`);
          fs.mkdirSync(firstDestination);
        }
        throw new Error("later erase move failed");
      }
      return nativeRename(from, to);
    }) as typeof fs.renameSync;
    try {
      const error = refusal(() =>
        project.eraseProduction("identity replacement during erase"),
      );
      TestValidator.predicate(
        "erase refuses rollback after a quarantined original changes identity",
        error instanceof AggregateError &&
          error.message.includes("changed physical identity") &&
          error.message.includes("No stale-path rollback was attempted"),
      );
    } finally {
      fs.renameSync = nativeRename;
    }
  });

  withFixture(({ project }) => {
    const nativeRename = fs.renameSync;
    let firstSource: string | undefined;
    let sourceMoves = 0;
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      const destination = path.resolve(to.toString());
      if (path.basename(path.dirname(destination)).startsWith(".erase-")) {
        sourceMoves += 1;
        if (sourceMoves === 1) {
          firstSource = path.resolve(from.toString());
          return nativeRename(from, to);
        }
        if (firstSource !== undefined) fs.mkdirSync(firstSource);
        throw new Error("later erase move failed");
      }
      return nativeRename(from, to);
    }) as typeof fs.renameSync;
    try {
      const error = refusal(() =>
        project.eraseProduction("rollback source replacement"),
      );
      TestValidator.predicate(
        "erase leaves a quarantined original untouched when its source path is replaced",
        error instanceof AggregateError &&
          error.message.includes("rollback was incomplete") &&
          error.errors.some((entry) =>
            messageIncludes(entry, "was replaced before rollback"),
          ),
      );
    } finally {
      fs.renameSync = nativeRename;
    }
  });

  withFixture(({ root, project }) => {
    const registry = path.join(root, "automovie/productions.json");
    const auditParent = path.join(root, "automovie/audit/production-deletions");
    const nativeRename = fs.renameSync;
    const nativeRemove = fs.rmSync;
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (path.resolve(to.toString()) === path.resolve(registry))
        throw new Error("erase registry publish failed");
      return nativeRename(from, to);
    }) as typeof fs.renameSync;
    fs.rmSync = ((file: fs.PathLike, options?: fs.RmOptions) => {
      if (
        path.resolve(path.dirname(file.toString())) ===
          path.resolve(auditParent) &&
        path.basename(file.toString()).startsWith("fixture-film-") &&
        path.basename(file.toString()).endsWith(".json")
      )
        throw new Error("erase audit rollback failed");
      return nativeRemove(file, options);
    }) as typeof fs.rmSync;
    try {
      const error = refusal(() =>
        project.eraseProduction("audit rollback failure"),
      );
      TestValidator.predicate(
        "erase aggregates an audit cleanup failure after restoring quarantined sources",
        error instanceof AggregateError &&
          error.message.includes("rollback was incomplete") &&
          error.errors.some((entry) =>
            messageIncludes(entry, "erase audit rollback failed"),
          ),
      );
    } finally {
      fs.renameSync = nativeRename;
      fs.rmSync = nativeRemove;
    }
  });

  withFixture(({ project }) => {
    const nativeRemove = fs.rmSync;
    let registryCleanupFaults = 0;
    fs.rmSync = ((file: fs.PathLike, options?: fs.RmOptions) => {
      if (file.toString().includes("productions.json.tmp.")) {
        registryCleanupFaults += 1;
        throw new Error("post-publish registry cleanup failed");
      }
      return nativeRemove(file, options);
    }) as typeof fs.rmSync;
    try {
      const erased = project.eraseProduction("committed cleanup failure");
      TestValidator.predicate(
        "erase preserves its registry commit point after temporary cleanup fails",
        registryCleanupFaults === 1 && erased.erased,
      );
    } finally {
      fs.rmSync = nativeRemove;
    }
  });

  withFixture(({ root, project }) => {
    const stateRoot = path.join(root, "automovie/productions/fixture-film");
    const nativeMkdir = fs.mkdirSync;
    let replaced = false;
    fs.mkdirSync = ((
      directory: fs.PathLike,
      options?: fs.MakeDirectoryOptions,
    ) => {
      const result = nativeMkdir(directory, options);
      if (
        replaced === false &&
        path.basename(directory.toString()).startsWith(".erase-")
      ) {
        fs.renameSync(stateRoot, `${stateRoot}.parked`);
        nativeMkdir(stateRoot);
        replaced = true;
      }
      return result;
    }) as typeof fs.mkdirSync;
    try {
      const error = refusal(() => project.eraseProduction("state replacement"));
      TestValidator.predicate(
        "erase abandons only process-local lock ownership after state-root replacement",
        replaced && messageIncludes(error, "physical identity"),
      );
    } finally {
      fs.mkdirSync = nativeMkdir;
    }
  });

  withFixture(({ root, project }) => {
    const auditParent = path.join(root, "automovie/audit/production-deletions");
    fs.mkdirSync(path.dirname(auditParent), { recursive: true });
    fs.writeFileSync(auditParent, "audit obstruction");
    const nativeReadDirectory = fs.readdirSync;
    fs.readdirSync = ((directory: fs.PathLike, options?: unknown) => {
      if (path.basename(directory.toString()).startsWith(".erase-"))
        throw new Error("quarantine inspection failed");
      return nativeReadDirectory(directory, options as never);
    }) as typeof fs.readdirSync;
    try {
      TestValidator.predicate(
        "erase preserves its original refusal when empty-quarantine inspection also fails",
        messageIncludes(
          refusal(() => project.eraseProduction("quarantine inspection")),
          "not a physical directory",
        ),
      );
    } finally {
      fs.readdirSync = nativeReadDirectory;
    }
  });

  withFixture(({ project }) => {
    const targetRoot = path.join(
      project.renderRoot(),
      "deliverables/atomic-cleanup",
    );
    const nativeRename = fs.renameSync;
    const nativeRemove = fs.rmSync;
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (path.resolve(to.toString()).startsWith(path.resolve(targetRoot)))
        throw Object.assign(new Error("atomic publish failed"), {
          code: "ENOSPC",
        });
      return nativeRename(from, to);
    }) as typeof fs.renameSync;
    fs.rmSync = ((file: fs.PathLike, options?: fs.RmOptions) => {
      if (
        path.resolve(file.toString()).startsWith(path.resolve(targetRoot)) &&
        file.toString().includes(".tmp.")
      )
        throw Object.assign(new Error("atomic temporary cleanup failed"), {
          code: "EACCES",
        });
      return nativeRemove(file, options);
    }) as typeof fs.rmSync;
    try {
      const error = refusal(() =>
        project.commitProductionDeliverableFiles(
          "atomic-cleanup",
          new Map([["candidate.bin", Buffer.from("candidate")]]),
        ),
      );
      TestValidator.predicate(
        "atomic write preserves both publication and temporary-cleanup failures",
        error instanceof AggregateError &&
          error.message.includes("atomic write cleanup failed") &&
          error.errors.length === 2,
      );
    } finally {
      fs.renameSync = nativeRename;
      fs.rmSync = nativeRemove;
    }
  });

  withFixture(({ project }) => {
    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    if (
      productionCompileSucceeded("atomic delete recovery", compiled) === false
    )
      throw new Error("Generated fixture compilation failed.");
    const currentManifest = project.generatedManifest();
    if (currentManifest === null || currentManifest.files.length === 0)
      throw new Error("Generated fixture has no removable resident.");
    const removed = currentManifest.files[0]!;
    const nextManifest = {
      ...currentManifest,
      files: currentManifest.files.slice(1),
    };
    const nextFiles = new Map(
      nextManifest.files.map((entry) => [
        entry.path,
        project.readGeneratedFile(entry.path),
      ]),
    );
    const nativeRename = fs.renameSync;
    const nativeRemove = fs.rmSync;
    fs.rmSync = ((file: fs.PathLike, options?: fs.RmOptions) => {
      if (file.toString().includes(".delete."))
        throw Object.assign(new Error("quarantine removal failed"), {
          code: "ENOSPC",
        });
      return nativeRemove(file, options);
    }) as typeof fs.rmSync;
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (from.toString().includes(".delete."))
        throw Object.assign(new Error("quarantine recovery failed"), {
          code: "EACCES",
        });
      return nativeRename(from, to);
    }) as typeof fs.renameSync;
    try {
      const error = refusal(() =>
        project.commitGenerated(nextFiles, nextManifest),
      );
      TestValidator.predicate(
        "atomic delete preserves both quarantine and recovery failures",
        error instanceof AggregateError &&
          error.message.includes("atomic delete recovery failed") &&
          error.errors.length === 2 &&
          fs.existsSync(path.join(project.generatedRoot(), removed.path)) ===
            false,
      );
    } finally {
      fs.renameSync = nativeRename;
      fs.rmSync = nativeRemove;
    }
  });

  withRoot((root) => {
    const source = path.join(root, "automovie/design/models");
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, "legacy.txt"), "legacy model");
    const nativeRename = fs.renameSync;
    let replaced = false;
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      const result = nativeRename(from, to);
      if (path.resolve(from.toString()) === path.resolve(source)) {
        const temporary = path.dirname(path.resolve(to.toString()));
        const parked = `${temporary}.parked`;
        nativeRename(temporary, parked);
        fs.mkdirSync(temporary);
        replaced = true;
      }
      return result;
    }) as typeof fs.renameSync;
    try {
      const error = refusal(() =>
        AutoMovieProductionProject.open(root, "legacy"),
      );
      TestValidator.predicate(
        "legacy migration refuses a replaced staging root without stale rollback",
        replaced &&
          error instanceof AggregateError &&
          error.message.includes("owned namespace changed physical identity"),
      );
    } finally {
      fs.renameSync = nativeRename;
    }
  });

  withRoot((root) => {
    const generated = path.join(root, "generated");
    const renders = path.join(root, "renders");
    fs.mkdirSync(generated);
    fs.mkdirSync(renders);
    fs.writeFileSync(path.join(generated, "generated.txt"), "generated");
    fs.writeFileSync(path.join(renders, "render.txt"), "render");
    const nativeRename = fs.renameSync;
    const renderDestination = path.join(renders, "legacy");
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (path.resolve(to.toString()) === path.resolve(renderDestination))
        throw Object.assign(new Error("render publish fault"), {
          code: "ENOSPC",
        });
      return nativeRename(from, to);
    }) as typeof fs.renameSync;
    try {
      const error = refusal(() =>
        AutoMovieProductionProject.open(root, "legacy"),
      );
      TestValidator.predicate(
        "legacy output migration restores staged roots after a later publish fault",
        messageIncludes(error, "render publish fault") &&
          fs.readFileSync(path.join(generated, "generated.txt"), "utf8") ===
            "generated" &&
          fs.readFileSync(path.join(renders, "render.txt"), "utf8") ===
            "render" &&
          fs
            .readdirSync(path.join(root, "automovie"))
            .every((entry) => entry.startsWith(".layout-migration-") === false),
      );
    } finally {
      fs.renameSync = nativeRename;
    }
  });

  withRoot((root) => {
    const nativeRemove = fs.rmSync;
    let registryTemporaryRemovals = 0;
    fs.rmSync = ((file: fs.PathLike, options?: fs.RmOptions) => {
      const value = file.toString();
      if (value.includes("productions.json.tmp.")) {
        registryTemporaryRemovals += 1;
        if (registryTemporaryRemovals === 2)
          throw Object.assign(new Error("registry cleanup fault"), {
            code: "ENOSPC",
          });
      }
      return nativeRemove(file, options);
    }) as typeof fs.rmSync;
    try {
      const error = refusal(() =>
        AutoMovieProductionProject.open(root, "legacy"),
      );
      TestValidator.predicate(
        "legacy migration never rolls back after the registry commit point",
        registryTemporaryRemovals === 2 &&
          error instanceof AggregateError &&
          error.message.includes("registry were committed") &&
          AutoMovieProductionProject.registeredProductionIds(root).includes(
            "legacy",
          ),
      );
    } finally {
      fs.rmSync = nativeRemove;
    }
  });
};
