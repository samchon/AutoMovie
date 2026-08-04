import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "@automovie/cli";
import {
  Vector3,
  formationSlot,
  reachPose,
  sampleFormationMotion,
  transformFormationPoint,
} from "@automovie/engine";
import { IAutoMovieGeneratedManifest } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  formationDesign,
  productionFixture,
  setProductionFixtureShotContract,
  shotContract,
} from "../mcp/productionFixtures";

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

interface IProjectStateFixtureFailure {
  error: unknown;
}

class ProjectStateFixtureCleanupError extends AggregateError {}

/** Dispose the project-state fixture without replacing its primary failure. */
export const preserveProjectStateFixtureCleanup = (
  failure: IProjectStateFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProjectStateFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Project-state fixture teardown failed after the test failed.",
    );
  }
};

interface IProjectStateHarnessCleanup {
  cleanup: () => unknown;
  resource: string;
}

class ProjectStateHarnessCleanupError extends AggregateError {}

/** Attempt every project-state harness restoration without hiding failure. */
export const preserveProjectStateHarnessCleanup = (
  failure: IProjectStateFixtureFailure | undefined,
  resources: readonly IProjectStateHarnessCleanup[],
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
    throw new ProjectStateHarnessCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `Project-state harness cleanup failed${
        failure === undefined ? "" : " after the state read failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};

/**
 * The transport-free project reader authenticates one compiled snapshot, feeds
 * its typed values directly to pure engine geometry, and refuses stale bytes.
 */
export const test_cli_project_state = (): void => {
  const fixture = productionFixture();
  let projectStateFailure: IProjectStateFixtureFailure | undefined;
  try {
    const sourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const formation = {
      ...formationDesign(),
      id: "army",
      anchor: { x: 3, y: 0, z: -4 },
    };
    const formationPath = path.join(
      fixture.root,
      ".automovie/design/formations/army.json",
    );
    const formationContract = {
      ...shotContract(),
      participants: [
        ...shotContract().participants,
        { kind: "formation" as const, id: "army" },
      ],
    };
    fs.mkdirSync(path.dirname(formationPath), { recursive: true });
    fs.writeFileSync(formationPath, `${JSON.stringify(formation, null, 2)}\n`);
    const project = AutoMovieProductionProject.open(fixture.root);
    TestValidator.predicate(
      "state-reader formation contract updates design and source registration",
      setProductionFixtureShotContract(project, formationContract).accepted,
    );
    const originalSource = fs.readFileSync(sourcePath, "utf8");
    const missing = loadAutoMovieProjectState({ root: fixture.root });
    TestValidator.equals(
      "uncompiled project state is explicit",
      namedFacts([
        ["missingProductionId", () => missing.productionId === "fixture-film"],
        ["missingFreshness", () => missing.freshness.status === "missing"],
        [
          "missingFreshness2",
          () => missing.freshness.compileFingerprint === null,
        ],
        ["missingGenerated", () => missing.generated.registry === null],
      ]),
      {
        missingProductionId: true,
        missingFreshness: true,
        missingFreshness2: true,
        missingGenerated: true,
      },
    );
    TestValidator.predicate(
      "missing project state cannot be narrowed",
      refusesCurrent(missing),
    );

    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    TestValidator.predicate("state-reader fixture compiles", compiled.success);
    const loaded = loadAutoMovieProjectState({ root: fixture.root });
    const current = requireCurrentAutoMovieProjectState(loaded);
    const shot = current.generated.shots.get("opening")!;
    const loadedFormation = current.generated.design.formations.get("army")!;
    const runtime = shot.formations.find(
      (candidate) => candidate.id === loadedFormation.id,
    )!;
    const base = formationSlot(loadedFormation, 1).position;
    const motion = sampleFormationMotion(
      shot.formationMotions,
      loadedFormation.id,
      3,
    );
    const moved = transformFormationPoint(
      base,
      runtime.anchor,
      motion,
      runtime.facingDeg,
    );
    const landmark = current.generated.design.world.landmarks.find(
      (candidate) => candidate.id === "signal-ground",
    )!.position;
    const meters = Vector3.length(Vector3.subtract(moved, landmark));
    const actor = shot.scene.nodes.find(
      (candidate) => candidate.id === "sentinel",
    )!;
    const model = shot.models.find(
      (candidate) => candidate.id === actor.model,
    )!;
    const left =
      model.skeleton === null
        ? null
        : reachPose(model.skeleton, "left", landmark);
    const repeatedLeft =
      model.skeleton === null
        ? null
        : reachPose(model.skeleton, "left", landmark);
    TestValidator.equals(
      "loaded state feeds deterministic engine reach distance and formation queries",
      namedFacts([
        ["currentRevision", () => current.revision === compiled.revision],
        [
          "currentFreshness",
          () =>
            current.freshness.compileFingerprint ===
            compiled.compiler.inputFingerprint,
        ],
        [
          "currentFreshness2",
          () =>
            current.freshness.currentFingerprint ===
            compiled.compiler.inputFingerprint,
        ],
        ["currentCount", () => current.freshness.problems.length === 0],
        [
          "currentGenerated",
          () =>
            current.generated.registry.inputFingerprint ===
            compiled.compiler.inputFingerprint,
        ],
        [
          "currentGenerated2",
          () =>
            current.generated.registry.shots.some(
              (candidate) => candidate.id === "opening",
            ),
        ],
        [
          "currentGenerated3",
          () => current.generated.film?.id === "fixture-film",
        ],
        ["movedX", () => moved.x === 3],
        ["movedZ", () => moved.z === -5],
        ["absMeters", () => Math.abs(meters - Math.sqrt(34)) < 1e-12],
        ["left", () => left !== null],
        [
          "stringifyLeft",
          () =>
            left !== null &&
            JSON.stringify(left) === JSON.stringify(repeatedLeft),
        ],
      ]),
      {
        currentRevision: true,
        currentFreshness: true,
        currentFreshness2: true,
        currentCount: true,
        currentGenerated: true,
        currentGenerated2: true,
        currentGenerated3: true,
        movedX: true,
        movedZ: true,
        absMeters: true,
        left: true,
        stringifyLeft: true,
      },
    );

    const generatedManifest = project.generatedManifest()!;
    const generatedManifestMethod =
      AutoMovieProductionProject.prototype.generatedManifest;
    const readGeneratedFileMethod =
      AutoMovieProductionProject.prototype.readGeneratedFile;
    const registryPath = "manifests/compile.json";
    const registryBytes = project.readGeneratedFile(registryPath);
    const registry = JSON.parse(
      Buffer.from(registryBytes).toString("utf8"),
    ) as {
      productionId: string;
      inputFingerprint: string;
      assets: Array<{ id: string; path: string }>;
      shots: Array<{ id: string; path: string }>;
      film: string | null;
    };
    const withManifest = (
      nextManifest: IAutoMovieGeneratedManifest,
      replacements: ReadonlyMap<string, Uint8Array> = new Map(),
    ): ReturnType<typeof loadAutoMovieProjectState> => {
      AutoMovieProductionProject.prototype.generatedManifest = () =>
        structuredClone(nextManifest);
      AutoMovieProductionProject.prototype.readGeneratedFile = function (file) {
        return (
          replacements.get(file) ?? readGeneratedFileMethod.call(this, file)
        );
      };
      let manifestReadFailure: IProjectStateFixtureFailure | undefined;
      try {
        return loadAutoMovieProjectState({ root: fixture.root });
      } catch (error) {
        manifestReadFailure = { error };
        throw error;
      } finally {
        preserveProjectStateHarnessCleanup(manifestReadFailure, [
          {
            resource: "generated-manifest prototype hook",
            cleanup: () => {
              AutoMovieProductionProject.prototype.generatedManifest =
                generatedManifestMethod;
            },
          },
          {
            resource: "generated-file prototype hook",
            cleanup: () => {
              AutoMovieProductionProject.prototype.readGeneratedFile =
                readGeneratedFileMethod;
            },
          },
        ]);
      }
    };
    const manifestWith = (
      file: string,
      bytes: Uint8Array,
    ): IAutoMovieGeneratedManifest => ({
      ...structuredClone(generatedManifest),
      files: [
        ...generatedManifest.files.filter((entry) => entry.path !== file),
        {
          ...generatedManifest.files[0]!,
          path: file,
          digest: digestAutoMovieBytes(bytes),
        },
      ],
    });

    const duplicateFile = withManifest({
      ...structuredClone(generatedManifest),
      files: [
        ...generatedManifest.files,
        structuredClone(generatedManifest.files[0]!),
      ],
    });
    const unreadableFile = withManifest({
      ...structuredClone(generatedManifest),
      files: [
        ...generatedManifest.files,
        {
          ...generatedManifest.files[0]!,
          path: "contracts/models/unreadable.json",
          digest: digestAutoMovieBytes(Buffer.from("{}")),
        },
      ],
    });
    const invalidJsonBytes = Buffer.from("{");
    const invalidJson = withManifest(
      manifestWith("contracts/models/invalid.json", invalidJsonBytes),
      new Map([["contracts/models/invalid.json", invalidJsonBytes]]),
    );
    const modelContract = generatedManifest.files.find((file) =>
      file.path.startsWith("contracts/models/"),
    )!;
    const duplicateModelBytes = project.readGeneratedFile(modelContract.path);
    const duplicateModel = withManifest(
      manifestWith("contracts/models/duplicate.json", duplicateModelBytes),
      new Map([["contracts/models/duplicate.json", duplicateModelBytes]]),
    );
    const compiledShot = generatedManifest.files.find((file) =>
      file.path.startsWith("shots/"),
    )!;
    const duplicateShotBytes = project.readGeneratedFile(compiledShot.path);
    const duplicateShot = withManifest(
      manifestWith("shots/duplicate.json", duplicateShotBytes),
      new Map([["shots/duplicate.json", duplicateShotBytes]]),
    );
    TestValidator.equals(
      "ownership manifest and generated JSON boundaries are explicit",
      namedFacts([
        [
          "duplicateFileFreshness",
          () =>
            duplicateFile.freshness.problems.some(
              (problem) => problem.code === "generated-file-duplicate",
            ),
        ],
        [
          "unreadableFileFreshness",
          () =>
            unreadableFile.freshness.problems.some(
              (problem) => problem.code === "generated-file-unreadable",
            ),
        ],
        [
          "invalidJsonFreshness",
          () =>
            invalidJson.freshness.problems.some(
              (problem) => problem.code === "generated-json-invalid",
            ),
        ],
        [
          "duplicateModelFreshness",
          () =>
            duplicateModel.freshness.problems.some(
              (problem) => problem.code === "generated-id-duplicate",
            ),
        ],
        [
          "duplicateShotFreshness",
          () =>
            duplicateShot.freshness.problems.some(
              (problem) => problem.code === "generated-id-duplicate",
            ),
        ],
      ]),
      {
        duplicateFileFreshness: true,
        unreadableFileFreshness: true,
        invalidJsonFreshness: true,
        duplicateModelFreshness: true,
        duplicateShotFreshness: true,
      },
    );

    const mismatchedRegistryBytes = Buffer.from(
      JSON.stringify({
        ...registry,
        productionId: "other-production",
        assets: registry.assets.map((asset, index) =>
          index === 0 ? { ...asset, path: "models/missing.json" } : asset,
        ),
        shots: registry.shots.map((shot, index) =>
          index === 0 ? { ...shot, path: "shots/missing.json" } : shot,
        ),
        film: null,
      }),
    );
    const mismatchedRegistry = withManifest(
      manifestWith(registryPath, mismatchedRegistryBytes),
      new Map([[registryPath, mismatchedRegistryBytes]]),
    );
    const mismatchedFilmBytes = Buffer.from(
      JSON.stringify({ ...registry, film: "other-film" }),
    );
    const mismatchedFilm = withManifest(
      manifestWith(registryPath, mismatchedFilmBytes),
      new Map([[registryPath, mismatchedFilmBytes]]),
    );
    const incomplete = withManifest({
      ...structuredClone(generatedManifest),
      files: generatedManifest.files.filter(
        (file) => file.path !== "contracts/world.json",
      ),
    });
    TestValidator.equals(
      "registry joins and required generated contracts fail closed",
      namedFacts([
        [
          "mismatchedRegistryCount",
          () =>
            mismatchedRegistry.freshness.problems.filter(
              (problem) => problem.code === "generated-registry-mismatch",
            ).length >= 4,
        ],
        [
          "mismatchedFilmFreshness",
          () =>
            mismatchedFilm.freshness.problems.some(
              (problem) =>
                problem.code === "generated-registry-mismatch" &&
                problem.path === "film-timeline.json",
            ),
        ],
        [
          "incompleteFreshness",
          () =>
            incomplete.freshness.problems.some(
              (problem) => problem.code === "generated-state-incomplete",
            ),
        ],
      ]),
      {
        mismatchedRegistryCount: true,
        mismatchedFilmFreshness: true,
        incompleteFreshness: true,
      },
    );

    AutoMovieProductionProject.prototype.generatedManifest = () => {
      throw new Error("manifest unreadable");
    };
    let invalidManifest: ReturnType<typeof loadAutoMovieProjectState>;
    try {
      invalidManifest = loadAutoMovieProjectState({ root: fixture.root });
    } finally {
      AutoMovieProductionProject.prototype.generatedManifest =
        generatedManifestMethod;
    }
    TestValidator.predicate(
      "a malformed ownership manifest is stale rather than missing",
      invalidManifest.freshness.status === "stale" &&
        invalidManifest.freshness.problems.some(
          (problem) => problem.code === "generated-manifest-invalid",
        ),
    );

    const compilerLint = AutoMovieProductionCompiler.prototype.lint;
    const nonError = (function* (): Generator<never, never, never> {
      return undefined as never;
    })();
    let compilerCalls = 0;
    AutoMovieProductionCompiler.prototype.lint = function (input) {
      ++compilerCalls;
      if (compilerCalls === 1)
        return nonError.throw("lint unavailable") as never;
      return compilerLint.call(this, input);
    };
    const unavailableStatus = loadAutoMovieProjectState({
      root: fixture.root,
    });
    AutoMovieProductionCompiler.prototype.lint = compilerLint;
    const unsuccessfulOutput = compilerLint.call(
      new AutoMovieProductionCompiler(project),
      { scope: "source" },
    );
    AutoMovieProductionCompiler.prototype.lint = function () {
      return { ...unsuccessfulOutput, success: false };
    };
    const invalidStatus = loadAutoMovieProjectState({ root: fixture.root });
    AutoMovieProductionCompiler.prototype.lint = compilerLint;
    TestValidator.predicate(
      "unavailable and unsuccessful current compilation are distinguished",
      unavailableStatus.freshness.problems.some(
        (problem) =>
          problem.code === "compile-status-unavailable" &&
          problem.message === "lint unavailable",
      ) &&
        invalidStatus.freshness.problems.some(
          (problem) => problem.code === "current-compile-invalid",
        ),
    );

    const lint = AutoMovieProductionCompiler.prototype.lint;
    let sourceRaceInjected = false;
    AutoMovieProductionCompiler.prototype.lint = function (input) {
      const output = lint.call(this, input);
      if (sourceRaceInjected === false) {
        sourceRaceInjected = true;
        fs.appendFileSync(sourcePath, "\n// injected during state read\n");
      }
      return output;
    };
    let raced: ReturnType<typeof loadAutoMovieProjectState>;
    let sourceRaceFailure: IProjectStateFixtureFailure | undefined;
    try {
      raced = loadAutoMovieProjectState({ root: fixture.root });
    } catch (error) {
      sourceRaceFailure = { error };
      throw error;
    } finally {
      preserveProjectStateHarnessCleanup(sourceRaceFailure, [
        {
          resource: "compiler-lint prototype hook",
          cleanup: () => {
            AutoMovieProductionCompiler.prototype.lint = lint;
          },
        },
        {
          resource: "source bytes",
          cleanup: () => {
            fs.writeFileSync(sourcePath, originalSource);
          },
        },
      ]);
    }
    TestValidator.equals(
      "source changes between fingerprint fences cannot look current",
      namedFacts([
        ["racedFreshness", () => raced.freshness.status === "stale"],
        [
          "racedFreshness2",
          () =>
            raced.freshness.problems.some(
              (problem) => problem.code === "project-state-changed",
            ),
        ],
        [
          "racedFreshness3",
          () =>
            raced.freshness.currentFingerprint !==
            raced.freshness.compileFingerprint,
        ],
        ["refusesCurrentRaced", () => refusesCurrent(raced)],
      ]),
      {
        racedFreshness: true,
        racedFreshness2: true,
        racedFreshness3: true,
        refusesCurrentRaced: true,
      },
    );

    fs.appendFileSync(sourcePath, "\n// stale reader fixture\n");
    const stale = loadAutoMovieProjectState({ root: fixture.root });
    TestValidator.equals(
      "source drift preserves the identified old snapshot but marks it stale",
      namedFacts([
        ["staleFreshness", () => stale.freshness.status === "stale"],
        [
          "staleFreshness2",
          () =>
            stale.freshness.compileFingerprint ===
            compiled.compiler.inputFingerprint,
        ],
        [
          "staleFreshness3",
          () =>
            stale.freshness.currentFingerprint !==
            stale.freshness.compileFingerprint,
        ],
        ["staleGenerated", () => stale.generated.shots.has("opening")],
        ["refusesCurrentStale", () => refusesCurrent(stale)],
      ]),
      {
        staleFreshness: true,
        staleFreshness2: true,
        staleFreshness3: true,
        staleGenerated: true,
        refusesCurrentStale: true,
      },
    );

    fs.writeFileSync(sourcePath, originalSource);
    const generatedShot = path.join(
      project.generatedRoot(),
      "shots/opening.json",
    );
    fs.appendFileSync(generatedShot, "\n");
    const modified = loadAutoMovieProjectState({ root: fixture.root });
    TestValidator.equals(
      "modified compiler bytes are excluded and reported stale",
      namedFacts([
        ["modifiedFreshness", () => modified.freshness.status === "stale"],
        [
          "modifiedFreshness2",
          () =>
            modified.freshness.problems.some(
              (problem) =>
                problem.code === "generated-file-modified" &&
                problem.path === "shots/opening.json",
            ),
        ],
        [
          "modifiedGenerated",
          () => modified.generated.shots.has("opening") === false,
        ],
        ["refusesCurrentModified", () => refusesCurrent(modified)],
      ]),
      {
        modifiedFreshness: true,
        modifiedFreshness2: true,
        modifiedGenerated: true,
        refusesCurrentModified: true,
      },
    );
  } catch (error) {
    projectStateFailure = { error };
    throw error;
  } finally {
    preserveProjectStateFixtureCleanup(projectStateFailure, () =>
      fixture.dispose(),
    );
  }
};

const refusesCurrent = (
  state: ReturnType<typeof loadAutoMovieProjectState>,
): boolean => {
  try {
    requireCurrentAutoMovieProjectState(state);
    return false;
  } catch {
    return true;
  }
};
