import { AutoMovieProductionProject } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { productionFixture } from "./productionFixtures";

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
