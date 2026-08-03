import {
  IAutoMovieGeneratedManifest,
  IAutoMovieRenderBundleManifest,
  IAutoMovieStoredReview,
} from "@automovie/interface";
import {
  AUTOMOVIE_MAX_FORMATION_MEMBERS,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  acquireCommitLock,
  acquireProductionRootNamespace,
  assertProductionRootNamespaceLease,
  compareCodeUnits,
  digestAutoMovieBytes,
  productionRenderBundleRelativePath,
  productionRenderTargetFingerprint,
  releaseCommitLock,
  releaseProductionRootNamespace,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";

import {
  acceptanceScenarios,
  fixtureWorldDesign,
  formationDesign,
  modelRecipe,
  productionCompileSucceeded,
  productionDesign,
  productionFixture,
  shotContract,
  testRendererIdentity,
  worldDesign,
} from "./productionFixtures";

const throws = (closure: () => unknown, fragment?: string): boolean => {
  try {
    closure();
    return false;
  } catch (error) {
    return (
      fragment === undefined ||
      (error instanceof Error && error.message.includes(fragment))
    );
  }
};

type RenderFileDescriptorFailureMode =
  | "combined-resident"
  | "combined-source"
  | "nested"
  | "primary-only"
  | "standalone-resident-close"
  | "standalone-source-close";

interface IRenderFileDescriptorFailureEvidence {
  caught: unknown;
  primaryFailure: Error;
  residentCloseFailure: Error;
  sourceCloseFailure: Error;
}

const captureRenderFileDescriptorFailure = (
  project: AutoMovieProductionProject,
  relativePath: string,
  mode: RenderFileDescriptorFailureMode,
): IRenderFileDescriptorFailureEvidence => {
  const target = path.resolve(project.renderRoot(), relativePath);
  const primaryFailure = new Error(`${mode} primary failure`);
  const residentCloseFailure = new Error(`${mode} resident close failure`);
  const sourceCloseFailure = new Error(`${mode} source close failure`);
  const nativeOpen = fs.openSync;
  const nativeFstat = fs.fstatSync;
  const nativeClose = fs.closeSync;
  let sourceDescriptor: number | undefined;
  let failedResidentDescriptor: number | undefined;
  fs.openSync = ((file, ...args: unknown[]): number => {
    const descriptor = Reflect.apply(nativeOpen, fs, [file, ...args]) as number;
    if (
      sourceDescriptor === undefined &&
      path.resolve(file.toString()) === target
    )
      sourceDescriptor = descriptor;
    return descriptor;
  }) as typeof fs.openSync;
  fs.fstatSync = ((
    descriptor,
    ...args: unknown[]
  ): fs.Stats | fs.BigIntStats => {
    if (
      descriptor === sourceDescriptor &&
      (mode === "primary-only" || mode === "combined-source")
    )
      throw primaryFailure;
    if (
      sourceDescriptor !== undefined &&
      descriptor !== sourceDescriptor &&
      failedResidentDescriptor === undefined &&
      (mode === "combined-resident" || mode === "nested")
    ) {
      failedResidentDescriptor = descriptor;
      throw primaryFailure;
    }
    return Reflect.apply(nativeFstat, fs, [descriptor, ...args]) as
      | fs.Stats
      | fs.BigIntStats;
  }) as typeof fs.fstatSync;
  fs.closeSync = ((descriptor): void => {
    if (
      sourceDescriptor !== undefined &&
      descriptor !== sourceDescriptor &&
      failedResidentDescriptor === undefined &&
      mode === "standalone-resident-close"
    )
      failedResidentDescriptor = descriptor;
    nativeClose(descriptor);
    if (
      descriptor === failedResidentDescriptor &&
      (mode === "combined-resident" ||
        mode === "nested" ||
        mode === "standalone-resident-close")
    )
      throw residentCloseFailure;
    if (
      descriptor === sourceDescriptor &&
      (mode === "combined-source" ||
        mode === "nested" ||
        mode === "standalone-source-close")
    )
      throw sourceCloseFailure;
  }) as typeof fs.closeSync;
  let caught: unknown;
  try {
    project.readRenderFile(relativePath);
  } catch (error) {
    caught = error;
  } finally {
    fs.openSync = nativeOpen;
    fs.fstatSync = nativeFstat;
    fs.closeSync = nativeClose;
  }
  return {
    caught,
    primaryFailure,
    residentCloseFailure,
    sourceCloseFailure,
  };
};

const aggregateContainsExactly = (
  error: unknown,
  expected: unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

interface IProductionProjectFixtureFailure {
  error: unknown;
}

interface IProductionProjectFixtureCleanup {
  cleanup: () => unknown;
  resource: string;
}

class ProductionProjectFixtureCleanupError extends AggregateError {}

/** Attempt every acquired project fixture cleanup without hiding failure. */
export const preserveProductionProjectFixtureCleanup = (
  failure: IProductionProjectFixtureFailure | undefined,
  resources: readonly IProductionProjectFixtureCleanup[],
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
    throw new ProductionProjectFixtureCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `Production-project fixture cleanup failed${
        failure === undefined ? "" : " after the test failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};

interface ISingleProductionProjectFixtureFailure {
  error: unknown;
}

class SingleProductionProjectFixtureCleanupError extends AggregateError {}

export const preserveSingleProductionProjectFixtureCleanup = (
  failure: ISingleProductionProjectFixtureFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new SingleProductionProjectFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Single production-project fixture teardown failed after the test failed.",
    );
  }
};

type ProductionAtomicFailureMode =
  | "combined-cleanup"
  | "combined-recovery"
  | "primary-only"
  | "standalone-cleanup";

interface IProductionAtomicFailureEvidence {
  caught: unknown;
  cleanupAttempted: boolean;
  cleanupFailure: Error;
  fixtureAccepted: boolean;
  primaryFailure: Error;
  quarantineArtifacts: number;
  recoveryAttempted: boolean;
  recoveryFailure: Error;
  targetExists: boolean;
  temporaryArtifacts: number;
}

interface IProductionAtomicNativeHooks {
  remove: typeof fs.rmSync;
  rename: typeof fs.renameSync;
}

const captureProductionAtomicFailure = (
  mode: ProductionAtomicFailureMode,
): IProductionAtomicFailureEvidence => {
  let nativeHooks: IProductionAtomicNativeHooks | undefined;
  let hooksInstalled = false;
  let atomicHarnessFailure: IProductionProjectFixtureFailure | undefined;
  const fixture = productionFixture();
  try {
    nativeHooks = { remove: fs.rmSync, rename: fs.renameSync };
    const { remove: nativeRemove, rename: nativeRename } = nativeHooks;
    const project = AutoMovieProductionProject.open(fixture.root);
    const base = modelRecipe();
    const id = `atomic-failure-${mode}`;
    const design = {
      ...base,
      id,
      lod: base.lod.map((lod) => ({ ...lod, recipe: id })),
    };
    const target = path.join(
      fixture.root,
      `.automovie/design/shared/models/${id}.json`,
    );
    const fixtureAccepted =
      mode !== "combined-recovery" || project.setModelRecipe(design).accepted;
    const primaryFailure = new Error(`${mode} primary failure`);
    const cleanupFailure = new Error(`${mode} cleanup failure`);
    const recoveryFailure = new Error(`${mode} recovery failure`);
    let cleanupAttempted = false;
    let recoveryAttempted = false;
    let quarantine: string | null = null;
    fs.renameSync = ((oldPath, newPath): void => {
      const source = path.resolve(oldPath.toString());
      const destination = path.resolve(newPath.toString());
      if (
        mode !== "combined-recovery" &&
        destination === path.resolve(target) &&
        source.startsWith(`${path.resolve(target)}.tmp.`) &&
        (mode === "primary-only" || mode === "combined-cleanup")
      )
        throw primaryFailure;
      if (
        mode === "combined-recovery" &&
        source === path.resolve(target) &&
        destination.startsWith(`${path.resolve(target)}.delete.`)
      )
        quarantine = destination;
      if (
        mode === "combined-recovery" &&
        quarantine !== null &&
        source === quarantine &&
        destination === path.resolve(target)
      ) {
        recoveryAttempted = true;
        throw recoveryFailure;
      }
      nativeRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    Reflect.set(fs, "rmSync", (file: fs.PathLike, ...args: unknown[]) => {
      const resolved = path.resolve(file.toString());
      if (
        mode !== "combined-recovery" &&
        resolved.startsWith(`${path.resolve(target)}.tmp.`)
      ) {
        cleanupAttempted = true;
        if (mode === "standalone-cleanup" || mode === "combined-cleanup")
          throw cleanupFailure;
      }
      if (
        mode === "combined-recovery" &&
        quarantine !== null &&
        resolved === quarantine
      ) {
        cleanupAttempted = true;
        throw primaryFailure;
      }
      return (nativeRemove as (...parameters: unknown[]) => void)(
        file,
        ...args,
      );
    });
    hooksInstalled = true;
    let caught: unknown;
    try {
      if (mode === "combined-recovery")
        project.eraseDesignArtifact({ kind: "model", id });
      else project.setModelRecipe(design);
    } catch (error) {
      caught = error;
    } finally {
      fs.renameSync = nativeRename;
      Reflect.set(fs, "rmSync", nativeRemove);
      hooksInstalled = false;
    }
    const entries = fs.readdirSync(path.dirname(target));
    return {
      caught,
      cleanupAttempted,
      cleanupFailure,
      fixtureAccepted,
      primaryFailure,
      quarantineArtifacts: entries.filter((entry) =>
        entry.startsWith(`${path.basename(target)}.delete.`),
      ).length,
      recoveryAttempted,
      recoveryFailure,
      targetExists: fs.existsSync(target),
      temporaryArtifacts: entries.filter((entry) =>
        entry.startsWith(`${path.basename(target)}.tmp.`),
      ).length,
    };
  } catch (error) {
    atomicHarnessFailure = { error };
    throw error;
  } finally {
    const completedNativeHooks = nativeHooks;
    preserveProductionProjectFixtureCleanup(atomicHarnessFailure, [
      ...(hooksInstalled && completedNativeHooks !== undefined
        ? [
            {
              resource: "atomic rename hook",
              cleanup: (): void => {
                fs.renameSync = completedNativeHooks.rename;
              },
            },
            {
              resource: "atomic remove hook",
              cleanup: (): void => {
                Reflect.set(fs, "rmSync", completedNativeHooks.remove);
              },
            },
          ]
        : []),
      {
        resource: "atomic failure production fixture",
        cleanup: () => fixture.dispose(),
      },
    ]);
  }
};

const exerciseProductionAtomicFailureOwnership = (): void => {
  const standalone = captureProductionAtomicFailure("standalone-cleanup");
  const primaryOnly = captureProductionAtomicFailure("primary-only");
  const combinedCleanup = captureProductionAtomicFailure("combined-cleanup");
  const combinedRecovery = captureProductionAtomicFailure("combined-recovery");
  TestValidator.predicate(
    "production atomic cleanup and recovery preserve exact failure ownership",
    standalone.caught === standalone.cleanupFailure &&
      standalone.cleanupAttempted &&
      standalone.targetExists &&
      standalone.temporaryArtifacts === 0 &&
      primaryOnly.caught === primaryOnly.primaryFailure &&
      primaryOnly.cleanupAttempted &&
      primaryOnly.targetExists === false &&
      primaryOnly.temporaryArtifacts === 0 &&
      aggregateContainsExactly(combinedCleanup.caught, [
        combinedCleanup.primaryFailure,
        combinedCleanup.cleanupFailure,
      ]) &&
      combinedCleanup.cleanupAttempted &&
      combinedCleanup.targetExists === false &&
      combinedCleanup.temporaryArtifacts === 1 &&
      combinedRecovery.fixtureAccepted &&
      aggregateContainsExactly(combinedRecovery.caught, [
        combinedRecovery.primaryFailure,
        combinedRecovery.recoveryFailure,
      ]) &&
      combinedRecovery.cleanupAttempted &&
      combinedRecovery.recoveryAttempted &&
      combinedRecovery.targetExists === false &&
      combinedRecovery.quarantineArtifacts === 1,
  );
};

const exerciseRenderFileDescriptorCleanup = (
  project: AutoMovieProductionProject,
  relativePath: string,
): void => {
  const standaloneSource = captureRenderFileDescriptorFailure(
    project,
    relativePath,
    "standalone-source-close",
  );
  const standaloneResident = captureRenderFileDescriptorFailure(
    project,
    relativePath,
    "standalone-resident-close",
  );
  const primaryOnly = captureRenderFileDescriptorFailure(
    project,
    relativePath,
    "primary-only",
  );
  const combinedResident = captureRenderFileDescriptorFailure(
    project,
    relativePath,
    "combined-resident",
  );
  const combinedSource = captureRenderFileDescriptorFailure(
    project,
    relativePath,
    "combined-source",
  );
  const nested = captureRenderFileDescriptorFailure(
    project,
    relativePath,
    "nested",
  );
  TestValidator.predicate(
    "render-file descriptor cleanup preserves every operation and resource failure",
    standaloneSource.caught === standaloneSource.sourceCloseFailure &&
      standaloneResident.caught === standaloneResident.residentCloseFailure &&
      primaryOnly.caught === primaryOnly.primaryFailure &&
      aggregateContainsExactly(combinedResident.caught, [
        combinedResident.primaryFailure,
        combinedResident.residentCloseFailure,
      ]) &&
      aggregateContainsExactly(combinedSource.caught, [
        combinedSource.primaryFailure,
        combinedSource.sourceCloseFailure,
      ]) &&
      aggregateContainsExactly(nested.caught, [
        nested.primaryFailure,
        nested.residentCloseFailure,
        nested.sourceCloseFailure,
      ]),
  );
};

const snapshotTree = (root: string): string[] => {
  const output: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
      )) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (entry.isDirectory()) {
        output.push(`directory:${relative}`);
        visit(absolute);
      } else
        output.push(
          `${entry.isSymbolicLink() ? "link" : "file"}:${relative}:${
            entry.isSymbolicLink()
              ? fs.readlinkSync(absolute)
              : digestAutoMovieBytes(fs.readFileSync(absolute))
          }`,
        );
    }
  };
  visit(root);
  return output;
};

/** The resident production store enforces path, revision and ownership rules. */
export const test_mcp_production_project = (): void => {
  exerciseProductionAtomicFailureOwnership();
  let productionProjectFailure:
    | ISingleProductionProjectFixtureFailure
    | undefined;
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    TestValidator.predicate(
      "manifest and summary preserve tracked identity",
      project.manifest().formatVersion === 2 &&
        project.summary().initialized === false &&
        project.productionId === "fixture-film" &&
        project.generatedRoot() ===
          path.join(fixture.root, "generated", "fixture-film") &&
        project.renderRoot() ===
          path.join(fixture.root, "renders", "fixture-film"),
    );
    const caseAliasedRoot =
      fixture.root === fixture.root.toUpperCase()
        ? fixture.root.toLowerCase()
        : fixture.root.toUpperCase();
    TestValidator.predicate(
      "registered production discovery accepts Windows path case aliases",
      process.platform !== "win32" ||
        AutoMovieProductionProject.registeredProductionIds(
          caseAliasedRoot,
        ).includes(project.productionId),
    );
    const beforeReadOnly = snapshotTree(fixture.root);
    const readOnly = AutoMovieProductionProject.openReadOnly(
      fixture.root,
      project.productionId,
    );
    const readOnlyLint = new AutoMovieProductionCompiler(readOnly).lint({
      scope: "source",
    });
    TestValidator.predicate(
      "read-only open and lint never create, migrate, repair, or mutate state",
      typeof readOnlyLint.compiler.inputFingerprint === "string" &&
        readOnly.productionId === project.productionId &&
        throws(
          () => readOnly.setWorldDesign(fixtureWorldDesign()),
          "opened read-only",
        ) &&
        JSON.stringify(snapshotTree(fixture.root)) ===
          JSON.stringify(beforeReadOnly),
    );
    const manifestCopy = project.manifest();
    manifestCopy.generatedRoot = "caller-mutated";
    TestValidator.equals(
      "manifest callers cannot mutate resident ownership state",
      project.manifest().generatedRoot,
      "generated",
    );
    TestValidator.predicate(
      "project-level erase audit reasons cannot be blank",
      throws(() => project.eraseDesignArtifact({ kind: "world" }, " ")),
    );
    TestValidator.predicate(
      "every design target is readable",
      project.design({ kind: "production" }) !== null &&
        project.design({ kind: "model", id: "sentinel" }) !== null &&
        project.design({ kind: "world" }) !== null &&
        project.design({ kind: "formation", id: "absent" }) === null &&
        project.design({ kind: "shot", id: "opening" }) !== null &&
        project.design({ kind: "acceptance", id: "opening-beauty" }) !== null,
    );
    const stagedShot = shotContract();
    stagedShot.reviewFrames[0]!.id = "replacement-apex";
    const stagedDependencyBreak = project.setShotContract(stagedShot);
    TestValidator.predicate(
      "one-artifact setters accept an orderable dependency migration but expose its new downstream blockers",
      stagedDependencyBreak.accepted &&
        stagedDependencyBreak.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "design-downstream-invalidated" &&
            diagnostic.category === "warning" &&
            diagnostic.target.startsWith("acceptance:"),
        ) &&
        new AutoMovieProductionCompiler(project).lint({ scope: "design" })
          .success === false,
    );
    const unrelatedDuringMigration = project.setWorldDesign(worldDesign());
    TestValidator.predicate(
      "an unrelated setter does not claim a pre-existing migration blocker as its consequence",
      unrelatedDuringMigration.accepted &&
        unrelatedDuringMigration.diagnostics.every(
          (diagnostic) => diagnostic.code !== "design-downstream-invalidated",
        ),
    );
    TestValidator.predicate(
      "restoring the upstream contract clears the staged dependency break",
      project.setShotContract(shotContract()).accepted &&
        new AutoMovieProductionCompiler(project).lint({ scope: "design" })
          .success,
    );
    TestValidator.predicate(
      "source ownership rejects absolute, external and non-TypeScript paths",
      throws(() => project.resolveSourcePath(path.resolve("outside.ts"))) &&
        throws(() => project.resolveSourcePath("../outside.ts")) &&
        throws(() => project.resolveSourcePath("outside/source.ts")) &&
        throws(() => project.resolveSourcePath("src/not-source.json")) &&
        throws(() => project.readSource("src/missing.ts")),
    );
    const outsideSource = path.join(fixture.root, "outside-source");
    const sourceJunction = path.join(fixture.root, "src/junction");
    fs.mkdirSync(outsideSource, { recursive: true });
    fs.writeFileSync(path.join(outsideSource, "escape.ts"), "export {};\n");
    fs.symlinkSync(outsideSource, sourceJunction, "junction");
    TestValidator.predicate(
      "source realpaths cannot escape through a directory junction",
      throws(() => project.readSource("src/junction/escape.ts")),
    );
    fs.rmSync(sourceJunction);
    fs.rmSync(outsideSource, { recursive: true });

    const sourceReadRelative = shotContract().source.module;
    const sourceReadPath = project.resolveSourcePath(sourceReadRelative);
    const sourceReadParked = `${sourceReadPath}.parked`;
    const sourceReadBefore = fs.readFileSync(sourceReadPath);
    const nativeSourceRead = fs.readFileSync;
    let sourcePathRead = false;
    fs.readFileSync = ((
      target: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      if (
        typeof target !== "number" &&
        path.resolve(target.toString()) === path.resolve(sourceReadPath)
      ) {
        sourcePathRead = true;
        fs.renameSync(sourceReadPath, sourceReadParked);
        fs.writeFileSync(sourceReadPath, "export const transient = true;\n");
        try {
          return Reflect.apply(nativeSourceRead, fs, [target, ...args]);
        } finally {
          fs.rmSync(sourceReadPath);
          fs.renameSync(sourceReadParked, sourceReadPath);
        }
      }
      return Reflect.apply(nativeSourceRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    let sourceReadBytes: Uint8Array = new Uint8Array();
    try {
      sourceReadBytes = project.readSource(sourceReadRelative);
    } finally {
      fs.readFileSync = nativeSourceRead;
      if (fs.existsSync(sourceReadParked)) {
        fs.rmSync(sourceReadPath, { force: true });
        fs.renameSync(sourceReadParked, sourceReadPath);
      }
    }
    TestValidator.predicate(
      "source reads bind bytes to the verified descriptor across a pathname swap",
      sourcePathRead === false &&
        Buffer.from(sourceReadBytes).equals(sourceReadBefore),
    );

    const projectManifestPath = path.join(
      fixture.root,
      ".automovie/manifest.json",
    );
    const trackedRevisionPath = path.join(
      fixture.root,
      ".automovie/productions/fixture-film/revision.json",
    );
    const stateReadResidents = new Map([
      [projectManifestPath, fs.readFileSync(projectManifestPath)],
      [trackedRevisionPath, fs.readFileSync(trackedRevisionPath)],
    ]);
    const expectedRevision = (
      JSON.parse(stateReadResidents.get(trackedRevisionPath)!.toString()) as {
        revision: number;
      }
    ).revision;
    const statePathReads = new Set<string>();
    const nativeStateRead = fs.readFileSync;
    fs.readFileSync = ((
      target: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      const resolved =
        typeof target === "number" ? null : path.resolve(target.toString());
      const resident =
        resolved === null ? undefined : stateReadResidents.get(resolved);
      if (resolved !== null && resident !== undefined) {
        statePathReads.add(resolved);
        const parked = `${resolved}.parked`;
        fs.renameSync(resolved, parked);
        fs.writeFileSync(
          resolved,
          resolved === trackedRevisionPath
            ? JSON.stringify({ revision: expectedRevision + 1 })
            : "transient replacement",
        );
        try {
          return Reflect.apply(nativeStateRead, fs, [target, ...args]);
        } finally {
          fs.rmSync(resolved);
          fs.renameSync(parked, resolved);
        }
      }
      return Reflect.apply(nativeStateRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    let projectStateManifest: Uint8Array = new Uint8Array();
    let trackedRevision: Uint8Array = new Uint8Array();
    let currentRevision = -1;
    try {
      projectStateManifest = project.projectStateRecords().manifest;
      trackedRevision = project.readTrackedStateFile("revision.json")!;
      currentRevision = project.revision();
    } finally {
      fs.readFileSync = nativeStateRead;
      for (const file of stateReadResidents.keys()) {
        const parked = `${file}.parked`;
        if (fs.existsSync(parked)) {
          fs.rmSync(file, { force: true });
          fs.renameSync(parked, file);
        }
      }
    }
    TestValidator.predicate(
      "state reads bind raw records and JSON to verified descriptors across pathname swaps",
      statePathReads.size === 0 &&
        Buffer.from(projectStateManifest).equals(
          stateReadResidents.get(projectManifestPath)!,
        ) &&
        Buffer.from(trackedRevision).equals(
          stateReadResidents.get(trackedRevisionPath)!,
        ) &&
        currentRevision === expectedRevision,
    );

    const invalidSchema = project.setModelRecipe(
      {} as ReturnType<typeof modelRecipe>,
    );
    const invalidGraph = project.setModelRecipe({
      ...modelRecipe(),
      parameters: { ...modelRecipe().parameters, height: 99 },
    });
    const invalidReference = project.setFormationDesign({
      ...formationDesign(),
      id: "missing-model-formation",
      modelRecipe: "absent",
    });
    const caseCollision = project.setModelRecipe({
      ...modelRecipe(),
      id: "SENTINEL",
    });
    const nonCanonicalSources = [
      "/src/shots/opening.ts",
      "C:/src/shots/opening.ts",
      "src\\shots\\opening.ts",
      "src/../shots/opening.ts",
      "../outside.ts",
      "C:src/shots/opening.ts",
      "src/shots/",
      "src/shots/opening.js",
    ].map((module, index) =>
      project.setShotContract({
        ...shotContract(),
        id: `non-canonical-source-${index}`,
        source: {
          ...shotContract().source,
          module,
        },
      }),
    );
    const sourceCaseCollision = project.setShotContract({
      ...shotContract(),
      id: "source-case-collision",
      source: {
        ...shotContract().source,
        module: "SRC/shots/opening.ts",
      },
    });
    TestValidator.predicate(
      "setter rejects both schema and graph errors before writing",
      invalidSchema.accepted === false &&
        invalidSchema.diagnostics[0]?.code === "design-schema-invalid" &&
        invalidGraph.accepted === false &&
        invalidGraph.diagnostics.some(
          (item) => item.code === "model-parameter-invalid",
        ) &&
        invalidReference.diagnostics.some(
          (item) => item.code === "design-reference-missing",
        ) &&
        caseCollision.accepted === false &&
        caseCollision.diagnostics[0]?.code === "design-id-collision" &&
        nonCanonicalSources.every((mutation) =>
          mutation.diagnostics.some(
            (item) => item.code === "design-source-path-invalid",
          ),
        ) &&
        sourceCaseCollision.diagnostics.some(
          (item) => item.code === "design-source-path-collision",
        ),
    );
    const boundedFormationCount =
      Math.floor(AUTOMOVIE_MAX_FORMATION_MEMBERS / 2) + 1;
    const boundedFormation = formationDesign({
      kind: "line",
      ranks: 1,
      files: boundedFormationCount,
      spacing: { lateral: 0.8, depth: 0.9 },
    });
    const firstBoundedFormation = project.setFormationDesign({
      ...boundedFormation,
      id: "bounded-a",
      count: boundedFormationCount,
    });
    const aggregateOverflow = project.setFormationDesign({
      ...boundedFormation,
      id: "bounded-b",
      count: boundedFormationCount,
    });
    TestValidator.predicate(
      "formation setters hard-refuse a graph-wide explicit-slot overflow",
      firstBoundedFormation.accepted &&
        aggregateOverflow.accepted === false &&
        aggregateOverflow.diagnostics.some(
          (item) =>
            item.code === "design-range-invalid" &&
            item.target === "formations",
        ) &&
        project.eraseDesignArtifact({
          kind: "formation",
          id: "bounded-a",
        }).accepted,
    );
    TestValidator.predicate(
      "missing design erase is explicit",
      project.eraseDesignArtifact({
        kind: "formation",
        id: "absent",
      }).diagnostics[0]?.code === "design-missing",
    );
    TestValidator.predicate(
      "shot acceptance references block erasure",
      project
        .eraseDesignArtifact({
          kind: "shot",
          id: "opening",
        })
        .diagnostics.some((item) => item.code === "design-reference-active"),
    );
    const filmAcceptance = {
      id: "film-opening-beauty",
      target: { kind: "film" as const, id: "fixture-film" },
      criterion: {
        kind: "frame" as const,
        shot: "opening",
        frame: "signal-apex",
        pass: "beauty" as const,
        expectation: "The film retains the opening signal frame.",
      },
      required: true,
    };
    const filmEventAcceptance = {
      id: "film-opening-event",
      target: { kind: "film" as const, id: "fixture-film" },
      criterion: {
        kind: "event" as const,
        shot: "opening",
        event: "signal-raised",
        expectation: "The opening signal event remains in the film.",
      },
      required: true,
    };
    TestValidator.predicate(
      "film-scoped criteria are real shot and production references",
      project.setAcceptanceScenario(filmAcceptance).accepted &&
        project.setAcceptanceScenario(filmEventAcceptance).accepted &&
        project
          .eraseDesignArtifact({ kind: "shot", id: "opening" })
          .diagnostics.some((diagnostic) =>
            diagnostic.message.includes("acceptance:film-opening-beauty"),
          ) &&
        project
          .eraseDesignArtifact({ kind: "production" })
          .diagnostics.some((diagnostic) =>
            diagnostic.message.includes("acceptance:film-opening-beauty"),
          ),
    );
    TestValidator.predicate(
      "temporary film acceptances erase without a cascade",
      project.eraseDesignArtifact({
        kind: "acceptance",
        id: filmAcceptance.id,
      }).accepted &&
        project.eraseDesignArtifact({
          kind: "acceptance",
          id: filmEventAcceptance.id,
        }).accepted,
    );
    TestValidator.predicate(
      "shot frame clocks retain the singleton production design",
      project
        .eraseDesignArtifact({ kind: "production" })
        .diagnostics.some((diagnostic) =>
          diagnostic.message.includes("shot:opening"),
        ),
    );
    const landmarkShot = shotContract();
    landmarkShot.opening[0]!.predicates.push({
      kind: "position",
      subject: { kind: "landmark", id: "signal-ground" },
      axis: "x",
      operator: "==",
      value: 0,
      tolerance: 0,
    });
    project.setShotContract(landmarkShot);
    TestValidator.predicate(
      "shot predicates retain the world that owns their landmark selectors",
      project
        .eraseDesignArtifact({ kind: "world" })
        .diagnostics.some((diagnostic) =>
          diagnostic.message.includes("shot:opening"),
        ),
    );
    landmarkShot.opening[0]!.predicates = [
      {
        kind: "position",
        subject: { kind: "point", position: { x: 0, y: 0, z: 0 } },
        axis: "x",
        operator: "==",
        value: 0,
        tolerance: 0,
      },
      {
        kind: "distance",
        from: { kind: "point", position: { x: 0, y: 0, z: 0 } },
        to: { kind: "landmark", id: "signal-ground" },
        operator: "==",
        value: 0,
        tolerance: 0,
      },
    ];
    project.setShotContract(landmarkShot);
    const landmarkAsDistanceDestination = project.eraseDesignArtifact({
      kind: "world",
    });
    landmarkShot.opening[0]!.predicates = [
      {
        kind: "distance",
        from: { kind: "landmark", id: "signal-ground" },
        to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
        operator: "==",
        value: 0,
        tolerance: 0,
      },
    ];
    project.setShotContract(landmarkShot);
    TestValidator.predicate(
      "both distance operands preserve their referenced landmark world",
      landmarkAsDistanceDestination.accepted === false &&
        project.eraseDesignArtifact({ kind: "world" }).accepted === false,
    );
    project.setShotContract(shotContract());
    const standaloneModel = {
      ...modelRecipe(),
      id: "standalone",
      lod: [
        {
          tier: "hero" as const,
          maxDistance: null,
          recipe: "standalone",
        },
      ],
    };
    TestValidator.predicate(
      "a model's self LOD does not make the model impossible to erase",
      project.setModelRecipe(standaloneModel).accepted &&
        project.eraseDesignArtifact({
          kind: "model",
          id: standaloneModel.id,
        }).accepted,
    );
    project.setFormationDesign(formationDesign());
    const dependentModel = {
      ...modelRecipe(),
      id: "sentinel-variant",
      lod: [
        { tier: "hero" as const, maxDistance: 10, recipe: "sentinel" },
        {
          tier: "far" as const,
          maxDistance: null,
          recipe: "sentinel-variant",
        },
      ],
    };
    const dependentModelMutation = project.setModelRecipe(dependentModel);
    const transitiveDependentModel = {
      ...modelRecipe(),
      id: "sentinel-variant-far",
      lod: [
        {
          tier: "hero" as const,
          maxDistance: 10,
          recipe: "sentinel-variant",
        },
        {
          tier: "far" as const,
          maxDistance: null,
          recipe: "sentinel-variant-far",
        },
      ],
    };
    const transitiveDependentMutation = project.setModelRecipe(
      transitiveDependentModel,
    );
    let cyclicDependencyTraversal = false;
    let dependencyCycleFailure:
      | ISingleProductionProjectFixtureFailure
      | undefined;
    const dependencyCycleFixture = productionFixture();
    try {
      const modelRoot = path.join(
        dependencyCycleFixture.root,
        ".automovie/design/models",
      );
      fs.writeFileSync(
        path.join(modelRoot, "cycle-a.json"),
        JSON.stringify({
          ...modelRecipe(),
          id: "cycle-a",
          lod: [
            {
              tier: "hero",
              maxDistance: null,
              recipe: "cycle-b",
            },
          ],
        }),
      );
      fs.writeFileSync(
        path.join(modelRoot, "cycle-b.json"),
        JSON.stringify({
          ...modelRecipe(),
          id: "cycle-b",
          lod: [
            {
              tier: "hero",
              maxDistance: null,
              recipe: "cycle-a",
            },
          ],
        }),
      );
      fs.writeFileSync(
        path.join(modelRoot, "missing-lod.json"),
        JSON.stringify({
          ...modelRecipe(),
          id: "missing-lod",
          lod: [
            {
              tier: "hero",
              maxDistance: null,
              recipe: "absent",
            },
          ],
        }),
      );
      AutoMovieProductionProject.open(
        dependencyCycleFixture.root,
      ).eraseDesignArtifact({
        kind: "model",
        id: "sentinel",
      });
      cyclicDependencyTraversal = true;
    } catch (error) {
      dependencyCycleFailure = { error };
      throw error;
    } finally {
      preserveSingleProductionProjectFixtureCleanup(
        dependencyCycleFailure,
        () => dependencyCycleFixture.dispose(),
      );
    }
    const refusedModelErase = project.eraseDesignArtifact({
      kind: "model",
      id: "sentinel",
    });
    TestValidator.predicate(
      "model consequences and erasure include dependent LOD models and formations",
      cyclicDependencyTraversal &&
        dependentModelMutation.accepted &&
        transitiveDependentMutation.accepted &&
        refusedModelErase.consequences.staleReviews.some(
          (target) =>
            target.kind === "design" &&
            target.design.kind === "model" &&
            target.design.id === "sentinel-variant",
        ) &&
        refusedModelErase.consequences.staleReviews.some(
          (target) =>
            target.kind === "design" &&
            target.design.kind === "model" &&
            target.design.id === "sentinel-variant-far",
        ) &&
        refusedModelErase.diagnostics.some(
          (item) =>
            item.message.includes("model:sentinel-variant") ||
            item.message.includes("formation:line"),
        ),
    );
    project.setShotContract({
      ...shotContract(),
      participants: [{ kind: "formation", id: "line" }],
    });
    TestValidator.predicate(
      "formation references block erasure",
      project
        .eraseDesignArtifact({
          kind: "formation",
          id: "line",
        })
        .diagnostics.some((item) => item.code === "design-reference-active"),
    );
    const secondShotMutation = project.setShotContract({
      ...shotContract(),
      id: "second",
      beat: "second",
    });
    const acceptanceMutation = project.setAcceptanceScenario(
      acceptanceScenarios()[0]!,
    );
    TestValidator.predicate(
      "mutation consequences follow target-local shot and review dependencies",
      secondShotMutation.accepted &&
        secondShotMutation.consequences.staleRenders.includes("shot:second") &&
        secondShotMutation.consequences.staleRenders.includes(
          "shot:opening",
        ) === false &&
        acceptanceMutation.accepted &&
        acceptanceMutation.consequences.staleRenders.length === 0 &&
        acceptanceMutation.consequences.staleReviews.some(
          (target) => target.kind === "shot" && target.id === "opening",
        ) &&
        acceptanceMutation.consequences.staleReviews.some(
          (target) => target.kind === "shot" && target.id === "second",
        ) === false &&
        secondShotMutation.consequences.staleReviews.some(
          (target) => target.kind === "sequence" && target.id === "SEQ-SIGNAL",
        ) &&
        secondShotMutation.consequences.staleReviews.some(
          (target) => target.kind === "sequence" && target.id === "SEQ-ANSWER",
        ) === false &&
        secondShotMutation.consequences.staleReviews.some(
          (target) => target.kind === "rendition",
        ) === false &&
        acceptanceMutation.consequences.staleReviews.some(
          (target) => target.kind === "sequence" && target.id === "SEQ-SIGNAL",
        ),
    );
    const refusedRepaint = project.setProductionDesign(
      productionDesign({ visualDelivery: "repainted" }),
    );
    TestValidator.predicate(
      "refused delivery mutations retain only current review targets",
      refusedRepaint.accepted === false &&
        refusedRepaint.consequences.staleReviews.some(
          (target) => target.kind === "rendition",
        ) === false,
    );
    const repaintedProduction = productionDesign({
      visualDelivery: "repainted",
    });
    repaintedProduction.deliverables = repaintedProduction.deliverables.map(
      (deliverable) => ({
        ...deliverable,
        required: deliverable.kind === "feature",
      }),
    );
    const productionMutation = project.setProductionDesign(repaintedProduction);
    const repaintedShotMutation = project.setShotContract({
      ...shotContract(),
      id: "second",
      beat: "second repaint consequence",
    });
    const movedSequenceShot = shotContract();
    movedSequenceShot.id = "second";
    movedSequenceShot.beat = "second moved sequence consequence";
    movedSequenceShot.evidence = [
      {
        reason: "This shot now realizes the screenplay's answering action.",
        scene: "SCN-002",
      },
    ];
    const movedSequenceShotMutation =
      project.setShotContract(movedSequenceShot);
    const repaintedAcceptance = acceptanceScenarios()[0]!;
    if (repaintedAcceptance.criterion.kind === "frame")
      repaintedAcceptance.criterion.expectation +=
        " The selected rendition remains readable.";
    const repaintedAcceptanceMutation =
      project.setAcceptanceScenario(repaintedAcceptance);
    const movedAcceptanceMutation = project.setAcceptanceScenario({
      ...repaintedAcceptance,
      target: { kind: "shot", id: "second" },
    });
    const restoredAcceptanceMutation =
      project.setAcceptanceScenario(repaintedAcceptance);
    const modelMutation = project.setModelRecipe(modelRecipe());
    const formationMutation = project.setFormationDesign({
      ...formationDesign(),
      facingDeg: 1,
    });
    const worldMutation = project.setWorldDesign(worldDesign());
    TestValidator.predicate(
      "mutation consequences identify exact sequence and rendition review dependencies",
      modelMutation.consequences.staleRenders.includes("shot:opening") &&
        modelMutation.consequences.staleRenders.includes("shot:second") &&
        worldMutation.consequences.staleReviews.some(
          (target) => target.kind === "film",
        ) &&
        productionMutation.consequences.staleRenders.length > 0 &&
        repaintedShotMutation.consequences.staleReviews.some(
          (target) => target.kind === "rendition" && target.id === "second",
        ) &&
        repaintedShotMutation.consequences.staleReviews.some(
          (target) => target.kind === "sequence" && target.id === "SEQ-SIGNAL",
        ) &&
        repaintedShotMutation.consequences.staleReviews.some(
          (target) => target.kind === "sequence" && target.id === "SEQ-ANSWER",
        ) === false &&
        movedSequenceShotMutation.consequences.staleReviews.some(
          (target) => target.kind === "sequence" && target.id === "SEQ-SIGNAL",
        ) &&
        movedSequenceShotMutation.consequences.staleReviews.some(
          (target) => target.kind === "sequence" && target.id === "SEQ-ANSWER",
        ) &&
        repaintedAcceptanceMutation.consequences.staleReviews.some(
          (target) => target.kind === "rendition" && target.id === "opening",
        ) &&
        movedAcceptanceMutation.consequences.staleReviews.some(
          (target) => target.kind === "shot" && target.id === "opening",
        ) &&
        movedAcceptanceMutation.consequences.staleReviews.some(
          (target) => target.kind === "shot" && target.id === "second",
        ) &&
        movedAcceptanceMutation.consequences.staleReviews.some(
          (target) => target.kind === "rendition" && target.id === "opening",
        ) &&
        movedAcceptanceMutation.consequences.staleReviews.some(
          (target) => target.kind === "rendition" && target.id === "second",
        ) &&
        movedAcceptanceMutation.consequences.staleReviews.some(
          (target) => target.kind === "sequence" && target.id === "SEQ-SIGNAL",
        ) &&
        movedAcceptanceMutation.consequences.staleReviews.some(
          (target) => target.kind === "sequence" && target.id === "SEQ-ANSWER",
        ) &&
        restoredAcceptanceMutation.accepted &&
        modelMutation.consequences.staleReviews.some(
          (target) => target.kind === "rendition" && target.id === "opening",
        ) &&
        formationMutation.consequences.staleReviews.some(
          (target) => target.kind === "rendition" && target.id === "opening",
        ) &&
        worldMutation.consequences.staleReviews.some(
          (target) => target.kind === "sequence" && target.id === "SEQ-SIGNAL",
        ) &&
        project.setProductionDesign(productionDesign()).accepted &&
        project.eraseDesignArtifact({
          kind: "shot",
          id: "second",
        }).accepted,
    );
    const movedReviewKeys =
      movedSequenceShotMutation.consequences.staleReviews.map((target) =>
        JSON.stringify(target),
      );
    TestValidator.equals(
      "merged review consequences remain unique and code-unit sorted",
      movedReviewKeys,
      [...new Set(movedReviewKeys)].sort(compareCodeUnits),
    );
    project.setShotContract(shotContract());
    TestValidator.predicate(
      "unreferenced formation erases",
      project.eraseDesignArtifact({
        kind: "formation",
        id: "line",
      }).accepted,
    );

    const first = AutoMovieProductionProject.open(fixture.root);
    const stale = AutoMovieProductionProject.open(fixture.root);
    const staleRevision = stale.revision();
    const concurrentDesign = productionDesign({
      title: "fixture-film concurrent revision",
    });
    const concurrentMutation = first.setProductionDesign(concurrentDesign);
    TestValidator.predicate(
      "optimistic revision rejects stale resident writers",
      concurrentMutation.accepted &&
        concurrentMutation.revision > staleRevision &&
        throws(
          () => stale.setProductionDesign(productionDesign()),
          "Production revision changed",
        ),
    );
    const staleEraser = AutoMovieProductionProject.open(fixture.root);
    const staleEraseRevision = staleEraser.revision();
    const removableFormation = {
      ...formationDesign(),
      id: "stale-erase",
    };
    const formationAddition = first.setFormationDesign(removableFormation);
    TestValidator.predicate(
      "optimistic revision rejects stale resident erasers",
      formationAddition.accepted &&
        formationAddition.revision > staleEraseRevision &&
        throws(
          () =>
            staleEraser.eraseDesignArtifact({
              kind: "formation",
              id: removableFormation.id,
            }),
          "Production revision changed",
        ) &&
        AutoMovieProductionProject.open(fixture.root).eraseDesignArtifact({
          kind: "formation",
          id: removableFormation.id,
        }).accepted,
    );

    const compiler = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    );
    const compiled = compiler.compile({ scope: "source" });
    TestValidator.predicate(
      "project compiler fixture",
      productionCompileSucceeded("project compiler fixture", compiled),
    );
    const generatedReadPath = path.join(
      project.generatedRoot(),
      "shots/opening.json",
    );
    const generatedReadParked = `${generatedReadPath}.parked`;
    const generatedReadBefore = fs.readFileSync(generatedReadPath);
    const nativeGeneratedRead = fs.readFileSync;
    let generatedPathRead = false;
    fs.readFileSync = ((
      target: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      if (
        typeof target !== "number" &&
        path.resolve(target.toString()) === path.resolve(generatedReadPath)
      ) {
        generatedPathRead = true;
        fs.renameSync(generatedReadPath, generatedReadParked);
        fs.writeFileSync(generatedReadPath, "transient replacement");
        try {
          return Reflect.apply(nativeGeneratedRead, fs, [target, ...args]);
        } finally {
          fs.rmSync(generatedReadPath);
          fs.renameSync(generatedReadParked, generatedReadPath);
        }
      }
      return Reflect.apply(nativeGeneratedRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    let generatedReadBytes: Uint8Array = new Uint8Array();
    try {
      generatedReadBytes = project.readGeneratedFile("shots/opening.json");
    } finally {
      fs.readFileSync = nativeGeneratedRead;
      if (fs.existsSync(generatedReadParked)) {
        fs.rmSync(generatedReadPath, { force: true });
        fs.renameSync(generatedReadParked, generatedReadPath);
      }
    }
    TestValidator.predicate(
      "generated reads bind bytes to the verified descriptor across a pathname swap",
      generatedPathRead === false &&
        Buffer.from(generatedReadBytes).equals(generatedReadBefore),
    );
    const linkedGenerated = productionFixture();
    let outsideGenerated: string | undefined;
    let linkedGeneratedFailure: IProductionProjectFixtureFailure | undefined;
    try {
      outsideGenerated = fs.mkdtempSync(
        path.join(os.tmpdir(), "automovie-generated-outside-"),
      );
      const linkedProject = AutoMovieProductionProject.open(
        linkedGenerated.root,
      );
      const linkedCompiler = new AutoMovieProductionCompiler(linkedProject);
      TestValidator.predicate(
        "linked generated fixture compiles",
        productionCompileSucceeded(
          "linked generated fixture",
          linkedCompiler.compile({ scope: "source" }),
        ),
      );
      const shotsRoot = path.join(linkedProject.generatedRoot(), "shots");
      fs.copyFileSync(
        path.join(shotsRoot, "opening.json"),
        path.join(outsideGenerated, "opening.json"),
      );
      fs.rmSync(shotsRoot, { force: true, recursive: true });
      fs.symlinkSync(outsideGenerated, shotsRoot, "junction");
      const unsafeGenerated = linkedCompiler.lint({ scope: "source" });
      TestValidator.predicate(
        "generated reads and compiler ownership refuse a nested junction",
        throws(() => linkedProject.readGeneratedFile("shots/opening.json")) &&
          throws(() => linkedProject.readGeneratedFile("shots")) &&
          throws(() => linkedProject.readGeneratedFile("contracts")) &&
          unsafeGenerated.diagnostics.some(
            (item) => item.code === "generated-path-outside",
          ),
      );
    } catch (error) {
      linkedGeneratedFailure = { error };
      throw error;
    } finally {
      const completedOutsideGenerated = outsideGenerated;
      preserveProductionProjectFixtureCleanup(linkedGeneratedFailure, [
        {
          resource: "linked-generated production fixture",
          cleanup: () => linkedGenerated.dispose(),
        },
        ...(completedOutsideGenerated === undefined
          ? []
          : [
              {
                resource: "linked-generated outside root",
                cleanup: () =>
                  fs.rmSync(completedOutsideGenerated, {
                    force: true,
                    recursive: true,
                  }),
              },
            ]),
      ]);
    }
    const linkedState = productionFixture();
    let outsideState: string | undefined;
    let linkedStateFailure: IProductionProjectFixtureFailure | undefined;
    try {
      outsideState = fs.mkdtempSync(
        path.join(os.tmpdir(), "automovie-state-outside-"),
      );
      const stateProject = AutoMovieProductionProject.open(linkedState.root);
      const modelRoot = path.join(
        linkedState.root,
        ".automovie/design/shared/models",
      );
      fs.copyFileSync(
        path.join(modelRoot, "sentinel.json"),
        path.join(outsideState, "sentinel.json"),
      );
      fs.rmSync(modelRoot, { force: true, recursive: true });
      fs.symlinkSync(outsideState, modelRoot, "junction");
      TestValidator.predicate(
        "tracked design reads refuse a nested state junction",
        throws(() => stateProject.graph()),
      );
    } catch (error) {
      linkedStateFailure = { error };
      throw error;
    } finally {
      const completedOutsideState = outsideState;
      preserveProductionProjectFixtureCleanup(linkedStateFailure, [
        {
          resource: "linked-state production fixture",
          cleanup: () => linkedState.dispose(),
        },
        ...(completedOutsideState === undefined
          ? []
          : [
              {
                resource: "linked-state outside root",
                cleanup: () =>
                  fs.rmSync(completedOutsideState, {
                    force: true,
                    recursive: true,
                  }),
              },
            ]),
      ]);
    }
    const linkedStateFile = productionFixture();
    let outsideStateFile: string | undefined;
    let linkedStateFileFailure: IProductionProjectFixtureFailure | undefined;
    try {
      outsideStateFile = fs.mkdtempSync(
        path.join(os.tmpdir(), "automovie-state-file-outside-"),
      );
      const stateProject = AutoMovieProductionProject.open(
        linkedStateFile.root,
      );
      fs.symlinkSync(
        outsideStateFile,
        path.join(
          linkedStateFile.root,
          ".automovie/design/shared/models/unsafe.json",
        ),
        "junction",
      );
      TestValidator.predicate(
        "tracked keyed design refuses a symbolic JSON entry",
        throws(() => stateProject.graph()),
      );
    } catch (error) {
      linkedStateFileFailure = { error };
      throw error;
    } finally {
      const completedOutsideStateFile = outsideStateFile;
      preserveProductionProjectFixtureCleanup(linkedStateFileFailure, [
        {
          resource: "linked-state-file production fixture",
          cleanup: () => linkedStateFile.dispose(),
        },
        ...(completedOutsideStateFile === undefined
          ? []
          : [
              {
                resource: "linked-state-file outside root",
                cleanup: () =>
                  fs.rmSync(completedOutsideStateFile, {
                    force: true,
                    recursive: true,
                  }),
              },
            ]),
      ]);
    }
    const ownerProject = AutoMovieProductionProject.open(fixture.root);
    TestValidator.predicate(
      "missing keyed design reads are explicit",
      ownerProject.design({ kind: "shot", id: "absent" }) === null &&
        ownerProject.design({ kind: "acceptance", id: "absent" }) === null,
    );
    const oldManifest = ownerProject.generatedManifest()!;
    const retained = oldManifest.files.filter((entry) =>
      entry.path.startsWith("contracts/"),
    );
    const retainedBytes = new Map(
      retained.map((entry) => [
        entry.path,
        fs.readFileSync(path.join(ownerProject.generatedRoot(), entry.path)),
      ]),
    );
    const smaller: IAutoMovieGeneratedManifest = {
      ...oldManifest,
      files: retained,
    };
    ownerProject.commitGenerated(retainedBytes, smaller);
    const stableGeneratedRevision = ownerProject.revision();
    const generatedManifestPath = path.join(
      fixture.root,
      ".automovie/productions/fixture-film/generated-manifest.json",
    );
    const generatedManifestBefore = fs.readFileSync(generatedManifestPath);
    const generatedManifestParked = `${generatedManifestPath}.read-parked`;
    const nativeGeneratedManifestRead = fs.readFileSync;
    let generatedManifestPathRead = false;
    fs.readFileSync = ((
      target: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      if (
        typeof target !== "number" &&
        path.resolve(target.toString()) === path.resolve(generatedManifestPath)
      ) {
        generatedManifestPathRead = true;
        fs.renameSync(generatedManifestPath, generatedManifestParked);
        fs.writeFileSync(generatedManifestPath, "transient generated manifest");
        try {
          return Reflect.apply(nativeGeneratedManifestRead, fs, [
            target,
            ...args,
          ]);
        } finally {
          fs.rmSync(generatedManifestPath);
          fs.renameSync(generatedManifestParked, generatedManifestPath);
        }
      }
      return Reflect.apply(nativeGeneratedManifestRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    let stableGeneratedCommitRejected = false;
    let repeatedGeneratedRevision = -1;
    try {
      repeatedGeneratedRevision = ownerProject.commitGenerated(
        retainedBytes,
        smaller,
      );
    } catch {
      stableGeneratedCommitRejected = true;
    } finally {
      fs.readFileSync = nativeGeneratedManifestRead;
      if (fs.existsSync(generatedManifestParked)) {
        fs.rmSync(generatedManifestPath, { force: true });
        fs.renameSync(generatedManifestParked, generatedManifestPath);
      }
    }
    TestValidator.predicate(
      "generated manifest guards bind exact bytes to descriptors",
      stableGeneratedCommitRejected === false &&
        generatedManifestPathRead === false &&
        repeatedGeneratedRevision === stableGeneratedRevision &&
        ownerProject.revision() === stableGeneratedRevision &&
        nativeGeneratedManifestRead(generatedManifestPath).equals(
          generatedManifestBefore,
        ),
    );
    TestValidator.predicate(
      "generated commit deletes formerly declared stale files",
      fs.existsSync(
        path.join(ownerProject.generatedRoot(), "shots/opening.json"),
      ) === false,
    );
    TestValidator.predicate(
      "generated and render writes cannot escape owned roots",
      throws(() =>
        ownerProject.commitGenerated(
          new Map([["../escape", Buffer.from("x")]]),
          oldManifest,
        ),
      ) &&
        throws(() =>
          ownerProject.commitRenderBundle("../escape", new Map(), {
            version: 3,
            target: { kind: "shot", id: "opening" },
            compileFingerprint: oldManifest.inputFingerprint,
            rendererIdentity: testRendererIdentity(),
            targetFingerprint: productionRenderTargetFingerprint(
              ownerProject,
              oldManifest,
              { kind: "shot", id: "opening" },
            ),
            renderSpec: {
              target: "opening",
              frameFormat: { width: 1, height: 1, fps: 1 },
              toneMapping: "none",
              codec: "h264",
              pixelFormat: "yuv420p",
              crf: 17,
            },
            frames: [],
          }),
        ),
    );

    const renderImage = new PNG({ width: 1, height: 1 });
    renderImage.data.fill(200);
    const renderImageBytes = PNG.sync.write(renderImage);
    const renderManifest: IAutoMovieRenderBundleManifest = {
      version: 3,
      target: { kind: "shot", id: "opening" },
      compileFingerprint: oldManifest.inputFingerprint,
      rendererIdentity: testRendererIdentity(),
      targetFingerprint: productionRenderTargetFingerprint(
        ownerProject,
        oldManifest,
        { kind: "shot", id: "opening" },
      ),
      renderSpec: {
        target: "opening",
        frameFormat: { width: 1, height: 1, fps: 1 },
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
          path: "frame.png",
          digest: digestAutoMovieBytes(renderImageBytes),
          width: 1,
          height: 1,
        },
      ],
    };
    const renderBundle = productionRenderBundleRelativePath(renderManifest);
    const blankRendererRefused = throws(() =>
      ownerProject.commitRenderBundle(renderBundle, new Map(), {
        ...renderManifest,
        rendererIdentity: " ",
      }),
    );
    const revision = ownerProject.commitRenderBundle(
      renderBundle,
      new Map([
        ["frame.bin", Buffer.from("frame")],
        ["frame.png", renderImageBytes],
      ]),
      renderManifest,
    );
    TestValidator.predicate(
      "render bundle commits bytes and manifest atomically",
      blankRendererRefused &&
        revision > 0 &&
        fs.existsSync(
          path.join(ownerProject.renderRoot(), renderBundle, "manifest.json"),
        ),
    );
    let inputGuardReads = 0;
    const guardedRevision = ownerProject.revision();
    const guardedCommitRefused = throws(() =>
      ownerProject.commitRenderBundle(
        renderBundle,
        new Map([
          ["frame.bin", Buffer.from("guarded-change")],
          ["frame.png", renderImageBytes],
        ]),
        renderManifest,
        () => inputGuardReads++ === 0,
      ),
    );
    TestValidator.predicate(
      "guarded render commit rolls back when inputs change during apply",
      guardedCommitRefused &&
        inputGuardReads === 2 &&
        ownerProject.revision() === guardedRevision &&
        fs
          .readFileSync(
            path.join(ownerProject.renderRoot(), renderBundle, "frame.bin"),
          )
          .equals(Buffer.from("frame")),
    );
    const renderFramePath = path.join(
      ownerProject.renderRoot(),
      renderBundle,
      "frame.bin",
    );
    const renderManifestPath = path.join(
      ownerProject.renderRoot(),
      renderBundle,
      "manifest.json",
    );
    TestValidator.predicate(
      "render manifest is bound to its MCP-owned receipt",
      ownerProject.verifiedRenderManifest(renderManifestPath) !== null,
    );
    const renderImagePath = path.join(
      ownerProject.renderRoot(),
      renderBundle,
      "frame.png",
    );
    fs.writeFileSync(renderImagePath, Buffer.from("tampered"));
    const tamperedRenderFrame =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    fs.writeFileSync(renderImagePath, renderImageBytes);
    fs.rmSync(renderImagePath);
    const missingRenderFrame =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    fs.writeFileSync(renderImagePath, renderImageBytes);
    TestValidator.predicate(
      "manifest ownership includes every declared frame's current PNG bytes",
      tamperedRenderFrame === null && missingRenderFrame === null,
    );
    const renderReceiptDirectory = path.join(
      fixture.root,
      ".automovie/productions/fixture-film/render-receipts",
    );
    const renderReceiptPath = path.join(
      renderReceiptDirectory,
      fs.readdirSync(renderReceiptDirectory)[0]!,
    );
    const renderManifestBytes = fs.readFileSync(renderManifestPath);
    const renderReceiptBytes = fs.readFileSync(renderReceiptPath);
    const writeOwnedRenderManifest = (
      manifest: IAutoMovieRenderBundleManifest,
    ): void => {
      const serialized = Buffer.from(`${JSON.stringify(manifest)}\n`);
      fs.writeFileSync(renderManifestPath, serialized);
      fs.writeFileSync(
        renderReceiptPath,
        `${JSON.stringify({
          version: 1,
          bundle: renderBundle,
          manifestDigest: digestAutoMovieBytes(serialized),
        })}\n`,
      );
    };
    writeOwnedRenderManifest({
      ...renderManifest,
      rendererIdentity: " ",
    });
    const blankOwnedRenderer =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    writeOwnedRenderManifest({
      ...renderManifest,
      frames: [renderManifest.frames[0]!, renderManifest.frames[0]!],
    });
    const duplicateRenderFrame =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    writeOwnedRenderManifest({
      ...renderManifest,
      frames: [{ ...renderManifest.frames[0]!, width: 2 }],
    });
    const mismatchedRenderWidth =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    writeOwnedRenderManifest({
      ...renderManifest,
      frames: [{ ...renderManifest.frames[0]!, height: 2 }],
    });
    const mismatchedRenderHeight =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    fs.writeFileSync(renderManifestPath, renderManifestBytes);
    fs.writeFileSync(renderReceiptPath, renderReceiptBytes);
    TestValidator.predicate(
      "render verification rejects duplicate frame ownership and false raster metadata",
      blankOwnedRenderer === null &&
        duplicateRenderFrame === null &&
        mismatchedRenderWidth === null &&
        mismatchedRenderHeight === null,
    );
    const nonCanonicalManifest = path.join(
      ownerProject.renderRoot(),
      "non-canonical",
      "manifest.json",
    );
    fs.mkdirSync(path.dirname(nonCanonicalManifest), { recursive: true });
    fs.writeFileSync(nonCanonicalManifest, renderManifestBytes);
    TestValidator.predicate(
      "render verification refuses absent, non-file, external and non-canonical manifests",
      ownerProject.verifiedRenderManifest(
        path.join(ownerProject.renderRoot(), "absent.json"),
      ) === null &&
        ownerProject.verifiedRenderManifest(ownerProject.renderRoot()) ===
          null &&
        ownerProject.verifiedRenderManifest(
          path.join(fixture.root, "package.json"),
        ) === null &&
        ownerProject.verifiedRenderManifest(nonCanonicalManifest) === null,
    );
    fs.writeFileSync(renderManifestPath, "{}");
    const invalidRenderManifest =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    fs.writeFileSync(renderManifestPath, "{bad");
    const malformedRenderManifest =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    fs.writeFileSync(renderManifestPath, renderManifestBytes);
    fs.rmSync(renderReceiptPath);
    const missingRenderReceipt =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    for (const receipt of [
      { version: 0, bundle: renderBundle, manifestDigest: "sha256:bad" },
      {
        version: 1,
        bundle: "wrong-bundle",
        manifestDigest: digestAutoMovieBytes(renderManifestBytes),
      },
      { version: 1, bundle: renderBundle, manifestDigest: "sha256:bad" },
    ]) {
      fs.writeFileSync(renderReceiptPath, JSON.stringify(receipt));
      TestValidator.equals(
        "render verification rejects a mismatched receipt field",
        ownerProject.verifiedRenderManifest(renderManifestPath),
        null,
      );
    }
    fs.writeFileSync(renderReceiptPath, "{bad");
    const malformedRenderReceipt =
      ownerProject.verifiedRenderManifest(renderManifestPath);
    fs.writeFileSync(renderReceiptPath, renderReceiptBytes);
    TestValidator.predicate(
      "render verification validates manifest schema, JSON and receipt ownership",
      invalidRenderManifest === null &&
        malformedRenderManifest === null &&
        missingRenderReceipt === null &&
        malformedRenderReceipt === null &&
        ownerProject.verifiedRenderManifest(renderManifestPath) !== null,
    );
    TestValidator.predicate(
      "render reads reject absent paths and directories",
      throws(() => ownerProject.readRenderFile("absent.bin")) &&
        throws(() => ownerProject.readRenderFile(renderBundle)),
    );
    const outsideRenderRead = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-render-read-"),
    );
    const renderReadJunction = path.join(
      ownerProject.renderRoot(),
      "read-junction",
    );
    fs.writeFileSync(path.join(outsideRenderRead, "escape.bin"), "escape");
    fs.writeFileSync(path.join(outsideRenderRead, "frame.bin"), "outside");
    fs.symlinkSync(outsideRenderRead, renderReadJunction, "junction");
    TestValidator.predicate(
      "render reads reject nested junction escapes",
      throws(() => ownerProject.readRenderFile("read-junction/escape.bin")),
    );
    fs.rmSync(renderReadJunction);
    const renderFileLink = path.join(
      ownerProject.renderRoot(),
      "read-file-link.bin",
    );
    fs.symlinkSync(
      path.join(outsideRenderRead, "escape.bin"),
      renderFileLink,
      "file",
    );
    const renderParentFile = path.join(
      ownerProject.renderRoot(),
      "read-parent-file",
    );
    fs.writeFileSync(renderParentFile, "not a directory");
    TestValidator.predicate(
      "render reads reject linked files and non-directory ancestry",
      throws(() => ownerProject.readRenderFile("read-file-link.bin")) &&
        throws(() =>
          ownerProject.readRenderFile("read-parent-file/escape.bin"),
        ),
    );
    fs.unlinkSync(renderFileLink);
    fs.rmSync(renderParentFile);

    const crossApiIdentityFile = path.join(
      ownerProject.renderRoot(),
      "read-cross-api-identity.bin",
    );
    fs.writeFileSync(crossApiIdentityFile, "resident");
    const nativeCrossApiStat = fs.statSync;
    const mutableCrossApiStatFs = fs as { statSync: typeof fs.statSync };
    let divergentPathIdentityObserved = false;
    mutableCrossApiStatFs.statSync = ((
      target: fs.PathLike,
      ...args: unknown[]
    ): unknown => {
      const status = Reflect.apply(nativeCrossApiStat, fs, [
        target,
        ...args,
      ]) as fs.Stats | fs.BigIntStats;
      if (
        path.resolve(target.toString()) === path.resolve(crossApiIdentityFile)
      ) {
        divergentPathIdentityObserved = true;
        return {
          ...status,
          ino:
            typeof status.ino === "bigint"
              ? status.ino + BigInt(1)
              : status.ino + 1,
        };
      }
      return status;
    }) as typeof fs.statSync;
    let crossApiIdentityRead = "";
    try {
      fs.statSync(crossApiIdentityFile, { bigint: true });
      crossApiIdentityRead = Buffer.from(
        ownerProject.readRenderFile("read-cross-api-identity.bin"),
      ).toString("utf8");
    } finally {
      mutableCrossApiStatFs.statSync = nativeCrossApiStat;
      fs.rmSync(crossApiIdentityFile);
    }
    TestValidator.predicate(
      "render reads compare descriptor identities within one platform API domain",
      divergentPathIdentityObserved && crossApiIdentityRead === "resident",
    );

    const descriptorCleanupFile = path.join(
      ownerProject.renderRoot(),
      "read-descriptor-cleanup.bin",
    );
    fs.writeFileSync(descriptorCleanupFile, "resident");
    exerciseRenderFileDescriptorCleanup(
      ownerProject,
      path.relative(ownerProject.renderRoot(), descriptorCleanupFile),
    );
    fs.rmSync(descriptorCleanupFile);

    const descriptorRace = (
      replacement: "directory" | "regular" | "symlink",
    ): boolean => {
      const directory = path.join(
        ownerProject.renderRoot(),
        `read-descriptor-${replacement}`,
      );
      const file = path.join(directory, "frame.bin");
      const parked = `${file}.parked`;
      fs.mkdirSync(directory);
      fs.writeFileSync(file, "resident");
      const nativeOpen = fs.openSync;
      let swapped = false;
      fs.openSync = ((target: fs.PathLike, ...args: unknown[]): number => {
        const descriptor = Reflect.apply(nativeOpen, fs, [target, ...args]);
        if (
          swapped === false &&
          path.resolve(target.toString()) === path.resolve(file)
        ) {
          fs.renameSync(file, parked);
          if (replacement === "directory") fs.mkdirSync(file);
          else if (replacement === "regular")
            fs.writeFileSync(file, "replacement");
          else
            fs.symlinkSync(
              path.join(outsideRenderRead, "escape.bin"),
              file,
              "file",
            );
          swapped = true;
        }
        return descriptor;
      }) as typeof fs.openSync;
      let rejected = false;
      try {
        rejected = throws(() =>
          ownerProject.readRenderFile(
            path.relative(ownerProject.renderRoot(), file),
          ),
        );
      } finally {
        fs.openSync = nativeOpen;
        if (fs.lstatSync(file).isSymbolicLink()) fs.unlinkSync(file);
        else fs.rmSync(file, { recursive: true, force: true });
        fs.renameSync(parked, file);
        fs.rmSync(directory, { recursive: true, force: true });
      }
      return swapped && rejected;
    };
    TestValidator.predicate(
      "an opened descriptor cannot bless a replaced render filename",
      descriptorRace("symlink") &&
        descriptorRace("directory") &&
        descriptorRace("regular"),
    );

    const ancestryRace = (
      replacement: "directory" | "junction" | "missing",
    ): boolean => {
      const directory = path.join(
        ownerProject.renderRoot(),
        `read-ancestry-${replacement}`,
      );
      const parked = `${directory}.parked`;
      const file = path.join(directory, "frame.bin");
      fs.mkdirSync(directory);
      fs.writeFileSync(file, "resident");
      const nativeOpen = fs.openSync;
      let swapped = false;
      fs.openSync = ((target: fs.PathLike, ...args: unknown[]): number => {
        if (
          swapped === false &&
          path.resolve(target.toString()) === path.resolve(file)
        ) {
          fs.renameSync(directory, parked);
          if (replacement === "directory") {
            fs.mkdirSync(directory);
            fs.writeFileSync(file, "replacement");
          } else if (replacement === "junction")
            fs.symlinkSync(outsideRenderRead, directory, "junction");
          swapped = true;
        }
        return Reflect.apply(nativeOpen, fs, [target, ...args]);
      }) as typeof fs.openSync;
      let rejected = false;
      try {
        rejected = throws(() =>
          ownerProject.readRenderFile(
            path.relative(ownerProject.renderRoot(), file),
          ),
        );
      } finally {
        fs.openSync = nativeOpen;
        if (fs.existsSync(parked)) {
          if (fs.existsSync(directory)) {
            if (fs.lstatSync(directory).isSymbolicLink())
              fs.unlinkSync(directory);
            else fs.rmSync(directory, { recursive: true, force: true });
          }
          fs.renameSync(parked, directory);
        }
        fs.rmSync(directory, { recursive: true, force: true });
      }
      return swapped && rejected;
    };
    TestValidator.predicate(
      "render reads retain exact physical ancestry across descriptor acquisition",
      ancestryRace("missing") &&
        ancestryRace("junction") &&
        ancestryRace("directory"),
    );

    const afterReadDirectory = path.join(
      ownerProject.renderRoot(),
      "read-after-descriptor",
    );
    const afterReadFile = path.join(afterReadDirectory, "frame.bin");
    const afterReadParked = `${afterReadFile}.parked`;
    fs.mkdirSync(afterReadDirectory);
    fs.writeFileSync(afterReadFile, "resident");
    const nativeDescriptorRead = fs.readFileSync;
    let swappedAfterRead = false;
    fs.readFileSync = ((
      target: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      const bytes = Reflect.apply(nativeDescriptorRead, fs, [target, ...args]);
      if (swappedAfterRead === false && typeof target === "number") {
        fs.renameSync(afterReadFile, afterReadParked);
        fs.writeFileSync(afterReadFile, "replacement");
        swappedAfterRead = true;
      }
      return bytes;
    }) as typeof fs.readFileSync;
    let afterReadRejected = false;
    try {
      afterReadRejected = throws(() =>
        ownerProject.readRenderFile("read-after-descriptor/frame.bin"),
      );
    } finally {
      fs.readFileSync = nativeDescriptorRead;
      fs.rmSync(afterReadFile);
      fs.renameSync(afterReadParked, afterReadFile);
      fs.rmSync(afterReadDirectory, { recursive: true, force: true });
    }
    const deniedOpenFile = path.join(
      ownerProject.renderRoot(),
      "read-open-denied.bin",
    );
    fs.writeFileSync(deniedOpenFile, "resident");
    const nativeDeniedOpen = fs.openSync;
    fs.openSync = ((target: fs.PathLike, ...args: unknown[]): number => {
      if (path.resolve(target.toString()) === path.resolve(deniedOpenFile)) {
        const error = new Error("injected render open denial");
        Object.assign(error, { code: "EACCES" });
        throw error;
      }
      return Reflect.apply(nativeDeniedOpen, fs, [target, ...args]);
    }) as typeof fs.openSync;
    let deniedOpenRejected = false;
    try {
      deniedOpenRejected = throws(() =>
        ownerProject.readRenderFile("read-open-denied.bin"),
      );
    } finally {
      fs.openSync = nativeDeniedOpen;
      fs.rmSync(deniedOpenFile);
    }
    TestValidator.predicate(
      "render reads revalidate after descriptor I/O and preserve non-absence errors",
      swappedAfterRead && afterReadRejected && deniedOpenRejected,
    );
    fs.rmSync(outsideRenderRead, { force: true, recursive: true });
    const deliverableFiles = ownerProject.commitProductionDeliverableFiles(
      "feature*CON",
      new Map([
        ["z.bin", Buffer.from("z")],
        ["nested/a.bin", Buffer.from("a")],
      ]),
    );
    TestValidator.predicate(
      "deliverable commits are nonempty, sorted and renderer-owned",
      deliverableFiles.paths[0]?.endsWith("nested/a.bin") === true &&
        deliverableFiles.paths[1]?.endsWith("z.bin") === true &&
        deliverableFiles.paths.every((file) =>
          fs.existsSync(path.join(ownerProject.renderRoot(), file)),
        ) &&
        throws(() =>
          ownerProject.commitProductionDeliverableFiles("empty", new Map()),
        ) &&
        throws(() =>
          ownerProject.commitProductionDeliverableFiles(
            "unsafe",
            new Map([["../escape.bin", Buffer.from("x")]]),
          ),
        ) &&
        throws(() =>
          ownerProject.commitProductionDeliverableFiles(
            "duplicate",
            new Map([
              ["nested/../same.bin", Buffer.from("first")],
              ["same.bin", Buffer.from("second")],
            ]),
          ),
        ) &&
        throws(() =>
          ownerProject.commitProductionDeliverableFiles(
            "case-collision",
            new Map([
              ["Frame.bin", Buffer.from("first")],
              ["frame.bin", Buffer.from("second")],
            ]),
          ),
        ),
    );
    TestValidator.predicate(
      "aggregate render commit validates its public schema",
      throws(() => ownerProject.commitProductionRenderManifest({} as never)),
    );
    const frameBeforeFailure = fs.readFileSync(renderFramePath);
    const manifestBeforeFailure = fs.readFileSync(renderManifestPath);
    const revisionBeforeFailure = ownerProject.revision();
    const nativeRollbackRead = fs.readFileSync;
    const rollbackReadParked = `${renderFramePath}.rollback-read-parked`;
    let rollbackPathRead = false;
    fs.readFileSync = ((
      target: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      if (
        typeof target !== "number" &&
        path.resolve(target.toString()) === path.resolve(renderFramePath)
      ) {
        rollbackPathRead = true;
        fs.renameSync(renderFramePath, rollbackReadParked);
        fs.writeFileSync(renderFramePath, "transient rollback baseline");
        try {
          return Reflect.apply(nativeRollbackRead, fs, [target, ...args]);
        } finally {
          fs.rmSync(renderFramePath);
          fs.renameSync(rollbackReadParked, renderFramePath);
        }
      }
      return Reflect.apply(nativeRollbackRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    const renameSync = fs.renameSync;
    fs.renameSync = ((oldPath, newPath) => {
      if (String(newPath) === renderManifestPath)
        throw new Error("injected manifest rename failure");
      return renameSync(oldPath, newPath);
    }) as typeof fs.renameSync;
    try {
      TestValidator.predicate(
        "multi-file commit rolls back updated and newly created files",
        throws(() =>
          ownerProject.commitRenderBundle(
            renderBundle,
            new Map([
              ["frame.bin", Buffer.from("changed")],
              ["new.bin", Buffer.from("new")],
            ]),
            renderManifest,
          ),
        ) &&
          rollbackPathRead === false &&
          nativeRollbackRead(renderFramePath).equals(frameBeforeFailure) &&
          nativeRollbackRead(renderManifestPath).equals(
            manifestBeforeFailure,
          ) &&
          fs.existsSync(
            path.join(ownerProject.renderRoot(), renderBundle, "new.bin"),
          ) === false &&
          ownerProject.revision() === revisionBeforeFailure,
      );
    } finally {
      fs.renameSync = renameSync;
      fs.readFileSync = nativeRollbackRead;
      if (fs.existsSync(rollbackReadParked)) {
        fs.rmSync(renderFramePath, { force: true });
        fs.renameSync(rollbackReadParked, renderFramePath);
      }
    }
    let renameFailures = 0;
    fs.renameSync = ((oldPath, newPath) => {
      const target = String(newPath);
      if (
        (renameFailures === 0 && target === renderManifestPath) ||
        (renameFailures === 1 && target === renderFramePath)
      ) {
        ++renameFailures;
        throw new Error(`injected rename failure ${renameFailures}`);
      }
      return renameSync(oldPath, newPath);
    }) as typeof fs.renameSync;
    try {
      let aggregate = false;
      try {
        ownerProject.commitRenderBundle(
          renderBundle,
          new Map([["frame.bin", Buffer.from("changed-again")]]),
          renderManifest,
        );
      } catch (error) {
        aggregate = error instanceof AggregateError;
      }
      TestValidator.predicate(
        "rollback failure is surfaced as an aggregate instead of hidden",
        aggregate && ownerProject.revision() === revisionBeforeFailure,
      );
    } finally {
      fs.renameSync = renameSync;
      fs.writeFileSync(renderFramePath, frameBeforeFailure);
      fs.writeFileSync(renderManifestPath, manifestBeforeFailure);
    }
    fs.rmSync(renderFramePath);
    const outsideRenderTarget = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-render-target-"),
    );
    fs.symlinkSync(outsideRenderTarget, renderFramePath, "junction");
    TestValidator.predicate(
      "commit target cannot be replaced through a symlink or junction",
      throws(() =>
        ownerProject.commitRenderBundle(
          renderBundle,
          new Map([["frame.bin", Buffer.from("unsafe")]]),
          renderManifest,
        ),
      ),
    );
    fs.rmSync(renderFramePath, { force: true, recursive: true });
    fs.rmSync(outsideRenderTarget, { force: true, recursive: true });
    const lstatSync = fs.lstatSync;
    Object.defineProperty(fs, "lstatSync", {
      configurable: true,
      value: ((filePath: fs.PathLike, options?: unknown) => {
        if (String(filePath).endsWith("denied.json")) {
          const error = new Error(
            "injected lstat denial",
          ) as NodeJS.ErrnoException;
          error.code = "EACCES";
          throw error;
        }
        return lstatSync(filePath, options as never);
      }) as typeof fs.lstatSync,
    });
    try {
      TestValidator.predicate(
        "non-missing lstat errors are not hidden as absent files",
        throws(() => ownerProject.readTrackedStateFile("denied.json")),
      );
    } finally {
      Object.defineProperty(fs, "lstatSync", {
        configurable: true,
        value: lstatSync,
      });
    }
    TestValidator.predicate(
      "all review target paths are owned and encoded",
      [
        { kind: "design" as const, design: { kind: "production" as const } },
        { kind: "design" as const, design: { kind: "world" as const } },
        {
          kind: "design" as const,
          design: { kind: "formation" as const, id: "line/name" },
        },
        { kind: "source" as const, path: "src/shots/opening.ts" },
        { kind: "shot" as const, id: "opening" },
        { kind: "film" as const, id: "fixture-film" },
      ].every((target) =>
        ownerProject
          .reviewPath(target)
          .startsWith(path.join(fixture.root, ".automovie/reviews")),
      ),
    );
    TestValidator.predicate(
      "blank encoded review identity is rejected",
      throws(() =>
        ownerProject.reviewPath({
          kind: "shot",
          id: " ",
        }),
      ),
    );
    const stored: IAutoMovieStoredReview = {
      version: 1,
      target: { kind: "source", path: "src/shots/opening.ts" },
      fingerprint: oldManifest.inputFingerprint,
      observations: "stored",
      checks: [],
      corrections: [],
      completionBasis: "stored",
      complete: false,
    };
    ownerProject.commitReview(stored);
    TestValidator.equals(
      "stored review round-trip",
      ownerProject.review(stored.target),
      stored,
    );
    TestValidator.equals(
      "missing review returns null",
      ownerProject.review({ kind: "shot", id: "absent" }),
      null,
    );
    TestValidator.predicate(
      "digest helper remains usable for owned bytes",
      digestAutoMovieBytes(Buffer.from("frame")).startsWith("sha256:"),
    );

    const modelDirectory = path.join(
      fixture.root,
      ".automovie/design/shared/models",
    );
    const encodedDuplicate = path.join(modelDirectory, "%73entinel.json");
    fs.writeFileSync(encodedDuplicate, JSON.stringify(modelRecipe()));
    TestValidator.predicate(
      "distinct filenames cannot decode to one design id",
      throws(() => ownerProject.graph()),
    );
    fs.rmSync(encodedDuplicate);
    const kelvin = { ...modelRecipe(), id: "K" };
    const lowerK = { ...modelRecipe(), id: "k" };
    fs.writeFileSync(
      path.join(modelDirectory, `${encodeURIComponent(kelvin.id)}.json`),
      JSON.stringify(kelvin),
    );
    fs.writeFileSync(
      path.join(modelDirectory, `${encodeURIComponent(lowerK.id)}.json`),
      JSON.stringify(lowerK),
    );
    TestValidator.predicate(
      "case-folding collisions are rejected even with distinct filenames",
      throws(() => ownerProject.graph()),
    );
    fs.rmSync(
      path.join(modelDirectory, `${encodeURIComponent(kelvin.id)}.json`),
    );
    fs.rmSync(
      path.join(modelDirectory, `${encodeURIComponent(lowerK.id)}.json`),
    );
    const vanished = path.join(modelDirectory, "vanished.json");
    fs.writeFileSync(
      vanished,
      JSON.stringify({ ...modelRecipe(), id: "vanished" }),
    );
    const residentReadFileSync = fs.readFileSync;
    fs.readFileSync = ((file: fs.PathOrFileDescriptor, ...args: unknown[]) => {
      if (path.resolve(String(file)) === path.resolve(vanished))
        fs.rmSync(vanished, { force: true });
      return (residentReadFileSync as (...parameters: unknown[]) => unknown)(
        file,
        ...args,
      );
    }) as typeof fs.readFileSync;
    try {
      TestValidator.predicate(
        "a design disappearing during inventory is a loud race",
        throws(() => ownerProject.graph()),
      );
    } finally {
      fs.readFileSync = residentReadFileSync;
    }
    const invalidTyped = path.join(modelDirectory, "invalid.json");
    fs.writeFileSync(invalidTyped, "null");
    TestValidator.predicate(
      "present JSON null is invalid typed design rather than absence",
      throws(() => ownerProject.graph()),
    );
    fs.rmSync(invalidTyped);
  } catch (error) {
    productionProjectFailure = { error };
    throw error;
  } finally {
    preserveSingleProductionProjectFixtureCleanup(
      productionProjectFailure,
      () => fixture.dispose(),
    );
  }

  let contentFixtureFailure: ISingleProductionProjectFixtureFailure | undefined;
  const contentFixture = productionFixture();
  try {
    const manifestPath = path.join(
      contentFixture.root,
      ".automovie/manifest.json",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        ...manifest,
        contentRoots: ["viewer", "src"],
        contentFiles: ["automovie.config.ts", "missing-content.file"],
      }),
    );
    const contentProject = AutoMovieProductionProject.open(contentFixture.root);
    const inputs = contentProject.contentInputs();
    TestValidator.predicate(
      "declared content roots and files enter deterministic compilation identity",
      inputs.some(
        (input) => input.path === "viewer/src/main.ts" && input.bytes !== null,
      ) &&
        inputs.some(
          (input) =>
            input.path === "automovie.config.ts" && input.bytes !== null,
        ) &&
        inputs.some(
          (input) =>
            input.path === "missing-content.file" && input.bytes === null,
        ) &&
        inputs.some(
          (input) =>
            input.path === ".automovie/assets.json" &&
            input.bytes !== null &&
            input.source === false &&
            input.render === false,
        ) &&
        inputs.some(
          (input) =>
            input.path === "src/shots/opening.ts" &&
            input.source &&
            input.render,
        ),
    );
    const contentReadResidents = new Map(
      (
        [
          ["viewer/src/main.ts", "viewer/src/main.ts"],
          ["automovie.config.ts", "automovie.config.ts"],
          [".automovie/assets.json", ".automovie/assets.json"],
        ] as const
      ).map(([file, relative]) => {
        const absolute = fs.realpathSync(path.join(contentFixture.root, file));
        return [
          absolute,
          { relative, bytes: fs.readFileSync(absolute) },
        ] as const;
      }),
    );
    const contentPathReads = new Set<string>();
    const nativeContentRead = fs.readFileSync;
    fs.readFileSync = ((
      target: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      const resolved =
        typeof target === "number" ? null : path.resolve(target.toString());
      const resident =
        resolved === null ? undefined : contentReadResidents.get(resolved);
      if (resolved !== null && resident !== undefined) {
        contentPathReads.add(resolved);
        const parked = `${resolved}.parked`;
        fs.renameSync(resolved, parked);
        fs.writeFileSync(resolved, "transient content bytes");
        try {
          return Reflect.apply(nativeContentRead, fs, [target, ...args]);
        } finally {
          fs.rmSync(resolved);
          fs.renameSync(parked, resolved);
        }
      }
      return Reflect.apply(nativeContentRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    let boundContentInputs: ReturnType<
      AutoMovieProductionProject["contentInputs"]
    > = [];
    try {
      boundContentInputs = contentProject.contentInputs();
    } finally {
      fs.readFileSync = nativeContentRead;
      for (const file of contentReadResidents.keys()) {
        const parked = `${file}.parked`;
        if (fs.existsSync(parked)) {
          fs.rmSync(file, { force: true });
          fs.renameSync(parked, file);
        }
      }
    }
    TestValidator.predicate(
      "declared content reads bind rooted, direct, and asset bytes to verified descriptors",
      contentPathReads.size === 0 &&
        [...contentReadResidents.values()].every((resident) => {
          const input = boundContentInputs.find(
            (candidate) => candidate.path === resident.relative,
          );
          return (
            input?.bytes !== null &&
            input?.bytes !== undefined &&
            Buffer.from(input.bytes).equals(resident.bytes)
          );
        }),
    );
    const outsideContent = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-content-junction-"),
    );
    const nestedContentJunction = path.join(
      contentFixture.root,
      "viewer",
      "linked",
    );
    fs.writeFileSync(path.join(outsideContent, "escape.ts"), "export {};\n");
    fs.symlinkSync(outsideContent, nestedContentJunction, "junction");
    TestValidator.predicate(
      "declared content inventory refuses nested junctions",
      throws(() => contentProject.contentInputs()),
    );
    fs.rmSync(nestedContentJunction);
    fs.rmSync(outsideContent, { force: true, recursive: true });
    const racedOutside = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-content-race-"),
    );
    const racedOutsideFile = path.join(racedOutside, "outside.ts");
    fs.writeFileSync(racedOutsideFile, "export {};\n");
    const viewerRoot = path.join(contentFixture.root, "viewer");
    const viewerFile = path.join(viewerRoot, "src/main.ts");
    const residentRealpathSync = fs.realpathSync;
    const withRacedRealpath = (
      select: (absolute: string, occurrence: number) => string | null,
    ): boolean => {
      const occurrences = new Map<string, number>();
      Reflect.set(
        fs,
        "realpathSync",
        (candidate: fs.PathLike, ...args: unknown[]) => {
          const absolute = path.resolve(String(candidate));
          const occurrence = (occurrences.get(absolute) ?? 0) + 1;
          occurrences.set(absolute, occurrence);
          const replacement = select(absolute, occurrence);
          return replacement === null
            ? (
                residentRealpathSync as (
                  file: fs.PathLike,
                  ...options: unknown[]
                ) => unknown
              )(candidate, ...args)
            : replacement;
        },
      );
      try {
        return throws(() => contentProject.contentInputs());
      } finally {
        Reflect.set(fs, "realpathSync", residentRealpathSync);
      }
    };
    try {
      TestValidator.predicate(
        "a content root cannot race its physical-root realpath outside the project",
        withRacedRealpath((absolute, occurrence) =>
          absolute === path.resolve(viewerRoot) && occurrence === 1
            ? racedOutside
            : null,
        ),
      );
      TestValidator.predicate(
        "a traversed content directory cannot race from its verified physical root",
        withRacedRealpath((absolute, occurrence) =>
          absolute === path.resolve(viewerRoot) && occurrence === 2
            ? racedOutside
            : null,
        ),
      );
      TestValidator.predicate(
        "a content file cannot race its lstat into an external realpath",
        withRacedRealpath((absolute) =>
          absolute === path.resolve(viewerFile) ? racedOutsideFile : null,
        ),
      );
      fs.rmSync(viewerRoot, { recursive: true });
      fs.writeFileSync(viewerRoot, "not a directory");
      TestValidator.predicate(
        "a declared content root replaced after project open is refused",
        throws(() => contentProject.contentInputs()),
      );
    } finally {
      fs.rmSync(racedOutside, { force: true, recursive: true });
    }
  } catch (error) {
    contentFixtureFailure = { error };
    throw error;
  } finally {
    preserveSingleProductionProjectFixtureCleanup(contentFixtureFailure, () =>
      contentFixture.dispose(),
    );
  }

  for (const [name, replace, expected] of [
    [
      "missing",
      (assetManifestPath: string): void => fs.rmSync(assetManifestPath),
      (inputs: ReturnType<AutoMovieProductionProject["contentInputs"]>) =>
        inputs.some(
          (input) =>
            input.path === ".automovie/assets.json" && input.bytes === null,
        ),
    ],
    [
      "directory",
      (assetManifestPath: string): void => {
        fs.rmSync(assetManifestPath);
        fs.mkdirSync(assetManifestPath);
      },
      (_inputs: ReturnType<AutoMovieProductionProject["contentInputs"]>) =>
        false,
    ],
  ] as const) {
    let assetManifestFixtureFailure:
      | ISingleProductionProjectFixtureFailure
      | undefined;
    const assetManifestFixture = productionFixture();
    try {
      const assetManifestPath = path.join(
        assetManifestFixture.root,
        ".automovie/assets.json",
      );
      replace(assetManifestPath);
      const assetManifestProject = AutoMovieProductionProject.open(
        assetManifestFixture.root,
      );
      TestValidator.predicate(
        `declared asset manifest reports ${name} physical state`,
        name === "directory"
          ? throws(() => assetManifestProject.contentInputs())
          : expected(assetManifestProject.contentInputs()),
      );
    } catch (error) {
      assetManifestFixtureFailure = { error };
      throw error;
    } finally {
      preserveSingleProductionProjectFixtureCleanup(
        assetManifestFixtureFailure,
        () => assetManifestFixture.dispose(),
      );
    }
  }

  const nestedContentFileFixture = productionFixture();
  let outsideContentFile: string | undefined;
  let nestedContentFileFailure: IProductionProjectFixtureFailure | undefined;
  try {
    outsideContentFile = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-content-file-junction-"),
    );
    fs.writeFileSync(
      path.join(outsideContentFile, "escape.ts"),
      "export {};\n",
    );
    fs.symlinkSync(
      outsideContentFile,
      path.join(nestedContentFileFixture.root, "linked-content-file"),
      "junction",
    );
    const manifestPath = path.join(
      nestedContentFileFixture.root,
      ".automovie/manifest.json",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        ...manifest,
        contentFiles: ["linked-content-file/escape.ts"],
      }),
    );
    const contentProject = AutoMovieProductionProject.open(
      nestedContentFileFixture.root,
    );
    TestValidator.predicate(
      "declared content files cannot escape through an intermediate junction",
      throws(() => contentProject.contentInputs()),
    );
  } catch (error) {
    nestedContentFileFailure = { error };
    throw error;
  } finally {
    const completedOutsideContentFile = outsideContentFile;
    preserveProductionProjectFixtureCleanup(nestedContentFileFailure, [
      {
        resource: "nested-content-file production fixture",
        cleanup: () => nestedContentFileFixture.dispose(),
      },
      ...(completedOutsideContentFile === undefined
        ? []
        : [
            {
              resource: "nested-content-file outside root",
              cleanup: () =>
                fs.rmSync(completedOutsideContentFile, {
                  force: true,
                  recursive: true,
                }),
            },
          ]),
    ]);
  }

  const parentJunctionFixture = productionFixture();
  let outsideContentRoot: string | undefined;
  let parentJunctionFailure: IProductionProjectFixtureFailure | undefined;
  try {
    outsideContentRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-content-root-junction-"),
    );
    fs.mkdirSync(path.join(outsideContentRoot, "viewer"));
    fs.writeFileSync(
      path.join(outsideContentRoot, "viewer", "escape.ts"),
      "export {};\n",
    );
    fs.symlinkSync(
      outsideContentRoot,
      path.join(parentJunctionFixture.root, "linked-content-root"),
      "junction",
    );
    const manifestPath = path.join(
      parentJunctionFixture.root,
      ".automovie/manifest.json",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        ...manifest,
        contentRoots: ["linked-content-root/viewer"],
      }),
    );
    TestValidator.predicate(
      "a declared content root cannot escape through a parent junction",
      throws(() => AutoMovieProductionProject.open(parentJunctionFixture.root)),
    );
  } catch (error) {
    parentJunctionFailure = { error };
    throw error;
  } finally {
    const completedOutsideContentRoot = outsideContentRoot;
    preserveProductionProjectFixtureCleanup(parentJunctionFailure, [
      {
        resource: "parent-junction production fixture",
        cleanup: () => parentJunctionFixture.dispose(),
      },
      ...(completedOutsideContentRoot === undefined
        ? []
        : [
            {
              resource: "parent-junction outside root",
              cleanup: () =>
                fs.rmSync(completedOutsideContentRoot, {
                  force: true,
                  recursive: true,
                }),
            },
          ]),
    ]);
  }

  for (const [name, contentRoots, contentFiles, prepare] of [
    [
      "missing-root",
      ["missing-content"],
      [],
      (_root: string): void => undefined,
    ],
    [
      "file-root",
      ["automovie.config.ts"],
      [],
      (_root: string): void => undefined,
    ],
    ["directory-file", [], ["viewer"], (_root: string): void => undefined],
    [
      "junction-file",
      [],
      ["linked-content"],
      (root: string): void => {
        fs.symlinkSync(
          path.join(root, "viewer"),
          path.join(root, "linked-content"),
          "junction",
        );
      },
    ],
  ] as const) {
    let invalidContentFailure:
      | ISingleProductionProjectFixtureFailure
      | undefined;
    const invalidContent = productionFixture();
    try {
      prepare(invalidContent.root);
      const manifestPath = path.join(
        invalidContent.root,
        ".automovie/manifest.json",
      );
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({ ...manifest, contentRoots, contentFiles }),
      );
      TestValidator.predicate(
        `declared content rejects ${name}`,
        throws(() =>
          AutoMovieProductionProject.open(invalidContent.root).contentInputs(),
        ),
      );
    } catch (error) {
      invalidContentFailure = { error };
      throw error;
    } finally {
      preserveSingleProductionProjectFixtureCleanup(invalidContentFailure, () =>
        invalidContent.dispose(),
      );
    }
  }

  let replacedOwnerFailure: ISingleProductionProjectFixtureFailure | undefined;
  const replacedOwner = productionFixture();
  try {
    const ownerProject = AutoMovieProductionProject.open(replacedOwner.root);
    const ownerRenderRoot = ownerProject.renderRoot();
    fs.rmSync(ownerRenderRoot, { recursive: true });
    fs.symlinkSync(
      path.join(replacedOwner.root, "viewer"),
      ownerRenderRoot,
      "junction",
    );
    TestValidator.predicate(
      "an owned root replaced by an internal junction cannot receive writes",
      throws(() =>
        ownerProject.commitProductionDeliverableFiles(
          "unsafe-owner",
          new Map([["frame.bin", Buffer.from("x")]]),
        ),
      ),
    );
  } catch (error) {
    replacedOwnerFailure = { error };
    throw error;
  } finally {
    preserveSingleProductionProjectFixtureCleanup(replacedOwnerFailure, () =>
      replacedOwner.dispose(),
    );
  }

  const invalidRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-production-root-"),
  );
  try {
    const fileRoot = path.join(invalidRoot, "file");
    fs.writeFileSync(fileRoot, "x");
    TestValidator.predicate(
      "project root must be a directory",
      throws(() => AutoMovieProductionProject.open(fileRoot)) &&
        throws(
          () => AutoMovieProductionProject.open(path.join(fileRoot, "child")),
          "parent",
        ),
    );
    TestValidator.predicate(
      "project root must not be a filesystem root",
      throws(() =>
        AutoMovieProductionProject.open(path.parse(invalidRoot).root),
      ),
    );
    const fresh = path.join(invalidRoot, "fresh");
    const initialized = AutoMovieProductionProject.open(fresh);
    TestValidator.predicate(
      "fresh project initializes format and directories",
      initialized.summary().initialized &&
        initialized.revision() === 0 &&
        initialized.inventory().production === false &&
        initialized.contentInputs().length === 0,
    );
    const nativeWriteForExistingRoot = fs.writeFileSync;
    let attemptedParentSiblingLock = false;
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      if (
        typeof file !== "number" &&
        path.dirname(path.resolve(file.toString())) ===
          fs.realpathSync(invalidRoot) &&
        path.basename(file.toString()).includes("fresh.automovie-root")
      ) {
        attemptedParentSiblingLock = true;
        const error = new Error("parent is intentionally not writable");
        Object.assign(error, { code: "EACCES" });
        throw error;
      }
      Reflect.apply(nativeWriteForExistingRoot, fs, [file, ...args]);
    }) as typeof fs.writeFileSync;
    try {
      TestValidator.predicate(
        "an existing writable project does not require writable parent access",
        AutoMovieProductionProject.open(fresh).root ===
          fs.realpathSync(fresh) && attemptedParentSiblingLock === false,
      );
    } finally {
      fs.writeFileSync = nativeWriteForExistingRoot;
    }
    const nestedFresh = path.join(invalidRoot, "missing", "nested", "project");
    TestValidator.predicate(
      "fresh project recursively creates a missing nested root",
      AutoMovieProductionProject.open(nestedFresh).root === nestedFresh &&
        fs.existsSync(path.join(nestedFresh, ".automovie/incarnation.json")),
    );
    const physicalAliasParent = path.join(invalidRoot, "physical-alias-parent");
    const aliasParent = path.join(invalidRoot, "alias-parent");
    fs.mkdirSync(physicalAliasParent);
    fs.symlinkSync(physicalAliasParent, aliasParent, "junction");
    const aliasProject = path.join(aliasParent, "aliased-project");
    const nativeWriteForAlias = fs.writeFileSync;
    const aliasLockPaths: string[] = [];
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      Reflect.apply(nativeWriteForAlias, fs, [file, ...args]);
      if (
        typeof file !== "number" &&
        file.toString().includes("automovie-root")
      )
        aliasLockPaths.push(path.resolve(file.toString()));
    }) as typeof fs.writeFileSync;
    try {
      AutoMovieProductionProject.open(aliasProject);
    } finally {
      fs.writeFileSync = nativeWriteForAlias;
    }
    TestValidator.predicate(
      "ancestor aliases create through the physical parent then hold the project-owned namespace",
      aliasLockPaths.filter((file) => path.basename(file).startsWith("create-"))
        .length === 2 &&
        aliasLockPaths.filter((file) => path.basename(file).startsWith("root-"))
          .length === 2 &&
        aliasLockPaths.every(
          (file) =>
            path.basename(path.dirname(file)) === ".automovie-root-locks",
        ) &&
        fs
          .readdirSync(fs.realpathSync(physicalAliasParent))
          .every((entry) => entry.includes("automovie-root") === false) &&
        fs
          .readdirSync(fs.realpathSync(aliasProject))
          .every((entry) => entry.includes("automovie-root") === false),
    );
    const alternateAliasParent = path.join(
      invalidRoot,
      "alternate-alias-parent",
    );
    fs.mkdirSync(path.join(alternateAliasParent, "aliased-project"), {
      recursive: true,
    });
    const nativeWriteForRequestedSwap = fs.writeFileSync;
    let requestedRootLocks = 0;
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      Reflect.apply(nativeWriteForRequestedSwap, fs, [file, ...args]);
      if (
        typeof file !== "number" &&
        path.basename(file.toString()).startsWith("root-") &&
        ++requestedRootLocks === 2
      ) {
        fs.rmSync(aliasParent);
        fs.symlinkSync(alternateAliasParent, aliasParent, "junction");
      }
    }) as typeof fs.writeFileSync;
    let requestedSwapRejected = false;
    try {
      requestedSwapRejected = throws(
        () => acquireProductionRootNamespace(aliasProject),
        "changed physical identity",
      );
    } finally {
      fs.writeFileSync = nativeWriteForRequestedSwap;
      fs.rmSync(aliasParent);
      fs.symlinkSync(physicalAliasParent, aliasParent, "junction");
    }
    TestValidator.predicate(
      "a requested alias swapped after physical lock acquisition is rejected",
      requestedSwapRejected && requestedRootLocks === 2,
    );
    const filesystemRoot = path.parse(invalidRoot).root;
    const nativeLstatForMissingBase = fs.lstatSync;
    const mutableLstatFs = fs as { lstatSync: typeof fs.lstatSync };
    mutableLstatFs.lstatSync = ((
      file: fs.PathLike,
      ...args: unknown[]
    ): fs.Stats | fs.BigIntStats => {
      if (path.resolve(file.toString()) === path.resolve(filesystemRoot)) {
        const error = new Error(
          "injected absent filesystem base",
        ) as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return Reflect.apply(nativeLstatForMissingBase, fs, [file, ...args]) as
        | fs.Stats
        | fs.BigIntStats;
    }) as typeof fs.lstatSync;
    try {
      TestValidator.predicate(
        "a recursively absent filesystem base is rejected without unbounded parent walking",
        throws(
          () =>
            AutoMovieProductionProject.open(
              path.join(filesystemRoot, "automovie-absent-base", "project"),
            ),
          "does not exist as a physical directory",
        ),
      );
    } finally {
      mutableLstatFs.lstatSync = nativeLstatForMissingBase;
    }
    const collidingParent = path.join(invalidRoot, "colliding-parent");
    const collidingParentProject = path.join(collidingParent, "project");
    const nativeWriteForParentCollision = fs.writeFileSync;
    let parentCollisionLocks = 0;
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      Reflect.apply(nativeWriteForParentCollision, fs, [file, ...args]);
      if (
        typeof file !== "number" &&
        path.basename(file.toString()).startsWith("create-") &&
        ++parentCollisionLocks === 2
      )
        Reflect.apply(nativeWriteForParentCollision, fs, [
          collidingParent,
          "collision",
        ]);
    }) as typeof fs.writeFileSync;
    let parentCollisionRejected = false;
    try {
      parentCollisionRejected = throws(
        () => AutoMovieProductionProject.open(collidingParentProject),
        "parent",
      );
    } finally {
      fs.writeFileSync = nativeWriteForParentCollision;
    }
    TestValidator.predicate(
      "a missing parent replaced by a file while creation locks are held is rejected",
      parentCollisionRejected &&
        parentCollisionLocks === 2 &&
        fs.existsSync(collidingParentProject) === false,
    );
    fs.rmSync(collidingParent, { force: true });
    const collidingRoot = path.join(invalidRoot, "colliding-root");
    const nativeWriteForRootCollision = fs.writeFileSync;
    let rootCollisionLocks = 0;
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      Reflect.apply(nativeWriteForRootCollision, fs, [file, ...args]);
      if (
        typeof file !== "number" &&
        path.basename(file.toString()).startsWith("create-") &&
        ++rootCollisionLocks === 2
      )
        Reflect.apply(nativeWriteForRootCollision, fs, [
          collidingRoot,
          "collision",
        ]);
    }) as typeof fs.writeFileSync;
    let rootCollisionRejected = false;
    try {
      rootCollisionRejected = throws(
        () => AutoMovieProductionProject.open(collidingRoot),
        "root",
      );
    } finally {
      fs.writeFileSync = nativeWriteForRootCollision;
    }
    TestValidator.predicate(
      "a missing project root replaced by a file while creation locks are held is rejected",
      rootCollisionRejected &&
        rootCollisionLocks === 2 &&
        fs.readFileSync(collidingRoot, "utf8") === "collision",
    );
    fs.rmSync(collidingRoot, { force: true });
    const createdPhysicalParent = path.join(
      invalidRoot,
      "created-physical-parent",
    );
    const createdAlternateParent = path.join(
      invalidRoot,
      "created-alternate-parent",
    );
    const createdAliasParent = path.join(invalidRoot, "created-alias-parent");
    fs.mkdirSync(createdPhysicalParent);
    fs.mkdirSync(createdAlternateParent);
    fs.symlinkSync(createdPhysicalParent, createdAliasParent, "junction");
    const createdAliasProject = path.join(createdAliasParent, "project");
    const nativeWriteForCreatedAlias = fs.writeFileSync;
    const createdAliasLocks: string[] = [];
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      Reflect.apply(nativeWriteForCreatedAlias, fs, [file, ...args]);
      if (
        typeof file !== "number" &&
        path.basename(file.toString()).startsWith("root-")
      ) {
        createdAliasLocks.push(path.resolve(file.toString()));
        if (createdAliasLocks.length === 2) {
          fs.rmSync(createdAliasParent);
          fs.symlinkSync(
            createdAlternateParent,
            createdAliasParent,
            "junction",
          );
        }
      }
    }) as typeof fs.writeFileSync;
    let createdAliasRejected = false;
    try {
      createdAliasRejected = throws(
        () => AutoMovieProductionProject.open(createdAliasProject),
        "changed physical identity",
      );
    } finally {
      fs.writeFileSync = nativeWriteForCreatedAlias;
      fs.rmSync(createdAliasParent);
      fs.symlinkSync(createdPhysicalParent, createdAliasParent, "junction");
    }
    TestValidator.predicate(
      "a newly created physical root releases its lease when the requested alias changes afterward",
      createdAliasRejected &&
        createdAliasLocks.length === 2 &&
        createdAliasLocks.every((file) => fs.existsSync(file) === false) &&
        fs.existsSync(path.join(createdAlternateParent, "project")) === false,
    );
    const coordinationRoot = path.dirname(aliasLockPaths[0]!);
    const assertionLease = acquireProductionRootNamespace(aliasProject);
    const assertedFence = assertionLease.locks[0]!;
    const assertedFenceParked = `${assertedFence.path}.read-parked`;
    const nativeFenceRead = fs.readFileSync;
    let fencePathRead = false;
    let fenceAssertionSucceeded = false;
    fs.readFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === path.resolve(assertedFence.path)
      ) {
        fencePathRead = true;
        fs.renameSync(assertedFence.path, assertedFenceParked);
        fs.writeFileSync(assertedFence.path, assertedFence.token);
        try {
          return Reflect.apply(nativeFenceRead, fs, [file, ...args]);
        } finally {
          fs.rmSync(assertedFence.path);
          fs.renameSync(assertedFenceParked, assertedFence.path);
        }
      }
      return Reflect.apply(nativeFenceRead, fs, [file, ...args]);
    }) as typeof fs.readFileSync;
    try {
      assertProductionRootNamespaceLease(assertionLease);
      fenceAssertionSucceeded = true;
    } finally {
      fs.readFileSync = nativeFenceRead;
      if (fs.existsSync(assertedFenceParked)) {
        fs.rmSync(assertedFence.path, { force: true });
        fs.renameSync(assertedFenceParked, assertedFence.path);
      }
      releaseProductionRootNamespace(assertionLease);
    }
    TestValidator.predicate(
      "root namespace assertions bind fence tokens to descriptors",
      fenceAssertionSucceeded && fencePathRead === false,
    );
    // A guarded commit runs the read-only compiler gate, which commits its own
    // snapshot, so one process reaches the same root coordinate twice. That is
    // a nested operation rather than a second session, and blocking it makes
    // the process time out against itself.
    const reentrantLocks: string[] = [];
    const nativeWriteForReentrancy = fs.writeFileSync;
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      Reflect.apply(nativeWriteForReentrancy, fs, [file, ...args]);
      if (
        typeof file !== "number" &&
        path.dirname(file.toString()) === coordinationRoot &&
        path.basename(file.toString()).startsWith("root-")
      )
        reentrantLocks.push(path.resolve(file.toString()));
    }) as typeof fs.writeFileSync;
    let outerLease: ReturnType<typeof acquireProductionRootNamespace>;
    let innerLease: ReturnType<typeof acquireProductionRootNamespace>;
    try {
      outerLease = acquireProductionRootNamespace(aliasProject);
      innerLease = acquireProductionRootNamespace(aliasProject);
    } finally {
      fs.writeFileSync = nativeWriteForReentrancy;
    }
    const heldAfterInnerRelease = ((): boolean => {
      releaseProductionRootNamespace(innerLease);
      return reentrantLocks.every((file) => fs.existsSync(file));
    })();
    releaseProductionRootNamespace(outerLease);
    TestValidator.equals(
      "one process reaches the same root coordinate twice without deadlocking",
      {
        coordinates: reentrantLocks.length,
        sharedTokens: outerLease.locks.every(
          (lock, index) => lock.token === innerLease.locks[index]?.token,
        ),
        heldAfterInnerRelease,
        releasedAfterOuterRelease: reentrantLocks.every(
          (file) => fs.existsSync(file) === false,
        ),
      },
      {
        coordinates: 2,
        sharedTokens: true,
        heldAfterInnerRelease: true,
        releasedAfterOuterRelease: true,
      },
    );
    const swappedParent = path.join(invalidRoot, "swapped-parent");
    const originalParent = path.join(invalidRoot, "original-parent");
    fs.mkdirSync(swappedParent);
    const swappedProject = path.join(swappedParent, "project");
    const swapLockPaths: string[] = [];
    let parentSwapped = false;
    const nativeWriteForParentSwap = fs.writeFileSync;
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      Reflect.apply(nativeWriteForParentSwap, fs, [file, ...args]);
      if (
        parentSwapped === false &&
        typeof file !== "number" &&
        path.basename(file.toString()).startsWith("create-")
      ) {
        swapLockPaths.push(path.resolve(file.toString()));
        if (swapLockPaths.length === 2) {
          parentSwapped = true;
          fs.renameSync(swappedParent, originalParent);
          fs.mkdirSync(swappedParent);
        }
      }
    }) as typeof fs.writeFileSync;
    let parentSwapRejected = false;
    try {
      parentSwapRejected = throws(
        () => AutoMovieProductionProject.open(swappedProject),
        "changed physical identity",
      );
    } finally {
      fs.writeFileSync = nativeWriteForParentSwap;
    }
    TestValidator.predicate(
      "a parent replaced while creation fences are acquired is rejected before either tree receives a child",
      parentSwapRejected &&
        fs.existsSync(swappedProject) === false &&
        fs.existsSync(path.join(originalParent, "project")) === false &&
        swapLockPaths.length === 2 &&
        swapLockPaths.every((file) => fs.existsSync(file) === false),
    );
    for (const replacement of ["absent", "file"] as const) {
      const parent = path.join(invalidRoot, `${replacement}-parent`);
      const archived = path.join(invalidRoot, `${replacement}-parent-original`);
      fs.mkdirSync(parent);
      const projectPath = path.join(parent, "project");
      const lockPaths: string[] = [];
      const nativeWriteForReplacement = fs.writeFileSync;
      fs.writeFileSync = ((
        file: fs.PathOrFileDescriptor,
        ...args: unknown[]
      ): void => {
        Reflect.apply(nativeWriteForReplacement, fs, [file, ...args]);
        if (
          typeof file !== "number" &&
          path.basename(file.toString()).startsWith("create-")
        ) {
          lockPaths.push(path.resolve(file.toString()));
          if (lockPaths.length === 2) {
            fs.renameSync(parent, archived);
            if (replacement === "file")
              Reflect.apply(nativeWriteForReplacement, fs, [
                parent,
                "replacement",
              ]);
          }
        }
      }) as typeof fs.writeFileSync;
      let rejected = false;
      try {
        rejected = throws(
          () => AutoMovieProductionProject.open(projectPath),
          "changed physical identity",
        );
      } finally {
        fs.writeFileSync = nativeWriteForReplacement;
      }
      TestValidator.predicate(
        `a ${replacement} creation parent fails closed and releases both coordinates`,
        rejected &&
          fs.existsSync(projectPath) === false &&
          fs.existsSync(path.join(archived, "project")) === false &&
          lockPaths.length === 2 &&
          lockPaths.every((file) => fs.existsSync(file) === false),
      );
    }
    const nativeCoordinationMkdir = fs.mkdirSync;
    fs.mkdirSync = ((directory: fs.PathLike, ...args: unknown[]): unknown => {
      if (path.resolve(directory.toString()) === coordinationRoot) {
        const error = new Error("coordination mkdir denied");
        Object.assign(error, { code: "EACCES" });
        throw error;
      }
      return Reflect.apply(nativeCoordinationMkdir, fs, [
        directory,
        ...args,
      ]) as unknown;
    }) as typeof fs.mkdirSync;
    try {
      TestValidator.predicate(
        "a root coordination directory creation failure is fail-closed",
        throws(
          () => AutoMovieProductionProject.open(fresh),
          "coordination mkdir denied",
        ),
      );
    } finally {
      fs.mkdirSync = nativeCoordinationMkdir;
    }
    const nativeCoordinationLstat = fs.lstatSync;
    const mutableFs = fs as { lstatSync: typeof fs.lstatSync };
    for (const [name, linked] of [
      ["symlink", { isSymbolicLink: () => true, isDirectory: () => false }],
      [
        "non-directory",
        { isSymbolicLink: () => false, isDirectory: () => false },
      ],
    ] as const) {
      mutableFs.lstatSync = ((
        file: fs.PathLike,
        ...args: unknown[]
      ): fs.Stats => {
        if (path.resolve(file.toString()) === coordinationRoot)
          return linked as fs.Stats;
        return Reflect.apply(nativeCoordinationLstat, fs, [
          file,
          ...args,
        ]) as fs.Stats;
      }) as typeof fs.lstatSync;
      try {
        TestValidator.predicate(
          `a ${name} root coordination collision is rejected`,
          throws(
            () => AutoMovieProductionProject.open(fresh),
            "is not a physical directory",
          ),
        );
      } finally {
        mutableFs.lstatSync = nativeCoordinationLstat;
      }
    }
    const deniedRoot = path.join(invalidRoot, "denied-root");
    const nativeRootLstatDescriptor = Object.getOwnPropertyDescriptor(
      fs,
      "lstatSync",
    )!;
    Object.defineProperty(fs, "lstatSync", {
      ...nativeRootLstatDescriptor,
      value: ((
        file: fs.PathLike,
        ...args: unknown[]
      ): fs.Stats | fs.BigIntStats => {
        if (path.resolve(file.toString()) === deniedRoot) {
          const error = new Error(
            "injected project-root lstat denial",
          ) as NodeJS.ErrnoException;
          error.code = "EACCES";
          throw error;
        }
        return Reflect.apply(nativeCoordinationLstat, fs, [file, ...args]) as
          | fs.Stats
          | fs.BigIntStats;
      }) as typeof fs.lstatSync,
    });
    try {
      TestValidator.predicate(
        "an unexpected project-root lstat denial propagates",
        throws(
          () => AutoMovieProductionProject.open(deniedRoot),
          "injected project-root lstat denial",
        ),
      );
    } finally {
      Object.defineProperty(fs, "lstatSync", nativeRootLstatDescriptor);
    }
    const nativeCoordinationChmod = fs.chmodSync;
    fs.chmodSync = ((file: fs.PathLike): void => {
      if (path.resolve(file.toString()) === coordinationRoot)
        throw new Error("coordination chmod denied");
      nativeCoordinationChmod(file, 0o700);
    }) as typeof fs.chmodSync;
    try {
      TestValidator.predicate(
        "an insecure coordination permission failure is fail-closed",
        throws(
          () => AutoMovieProductionProject.open(fresh),
          "coordination chmod denied",
        ),
      );
    } finally {
      fs.chmodSync = nativeCoordinationChmod;
    }
    const nativeCoordinateWrite = fs.writeFileSync;
    const partiallyHeldCoordinates: string[] = [];
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      if (
        typeof file !== "number" &&
        path.dirname(path.resolve(file.toString())) === coordinationRoot &&
        path.basename(file.toString()).startsWith("root-path-")
      )
        throw new Error("second root coordinate denied");
      Reflect.apply(nativeCoordinateWrite, fs, [file, ...args]);
      if (
        typeof file !== "number" &&
        path.dirname(path.resolve(file.toString())) === coordinationRoot &&
        path.basename(file.toString()).startsWith("root-id-")
      )
        partiallyHeldCoordinates.push(path.resolve(file.toString()));
    }) as typeof fs.writeFileSync;
    try {
      TestValidator.predicate(
        "partial dual-coordinate acquisition releases the physical identity fence",
        throws(
          () => AutoMovieProductionProject.open(fresh),
          "second root coordinate denied",
        ) &&
          partiallyHeldCoordinates.length === 1 &&
          partiallyHeldCoordinates.every(
            (file) => fs.existsSync(file) === false,
          ),
      );
    } finally {
      fs.writeFileSync = nativeCoordinateWrite;
    }
    const staleRoot = path.join(invalidRoot, "stale-physical-root");
    const staleProject = AutoMovieProductionProject.open(staleRoot);
    const staleRenderRoot = staleProject.renderRoot();
    const parkedStaleRoot = `${staleRoot}-parked`;
    fs.renameSync(staleRoot, parkedStaleRoot);
    fs.cpSync(parkedStaleRoot, staleRoot, { recursive: true });
    TestValidator.predicate(
      "a byte-identical physical root replacement invalidates every stale handle operation",
      throws(() => staleProject.manifest(), "root identity changed") &&
        throws(
          () =>
            staleProject.commitProductionDeliverableFiles(
              "stale-root-write",
              new Map([["frame.bin", Buffer.from("unsafe")]]),
            ),
          "root identity changed",
        ) &&
        fs.existsSync(
          path.join(staleRenderRoot, "deliverables/stale-root-write/frame.bin"),
        ) === false,
    );
    const missingIdentityRoot = path.join(invalidRoot, "missing-identity-root");
    const missingIdentityProject =
      AutoMovieProductionProject.open(missingIdentityRoot);
    const parkedMissingIdentityRoot = `${missingIdentityRoot}-parked`;
    fs.renameSync(missingIdentityRoot, parkedMissingIdentityRoot);
    try {
      TestValidator.predicate(
        "an absent physical root invalidates a stale handle before any read",
        throws(
          () => missingIdentityProject.manifest(),
          "root identity changed",
        ),
      );
    } finally {
      fs.renameSync(parkedMissingIdentityRoot, missingIdentityRoot);
    }
    const acquiredReplacementRoot = path.join(
      invalidRoot,
      "acquired-replacement-root",
    );
    const acquiredReplacementProject = AutoMovieProductionProject.open(
      acquiredReplacementRoot,
    );
    const acquiredReplacementRenderRoot =
      acquiredReplacementProject.renderRoot();
    const parkedAcquiredReplacementRoot = `${acquiredReplacementRoot}-parked`;
    let acquiredReplacementSwapped = false;
    const racingFiles = new Map([
      ["frame.bin", Buffer.from("unsafe")] as const,
    ]);
    const residentFileIterator = racingFiles[Symbol.iterator].bind(racingFiles);
    racingFiles[Symbol.iterator] = () => {
      if (acquiredReplacementSwapped === false) {
        acquiredReplacementSwapped = true;
        fs.renameSync(acquiredReplacementRoot, parkedAcquiredReplacementRoot);
        fs.cpSync(parkedAcquiredReplacementRoot, acquiredReplacementRoot, {
          recursive: true,
        });
      }
      return residentFileIterator();
    };
    const acquiredReplacementRejected = throws(
      () =>
        acquiredReplacementProject.commitProductionDeliverableFiles(
          "acquired-replacement",
          racingFiles,
        ),
      "root identity changed",
    );
    const acquiredReplacementUntouched =
      fs.existsSync(
        path.join(
          acquiredReplacementRenderRoot,
          "deliverables/acquired-replacement/frame.bin",
        ),
      ) === false;
    if (acquiredReplacementSwapped) {
      fs.rmSync(acquiredReplacementRoot, { force: true, recursive: true });
      fs.renameSync(parkedAcquiredReplacementRoot, acquiredReplacementRoot);
    }
    TestValidator.predicate(
      "a replacement acquired after argument staging is rejected against the open handle identity",
      acquiredReplacementSwapped &&
        acquiredReplacementRejected &&
        acquiredReplacementUntouched,
    );
    const preLeaseRoot = path.join(invalidRoot, "pre-lease-root-race");
    const preLeaseProject = AutoMovieProductionProject.open(preLeaseRoot);
    const preLeaseBytes = Buffer.from("before");
    preLeaseProject.commitProductionDeliverableFiles(
      "pre-lease",
      new Map([["frame.bin", preLeaseBytes]]),
    );
    const preLeaseTarget = path.join(
      preLeaseProject.renderRoot(),
      "deliverables/pre-lease/frame.bin",
    );
    const parkedPreLeaseRoot = `${preLeaseRoot}-parked`;
    const nativeReadForPreLease = fs.readFileSync;
    let preLeaseSwapped = false;
    fs.readFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      const output = Reflect.apply(nativeReadForPreLease, fs, [file, ...args]);
      if (
        preLeaseSwapped === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === preLeaseTarget
      ) {
        preLeaseSwapped = true;
        fs.renameSync(preLeaseRoot, parkedPreLeaseRoot);
        fs.cpSync(parkedPreLeaseRoot, preLeaseRoot, { recursive: true });
      }
      return output;
    }) as typeof fs.readFileSync;
    let preLeaseRejected = false;
    try {
      preLeaseRejected = throws(
        () =>
          preLeaseProject.commitProductionDeliverableFiles(
            "pre-lease",
            new Map([["frame.bin", Buffer.from("after")]]),
          ),
        "namespace fence changed",
      );
    } finally {
      fs.readFileSync = nativeReadForPreLease;
    }
    const preLeaseReplacementUntouched =
      fs.readFileSync(preLeaseTarget, "utf8") === "before";
    if (preLeaseSwapped) {
      fs.rmSync(preLeaseRoot, { force: true, recursive: true });
      fs.renameSync(parkedPreLeaseRoot, preLeaseRoot);
    }
    TestValidator.predicate(
      "a root replaced while staging under the namespace lease is refused without mutation",
      preLeaseSwapped && preLeaseRejected && preLeaseReplacementUntouched,
    );
    const atomicDeleteBase = modelRecipe();
    const atomicDeleteModel = {
      ...atomicDeleteBase,
      id: "atomic-delete-recovery",
      lod: atomicDeleteBase.lod.map((lod) => ({
        ...lod,
        recipe: "atomic-delete-recovery",
      })),
    };
    TestValidator.predicate(
      "atomic delete recovery fixture is accepted",
      initialized.setModelRecipe(atomicDeleteModel).accepted,
    );
    const atomicDeleteTarget = path.join(
      fresh,
      ".automovie/design/shared/models/atomic-delete-recovery.json",
    );
    const atomicDeleteBytes = fs.readFileSync(atomicDeleteTarget);
    const atomicDeleteRevision = initialized.revision();
    const nativeRmForAtomicDelete = fs.rmSync;
    let quarantineDeleteDenied = false;
    Reflect.set(fs, "rmSync", (file: fs.PathLike, ...args: unknown[]) => {
      if (
        quarantineDeleteDenied === false &&
        path
          .resolve(String(file))
          .startsWith(`${path.resolve(atomicDeleteTarget)}.delete.`)
      ) {
        quarantineDeleteDenied = true;
        throw new Error("injected quarantine delete denial");
      }
      return (nativeRmForAtomicDelete as (...parameters: unknown[]) => void)(
        file,
        ...args,
      );
    });
    let atomicDeleteRejected = false;
    try {
      atomicDeleteRejected = throws(
        () =>
          initialized.eraseDesignArtifact({
            kind: "model",
            id: atomicDeleteModel.id,
          }),
        "injected quarantine delete denial",
      );
    } finally {
      Reflect.set(fs, "rmSync", nativeRmForAtomicDelete);
    }
    TestValidator.predicate(
      "a failed quarantine cleanup restores the exact deleted file and revision",
      quarantineDeleteDenied &&
        atomicDeleteRejected &&
        fs.readFileSync(atomicDeleteTarget).equals(atomicDeleteBytes) &&
        initialized.revision() === atomicDeleteRevision &&
        fs
          .readdirSync(path.dirname(atomicDeleteTarget))
          .every(
            (entry) =>
              entry.startsWith(
                `${path.basename(atomicDeleteTarget)}.delete.`,
              ) === false,
          ) &&
        initialized.eraseDesignArtifact({
          kind: "model",
          id: atomicDeleteModel.id,
        }).accepted,
    );
    const mutationRoot = path.join(invalidRoot, "mutation-root");
    const mutationProject = AutoMovieProductionProject.open(mutationRoot);
    const mutationFrame = path.join(
      mutationProject.renderRoot(),
      "deliverables/root-swap/frame.bin",
    );
    const parkedMutationRoot = `${mutationRoot}-parked`;
    const nativeRenameForMutationSwap = fs.renameSync;
    let mutationRootSwapped = false;
    fs.renameSync = ((oldPath, newPath) => {
      if (
        mutationRootSwapped === false &&
        path.resolve(newPath.toString()) === path.resolve(mutationFrame)
      ) {
        mutationRootSwapped = true;
        nativeRenameForMutationSwap(mutationRoot, parkedMutationRoot);
        fs.mkdirSync(mutationRoot);
      }
      return nativeRenameForMutationSwap(oldPath, newPath);
    }) as typeof fs.renameSync;
    let mutationSwapRejected = false;
    try {
      mutationProject.commitProductionDeliverableFiles(
        "root-swap",
        new Map([["frame.bin", Buffer.from("unsafe")]]),
      );
    } catch (error) {
      mutationSwapRejected =
        error instanceof AggregateError &&
        error.message.includes("No stale-path rollback was attempted");
    } finally {
      fs.renameSync = nativeRenameForMutationSwap;
    }
    const replacementUntouched = fs.existsSync(mutationFrame) === false;
    let abandonedLockReleased = false;
    let processOwnershipReleased = false;
    if (mutationRootSwapped) {
      const abandonedLock = path.join(
        parkedMutationRoot,
        ".automovie/productions/mutation-root/revision.lock",
      );
      const abandonedToken = fs.readFileSync(abandonedLock, "utf8");
      fs.mkdirSync(
        path.join(mutationRoot, ".automovie/productions/mutation-root"),
        {
          recursive: true,
        },
      );
      const replacementLock = path.join(
        mutationRoot,
        ".automovie/productions/mutation-root/revision.lock",
      );
      const replacementToken = acquireCommitLock(replacementLock);
      try {
        processOwnershipReleased =
          replacementToken !== abandonedToken &&
          fs.readFileSync(replacementLock, "utf8") === replacementToken;
      } finally {
        releaseCommitLock(replacementLock, replacementToken);
      }
      fs.rmSync(mutationRoot, { force: true, recursive: true });
      fs.renameSync(parkedMutationRoot, mutationRoot);
      const restoredLock = path.join(
        mutationRoot,
        ".automovie/productions/mutation-root/revision.lock",
      );
      releaseCommitLock(restoredLock, abandonedToken);
      abandonedLockReleased = fs.existsSync(restoredLock) === false;
    }
    TestValidator.predicate(
      "a root swapped during publication refuses rollback and stale lock release in the replacement",
      mutationRootSwapped &&
        mutationSwapRejected &&
        replacementUntouched &&
        processOwnershipReleased &&
        abandonedLockReleased,
    );
    TestValidator.predicate(
      "every absent design discriminator returns one missing mutation",
      [
        { kind: "production" as const },
        { kind: "model" as const, id: "absent" },
        { kind: "world" as const },
        { kind: "formation" as const, id: "absent" },
        { kind: "shot" as const, id: "absent" },
        { kind: "acceptance" as const, id: "absent" },
      ].every(
        (target) =>
          initialized.eraseDesignArtifact(target).diagnostics[0]?.code ===
          "design-missing",
      ),
    );

    for (const value of [
      "{bad",
      "null",
      '{"formatVersion":1}',
      '{"formatVersion":2,"projectId":"","sourceRoots":[],"generatedRoot":"g","renderRoot":"r"}',
      '{"formatVersion":2,"projectId":"x","sourceRoots":[],"assetManifest":"assets.json","generatedRoot":"g","renderRoot":"r"}',
    ]) {
      const root = path.join(invalidRoot, `manifest-${Math.random()}`);
      fs.mkdirSync(path.join(root, ".automovie"), { recursive: true });
      fs.writeFileSync(path.join(root, ".automovie/manifest.json"), value);
      TestValidator.predicate(
        "invalid manifest is rejected",
        throws(() => AutoMovieProductionProject.open(root)),
      );
    }
    const invalidOwnedRoot = path.join(invalidRoot, "absolute-owned");
    fs.mkdirSync(path.join(invalidOwnedRoot, ".automovie"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(invalidOwnedRoot, ".automovie/manifest.json"),
      JSON.stringify({
        formatVersion: 2,
        projectId: "x",
        sourceRoots: ["src"],
        generatedRoot: path.resolve(invalidRoot, "outside"),
        renderRoot: "renders",
      }),
    );
    TestValidator.predicate(
      "manifest-owned roots must be relative",
      throws(() => AutoMovieProductionProject.open(invalidOwnedRoot)),
    );
    for (const [name, ownership] of [
      [
        "blank-generated",
        { sourceRoots: ["src"], generatedRoot: "", renderRoot: "renders" },
      ],
      [
        "absolute-source",
        {
          sourceRoots: ["/src"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "drive-source",
        {
          sourceRoots: ["C:/src"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "drive-relative-source",
        {
          sourceRoots: ["C:src"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "parent-source",
        {
          sourceRoots: ["../src"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "backslash-source",
        {
          sourceRoots: ["src\\shots"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "dot-source",
        {
          sourceRoots: ["src/../src"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "case-source",
        {
          sourceRoots: ["src", "SRC"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "cross-case-content",
        {
          sourceRoots: ["src"],
          generatedRoot: "generated",
          renderRoot: "renders",
          contentRoots: ["SRC"],
        },
      ],
      [
        "duplicate-content-file",
        {
          sourceRoots: ["src"],
          generatedRoot: "generated",
          renderRoot: "renders",
          contentFiles: ["config.ts", "config.ts"],
        },
      ],
      [
        "trailing-content-file",
        {
          sourceRoots: ["src"],
          generatedRoot: "generated",
          renderRoot: "renders",
          contentFiles: ["viewer/"],
        },
      ],
      [
        "project-root",
        { sourceRoots: ["src"], generatedRoot: ".", renderRoot: "renders" },
      ],
      [
        "reserved-state",
        {
          sourceRoots: ["src"],
          generatedRoot: ".automovie/generated",
          renderRoot: "renders",
        },
      ],
      [
        "source-generated-overlap",
        {
          sourceRoots: ["src"],
          generatedRoot: "src/generated",
          renderRoot: "renders",
        },
      ],
      [
        "source-source-overlap",
        {
          sourceRoots: ["src", "src/shots"],
          generatedRoot: "generated",
          renderRoot: "renders",
        },
      ],
      [
        "generated-render-overlap",
        {
          sourceRoots: ["src"],
          generatedRoot: "output",
          renderRoot: "output/renders",
        },
      ],
      [
        "content-root-project",
        {
          sourceRoots: ["src"],
          generatedRoot: "generated",
          renderRoot: "renders",
          contentRoots: ["."],
        },
      ],
      [
        "content-root-state",
        {
          sourceRoots: ["src"],
          generatedRoot: "generated",
          renderRoot: "renders",
          contentRoots: [".automovie/design"],
        },
      ],
      [
        "content-file-generated",
        {
          sourceRoots: ["src"],
          generatedRoot: "generated",
          renderRoot: "renders",
          contentFiles: ["generated/output.json"],
        },
      ],
    ] as const) {
      const root = path.join(invalidRoot, `ownership-${name}`);
      fs.mkdirSync(path.join(root, ".automovie"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".automovie/manifest.json"),
        JSON.stringify({
          formatVersion: 2,
          projectId: name,
          ...ownership,
        }),
      );
      TestValidator.predicate(
        `manifest ownership layout rejects ${name}`,
        throws(() => AutoMovieProductionProject.open(root)),
      );
    }

    const junctionOutside = path.join(invalidRoot, "junction-outside");
    fs.mkdirSync(junctionOutside);
    const junctionRoot = path.join(invalidRoot, "junction-owned-root");
    fs.mkdirSync(path.join(junctionRoot, ".automovie"), { recursive: true });
    fs.writeFileSync(
      path.join(junctionRoot, ".automovie/manifest.json"),
      JSON.stringify({
        formatVersion: 2,
        projectId: "junction-owned-root",
        sourceRoots: ["src"],
        generatedRoot: "generated",
        renderRoot: "renders",
      }),
    );
    fs.symlinkSync(
      junctionOutside,
      path.join(junctionRoot, "generated"),
      "junction",
    );
    TestValidator.predicate(
      "compiler-owned root cannot escape through a junction",
      throws(() => AutoMovieProductionProject.open(junctionRoot)),
    );
    let internalAliasFailure:
      | ISingleProductionProjectFixtureFailure
      | undefined;
    const internalAlias = productionFixture();
    try {
      fs.rmSync(path.join(internalAlias.root, "generated"), {
        force: true,
        recursive: true,
      });
      fs.symlinkSync(
        path.join(internalAlias.root, "viewer"),
        path.join(internalAlias.root, "generated"),
        "junction",
      );
      TestValidator.predicate(
        "owned roots cannot alias another project directory through a junction",
        throws(() => AutoMovieProductionProject.open(internalAlias.root)),
      );
    } catch (error) {
      internalAliasFailure = { error };
      throw error;
    } finally {
      preserveSingleProductionProjectFixtureCleanup(internalAliasFailure, () =>
        internalAlias.dispose(),
      );
    }

    const stateOutside = path.join(invalidRoot, "state-outside");
    const stateJunctionRoot = path.join(invalidRoot, "state-junction-root");
    fs.mkdirSync(stateOutside);
    fs.mkdirSync(stateJunctionRoot);
    fs.symlinkSync(
      stateOutside,
      path.join(stateJunctionRoot, ".automovie"),
      "junction",
    );
    TestValidator.predicate(
      "reserved state cannot escape through a junction",
      throws(() => AutoMovieProductionProject.open(stateJunctionRoot)) &&
        fs.readdirSync(stateOutside).length === 0,
    );

    const invalidIncarnationRoot = path.join(
      invalidRoot,
      "invalid-incarnation",
    );
    AutoMovieProductionProject.open(invalidIncarnationRoot);
    const incarnationPath = path.join(
      invalidIncarnationRoot,
      ".automovie/incarnation.json",
    );
    for (const value of [
      { version: 2, id: "7b2e2389-a246-4df2-94fb-f48e9bb90d51" },
      { version: 1, id: 42 },
      { version: 1, id: "not-a-uuid" },
    ]) {
      fs.writeFileSync(incarnationPath, JSON.stringify(value));
      TestValidator.predicate(
        "invalid production incarnation is rejected",
        throws(
          () => AutoMovieProductionProject.open(invalidIncarnationRoot),
          "Invalid production state incarnation",
        ),
      );
    }

    let malformedDesignFailure:
      | ISingleProductionProjectFixtureFailure
      | undefined;
    const malformedDesign = productionFixture();
    try {
      fs.writeFileSync(
        path.join(malformedDesign.root, ".automovie/design/models/%ZZ.json"),
        JSON.stringify(modelRecipe()),
      );
      TestValidator.predicate(
        "malformed encoded design filename is rejected",
        throws(() =>
          AutoMovieProductionProject.open(malformedDesign.root).graph(),
        ),
      );
      fs.rmSync(
        path.join(
          malformedDesign.root,
          ".automovie/design/shared/models/%ZZ.json",
        ),
      );
      fs.writeFileSync(
        path.join(malformedDesign.root, ".automovie/design/shared/world.json"),
        "{bad",
      );
      TestValidator.predicate(
        "invalid design JSON is rejected",
        throws(() =>
          AutoMovieProductionProject.open(malformedDesign.root).graph(),
        ),
      );
    } catch (error) {
      malformedDesignFailure = { error };
      throw error;
    } finally {
      preserveSingleProductionProjectFixtureCleanup(
        malformedDesignFailure,
        () => malformedDesign.dispose(),
      );
    }

    let invalidRevisionFailure:
      | ISingleProductionProjectFixtureFailure
      | undefined;
    const invalidRevision = productionFixture();
    try {
      fs.writeFileSync(
        path.join(invalidRevision.root, ".automovie/revision.json"),
        '{"revision":-1}',
      );
      TestValidator.predicate(
        "revision must be a non-negative safe integer",
        throws(() => AutoMovieProductionProject.open(invalidRevision.root)),
      );
    } catch (error) {
      invalidRevisionFailure = { error };
      throw error;
    } finally {
      preserveSingleProductionProjectFixtureCleanup(
        invalidRevisionFailure,
        () => invalidRevision.dispose(),
      );
    }
  } finally {
    fs.rmSync(invalidRoot, { force: true, recursive: true });
  }
};
