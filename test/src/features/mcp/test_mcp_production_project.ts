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

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

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
  let renderDescriptorHarnessFailure:
    | IProductionProjectFixtureFailure
    | undefined;
  try {
    project.readRenderFile(relativePath);
  } catch (error) {
    caught = error;
    renderDescriptorHarnessFailure = { error };
  } finally {
    preserveProductionProjectFixtureCleanup(renderDescriptorHarnessFailure, [
      {
        resource: "render descriptor open hook",
        cleanup: () => {
          fs.openSync = nativeOpen;
        },
      },
      {
        resource: "render descriptor fstat hook",
        cleanup: () => {
          fs.fstatSync = nativeFstat;
        },
      },
      {
        resource: "render descriptor close hook",
        cleanup: () => {
          fs.closeSync = nativeClose;
        },
      },
    ]);
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
      // The guarded body records its product failure in `caught` instead of
      // propagating it, so no primary failure is ever in flight at this
      // boundary. What the policy adds is independence: the three restorations
      // form one lifecycle -- the flag exists to keep the two hooks consistent
      // -- and a failure in the first must not leave the second installed for
      // every later scenario in this process.
      preserveProductionProjectFixtureCleanup(undefined, [
        {
          resource: "atomic rename hook",
          cleanup: () => {
            fs.renameSync = nativeRename;
          },
        },
        {
          resource: "atomic remove hook",
          cleanup: () => {
            Reflect.set(fs, "rmSync", nativeRemove);
          },
        },
        {
          resource: "atomic hook installation flag",
          cleanup: () => {
            hooksInstalled = false;
          },
        },
      ]);
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
  TestValidator.equals(
    "production atomic cleanup and recovery preserve exact failure ownership",
    namedFacts([
      [
        "standaloneCaught",
        () => standalone.caught === standalone.cleanupFailure,
      ],
      ["standaloneCleanupAttempted", () => standalone.cleanupAttempted],
      ["standaloneTargetExists", () => standalone.targetExists],
      [
        "standaloneTemporaryArtifacts",
        () => standalone.temporaryArtifacts === 0,
      ],
      [
        "primaryOnlyCaught",
        () => primaryOnly.caught === primaryOnly.primaryFailure,
      ],
      ["primaryOnlyCleanupAttempted", () => primaryOnly.cleanupAttempted],
      ["primaryOnlyTargetExists", () => primaryOnly.targetExists === false],
      [
        "primaryOnlyTemporaryArtifacts",
        () => primaryOnly.temporaryArtifacts === 0,
      ],
      [
        "aggregateContainsExactlyCombinedCleanup",
        () =>
          aggregateContainsExactly(combinedCleanup.caught, [
            combinedCleanup.primaryFailure,
            combinedCleanup.cleanupFailure,
          ]),
      ],
      [
        "combinedCleanupCleanupAttempted",
        () => combinedCleanup.cleanupAttempted,
      ],
      [
        "combinedCleanupTargetExists",
        () => combinedCleanup.targetExists === false,
      ],
      [
        "combinedCleanupTemporaryArtifacts",
        () => combinedCleanup.temporaryArtifacts === 1,
      ],
      [
        "combinedRecoveryFixtureAccepted",
        () => combinedRecovery.fixtureAccepted,
      ],
      [
        "aggregateContainsExactlyCombinedRecovery",
        () =>
          aggregateContainsExactly(combinedRecovery.caught, [
            combinedRecovery.primaryFailure,
            combinedRecovery.recoveryFailure,
          ]),
      ],
      [
        "combinedRecoveryCleanupAttempted",
        () => combinedRecovery.cleanupAttempted,
      ],
      [
        "combinedRecoveryRecoveryAttempted",
        () => combinedRecovery.recoveryAttempted,
      ],
      [
        "combinedRecoveryTargetExists",
        () => combinedRecovery.targetExists === false,
      ],
      [
        "combinedRecoveryQuarantineArtifacts",
        () => combinedRecovery.quarantineArtifacts === 1,
      ],
    ]),
    {
      standaloneCaught: true,
      standaloneCleanupAttempted: true,
      standaloneTargetExists: true,
      standaloneTemporaryArtifacts: true,
      primaryOnlyCaught: true,
      primaryOnlyCleanupAttempted: true,
      primaryOnlyTargetExists: true,
      primaryOnlyTemporaryArtifacts: true,
      aggregateContainsExactlyCombinedCleanup: true,
      combinedCleanupCleanupAttempted: true,
      combinedCleanupTargetExists: true,
      combinedCleanupTemporaryArtifacts: true,
      combinedRecoveryFixtureAccepted: true,
      aggregateContainsExactlyCombinedRecovery: true,
      combinedRecoveryCleanupAttempted: true,
      combinedRecoveryRecoveryAttempted: true,
      combinedRecoveryTargetExists: true,
      combinedRecoveryQuarantineArtifacts: true,
    },
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
  TestValidator.equals(
    "render-file descriptor cleanup preserves every operation and resource failure",
    namedFacts([
      [
        "standaloneSourceCaught",
        () => standaloneSource.caught === standaloneSource.sourceCloseFailure,
      ],
      [
        "standaloneResidentCaught",
        () =>
          standaloneResident.caught === standaloneResident.residentCloseFailure,
      ],
      [
        "primaryOnlyCaught",
        () => primaryOnly.caught === primaryOnly.primaryFailure,
      ],
      [
        "aggregateContainsExactlyCombinedResident",
        () =>
          aggregateContainsExactly(combinedResident.caught, [
            combinedResident.primaryFailure,
            combinedResident.residentCloseFailure,
          ]),
      ],
      [
        "aggregateContainsExactlyCombinedSource",
        () =>
          aggregateContainsExactly(combinedSource.caught, [
            combinedSource.primaryFailure,
            combinedSource.sourceCloseFailure,
          ]),
      ],
      [
        "aggregateContainsExactlyNested",
        () =>
          aggregateContainsExactly(nested.caught, [
            nested.primaryFailure,
            nested.residentCloseFailure,
            nested.sourceCloseFailure,
          ]),
      ],
    ]),
    {
      standaloneSourceCaught: true,
      standaloneResidentCaught: true,
      primaryOnlyCaught: true,
      aggregateContainsExactlyCombinedResident: true,
      aggregateContainsExactlyCombinedSource: true,
      aggregateContainsExactlyNested: true,
    },
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
    TestValidator.equals(
      "manifest and summary preserve tracked identity",
      namedFacts([
        ["projectManifest", () => project.manifest().formatVersion === 2],
        ["projectSummary", () => project.summary().initialized === false],
        ["projectProductionId", () => project.productionId === "fixture-film"],
        [
          "projectGeneratedRoot",
          () =>
            project.generatedRoot() ===
            path.join(fixture.root, "generated", "fixture-film"),
        ],
        [
          "projectRenderRoot",
          () =>
            project.renderRoot() ===
            path.join(fixture.root, "renders", "fixture-film"),
        ],
      ]),
      {
        projectManifest: true,
        projectSummary: true,
        projectProductionId: true,
        projectGeneratedRoot: true,
        projectRenderRoot: true,
      },
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
    TestValidator.equals(
      "read-only open and lint never create, migrate, repair, or mutate state",
      namedFacts([
        [
          "typeofReadOnlyLint",
          () => typeof readOnlyLint.compiler.inputFingerprint === "string",
        ],
        [
          "readOnlyProductionId",
          () => readOnly.productionId === project.productionId,
        ],
        [
          "rejected",
          () =>
            throws(
              () => readOnly.setWorldDesign(fixtureWorldDesign()),
              "opened read-only",
            ),
        ],
        [
          "stringifySnapshotTree",
          () =>
            JSON.stringify(snapshotTree(fixture.root)) ===
            JSON.stringify(beforeReadOnly),
        ],
      ]),
      {
        typeofReadOnlyLint: true,
        readOnlyProductionId: true,
        rejected: true,
        stringifySnapshotTree: true,
      },
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
    TestValidator.equals(
      "every design target is readable",
      namedFacts([
        [
          "projectDesign",
          () => project.design({ kind: "production" }) !== null,
        ],
        [
          "projectDesign2",
          () => project.design({ kind: "model", id: "soloist" }) !== null,
        ],
        ["projectDesign3", () => project.design({ kind: "world" }) !== null],
        [
          "projectDesign4",
          () => project.design({ kind: "formation", id: "absent" }) === null,
        ],
        [
          "projectDesign5",
          () => project.design({ kind: "shot", id: "opening" }) !== null,
        ],
        [
          "projectDesign6",
          () =>
            project.design({ kind: "acceptance", id: "opening-beauty" }) !==
            null,
        ],
      ]),
      {
        projectDesign: true,
        projectDesign2: true,
        projectDesign3: true,
        projectDesign4: true,
        projectDesign5: true,
        projectDesign6: true,
      },
    );
    const stagedShot = shotContract();
    stagedShot.reviewFrames[0]!.id = "replacement-apex";
    const stagedDependencyBreak = project.setShotContract(stagedShot);
    TestValidator.equals(
      "one-artifact setters accept an orderable dependency migration but expose its new downstream blockers",
      namedFacts([
        ["stagedDependencyBreakAccepted", () => stagedDependencyBreak.accepted],
        [
          "stagedDependencyBreakDiagnostics",
          () =>
            stagedDependencyBreak.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "design-downstream-invalidated" &&
                diagnostic.category === "warning" &&
                diagnostic.target.startsWith("acceptance:"),
            ),
        ],
        [
          "newAutoMovieProductionCompiler",
          () =>
            new AutoMovieProductionCompiler(project).lint({ scope: "design" })
              .success === false,
        ],
      ]),
      {
        stagedDependencyBreakAccepted: true,
        stagedDependencyBreakDiagnostics: true,
        newAutoMovieProductionCompiler: true,
      },
    );
    const unrelatedDuringMigration = project.setWorldDesign(worldDesign());
    TestValidator.equals(
      "an unrelated setter does not claim a pre-existing migration blocker as its consequence",
      namedFacts([
        ["accepted", () => unrelatedDuringMigration.accepted],
        [
          "noDownstreamBlame",
          () =>
            unrelatedDuringMigration.diagnostics.every(
              (diagnostic) =>
                diagnostic.code !== "design-downstream-invalidated",
            ),
        ],
      ]),
      { accepted: true, noDownstreamBlame: true },
    );
    TestValidator.equals(
      "restoring the upstream contract clears the staged dependency break",
      namedFacts([
        ["restored", () => project.setShotContract(shotContract()).accepted],
        [
          "lintClean",
          () =>
            new AutoMovieProductionCompiler(project).lint({ scope: "design" })
              .success,
        ],
      ]),
      { restored: true, lintClean: true },
    );
    TestValidator.equals(
      "source ownership rejects absolute, external and non-TypeScript paths",
      namedFacts([
        [
          "rejected",
          () =>
            throws(() => project.resolveSourcePath(path.resolve("outside.ts"))),
        ],
        [
          "rejected2",
          () => throws(() => project.resolveSourcePath("../outside.ts")),
        ],
        [
          "rejected3",
          () => throws(() => project.resolveSourcePath("outside/source.ts")),
        ],
        [
          "rejected4",
          () => throws(() => project.resolveSourcePath("src/not-source.json")),
        ],
        ["rejected5", () => throws(() => project.readSource("src/missing.ts"))],
      ]),
      {
        rejected: true,
        rejected2: true,
        rejected3: true,
        rejected4: true,
        rejected5: true,
      },
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
        let sourceTransientReadFailure:
          | IProductionProjectFixtureFailure
          | undefined;
        try {
          return Reflect.apply(nativeSourceRead, fs, [target, ...args]);
        } catch (error) {
          sourceTransientReadFailure = { error };
          throw error;
        } finally {
          preserveProductionProjectFixtureCleanup(sourceTransientReadFailure, [
            {
              resource: "source-read transient replacement",
              cleanup: () => fs.rmSync(sourceReadPath),
            },
            {
              resource: "source-read parked resident",
              cleanup: () => fs.renameSync(sourceReadParked, sourceReadPath),
            },
          ]);
        }
      }
      return Reflect.apply(nativeSourceRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    let sourceReadBytes: Uint8Array = new Uint8Array();
    let sourceReadFailure: IProductionProjectFixtureFailure | undefined;
    try {
      sourceReadBytes = project.readSource(sourceReadRelative);
    } catch (error) {
      sourceReadFailure = { error };
      throw error;
    } finally {
      const sourceResidentParked = fs.existsSync(sourceReadParked);
      preserveProductionProjectFixtureCleanup(sourceReadFailure, [
        {
          resource: "source-read native hook",
          cleanup: () => {
            fs.readFileSync = nativeSourceRead;
          },
        },
        ...(sourceResidentParked
          ? [
              {
                resource: "source-read transient replacement",
                cleanup: () => fs.rmSync(sourceReadPath, { force: true }),
              },
              {
                resource: "source-read parked resident",
                cleanup: () => fs.renameSync(sourceReadParked, sourceReadPath),
              },
            ]
          : []),
      ]);
    }
    TestValidator.equals(
      "source reads bind bytes to the verified descriptor across a pathname swap",
      namedFacts([
        ["noPathRead", () => sourcePathRead === false],
        [
          "residentBytes",
          () => Buffer.from(sourceReadBytes).equals(sourceReadBefore),
        ],
      ]),
      { noPathRead: true, residentBytes: true },
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
        let stateTransientReadFailure:
          | IProductionProjectFixtureFailure
          | undefined;
        try {
          return Reflect.apply(nativeStateRead, fs, [target, ...args]);
        } catch (error) {
          stateTransientReadFailure = { error };
          throw error;
        } finally {
          preserveProductionProjectFixtureCleanup(stateTransientReadFailure, [
            {
              resource: `state-read transient replacement ${resolved}`,
              cleanup: () => fs.rmSync(resolved),
            },
            {
              resource: `state-read parked resident ${resolved}`,
              cleanup: () => fs.renameSync(parked, resolved),
            },
          ]);
        }
      }
      return Reflect.apply(nativeStateRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    let projectStateManifest: Uint8Array = new Uint8Array();
    let trackedRevision: Uint8Array = new Uint8Array();
    let currentRevision = -1;
    let stateReadFailure: IProductionProjectFixtureFailure | undefined;
    try {
      projectStateManifest = project.projectStateRecords().manifest;
      trackedRevision = project.readTrackedStateFile("revision.json")!;
      currentRevision = project.revision();
    } catch (error) {
      stateReadFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(stateReadFailure, [
        {
          resource: "state-read native hook",
          cleanup: () => {
            fs.readFileSync = nativeStateRead;
          },
        },
        ...[...stateReadResidents.keys()].flatMap((file) => {
          const parked = `${file}.parked`;
          return fs.existsSync(parked)
            ? [
                {
                  resource: `state-read transient replacement ${file}`,
                  cleanup: () => fs.rmSync(file, { force: true }),
                },
                {
                  resource: `state-read parked resident ${file}`,
                  cleanup: () => fs.renameSync(parked, file),
                },
              ]
            : [];
        }),
      ]);
    }
    TestValidator.equals(
      "state reads bind raw records and JSON to verified descriptors across pathname swaps",
      namedFacts([
        ["statePathReadsSize", () => statePathReads.size === 0],
        [
          "projectStateManifestStateReadResidents",
          () =>
            Buffer.from(projectStateManifest).equals(
              stateReadResidents.get(projectManifestPath)!,
            ),
        ],
        [
          "trackedRevisionStateReadResidents",
          () =>
            Buffer.from(trackedRevision).equals(
              stateReadResidents.get(trackedRevisionPath)!,
            ),
        ],
        [
          "currentRevisionExpectedRevision",
          () => currentRevision === expectedRevision,
        ],
      ]),
      {
        statePathReadsSize: true,
        projectStateManifestStateReadResidents: true,
        trackedRevisionStateReadResidents: true,
        currentRevisionExpectedRevision: true,
      },
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
    TestValidator.equals(
      "setter rejects both schema and graph errors before writing",
      namedFacts([
        ["invalidSchemaAccepted", () => invalidSchema.accepted === false],
        [
          "invalidSchemaDiagnostics",
          () => invalidSchema.diagnostics[0]?.code === "design-schema-invalid",
        ],
        ["invalidGraphAccepted", () => invalidGraph.accepted === false],
        [
          "invalidGraphDiagnostics",
          () =>
            invalidGraph.diagnostics.some(
              (item) => item.code === "model-parameter-invalid",
            ),
        ],
        [
          "invalidReferenceDiagnostics",
          () =>
            invalidReference.diagnostics.some(
              (item) => item.code === "design-reference-missing",
            ),
        ],
        ["caseCollisionAccepted", () => caseCollision.accepted === false],
        [
          "caseCollisionDiagnostics",
          () => caseCollision.diagnostics[0]?.code === "design-id-collision",
        ],
        [
          "nonCanonicalSourcesMutation",
          () =>
            nonCanonicalSources.every((mutation) =>
              mutation.diagnostics.some(
                (item) => item.code === "design-source-path-invalid",
              ),
            ),
        ],
        [
          "sourceCaseCollisionDiagnostics",
          () =>
            sourceCaseCollision.diagnostics.some(
              (item) => item.code === "design-source-path-collision",
            ),
        ],
      ]),
      {
        invalidSchemaAccepted: true,
        invalidSchemaDiagnostics: true,
        invalidGraphAccepted: true,
        invalidGraphDiagnostics: true,
        invalidReferenceDiagnostics: true,
        caseCollisionAccepted: true,
        caseCollisionDiagnostics: true,
        nonCanonicalSourcesMutation: true,
        sourceCaseCollisionDiagnostics: true,
      },
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
    TestValidator.equals(
      "formation setters hard-refuse a graph-wide explicit-slot overflow",
      namedFacts([
        ["firstBoundedFormationAccepted", () => firstBoundedFormation.accepted],
        [
          "aggregateOverflowAccepted",
          () => aggregateOverflow.accepted === false,
        ],
        [
          "aggregateOverflowDiagnostics",
          () =>
            aggregateOverflow.diagnostics.some(
              (item) =>
                item.code === "design-range-invalid" &&
                item.target === "formations",
            ),
        ],
        [
          "projectEraseDesignArtifact",
          () =>
            project.eraseDesignArtifact({
              kind: "formation",
              id: "bounded-a",
            }).accepted,
        ],
      ]),
      {
        firstBoundedFormationAccepted: true,
        aggregateOverflowAccepted: true,
        aggregateOverflowDiagnostics: true,
        projectEraseDesignArtifact: true,
      },
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
        frame: "cue-apex",
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
    TestValidator.equals(
      "film-scoped criteria are real shot and production references",
      namedFacts([
        [
          "projectSetAcceptanceScenario",
          () => project.setAcceptanceScenario(filmAcceptance).accepted,
        ],
        [
          "projectSetAcceptanceScenario2",
          () => project.setAcceptanceScenario(filmEventAcceptance).accepted,
        ],
        [
          "projectEraseDesignArtifact",
          () =>
            project
              .eraseDesignArtifact({ kind: "shot", id: "opening" })
              .diagnostics.some((diagnostic) =>
                diagnostic.message.includes("acceptance:film-opening-beauty"),
              ),
        ],
        [
          "projectEraseDesignArtifact2",
          () =>
            project
              .eraseDesignArtifact({ kind: "production" })
              .diagnostics.some((diagnostic) =>
                diagnostic.message.includes("acceptance:film-opening-beauty"),
              ),
        ],
      ]),
      {
        projectSetAcceptanceScenario: true,
        projectSetAcceptanceScenario2: true,
        projectEraseDesignArtifact: true,
        projectEraseDesignArtifact2: true,
      },
    );
    TestValidator.equals(
      "temporary film acceptances erase without a cascade",
      namedFacts([
        [
          "beautyErased",
          () =>
            project.eraseDesignArtifact({
              kind: "acceptance",
              id: filmAcceptance.id,
            }).accepted,
        ],
        [
          "eventErased",
          () =>
            project.eraseDesignArtifact({
              kind: "acceptance",
              id: filmEventAcceptance.id,
            }).accepted,
        ],
      ]),
      { beautyErased: true, eventErased: true },
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
    TestValidator.equals(
      "both distance operands preserve their referenced landmark world",
      namedFacts([
        [
          "destinationRefused",
          () => landmarkAsDistanceDestination.accepted === false,
        ],
        [
          "originRefused",
          () =>
            project.eraseDesignArtifact({ kind: "world" }).accepted === false,
        ],
      ]),
      { destinationRefused: true, originRefused: true },
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
    TestValidator.equals(
      "a model's self LOD does not make the model impossible to erase",
      namedFacts([
        ["accepted", () => project.setModelRecipe(standaloneModel).accepted],
        [
          "erased",
          () =>
            project.eraseDesignArtifact({
              kind: "model",
              id: standaloneModel.id,
            }).accepted,
        ],
      ]),
      { accepted: true, erased: true },
    );
    project.setFormationDesign(formationDesign());
    const dependentModel = {
      ...modelRecipe(),
      id: "soloist-variant",
      lod: [
        { tier: "hero" as const, maxDistance: 10, recipe: "soloist" },
        {
          tier: "far" as const,
          maxDistance: null,
          recipe: "soloist-variant",
        },
      ],
    };
    const dependentModelMutation = project.setModelRecipe(dependentModel);
    const transitiveDependentModel = {
      ...modelRecipe(),
      id: "soloist-variant-far",
      lod: [
        {
          tier: "hero" as const,
          maxDistance: 10,
          recipe: "soloist-variant",
        },
        {
          tier: "far" as const,
          maxDistance: null,
          recipe: "soloist-variant-far",
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
        id: "soloist",
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
      id: "soloist",
    });
    TestValidator.equals(
      "model consequences and erasure include dependent LOD models and formations",
      namedFacts([
        ["cyclicDependencyTraversal", () => cyclicDependencyTraversal],
        [
          "dependentModelMutationAccepted",
          () => dependentModelMutation.accepted,
        ],
        [
          "transitiveDependentMutationAccepted",
          () => transitiveDependentMutation.accepted,
        ],
        [
          "refusedModelEraseConsequences",
          () =>
            refusedModelErase.consequences.staleReviews.some(
              (target) =>
                target.kind === "design" &&
                target.design.kind === "model" &&
                target.design.id === "soloist-variant",
            ),
        ],
        [
          "refusedModelEraseConsequences2",
          () =>
            refusedModelErase.consequences.staleReviews.some(
              (target) =>
                target.kind === "design" &&
                target.design.kind === "model" &&
                target.design.id === "soloist-variant-far",
            ),
        ],
        [
          "refusedModelEraseDiagnostics",
          () =>
            refusedModelErase.diagnostics.some(
              (item) =>
                item.message.includes("model:soloist-variant") ||
                item.message.includes("formation:line"),
            ),
        ],
      ]),
      {
        cyclicDependencyTraversal: true,
        dependentModelMutationAccepted: true,
        transitiveDependentMutationAccepted: true,
        refusedModelEraseConsequences: true,
        refusedModelEraseConsequences2: true,
        refusedModelEraseDiagnostics: true,
      },
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
    TestValidator.equals(
      "mutation consequences follow target-local shot and review dependencies",
      namedFacts([
        ["secondShotMutationAccepted", () => secondShotMutation.accepted],
        [
          "secondShotMutationConsequences",
          () =>
            secondShotMutation.consequences.staleRenders.includes(
              "shot:second",
            ),
        ],
        [
          "secondShotMutationConsequences2",
          () =>
            secondShotMutation.consequences.staleRenders.includes(
              "shot:opening",
            ) === false,
        ],
        ["acceptanceMutationAccepted", () => acceptanceMutation.accepted],
        [
          "acceptanceMutationCount",
          () => acceptanceMutation.consequences.staleRenders.length === 0,
        ],
        [
          "acceptanceMutationConsequences",
          () =>
            acceptanceMutation.consequences.staleReviews.some(
              (target) => target.kind === "shot" && target.id === "opening",
            ),
        ],
        [
          "acceptanceMutationConsequences2",
          () =>
            acceptanceMutation.consequences.staleReviews.some(
              (target) => target.kind === "shot" && target.id === "second",
            ) === false,
        ],
        [
          "secondShotMutationConsequences3",
          () =>
            secondShotMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "sequence" && target.id === "SEQ-SIGNAL",
            ),
        ],
        [
          "secondShotMutationConsequences4",
          () =>
            secondShotMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "sequence" && target.id === "SEQ-ANSWER",
            ) === false,
        ],
        [
          "secondShotMutationConsequences5",
          () =>
            secondShotMutation.consequences.staleReviews.some(
              (target) => target.kind === "rendition",
            ) === false,
        ],
        [
          "acceptanceMutationConsequences3",
          () =>
            acceptanceMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "sequence" && target.id === "SEQ-SIGNAL",
            ),
        ],
      ]),
      {
        secondShotMutationAccepted: true,
        secondShotMutationConsequences: true,
        secondShotMutationConsequences2: true,
        acceptanceMutationAccepted: true,
        acceptanceMutationCount: true,
        acceptanceMutationConsequences: true,
        acceptanceMutationConsequences2: true,
        secondShotMutationConsequences3: true,
        secondShotMutationConsequences4: true,
        secondShotMutationConsequences5: true,
        acceptanceMutationConsequences3: true,
      },
    );
    const refusedRepaint = project.setProductionDesign(
      productionDesign({ visualDelivery: "repainted" }),
    );
    TestValidator.equals(
      "refused delivery mutations retain only current review targets",
      namedFacts([
        ["refused", () => refusedRepaint.accepted === false],
        [
          "noRenditionReviews",
          () =>
            refusedRepaint.consequences.staleReviews.some(
              (target) => target.kind === "rendition",
            ) === false,
        ],
      ]),
      { refused: true, noRenditionReviews: true },
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
    TestValidator.equals(
      "mutation consequences identify exact sequence and rendition review dependencies",
      namedFacts([
        [
          "modelMutationConsequences",
          () =>
            modelMutation.consequences.staleRenders.includes("shot:opening"),
        ],
        [
          "modelMutationConsequences2",
          () => modelMutation.consequences.staleRenders.includes("shot:second"),
        ],
        [
          "worldMutationConsequences",
          () =>
            worldMutation.consequences.staleReviews.some(
              (target) => target.kind === "film",
            ),
        ],
        [
          "productionMutationCount",
          () => productionMutation.consequences.staleRenders.length > 0,
        ],
        [
          "repaintedShotMutationConsequences",
          () =>
            repaintedShotMutation.consequences.staleReviews.some(
              (target) => target.kind === "rendition" && target.id === "second",
            ),
        ],
        [
          "repaintedShotMutationConsequences2",
          () =>
            repaintedShotMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "sequence" && target.id === "SEQ-SIGNAL",
            ),
        ],
        [
          "repaintedShotMutationConsequences3",
          () =>
            repaintedShotMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "sequence" && target.id === "SEQ-ANSWER",
            ) === false,
        ],
        [
          "movedSequenceShotMutationConsequences",
          () =>
            movedSequenceShotMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "sequence" && target.id === "SEQ-SIGNAL",
            ),
        ],
        [
          "movedSequenceShotMutationConsequences2",
          () =>
            movedSequenceShotMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "sequence" && target.id === "SEQ-ANSWER",
            ),
        ],
        [
          "repaintedAcceptanceMutationConsequences",
          () =>
            repaintedAcceptanceMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "rendition" && target.id === "opening",
            ),
        ],
        [
          "movedAcceptanceMutationConsequences",
          () =>
            movedAcceptanceMutation.consequences.staleReviews.some(
              (target) => target.kind === "shot" && target.id === "opening",
            ),
        ],
        [
          "movedAcceptanceMutationConsequences2",
          () =>
            movedAcceptanceMutation.consequences.staleReviews.some(
              (target) => target.kind === "shot" && target.id === "second",
            ),
        ],
        [
          "movedAcceptanceMutationConsequences3",
          () =>
            movedAcceptanceMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "rendition" && target.id === "opening",
            ),
        ],
        [
          "movedAcceptanceMutationConsequences4",
          () =>
            movedAcceptanceMutation.consequences.staleReviews.some(
              (target) => target.kind === "rendition" && target.id === "second",
            ),
        ],
        [
          "movedAcceptanceMutationConsequences5",
          () =>
            movedAcceptanceMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "sequence" && target.id === "SEQ-SIGNAL",
            ),
        ],
        [
          "movedAcceptanceMutationConsequences6",
          () =>
            movedAcceptanceMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "sequence" && target.id === "SEQ-ANSWER",
            ),
        ],
        [
          "restoredAcceptanceMutationAccepted",
          () => restoredAcceptanceMutation.accepted,
        ],
        [
          "modelMutationConsequences3",
          () =>
            modelMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "rendition" && target.id === "opening",
            ),
        ],
        [
          "formationMutationConsequences",
          () =>
            formationMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "rendition" && target.id === "opening",
            ),
        ],
        [
          "worldMutationConsequences2",
          () =>
            worldMutation.consequences.staleReviews.some(
              (target) =>
                target.kind === "sequence" && target.id === "SEQ-SIGNAL",
            ),
        ],
        [
          "projectSetProductionDesign",
          () => project.setProductionDesign(productionDesign()).accepted,
        ],
        [
          "projectEraseDesignArtifact",
          () =>
            project.eraseDesignArtifact({
              kind: "shot",
              id: "second",
            }).accepted,
        ],
      ]),
      {
        modelMutationConsequences: true,
        modelMutationConsequences2: true,
        worldMutationConsequences: true,
        productionMutationCount: true,
        repaintedShotMutationConsequences: true,
        repaintedShotMutationConsequences2: true,
        repaintedShotMutationConsequences3: true,
        movedSequenceShotMutationConsequences: true,
        movedSequenceShotMutationConsequences2: true,
        repaintedAcceptanceMutationConsequences: true,
        movedAcceptanceMutationConsequences: true,
        movedAcceptanceMutationConsequences2: true,
        movedAcceptanceMutationConsequences3: true,
        movedAcceptanceMutationConsequences4: true,
        movedAcceptanceMutationConsequences5: true,
        movedAcceptanceMutationConsequences6: true,
        restoredAcceptanceMutationAccepted: true,
        modelMutationConsequences3: true,
        formationMutationConsequences: true,
        worldMutationConsequences2: true,
        projectSetProductionDesign: true,
        projectEraseDesignArtifact: true,
      },
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
    TestValidator.equals(
      "optimistic revision rejects stale resident writers",
      namedFacts([
        ["concurrentMutationAccepted", () => concurrentMutation.accepted],
        [
          "concurrentMutationRevision",
          () => concurrentMutation.revision > staleRevision,
        ],
        [
          "rejected",
          () =>
            throws(
              () => stale.setProductionDesign(productionDesign()),
              "Production revision changed",
            ),
        ],
      ]),
      {
        concurrentMutationAccepted: true,
        concurrentMutationRevision: true,
        rejected: true,
      },
    );
    const staleEraser = AutoMovieProductionProject.open(fixture.root);
    const staleEraseRevision = staleEraser.revision();
    const removableFormation = {
      ...formationDesign(),
      id: "stale-erase",
    };
    const formationAddition = first.setFormationDesign(removableFormation);
    TestValidator.equals(
      "optimistic revision rejects stale resident erasers",
      namedFacts([
        ["formationAdditionAccepted", () => formationAddition.accepted],
        [
          "formationAdditionRevision",
          () => formationAddition.revision > staleEraseRevision,
        ],
        [
          "rejected",
          () =>
            throws(
              () =>
                staleEraser.eraseDesignArtifact({
                  kind: "formation",
                  id: removableFormation.id,
                }),
              "Production revision changed",
            ),
        ],
        [
          "autoMovieProductionProjectOpen",
          () =>
            AutoMovieProductionProject.open(fixture.root).eraseDesignArtifact({
              kind: "formation",
              id: removableFormation.id,
            }).accepted,
        ],
      ]),
      {
        formationAdditionAccepted: true,
        formationAdditionRevision: true,
        rejected: true,
        autoMovieProductionProjectOpen: true,
      },
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
        let generatedTransientReadFailure:
          | IProductionProjectFixtureFailure
          | undefined;
        try {
          return Reflect.apply(nativeGeneratedRead, fs, [target, ...args]);
        } catch (error) {
          generatedTransientReadFailure = { error };
          throw error;
        } finally {
          preserveProductionProjectFixtureCleanup(
            generatedTransientReadFailure,
            [
              {
                resource: "generated-read transient replacement",
                cleanup: () => fs.rmSync(generatedReadPath),
              },
              {
                resource: "generated-read parked resident",
                cleanup: () =>
                  fs.renameSync(generatedReadParked, generatedReadPath),
              },
            ],
          );
        }
      }
      return Reflect.apply(nativeGeneratedRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    let generatedReadBytes: Uint8Array = new Uint8Array();
    let generatedReadFailure: IProductionProjectFixtureFailure | undefined;
    try {
      generatedReadBytes = project.readGeneratedFile("shots/opening.json");
    } catch (error) {
      generatedReadFailure = { error };
      throw error;
    } finally {
      const generatedResidentParked = fs.existsSync(generatedReadParked);
      preserveProductionProjectFixtureCleanup(generatedReadFailure, [
        {
          resource: "generated-read native hook",
          cleanup: () => {
            fs.readFileSync = nativeGeneratedRead;
          },
        },
        ...(generatedResidentParked
          ? [
              {
                resource: "generated-read transient replacement",
                cleanup: () => fs.rmSync(generatedReadPath, { force: true }),
              },
              {
                resource: "generated-read parked resident",
                cleanup: () =>
                  fs.renameSync(generatedReadParked, generatedReadPath),
              },
            ]
          : []),
      ]);
    }
    TestValidator.equals(
      "generated reads bind bytes to the verified descriptor across a pathname swap",
      namedFacts([
        ["noPathRead", () => generatedPathRead === false],
        [
          "residentBytes",
          () => Buffer.from(generatedReadBytes).equals(generatedReadBefore),
        ],
      ]),
      { noPathRead: true, residentBytes: true },
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
      TestValidator.equals(
        "generated reads and compiler ownership refuse a nested junction",
        namedFacts([
          [
            "rejected",
            () =>
              throws(() =>
                linkedProject.readGeneratedFile("shots/opening.json"),
              ),
          ],
          [
            "rejected2",
            () => throws(() => linkedProject.readGeneratedFile("shots")),
          ],
          [
            "rejected3",
            () => throws(() => linkedProject.readGeneratedFile("contracts")),
          ],
          [
            "unsafeGeneratedDiagnostics",
            () =>
              unsafeGenerated.diagnostics.some(
                (item) => item.code === "generated-path-outside",
              ),
          ],
        ]),
        {
          rejected: true,
          rejected2: true,
          rejected3: true,
          unsafeGeneratedDiagnostics: true,
        },
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
        path.join(modelRoot, "soloist.json"),
        path.join(outsideState, "soloist.json"),
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
    TestValidator.equals(
      "missing keyed design reads are explicit",
      namedFacts([
        [
          "missingShot",
          () => ownerProject.design({ kind: "shot", id: "absent" }) === null,
        ],
        [
          "missingAcceptance",
          () =>
            ownerProject.design({ kind: "acceptance", id: "absent" }) === null,
        ],
      ]),
      { missingShot: true, missingAcceptance: true },
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
        let generatedManifestTransientReadFailure:
          | IProductionProjectFixtureFailure
          | undefined;
        try {
          return Reflect.apply(nativeGeneratedManifestRead, fs, [
            target,
            ...args,
          ]);
        } catch (error) {
          generatedManifestTransientReadFailure = { error };
          throw error;
        } finally {
          preserveProductionProjectFixtureCleanup(
            generatedManifestTransientReadFailure,
            [
              {
                resource: "generated-manifest transient replacement",
                cleanup: () => fs.rmSync(generatedManifestPath),
              },
              {
                resource: "generated-manifest parked resident",
                cleanup: () =>
                  fs.renameSync(generatedManifestParked, generatedManifestPath),
              },
            ],
          );
        }
      }
      return Reflect.apply(nativeGeneratedManifestRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    let stableGeneratedCommitRejected = false;
    let repeatedGeneratedRevision = -1;
    let generatedManifestReadFailure:
      | IProductionProjectFixtureFailure
      | undefined;
    try {
      repeatedGeneratedRevision = ownerProject.commitGenerated(
        retainedBytes,
        smaller,
      );
    } catch (error) {
      generatedManifestReadFailure = { error };
      stableGeneratedCommitRejected = true;
    } finally {
      const generatedManifestResidentParked = fs.existsSync(
        generatedManifestParked,
      );
      preserveProductionProjectFixtureCleanup(generatedManifestReadFailure, [
        {
          resource: "generated-manifest native hook",
          cleanup: () => {
            fs.readFileSync = nativeGeneratedManifestRead;
          },
        },
        ...(generatedManifestResidentParked
          ? [
              {
                resource: "generated-manifest transient replacement",
                cleanup: () =>
                  fs.rmSync(generatedManifestPath, { force: true }),
              },
              {
                resource: "generated-manifest parked resident",
                cleanup: () =>
                  fs.renameSync(generatedManifestParked, generatedManifestPath),
              },
            ]
          : []),
      ]);
    }
    TestValidator.equals(
      "generated manifest guards bind exact bytes to descriptors",
      namedFacts([
        [
          "stableGeneratedCommitRejected",
          () => stableGeneratedCommitRejected === false,
        ],
        [
          "generatedManifestPathRead",
          () => generatedManifestPathRead === false,
        ],
        [
          "repeatedGeneratedRevisionStableGeneratedRevision",
          () => repeatedGeneratedRevision === stableGeneratedRevision,
        ],
        [
          "ownerProjectRevision",
          () => ownerProject.revision() === stableGeneratedRevision,
        ],
        [
          "nativeGeneratedManifestReadGeneratedManifestPath",
          () =>
            nativeGeneratedManifestRead(generatedManifestPath).equals(
              generatedManifestBefore,
            ),
        ],
      ]),
      {
        stableGeneratedCommitRejected: true,
        generatedManifestPathRead: true,
        repeatedGeneratedRevisionStableGeneratedRevision: true,
        ownerProjectRevision: true,
        nativeGeneratedManifestReadGeneratedManifestPath: true,
      },
    );
    TestValidator.predicate(
      "generated commit deletes formerly declared stale files",
      fs.existsSync(
        path.join(ownerProject.generatedRoot(), "shots/opening.json"),
      ) === false,
    );
    TestValidator.equals(
      "generated and render writes cannot escape owned roots",
      namedFacts([
        [
          "generatedRefused",
          () =>
            throws(() =>
              ownerProject.commitGenerated(
                new Map([["../escape", Buffer.from("x")]]),
                oldManifest,
              ),
            ),
        ],
        [
          "renderRefused",
          () =>
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
        ],
      ]),
      { generatedRefused: true, renderRefused: true },
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
    TestValidator.equals(
      "render bundle commits bytes and manifest atomically",
      namedFacts([
        ["blankRendererRefused", () => blankRendererRefused],
        ["revision", () => revision > 0],
        [
          "ownerProjectResident",
          () =>
            fs.existsSync(
              path.join(
                ownerProject.renderRoot(),
                renderBundle,
                "manifest.json",
              ),
            ),
        ],
      ]),
      {
        blankRendererRefused: true,
        revision: true,
        ownerProjectResident: true,
      },
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
    TestValidator.equals(
      "guarded render commit rolls back when inputs change during apply",
      namedFacts([
        ["guardedCommitRefused", () => guardedCommitRefused],
        ["inputGuardReads", () => inputGuardReads === 2],
        [
          "ownerProjectRevision",
          () => ownerProject.revision() === guardedRevision,
        ],
        [
          "ownerProjectRenderRoot",
          () =>
            fs
              .readFileSync(
                path.join(ownerProject.renderRoot(), renderBundle, "frame.bin"),
              )
              .equals(Buffer.from("frame")),
        ],
      ]),
      {
        guardedCommitRefused: true,
        inputGuardReads: true,
        ownerProjectRevision: true,
        ownerProjectRenderRoot: true,
      },
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
    TestValidator.equals(
      "manifest ownership includes every declared frame's current PNG bytes",
      namedFacts([
        ["tamperedRejected", () => tamperedRenderFrame === null],
        ["missingRejected", () => missingRenderFrame === null],
      ]),
      { tamperedRejected: true, missingRejected: true },
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
    TestValidator.equals(
      "render verification rejects duplicate frame ownership and false raster metadata",
      namedFacts([
        ["blankOwnedRenderer", () => blankOwnedRenderer === null],
        ["duplicateRenderFrame", () => duplicateRenderFrame === null],
        ["mismatchedRenderWidth", () => mismatchedRenderWidth === null],
        ["mismatchedRenderHeight", () => mismatchedRenderHeight === null],
      ]),
      {
        blankOwnedRenderer: true,
        duplicateRenderFrame: true,
        mismatchedRenderWidth: true,
        mismatchedRenderHeight: true,
      },
    );
    const nonCanonicalManifest = path.join(
      ownerProject.renderRoot(),
      "non-canonical",
      "manifest.json",
    );
    fs.mkdirSync(path.dirname(nonCanonicalManifest), { recursive: true });
    fs.writeFileSync(nonCanonicalManifest, renderManifestBytes);
    TestValidator.equals(
      "render verification refuses absent, non-file, external and non-canonical manifests",
      namedFacts([
        [
          "ownerProjectVerifiedRenderManifest",
          () =>
            ownerProject.verifiedRenderManifest(
              path.join(ownerProject.renderRoot(), "absent.json"),
            ) === null,
        ],
        [
          "ownerProjectVerifiedRenderManifest2",
          () =>
            ownerProject.verifiedRenderManifest(ownerProject.renderRoot()) ===
            null,
        ],
        [
          "ownerProjectVerifiedRenderManifest3",
          () =>
            ownerProject.verifiedRenderManifest(
              path.join(fixture.root, "package.json"),
            ) === null,
        ],
        [
          "ownerProjectVerifiedRenderManifest4",
          () =>
            ownerProject.verifiedRenderManifest(nonCanonicalManifest) === null,
        ],
      ]),
      {
        ownerProjectVerifiedRenderManifest: true,
        ownerProjectVerifiedRenderManifest2: true,
        ownerProjectVerifiedRenderManifest3: true,
        ownerProjectVerifiedRenderManifest4: true,
      },
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
    TestValidator.equals(
      "render verification validates manifest schema, JSON and receipt ownership",
      namedFacts([
        ["invalidRenderManifest", () => invalidRenderManifest === null],
        ["malformedRenderManifest", () => malformedRenderManifest === null],
        ["missingRenderReceipt", () => missingRenderReceipt === null],
        ["malformedRenderReceipt", () => malformedRenderReceipt === null],
        [
          "ownerProjectVerifiedRenderManifest",
          () =>
            ownerProject.verifiedRenderManifest(renderManifestPath) !== null,
        ],
      ]),
      {
        invalidRenderManifest: true,
        malformedRenderManifest: true,
        missingRenderReceipt: true,
        malformedRenderReceipt: true,
        ownerProjectVerifiedRenderManifest: true,
      },
    );
    TestValidator.equals(
      "render reads reject absent paths and directories",
      namedFacts([
        [
          "absentRejected",
          () => throws(() => ownerProject.readRenderFile("absent.bin")),
        ],
        [
          "directoryRejected",
          () => throws(() => ownerProject.readRenderFile(renderBundle)),
        ],
      ]),
      { absentRejected: true, directoryRejected: true },
    );
    let outsideRenderReadFailure:
      | ISingleProductionProjectFixtureFailure
      | undefined;
    const outsideRenderRead = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-render-read-"),
    );
    try {
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
      TestValidator.equals(
        "render reads reject linked files and non-directory ancestry",
        namedFacts([
          [
            "linkedFileRejected",
            () =>
              throws(() => ownerProject.readRenderFile("read-file-link.bin")),
          ],
          [
            "nonDirectoryParentRejected",
            () =>
              throws(() =>
                ownerProject.readRenderFile("read-parent-file/escape.bin"),
              ),
          ],
        ]),
        { linkedFileRejected: true, nonDirectoryParentRejected: true },
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
      let crossApiIdentityFailure: IProductionProjectFixtureFailure | undefined;
      try {
        fs.statSync(crossApiIdentityFile, { bigint: true });
        crossApiIdentityRead = Buffer.from(
          ownerProject.readRenderFile("read-cross-api-identity.bin"),
        ).toString("utf8");
      } catch (error) {
        crossApiIdentityFailure = { error };
        throw error;
      } finally {
        preserveProductionProjectFixtureCleanup(crossApiIdentityFailure, [
          {
            resource: "cross-API stat hook",
            cleanup: () => {
              mutableCrossApiStatFs.statSync = nativeCrossApiStat;
            },
          },
          {
            resource: "cross-API identity file",
            cleanup: () => fs.rmSync(crossApiIdentityFile),
          },
        ]);
      }
      TestValidator.equals(
        "render reads compare descriptor identities within one platform API domain",
        namedFacts([
          ["divergentIdentity", () => divergentPathIdentityObserved],
          ["residentBytes", () => crossApiIdentityRead === "resident"],
        ]),
        { divergentIdentity: true, residentBytes: true },
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
        let descriptorRaceFailure: IProductionProjectFixtureFailure | undefined;
        try {
          rejected = throws(() =>
            ownerProject.readRenderFile(
              path.relative(ownerProject.renderRoot(), file),
            ),
          );
        } catch (error) {
          descriptorRaceFailure = { error };
          throw error;
        } finally {
          const descriptorParked = fs.existsSync(parked);
          preserveProductionProjectFixtureCleanup(descriptorRaceFailure, [
            {
              resource: `descriptor-race ${replacement} open hook`,
              cleanup: () => {
                fs.openSync = nativeOpen;
              },
            },
            ...(descriptorParked
              ? [
                  {
                    resource: `descriptor-race ${replacement} active replacement`,
                    cleanup: () => {
                      if (fs.existsSync(file)) {
                        if (fs.lstatSync(file).isSymbolicLink())
                          fs.unlinkSync(file);
                        else fs.rmSync(file, { recursive: true, force: true });
                      }
                    },
                  },
                  {
                    resource: `descriptor-race ${replacement} parked file`,
                    cleanup: () => fs.renameSync(parked, file),
                  },
                ]
              : []),
            {
              resource: `descriptor-race ${replacement} directory`,
              cleanup: () =>
                fs.rmSync(directory, { recursive: true, force: true }),
            },
          ]);
        }
        return swapped && rejected;
      };
      TestValidator.equals(
        "an opened descriptor cannot bless a replaced render filename",
        namedFacts([
          ["descriptorRaceSymlink", () => descriptorRace("symlink")],
          ["descriptorRaceDirectory", () => descriptorRace("directory")],
          ["descriptorRaceRegular", () => descriptorRace("regular")],
        ]),
        {
          descriptorRaceSymlink: true,
          descriptorRaceDirectory: true,
          descriptorRaceRegular: true,
        },
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
        let ancestryRaceFailure: IProductionProjectFixtureFailure | undefined;
        try {
          rejected = throws(() =>
            ownerProject.readRenderFile(
              path.relative(ownerProject.renderRoot(), file),
            ),
          );
        } catch (error) {
          ancestryRaceFailure = { error };
          throw error;
        } finally {
          const ancestryParked = fs.existsSync(parked);
          preserveProductionProjectFixtureCleanup(ancestryRaceFailure, [
            {
              resource: `ancestry-race ${replacement} open hook`,
              cleanup: () => {
                fs.openSync = nativeOpen;
              },
            },
            ...(ancestryParked
              ? [
                  {
                    resource: `ancestry-race ${replacement} active replacement`,
                    cleanup: () => {
                      if (fs.existsSync(directory)) {
                        if (fs.lstatSync(directory).isSymbolicLink())
                          fs.unlinkSync(directory);
                        else
                          fs.rmSync(directory, {
                            recursive: true,
                            force: true,
                          });
                      }
                    },
                  },
                  {
                    resource: `ancestry-race ${replacement} parked directory`,
                    cleanup: () => fs.renameSync(parked, directory),
                  },
                ]
              : []),
            {
              resource: `ancestry-race ${replacement} directory`,
              cleanup: () =>
                fs.rmSync(directory, { recursive: true, force: true }),
            },
          ]);
        }
        return swapped && rejected;
      };
      TestValidator.equals(
        "render reads retain exact physical ancestry across descriptor acquisition",
        namedFacts([
          ["ancestryRaceMissing", () => ancestryRace("missing")],
          ["ancestryRaceJunction", () => ancestryRace("junction")],
          ["ancestryRaceDirectory", () => ancestryRace("directory")],
        ]),
        {
          ancestryRaceMissing: true,
          ancestryRaceJunction: true,
          ancestryRaceDirectory: true,
        },
      );

      const afterReadDirectory = path.join(
        ownerProject.renderRoot(),
        "read-after-descriptor",
      );
      const afterReadFile = path.join(afterReadDirectory, "frame.bin");
      const afterReadParked = `${afterReadFile}.parked`;
      fs.mkdirSync(afterReadDirectory);
      fs.writeFileSync(afterReadFile, "resident");
      // Render reads are fenced by coordinate locks whose snapshots are also
      // read through descriptors, so remember the descriptor this file's own
      // acquisition returns and swap only after that descriptor is read. Stat
      // identity is not usable here: Windows reports different `dev` values for
      // a descriptor and its path.
      const nativeAfterReadOpen = fs.openSync;
      const nativeDescriptorRead = fs.readFileSync;
      let afterReadDescriptor: number | null = null;
      let swappedAfterRead = false;
      fs.openSync = ((file: fs.PathLike, ...args: unknown[]): number => {
        const descriptor = Reflect.apply(nativeAfterReadOpen, fs, [
          file,
          ...args,
        ]) as number;
        if (
          afterReadDescriptor === null &&
          path.resolve(String(file)) === path.resolve(afterReadFile)
        )
          afterReadDescriptor = descriptor;
        return descriptor;
      }) as typeof fs.openSync;
      fs.readFileSync = ((
        target: fs.PathOrFileDescriptor,
        ...args: unknown[]
      ): unknown => {
        // prettier-ignore
        const bytes = Reflect.apply(nativeDescriptorRead, fs, [target, ...args]);
        if (swappedAfterRead === false && target === afterReadDescriptor) {
          fs.renameSync(afterReadFile, afterReadParked);
          fs.writeFileSync(afterReadFile, "replacement");
          swappedAfterRead = true;
        }
        return bytes;
      }) as typeof fs.readFileSync;
      let afterReadRejected = false;
      let afterReadFailure: IProductionProjectFixtureFailure | undefined;
      try {
        afterReadRejected = throws(() =>
          ownerProject.readRenderFile("read-after-descriptor/frame.bin"),
        );
      } catch (error) {
        afterReadFailure = { error };
        throw error;
      } finally {
        const afterReadWasParked = fs.existsSync(afterReadParked);
        preserveProductionProjectFixtureCleanup(afterReadFailure, [
          {
            resource: "post-descriptor read hook",
            cleanup: () => {
              fs.readFileSync = nativeDescriptorRead;
            },
          },
          {
            resource: "post-descriptor open hook",
            cleanup: () => {
              fs.openSync = nativeAfterReadOpen;
            },
          },
          ...(afterReadWasParked
            ? [
                {
                  resource: "post-descriptor active replacement",
                  cleanup: () => {
                    if (fs.existsSync(afterReadFile)) fs.rmSync(afterReadFile);
                  },
                },
                {
                  resource: "post-descriptor parked file",
                  cleanup: () => fs.renameSync(afterReadParked, afterReadFile),
                },
              ]
            : []),
          {
            resource: "post-descriptor directory",
            cleanup: () =>
              fs.rmSync(afterReadDirectory, { recursive: true, force: true }),
          },
        ]);
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
      let deniedOpenFailure: IProductionProjectFixtureFailure | undefined;
      try {
        deniedOpenRejected = throws(() =>
          ownerProject.readRenderFile("read-open-denied.bin"),
        );
      } catch (error) {
        deniedOpenFailure = { error };
        throw error;
      } finally {
        preserveProductionProjectFixtureCleanup(deniedOpenFailure, [
          {
            resource: "denied-open hook",
            cleanup: () => {
              fs.openSync = nativeDeniedOpen;
            },
          },
          {
            resource: "denied-open file",
            cleanup: () => fs.rmSync(deniedOpenFile),
          },
        ]);
      }
      TestValidator.equals(
        "render reads revalidate after descriptor I/O and preserve non-absence errors",
        { afterReadRejected, deniedOpenRejected, swappedAfterRead },
        {
          afterReadRejected: true,
          deniedOpenRejected: true,
          swappedAfterRead: true,
        },
      );
    } catch (error) {
      outsideRenderReadFailure = { error };
      throw error;
    } finally {
      preserveSingleProductionProjectFixtureCleanup(
        outsideRenderReadFailure,
        () => fs.rmSync(outsideRenderRead, { force: true, recursive: true }),
      );
    }
    const deliverableFiles = ownerProject.commitProductionDeliverableFiles(
      "feature*CON",
      new Map([
        ["z.bin", Buffer.from("z")],
        ["nested/a.bin", Buffer.from("a")],
      ]),
    );
    TestValidator.equals(
      "deliverable commits are nonempty, sorted and renderer-owned",
      namedFacts([
        [
          "deliverableFilesPaths",
          () => deliverableFiles.paths[0]?.endsWith("nested/a.bin") === true,
        ],
        [
          "deliverableFilesPaths2",
          () => deliverableFiles.paths[1]?.endsWith("z.bin") === true,
        ],
        [
          "deliverableFilesPaths3",
          () =>
            deliverableFiles.paths.every((file) =>
              fs.existsSync(path.join(ownerProject.renderRoot(), file)),
            ),
        ],
        [
          "rejected",
          () =>
            throws(() =>
              ownerProject.commitProductionDeliverableFiles("empty", new Map()),
            ),
        ],
        [
          "rejected2",
          () =>
            throws(() =>
              ownerProject.commitProductionDeliverableFiles(
                "unsafe",
                new Map([["../escape.bin", Buffer.from("x")]]),
              ),
            ),
        ],
        [
          "rejected3",
          () =>
            throws(() =>
              ownerProject.commitProductionDeliverableFiles(
                "duplicate",
                new Map([
                  ["nested/../same.bin", Buffer.from("first")],
                  ["same.bin", Buffer.from("second")],
                ]),
              ),
            ),
        ],
        [
          "rejected4",
          () =>
            throws(() =>
              ownerProject.commitProductionDeliverableFiles(
                "case-collision",
                new Map([
                  ["Frame.bin", Buffer.from("first")],
                  ["frame.bin", Buffer.from("second")],
                ]),
              ),
            ),
        ],
      ]),
      {
        deliverableFilesPaths: true,
        deliverableFilesPaths2: true,
        deliverableFilesPaths3: true,
        rejected: true,
        rejected2: true,
        rejected3: true,
        rejected4: true,
      },
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
        let rollbackTransientReadFailure:
          | IProductionProjectFixtureFailure
          | undefined;
        try {
          return Reflect.apply(nativeRollbackRead, fs, [target, ...args]);
        } catch (error) {
          rollbackTransientReadFailure = { error };
          throw error;
        } finally {
          preserveProductionProjectFixtureCleanup(
            rollbackTransientReadFailure,
            [
              {
                resource: "rollback-read transient replacement",
                cleanup: () => fs.rmSync(renderFramePath),
              },
              {
                resource: "rollback-read parked frame",
                cleanup: () =>
                  fs.renameSync(rollbackReadParked, renderFramePath),
              },
            ],
          );
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
    let renderRollbackFailure: IProductionProjectFixtureFailure | undefined;
    try {
      TestValidator.equals(
        "multi-file commit rolls back updated and newly created files",
        namedFacts([
          [
            "rejected",
            () =>
              throws(() =>
                ownerProject.commitRenderBundle(
                  renderBundle,
                  new Map([
                    ["frame.bin", Buffer.from("changed")],
                    ["new.bin", Buffer.from("new")],
                  ]),
                  renderManifest,
                ),
              ),
          ],
          ["rollbackPathRead", () => rollbackPathRead === false],
          [
            "nativeRollbackReadRenderFramePath",
            () =>
              nativeRollbackRead(renderFramePath).equals(frameBeforeFailure),
          ],
          [
            "nativeRollbackReadRenderManifestPath",
            () =>
              nativeRollbackRead(renderManifestPath).equals(
                manifestBeforeFailure,
              ),
          ],
          [
            "ownerProjectResident",
            () =>
              fs.existsSync(
                path.join(ownerProject.renderRoot(), renderBundle, "new.bin"),
              ) === false,
          ],
          [
            "ownerProjectRevision",
            () => ownerProject.revision() === revisionBeforeFailure,
          ],
        ]),
        {
          rejected: true,
          rollbackPathRead: true,
          nativeRollbackReadRenderFramePath: true,
          nativeRollbackReadRenderManifestPath: true,
          ownerProjectResident: true,
          ownerProjectRevision: true,
        },
      );
    } catch (error) {
      renderRollbackFailure = { error };
      throw error;
    } finally {
      const rollbackFrameParked = fs.existsSync(rollbackReadParked);
      preserveProductionProjectFixtureCleanup(renderRollbackFailure, [
        {
          resource: "rollback rename hook",
          cleanup: () => {
            fs.renameSync = renameSync;
          },
        },
        {
          resource: "rollback read hook",
          cleanup: () => {
            fs.readFileSync = nativeRollbackRead;
          },
        },
        ...(rollbackFrameParked
          ? [
              {
                resource: "rollback transient frame",
                cleanup: () => fs.rmSync(renderFramePath, { force: true }),
              },
              {
                resource: "rollback parked frame",
                cleanup: () =>
                  fs.renameSync(rollbackReadParked, renderFramePath),
              },
            ]
          : []),
      ]);
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
    let rollbackAggregateFailure: IProductionProjectFixtureFailure | undefined;
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
      TestValidator.equals(
        "rollback failure is surfaced as an aggregate instead of hidden",
        namedFacts([
          ["aggregate", () => aggregate],
          [
            "revisionUnchanged",
            () => ownerProject.revision() === revisionBeforeFailure,
          ],
        ]),
        { aggregate: true, revisionUnchanged: true },
      );
    } catch (error) {
      rollbackAggregateFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(rollbackAggregateFailure, [
        {
          resource: "rollback-aggregate rename hook",
          cleanup: () => {
            fs.renameSync = renameSync;
          },
        },
        {
          resource: "rollback-aggregate frame baseline",
          cleanup: () => fs.writeFileSync(renderFramePath, frameBeforeFailure),
        },
        {
          resource: "rollback-aggregate manifest baseline",
          cleanup: () =>
            fs.writeFileSync(renderManifestPath, manifestBeforeFailure),
        },
      ]);
    }
    fs.rmSync(renderFramePath);
    let outsideRenderTargetFailure:
      | ISingleProductionProjectFixtureFailure
      | undefined;
    const outsideRenderTarget = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-render-target-"),
    );
    try {
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
    } catch (error) {
      outsideRenderTargetFailure = { error };
      throw error;
    } finally {
      preserveSingleProductionProjectFixtureCleanup(
        outsideRenderTargetFailure,
        () => fs.rmSync(outsideRenderTarget, { force: true, recursive: true }),
      );
    }
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
    let deniedLstatHookFailure: IProductionProjectFixtureFailure | undefined;
    try {
      TestValidator.predicate(
        "non-missing lstat errors are not hidden as absent files",
        throws(() => ownerProject.readTrackedStateFile("denied.json")),
      );
    } catch (error) {
      deniedLstatHookFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(deniedLstatHookFailure, [
        {
          resource: "tracked-state lstat hook",
          cleanup: () => {
            Object.defineProperty(fs, "lstatSync", {
              configurable: true,
              value: lstatSync,
            });
          },
        },
      ]);
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
    // Owned reads acquire a descriptor and read bytes through it, so the race
    // window is the acquisition: removing the enumerated file just before its
    // open makes the inventory observe the disappearance instead of reading an
    // already-opened inode.
    const residentInventoryOpen = fs.openSync;
    fs.openSync = ((file: fs.PathLike, ...args: unknown[]) => {
      if (path.resolve(String(file)) === path.resolve(vanished))
        fs.rmSync(vanished, { force: true });
      return (residentInventoryOpen as (...parameters: unknown[]) => number)(
        file,
        ...args,
      );
    }) as typeof fs.openSync;
    let inventoryReadHookFailure: IProductionProjectFixtureFailure | undefined;
    try {
      TestValidator.predicate(
        "a design disappearing during inventory is a loud race",
        throws(() => ownerProject.graph(), "disappeared while reading"),
      );
    } catch (error) {
      inventoryReadHookFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(inventoryReadHookFailure, [
        {
          resource: "design-inventory open hook",
          cleanup: () => {
            fs.openSync = residentInventoryOpen;
          },
        },
      ]);
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
    TestValidator.equals(
      "declared content roots and files enter deterministic compilation identity",
      namedFacts([
        [
          "inputsInput",
          () =>
            inputs.some(
              (input) =>
                input.path === "viewer/src/main.ts" && input.bytes !== null,
            ),
        ],
        [
          "inputsInput2",
          () =>
            inputs.some(
              (input) =>
                input.path === "automovie.config.ts" && input.bytes !== null,
            ),
        ],
        [
          "inputsInput3",
          () =>
            inputs.some(
              (input) =>
                input.path === "missing-content.file" && input.bytes === null,
            ),
        ],
        [
          "inputsInput4",
          () =>
            inputs.some(
              (input) =>
                input.path === ".automovie/assets.json" &&
                input.bytes !== null &&
                input.source === false &&
                input.render === false,
            ),
        ],
        [
          "inputsInput5",
          () =>
            inputs.some(
              (input) =>
                input.path === "src/shots/opening.ts" &&
                input.source &&
                input.render,
            ),
        ],
      ]),
      {
        inputsInput: true,
        inputsInput2: true,
        inputsInput3: true,
        inputsInput4: true,
        inputsInput5: true,
      },
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
        let contentTransientReadFailure:
          | IProductionProjectFixtureFailure
          | undefined;
        try {
          return Reflect.apply(nativeContentRead, fs, [target, ...args]);
        } catch (error) {
          contentTransientReadFailure = { error };
          throw error;
        } finally {
          preserveProductionProjectFixtureCleanup(contentTransientReadFailure, [
            {
              resource: `content-read transient replacement ${resolved}`,
              cleanup: () => fs.rmSync(resolved),
            },
            {
              resource: `content-read parked resident ${resolved}`,
              cleanup: () => fs.renameSync(parked, resolved),
            },
          ]);
        }
      }
      return Reflect.apply(nativeContentRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    let boundContentInputs: ReturnType<
      AutoMovieProductionProject["contentInputs"]
    > = [];
    let contentReadFailure: IProductionProjectFixtureFailure | undefined;
    try {
      boundContentInputs = contentProject.contentInputs();
    } catch (error) {
      contentReadFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(contentReadFailure, [
        {
          resource: "content-read native hook",
          cleanup: () => {
            fs.readFileSync = nativeContentRead;
          },
        },
        ...[...contentReadResidents.keys()].flatMap((file) => {
          const parked = `${file}.parked`;
          return fs.existsSync(parked)
            ? [
                {
                  resource: `content-read transient replacement ${file}`,
                  cleanup: () => fs.rmSync(file, { force: true }),
                },
                {
                  resource: `content-read parked resident ${file}`,
                  cleanup: () => fs.renameSync(parked, file),
                },
              ]
            : [];
        }),
      ]);
    }
    TestValidator.equals(
      "declared content reads bind rooted, direct, and asset bytes to verified descriptors",
      namedFacts([
        ["noPathReads", () => contentPathReads.size === 0],
        [
          "residentBytes",
          () =>
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
        ],
      ]),
      { noPathReads: true, residentBytes: true },
    );
    let outsideContentFailure:
      | ISingleProductionProjectFixtureFailure
      | undefined;
    const outsideContent = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-content-junction-"),
    );
    try {
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
    } catch (error) {
      outsideContentFailure = { error };
      throw error;
    } finally {
      preserveSingleProductionProjectFixtureCleanup(outsideContentFailure, () =>
        fs.rmSync(outsideContent, { force: true, recursive: true }),
      );
    }
    let racedOutsideFailure: ISingleProductionProjectFixtureFailure | undefined;
    const racedOutside = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-content-race-"),
    );
    try {
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
    } catch (error) {
      racedOutsideFailure = { error };
      throw error;
    } finally {
      preserveSingleProductionProjectFixtureCleanup(racedOutsideFailure, () =>
        fs.rmSync(racedOutside, { force: true, recursive: true }),
      );
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

  let invalidRootFailure: ISingleProductionProjectFixtureFailure | undefined;
  const invalidRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-production-root-"),
  );
  try {
    const fileRoot = path.join(invalidRoot, "file");
    fs.writeFileSync(fileRoot, "x");
    TestValidator.equals(
      "project root must be a directory",
      namedFacts([
        [
          "fileRootRejected",
          () => throws(() => AutoMovieProductionProject.open(fileRoot)),
        ],
        [
          "fileParentRejected",
          () =>
            throws(
              () =>
                AutoMovieProductionProject.open(path.join(fileRoot, "child")),
              "parent",
            ),
        ],
      ]),
      { fileRootRejected: true, fileParentRejected: true },
    );
    TestValidator.predicate(
      "project root must not be a filesystem root",
      throws(() =>
        AutoMovieProductionProject.open(path.parse(invalidRoot).root),
      ),
    );
    const fresh = path.join(invalidRoot, "fresh");
    const initialized = AutoMovieProductionProject.open(fresh);
    TestValidator.equals(
      "fresh project initializes format and directories",
      namedFacts([
        ["initializedSummary", () => initialized.summary().initialized],
        ["initializedRevision", () => initialized.revision() === 0],
        [
          "initializedInventory",
          () => initialized.inventory().production === false,
        ],
        ["initializedCount", () => initialized.contentInputs().length === 0],
      ]),
      {
        initializedSummary: true,
        initializedRevision: true,
        initializedInventory: true,
        initializedCount: true,
      },
    );
    const nativeWriteForExistingRoot = fs.writeFileSync;
    let attemptedParentSiblingLock = false;
    fs.writeFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): void => {
      // Every write into the parent, not one basename. Root namespace locks
      // live under the home directory, so a hook that only refused a sibling
      // named after the project could never fire, and the fact below was true
      // because nothing was tried rather than because nothing was needed.
      if (
        typeof file !== "number" &&
        path.dirname(path.resolve(file.toString())) ===
          fs.realpathSync(invalidRoot)
      ) {
        attemptedParentSiblingLock = true;
        const error = new Error("parent is intentionally not writable");
        Object.assign(error, { code: "EACCES" });
        throw error;
      }
      Reflect.apply(nativeWriteForExistingRoot, fs, [file, ...args]);
    }) as typeof fs.writeFileSync;
    let existingRootHookFailure: IProductionProjectFixtureFailure | undefined;
    try {
      TestValidator.equals(
        "an existing writable project does not require writable parent access",
        namedFacts([
          [
            "openedInPlace",
            () =>
              AutoMovieProductionProject.open(fresh).root ===
              fs.realpathSync(fresh),
          ],
          ["noParentLock", () => attemptedParentSiblingLock === false],
        ]),
        { openedInPlace: true, noParentLock: true },
      );
    } catch (error) {
      existingRootHookFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(existingRootHookFailure, [
        {
          resource: "existing-root write hook",
          cleanup: () => {
            fs.writeFileSync = nativeWriteForExistingRoot;
          },
        },
      ]);
    }
    const nestedFresh = path.join(invalidRoot, "missing", "nested", "project");
    TestValidator.equals(
      "fresh project recursively creates a missing nested root",
      namedFacts([
        [
          "nestedRoot",
          () =>
            AutoMovieProductionProject.open(nestedFresh).root === nestedFresh,
        ],
        [
          "incarnationWritten",
          () =>
            fs.existsSync(
              path.join(nestedFresh, ".automovie/incarnation.json"),
            ),
        ],
      ]),
      { nestedRoot: true, incarnationWritten: true },
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
    let aliasOpenHookFailure: IProductionProjectFixtureFailure | undefined;
    try {
      AutoMovieProductionProject.open(aliasProject);
    } catch (error) {
      aliasOpenHookFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(aliasOpenHookFailure, [
        {
          resource: "alias-open write hook",
          cleanup: () => {
            fs.writeFileSync = nativeWriteForAlias;
          },
        },
      ]);
    }
    TestValidator.equals(
      "ancestor aliases create through the physical parent then hold the project-owned namespace",
      namedFacts([
        [
          "aliasLockPathsCount",
          () =>
            aliasLockPaths.filter((file) =>
              path.basename(file).startsWith("create-"),
            ).length === 2,
        ],
        [
          "aliasLockPathsCount2",
          () =>
            aliasLockPaths.filter((file) =>
              path.basename(file).startsWith("root-"),
            ).length === 2,
        ],
        [
          "aliasLockPathsFile",
          () =>
            aliasLockPaths.every(
              (file) =>
                path.basename(path.dirname(file)) === ".automovie-root-locks",
            ),
        ],
        [
          "realpathSyncPhysicalAliasParent",
          () =>
            fs
              .readdirSync(fs.realpathSync(physicalAliasParent))
              .every((entry) => entry.includes("automovie-root") === false),
        ],
        [
          "realpathSyncAliasProject",
          () =>
            fs
              .readdirSync(fs.realpathSync(aliasProject))
              .every((entry) => entry.includes("automovie-root") === false),
        ],
      ]),
      {
        aliasLockPathsCount: true,
        aliasLockPathsCount2: true,
        aliasLockPathsFile: true,
        realpathSyncPhysicalAliasParent: true,
        realpathSyncAliasProject: true,
      },
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
    let requestedSwapFailure: IProductionProjectFixtureFailure | undefined;
    try {
      requestedSwapRejected = throws(
        () => acquireProductionRootNamespace(aliasProject),
        "changed physical identity",
      );
    } catch (error) {
      requestedSwapFailure = { error };
      throw error;
    } finally {
      const requestedSwapAttempted = requestedRootLocks === 2;
      preserveProductionProjectFixtureCleanup(requestedSwapFailure, [
        {
          resource: "requested-swap write hook",
          cleanup: () => {
            fs.writeFileSync = nativeWriteForRequestedSwap;
          },
        },
        ...(requestedSwapAttempted
          ? [
              {
                resource: "requested-swap active alias",
                cleanup: () => {
                  if (fs.existsSync(aliasParent)) fs.rmSync(aliasParent);
                },
              },
              {
                resource: "requested-swap physical alias",
                cleanup: () =>
                  fs.symlinkSync(physicalAliasParent, aliasParent, "junction"),
              },
            ]
          : []),
      ]);
    }
    TestValidator.equals(
      "a requested alias swapped after physical lock acquisition is rejected",
      namedFacts([
        ["rejected", () => requestedSwapRejected],
        ["bothCoordinates", () => requestedRootLocks === 2],
      ]),
      { rejected: true, bothCoordinates: true },
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
    let missingBaseHookFailure: IProductionProjectFixtureFailure | undefined;
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
    } catch (error) {
      missingBaseHookFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(missingBaseHookFailure, [
        {
          resource: "missing-base lstat hook",
          cleanup: () => {
            mutableLstatFs.lstatSync = nativeLstatForMissingBase;
          },
        },
      ]);
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
    TestValidator.equals(
      "a missing parent replaced by a file while creation locks are held is rejected",
      namedFacts([
        ["parentCollisionRejected", () => parentCollisionRejected],
        ["parentCollisionLocks", () => parentCollisionLocks === 2],
        [
          "collidingParentProjectResident",
          () => fs.existsSync(collidingParentProject) === false,
        ],
      ]),
      {
        parentCollisionRejected: true,
        parentCollisionLocks: true,
        collidingParentProjectResident: true,
      },
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
    TestValidator.equals(
      "a missing project root replaced by a file while creation locks are held is rejected",
      namedFacts([
        ["rootCollisionRejected", () => rootCollisionRejected],
        ["rootCollisionLocks", () => rootCollisionLocks === 2],
        [
          "collidingRootUtf8",
          () => fs.readFileSync(collidingRoot, "utf8") === "collision",
        ],
      ]),
      {
        rootCollisionRejected: true,
        rootCollisionLocks: true,
        collidingRootUtf8: true,
      },
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
    let createdAliasFailure: IProductionProjectFixtureFailure | undefined;
    try {
      createdAliasRejected = throws(
        () => AutoMovieProductionProject.open(createdAliasProject),
        "changed physical identity",
      );
    } catch (error) {
      createdAliasFailure = { error };
      throw error;
    } finally {
      const createdAliasSwapAttempted = createdAliasLocks.length === 2;
      preserveProductionProjectFixtureCleanup(createdAliasFailure, [
        {
          resource: "created-alias write hook",
          cleanup: () => {
            fs.writeFileSync = nativeWriteForCreatedAlias;
          },
        },
        ...(createdAliasSwapAttempted
          ? [
              {
                resource: "created-alias active alias",
                cleanup: () => {
                  if (fs.existsSync(createdAliasParent))
                    fs.rmSync(createdAliasParent);
                },
              },
              {
                resource: "created-alias physical alias",
                cleanup: () =>
                  fs.symlinkSync(
                    createdPhysicalParent,
                    createdAliasParent,
                    "junction",
                  ),
              },
            ]
          : []),
      ]);
    }
    TestValidator.equals(
      "a newly created physical root releases its lease when the requested alias changes afterward",
      namedFacts([
        ["createdAliasRejected", () => createdAliasRejected],
        ["createdAliasLocksCount", () => createdAliasLocks.length === 2],
        [
          "createdAliasLocksFile",
          () =>
            createdAliasLocks.every((file) => fs.existsSync(file) === false),
        ],
        [
          "createdAlternateParentResident",
          () =>
            fs.existsSync(path.join(createdAlternateParent, "project")) ===
            false,
        ],
      ]),
      {
        createdAliasRejected: true,
        createdAliasLocksCount: true,
        createdAliasLocksFile: true,
        createdAlternateParentResident: true,
      },
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
        let fenceTransientReadFailure:
          | IProductionProjectFixtureFailure
          | undefined;
        try {
          return Reflect.apply(nativeFenceRead, fs, [file, ...args]);
        } catch (error) {
          fenceTransientReadFailure = { error };
          throw error;
        } finally {
          preserveProductionProjectFixtureCleanup(fenceTransientReadFailure, [
            {
              resource: "assertion-fence transient replacement",
              cleanup: () => {
                if (fs.existsSync(assertedFence.path))
                  fs.rmSync(assertedFence.path);
              },
            },
            {
              resource: "assertion-fence parked token",
              cleanup: () =>
                fs.renameSync(assertedFenceParked, assertedFence.path),
            },
          ]);
        }
      }
      return Reflect.apply(nativeFenceRead, fs, [file, ...args]);
    }) as typeof fs.readFileSync;
    let fenceAssertionFailure: IProductionProjectFixtureFailure | undefined;
    try {
      assertProductionRootNamespaceLease(assertionLease);
      fenceAssertionSucceeded = true;
    } catch (error) {
      fenceAssertionFailure = { error };
      throw error;
    } finally {
      const fenceWasParked = fs.existsSync(assertedFenceParked);
      preserveProductionProjectFixtureCleanup(fenceAssertionFailure, [
        {
          resource: "assertion-fence read hook",
          cleanup: () => {
            fs.readFileSync = nativeFenceRead;
          },
        },
        ...(fenceWasParked
          ? [
              {
                resource: "assertion-fence active token",
                cleanup: () => {
                  if (fs.existsSync(assertedFence.path))
                    fs.rmSync(assertedFence.path);
                },
              },
              {
                resource: "assertion-fence parked token",
                cleanup: () =>
                  fs.renameSync(assertedFenceParked, assertedFence.path),
              },
            ]
          : []),
        {
          resource: "assertion-fence namespace lease",
          cleanup: () => releaseProductionRootNamespace(assertionLease),
        },
      ]);
    }
    TestValidator.equals(
      "root namespace assertions bind fence tokens to descriptors",
      namedFacts([
        ["asserted", () => fenceAssertionSucceeded],
        ["noPathRead", () => fencePathRead === false],
      ]),
      { asserted: true, noPathRead: true },
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
    let outerLease:
      | ReturnType<typeof acquireProductionRootNamespace>
      | undefined;
    let innerLease:
      | ReturnType<typeof acquireProductionRootNamespace>
      | undefined;
    let reentrantAcquisitionFailure:
      | IProductionProjectFixtureFailure
      | undefined;
    try {
      outerLease = acquireProductionRootNamespace(aliasProject);
      innerLease = acquireProductionRootNamespace(aliasProject);
    } catch (error) {
      reentrantAcquisitionFailure = { error };
      throw error;
    } finally {
      const acquiredInnerLease = innerLease;
      const acquiredOuterLease = outerLease;
      let reentrantHookRestoreFailed = false;
      preserveProductionProjectFixtureCleanup(reentrantAcquisitionFailure, [
        {
          resource: "reentrant namespace write hook",
          cleanup: () => {
            try {
              fs.writeFileSync = nativeWriteForReentrancy;
            } catch (error) {
              reentrantHookRestoreFailed = true;
              throw error;
            }
          },
        },
        ...(acquiredInnerLease === undefined
          ? []
          : [
              {
                resource: "reentrant inner namespace lease",
                cleanup: () => {
                  if (
                    reentrantAcquisitionFailure !== undefined ||
                    reentrantHookRestoreFailed
                  )
                    releaseProductionRootNamespace(acquiredInnerLease);
                },
              },
            ]),
        ...(acquiredOuterLease === undefined
          ? []
          : [
              {
                resource: "reentrant outer namespace lease",
                cleanup: () => {
                  if (
                    reentrantAcquisitionFailure !== undefined ||
                    reentrantHookRestoreFailed
                  )
                    releaseProductionRootNamespace(acquiredOuterLease);
                },
              },
            ]),
      ]);
    }
    const heldAfterInnerRelease = ((): boolean => {
      releaseProductionRootNamespace(innerLease!);
      return reentrantLocks.every((file) => fs.existsSync(file));
    })();
    releaseProductionRootNamespace(outerLease!);
    TestValidator.equals(
      "one process reaches the same root coordinate twice without deadlocking",
      {
        coordinates: reentrantLocks.length,
        sharedTokens: outerLease!.locks.every(
          (lock, index) => lock.token === innerLease!.locks[index]?.token,
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
    let parentSwapFailure: IProductionProjectFixtureFailure | undefined;
    try {
      parentSwapRejected = throws(
        () => AutoMovieProductionProject.open(swappedProject),
        "changed physical identity",
      );
    } catch (error) {
      parentSwapFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(parentSwapFailure, [
        {
          resource: "creation-parent swap write hook",
          cleanup: () => {
            fs.writeFileSync = nativeWriteForParentSwap;
          },
        },
      ]);
    }
    TestValidator.equals(
      "a parent replaced while creation fences are acquired is rejected before either tree receives a child",
      namedFacts([
        ["parentSwapRejected", () => parentSwapRejected],
        [
          "swappedProjectResident",
          () => fs.existsSync(swappedProject) === false,
        ],
        [
          "originalParentResident",
          () => fs.existsSync(path.join(originalParent, "project")) === false,
        ],
        ["swapLockPathsCount", () => swapLockPaths.length === 2],
        [
          "swapLockPathsFile",
          () => swapLockPaths.every((file) => fs.existsSync(file) === false),
        ],
      ]),
      {
        parentSwapRejected: true,
        swappedProjectResident: true,
        originalParentResident: true,
        swapLockPathsCount: true,
        swapLockPathsFile: true,
      },
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
      let replacementParentFailure:
        | IProductionProjectFixtureFailure
        | undefined;
      try {
        rejected = throws(
          () => AutoMovieProductionProject.open(projectPath),
          "changed physical identity",
        );
      } catch (error) {
        replacementParentFailure = { error };
        throw error;
      } finally {
        preserveProductionProjectFixtureCleanup(replacementParentFailure, [
          {
            resource: `${replacement} parent write hook`,
            cleanup: () => {
              fs.writeFileSync = nativeWriteForReplacement;
            },
          },
        ]);
      }
      TestValidator.equals(
        `a ${replacement} creation parent fails closed and releases both coordinates`,
        namedFacts([
          ["rejected", () => rejected],
          ["existsSyncProjectPath", () => fs.existsSync(projectPath) === false],
          [
            "existsSyncArchivedProject",
            () => fs.existsSync(path.join(archived, "project")) === false,
          ],
          ["lockPaths", () => lockPaths.length === 2],
          [
            "lockPathsFileExistsSync",
            () => lockPaths.every((file) => fs.existsSync(file) === false),
          ],
        ]),
        {
          rejected: true,
          existsSyncProjectPath: true,
          existsSyncArchivedProject: true,
          lockPaths: true,
          lockPathsFileExistsSync: true,
        },
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
    let coordinationMkdirFailure: IProductionProjectFixtureFailure | undefined;
    try {
      TestValidator.predicate(
        "a root coordination directory creation failure is fail-closed",
        throws(
          () => AutoMovieProductionProject.open(fresh),
          "coordination mkdir denied",
        ),
      );
    } catch (error) {
      coordinationMkdirFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(coordinationMkdirFailure, [
        {
          resource: "coordination mkdir hook",
          cleanup: () => {
            fs.mkdirSync = nativeCoordinationMkdir;
          },
        },
      ]);
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
      let coordinationCollisionFailure:
        | IProductionProjectFixtureFailure
        | undefined;
      try {
        TestValidator.predicate(
          `a ${name} root coordination collision is rejected`,
          throws(
            () => AutoMovieProductionProject.open(fresh),
            "is not a physical directory",
          ),
        );
      } catch (error) {
        coordinationCollisionFailure = { error };
        throw error;
      } finally {
        preserveProductionProjectFixtureCleanup(coordinationCollisionFailure, [
          {
            resource: `${name} coordination lstat hook`,
            cleanup: () => {
              mutableFs.lstatSync = nativeCoordinationLstat;
            },
          },
        ]);
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
    let deniedRootLstatFailure: IProductionProjectFixtureFailure | undefined;
    try {
      TestValidator.predicate(
        "an unexpected project-root lstat denial propagates",
        throws(
          () => AutoMovieProductionProject.open(deniedRoot),
          "injected project-root lstat denial",
        ),
      );
    } catch (error) {
      deniedRootLstatFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(deniedRootLstatFailure, [
        {
          resource: "project-root lstat descriptor",
          cleanup: () =>
            Object.defineProperty(fs, "lstatSync", nativeRootLstatDescriptor),
        },
      ]);
    }
    const nativeCoordinationChmod = fs.chmodSync;
    fs.chmodSync = ((file: fs.PathLike): void => {
      if (path.resolve(file.toString()) === coordinationRoot)
        throw new Error("coordination chmod denied");
      nativeCoordinationChmod(file, 0o700);
    }) as typeof fs.chmodSync;
    let coordinationChmodFailure: IProductionProjectFixtureFailure | undefined;
    try {
      TestValidator.predicate(
        "an insecure coordination permission failure is fail-closed",
        throws(
          () => AutoMovieProductionProject.open(fresh),
          "coordination chmod denied",
        ),
      );
    } catch (error) {
      coordinationChmodFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(coordinationChmodFailure, [
        {
          resource: "coordination chmod hook",
          cleanup: () => {
            fs.chmodSync = nativeCoordinationChmod;
          },
        },
      ]);
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
    let partialCoordinateFailure: IProductionProjectFixtureFailure | undefined;
    try {
      TestValidator.equals(
        "partial dual-coordinate acquisition releases the physical identity fence",
        namedFacts([
          [
            "rejected",
            () =>
              throws(
                () => AutoMovieProductionProject.open(fresh),
                "second root coordinate denied",
              ),
          ],
          [
            "partiallyHeldCoordinatesCount",
            () => partiallyHeldCoordinates.length === 1,
          ],
          [
            "partiallyHeldCoordinatesFile",
            () =>
              partiallyHeldCoordinates.every(
                (file) => fs.existsSync(file) === false,
              ),
          ],
        ]),
        {
          rejected: true,
          partiallyHeldCoordinatesCount: true,
          partiallyHeldCoordinatesFile: true,
        },
      );
    } catch (error) {
      partialCoordinateFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(partialCoordinateFailure, [
        {
          resource: "partial-coordinate write hook",
          cleanup: () => {
            fs.writeFileSync = nativeCoordinateWrite;
          },
        },
      ]);
    }
    const staleRoot = path.join(invalidRoot, "stale-physical-root");
    const staleProject = AutoMovieProductionProject.open(staleRoot);
    const staleRenderRoot = staleProject.renderRoot();
    const parkedStaleRoot = `${staleRoot}-parked`;
    fs.renameSync(staleRoot, parkedStaleRoot);
    fs.cpSync(parkedStaleRoot, staleRoot, { recursive: true });
    TestValidator.equals(
      "a byte-identical physical root replacement invalidates every stale handle operation",
      namedFacts([
        [
          "rejected",
          () => throws(() => staleProject.manifest(), "root identity changed"),
        ],
        [
          "rejected2",
          () =>
            throws(
              () =>
                staleProject.commitProductionDeliverableFiles(
                  "stale-root-write",
                  new Map([["frame.bin", Buffer.from("unsafe")]]),
                ),
              "root identity changed",
            ),
        ],
        [
          "staleRenderRootResident",
          () =>
            fs.existsSync(
              path.join(
                staleRenderRoot,
                "deliverables/stale-root-write/frame.bin",
              ),
            ) === false,
        ],
      ]),
      {
        rejected: true,
        rejected2: true,
        staleRenderRootResident: true,
      },
    );
    const missingIdentityRoot = path.join(invalidRoot, "missing-identity-root");
    const missingIdentityProject =
      AutoMovieProductionProject.open(missingIdentityRoot);
    const parkedMissingIdentityRoot = `${missingIdentityRoot}-parked`;
    fs.renameSync(missingIdentityRoot, parkedMissingIdentityRoot);
    let missingIdentityFailure: IProductionProjectFixtureFailure | undefined;
    try {
      TestValidator.predicate(
        "an absent physical root invalidates a stale handle before any read",
        throws(
          () => missingIdentityProject.manifest(),
          "root identity changed",
        ),
      );
    } catch (error) {
      missingIdentityFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(missingIdentityFailure, [
        {
          resource: "missing-identity parked root",
          cleanup: () =>
            fs.renameSync(parkedMissingIdentityRoot, missingIdentityRoot),
        },
      ]);
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
    TestValidator.equals(
      "a replacement acquired after argument staging is rejected against the open handle identity",
      namedFacts([
        ["acquiredReplacementSwapped", () => acquiredReplacementSwapped],
        ["acquiredReplacementRejected", () => acquiredReplacementRejected],
        ["acquiredReplacementUntouched", () => acquiredReplacementUntouched],
      ]),
      {
        acquiredReplacementSwapped: true,
        acquiredReplacementRejected: true,
        acquiredReplacementUntouched: true,
      },
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
    // An owned read reaches the target through the owner's real path, which a
    // temporary root can spell differently from the fixture's own join.
    const preLeaseTargetReal = fs.realpathSync(preLeaseTarget);
    const nativeReadForPreLease = fs.readFileSync;
    const nativeOpenForPreLease = fs.openSync;
    const nativeCloseForPreLease = fs.closeSync;
    let preLeaseSwapped = false;
    // Record what the staging read actually opens: an owned read reaches its
    // target through a descriptor, so a pathname comparison never sees it.
    const preLeasePathReads: string[] = [];
    let preLeaseDescriptorReads = 0;
    let preLeaseDescriptor: number | null = null;
    fs.readFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      const output = Reflect.apply(nativeReadForPreLease, fs, [file, ...args]);
      if (typeof file === "number") preLeaseDescriptorReads += 1;
      else preLeasePathReads.push(path.resolve(file.toString()));
      return output;
    }) as typeof fs.readFileSync;
    fs.openSync = ((file: fs.PathLike, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpenForPreLease, fs, [
        file,
        ...args,
      ]) as number;
      const resolved = path.resolve(file.toString());
      if (
        preLeaseDescriptor === null &&
        (resolved === preLeaseTarget || resolved === preLeaseTargetReal)
      )
        preLeaseDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    // Replace the root when the staging read closes its own descriptor: the
    // lease is still held, and no handle is open inside the tree, which a
    // directory rename requires on Windows.
    fs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeCloseForPreLease, fs, [descriptor]);
      if (preLeaseSwapped === false && descriptor === preLeaseDescriptor) {
        preLeaseSwapped = true;
        fs.renameSync(preLeaseRoot, parkedPreLeaseRoot);
        fs.cpSync(parkedPreLeaseRoot, preLeaseRoot, { recursive: true });
      }
    }) as typeof fs.closeSync;
    let preLeaseRejected = false;
    let preLeaseReplacementUntouched = false;
    let preLeaseFailure: IProductionProjectFixtureFailure | undefined;
    try {
      preLeaseRejected = throws(
        () =>
          preLeaseProject.commitProductionDeliverableFiles(
            "pre-lease",
            new Map([["frame.bin", Buffer.from("after")]]),
          ),
        "namespace fence changed",
      );
    } catch (error) {
      preLeaseFailure = { error };
      throw error;
    } finally {
      const preLeaseWasSwapped = fs.existsSync(parkedPreLeaseRoot);
      preserveProductionProjectFixtureCleanup(preLeaseFailure, [
        {
          resource: "pre-lease read hook",
          cleanup: () => {
            fs.readFileSync = nativeReadForPreLease;
          },
        },
        {
          resource: "pre-lease open hook",
          cleanup: () => {
            fs.openSync = nativeOpenForPreLease;
          },
        },
        {
          resource: "pre-lease close hook",
          cleanup: () => {
            fs.closeSync = nativeCloseForPreLease;
          },
        },
        {
          resource: "pre-lease replacement observation",
          cleanup: () => {
            preLeaseReplacementUntouched =
              Reflect.apply(nativeReadForPreLease, fs, [
                preLeaseTarget,
                "utf8",
              ]) === "before";
          },
        },
        ...(preLeaseWasSwapped
          ? [
              {
                resource: "pre-lease active replacement",
                cleanup: () =>
                  fs.rmSync(preLeaseRoot, { force: true, recursive: true }),
              },
              {
                resource: "pre-lease parked root",
                cleanup: () => fs.renameSync(parkedPreLeaseRoot, preLeaseRoot),
              },
            ]
          : []),
      ]);
    }
    TestValidator.equals(
      "a root replaced while staging under the namespace lease is refused without mutation",
      {
        descriptorReads: preLeaseDescriptorReads === 0 ? "none" : "some",
        rejected: preLeaseRejected,
        replacementUntouched: preLeaseReplacementUntouched,
        swapped: preLeaseSwapped,
        targetDescriptorOpened: preLeaseDescriptor !== null,
        targetPathRead: preLeasePathReads.includes(preLeaseTarget),
      },
      {
        descriptorReads: "some",
        rejected: true,
        replacementUntouched: true,
        swapped: true,
        targetDescriptorOpened: true,
        targetPathRead: false,
      },
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
    let atomicDeleteFailure: IProductionProjectFixtureFailure | undefined;
    try {
      atomicDeleteRejected = throws(
        () =>
          initialized.eraseDesignArtifact({
            kind: "model",
            id: atomicDeleteModel.id,
          }),
        "injected quarantine delete denial",
      );
    } catch (error) {
      atomicDeleteFailure = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(atomicDeleteFailure, [
        {
          resource: "atomic-delete rm hook",
          cleanup: () => {
            Reflect.set(fs, "rmSync", nativeRmForAtomicDelete);
          },
        },
      ]);
    }
    // Observe in the scenario's own order: the erase is a mutation and has to
    // follow every reading of the restored file, which an object literal's
    // property order would otherwise decide.
    const atomicDeleteResident = fs
      .readFileSync(atomicDeleteTarget)
      .equals(atomicDeleteBytes);
    const atomicDeleteRevisionAfter = initialized.revision();
    const atomicDeleteLeftovers = fs
      .readdirSync(path.dirname(atomicDeleteTarget))
      .filter((entry) =>
        entry.startsWith(`${path.basename(atomicDeleteTarget)}.delete.`),
      );
    const atomicDeleteErasable = initialized.eraseDesignArtifact({
      kind: "model",
      id: atomicDeleteModel.id,
    }).accepted;
    TestValidator.equals(
      "a failed quarantine cleanup restores the exact deleted file and revision",
      {
        denied: quarantineDeleteDenied,
        erasable: atomicDeleteErasable,
        quarantineLeftovers: atomicDeleteLeftovers,
        rejected: atomicDeleteRejected,
        residentBytes: atomicDeleteResident,
        revision: atomicDeleteRevisionAfter,
      },
      {
        denied: true,
        erasable: true,
        quarantineLeftovers: [],
        rejected: true,
        residentBytes: true,
        revision: atomicDeleteRevision,
      },
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
    let replacementUntouched = false;
    let abandonedLockReleased = false;
    let processOwnershipReleased = false;
    const mutationLock = path.join(
      mutationRoot,
      ".automovie/productions/mutation-root/revision.lock",
    );
    let abandonedToken: string | undefined;
    let replacementToken: string | undefined;
    let mutationHarnessFailure: IProductionProjectFixtureFailure | undefined;
    try {
      try {
        mutationProject.commitProductionDeliverableFiles(
          "root-swap",
          new Map([["frame.bin", Buffer.from("unsafe")]]),
        );
      } catch (error) {
        mutationSwapRejected =
          error instanceof AggregateError &&
          error.message.includes("No stale-path rollback was attempted");
        if (mutationSwapRejected === false) throw error;
      }
      replacementUntouched = fs.existsSync(mutationFrame) === false;
      if (mutationRootSwapped) {
        const abandonedLock = path.join(
          parkedMutationRoot,
          ".automovie/productions/mutation-root/revision.lock",
        );
        abandonedToken = fs.readFileSync(abandonedLock, "utf8");
        fs.mkdirSync(
          path.join(mutationRoot, ".automovie/productions/mutation-root"),
          {
            recursive: true,
          },
        );
        replacementToken = acquireCommitLock(mutationLock);
        processOwnershipReleased =
          replacementToken !== abandonedToken &&
          fs.readFileSync(mutationLock, "utf8") === replacementToken;
      }
    } catch (error) {
      mutationHarnessFailure = { error };
      throw error;
    } finally {
      const acquiredReplacementToken = replacementToken;
      const acquiredAbandonedToken = abandonedToken;
      const mutationRootWasParked = fs.existsSync(parkedMutationRoot);
      let mutationRootRestored = false;
      preserveProductionProjectFixtureCleanup(mutationHarnessFailure, [
        {
          resource: "mutation-root rename hook",
          cleanup: () => {
            fs.renameSync = nativeRenameForMutationSwap;
          },
        },
        ...(acquiredReplacementToken === undefined
          ? []
          : [
              {
                resource: "mutation-root replacement lock",
                cleanup: () =>
                  releaseCommitLock(mutationLock, acquiredReplacementToken),
              },
            ]),
        ...(mutationRootWasParked
          ? [
              {
                resource: "mutation-root active replacement",
                cleanup: () =>
                  fs.rmSync(mutationRoot, { force: true, recursive: true }),
              },
              {
                resource: "mutation-root parked original",
                cleanup: () => {
                  fs.renameSync(parkedMutationRoot, mutationRoot);
                  mutationRootRestored = true;
                },
              },
            ]
          : []),
        ...(acquiredAbandonedToken === undefined
          ? []
          : [
              {
                resource: "mutation-root abandoned lock",
                cleanup: () => {
                  const abandonedLock = mutationRootRestored
                    ? mutationLock
                    : path.join(
                        parkedMutationRoot,
                        ".automovie/productions/mutation-root/revision.lock",
                      );
                  releaseCommitLock(abandonedLock, acquiredAbandonedToken);
                  abandonedLockReleased =
                    fs.existsSync(abandonedLock) === false;
                },
              },
            ]),
      ]);
    }
    TestValidator.equals(
      "a root swapped during publication refuses rollback and stale lock release in the replacement",
      namedFacts([
        ["mutationRootSwapped", () => mutationRootSwapped],
        ["mutationSwapRejected", () => mutationSwapRejected],
        ["replacementUntouched", () => replacementUntouched],
        ["processOwnershipReleased", () => processOwnershipReleased],
        ["abandonedLockReleased", () => abandonedLockReleased],
      ]),
      {
        mutationRootSwapped: true,
        mutationSwapRejected: true,
        replacementUntouched: true,
        processOwnershipReleased: true,
        abandonedLockReleased: true,
      },
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
    TestValidator.equals(
      "reserved state cannot escape through a junction",
      namedFacts([
        [
          "rejected",
          () =>
            throws(() => AutoMovieProductionProject.open(stateJunctionRoot)),
        ],
        ["outsideUntouched", () => fs.readdirSync(stateOutside).length === 0],
      ]),
      { rejected: true, outsideUntouched: true },
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
  } catch (error) {
    invalidRootFailure = { error };
    throw error;
  } finally {
    preserveSingleProductionProjectFixtureCleanup(invalidRootFailure, () =>
      fs.rmSync(invalidRoot, { force: true, recursive: true }),
    );
  }
};
