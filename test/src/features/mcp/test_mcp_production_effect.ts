import {
  IAutoMovieCompiledShotSource,
  IAutoMovieShotEffectCue,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionOracleService,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
  materializeCompiledEffects,
  validateAutoMovieEffects,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionFixture,
  shotContract,
  worldDesign,
} from "./productionFixtures";

interface IProductionEffectFixtureFailure {
  error: unknown;
}

class ProductionEffectFixtureCleanupError extends AggregateError {}

/** Dispose the production-effect fixture without replacing its failure. */
const preserveProductionEffectFixtureCleanup = (
  failure: IProductionEffectFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionEffectFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Production-effect fixture teardown failed after the test failed.",
    );
  }
};

/**
 * Effect source compilation, validation, and oracle queries must share one
 * bounded compiler-owned stream. The test exercises the same current generated
 * shot through both the happy path and the corruption/ambiguity guards.
 *
 * Scenarios:
 *
 * 1. A valid smoke cue compiles with its semantic event and the oracle reports an
 *    active, digest-bound, capped particle summary at an in-range time.
 * 2. End-exclusive sampling reports inactive, while duplicate subject ids and a
 *    missing effect zone fail closed with actionable diagnostics.
 * 3. Validation accepts the current cue and rejects excessive/duplicate ids,
 *    absent zones, invalid intervals/intensity/events, overlaps, and every
 *    cue-to-compiled-stream cardinality mismatch.
 * 4. Materialization without a compiler-owned world recipe emits no stream.
 * 5. A digest-consistent but ambiguous generated shot with two streams for one
 *    zone is rejected instead of selecting an arbitrary inactive gap.
 * 6. A digest-consistent shot whose selected camera is absent is rejected before
 *    an effect measurement can claim geometry.
 */
export const test_mcp_production_effect = (): void => {
  const fixture = productionFixture();
  let productionEffectFailure: IProductionEffectFixtureFailure | undefined;
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    project.setWorldDesign(worldDesign());
    const compile = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    const compileSucceeded = productionCompileSucceeded(
      "effect fixture",
      compile,
    );
    const compiled = compileSucceeded
      ? (JSON.parse(
          fs.readFileSync(
            path.join(
              fixture.root,
              "generated/fixture-film/shots/opening.json",
            ),
            "utf8",
          ),
        ) as IAutoMovieCompiledShotSource)
      : null;
    const summary = new AutoMovieProductionOracleService(project).query({
      request: {
        query: "effect",
        zone: "plaza-haze",
        shot: "opening",
        time: 2,
        subjects: ["soloist"],
      },
    });
    const inactive = new AutoMovieProductionOracleService(project).query({
      request: {
        query: "effect",
        zone: "plaza-haze",
        shot: "opening",
        time: 5,
      },
    });
    const unsafeSubjects = new AutoMovieProductionOracleService(project).query({
      request: {
        query: "effect",
        zone: "plaza-haze",
        shot: "opening",
        time: 2,
        subjects: ["soloist", "soloist"],
      },
    });
    const missingZone = new AutoMovieProductionOracleService(project).query({
      request: {
        query: "effect",
        zone: "missing",
        shot: "opening",
        time: 2,
      },
    });
    const invalidTimes = [Number.NaN, -1, 7].map((time) =>
      new AutoMovieProductionOracleService(project).query({
        request: {
          query: "effect",
          zone: "plaza-haze",
          shot: "opening",
          time,
        },
      }),
    );
    const missingCompiledShot = new AutoMovieProductionOracleService(
      project,
    ).query({
      request: {
        query: "effect",
        zone: "plaza-haze",
        shot: "absent",
        time: 2,
      },
    });
    TestValidator.equals(
      "source cue becomes one current deterministic effect stream and oracle summary",
      namedFacts([
        ["compileSucceeded", () => compileSucceeded],
        [
          "compiledEffectsLength",
          () => compileSucceeded && compiled?.effects.length === 1,
        ],
        [
          "compiledEffects0",
          () =>
            compileSucceeded &&
            compiled?.effects.length === 1 &&
            compiled.effects[0]?.kind === "smoke",
        ],
        [
          "compiledEffects02",
          () =>
            compileSucceeded &&
            compiled?.effects.length === 1 &&
            compiled.effects[0]?.kind === "smoke" &&
            compiled.effects[0]?.event === "cue-raised",
        ],
        [
          "summaryResultKind",
          () =>
            compileSucceeded &&
            compiled?.effects.length === 1 &&
            compiled.effects[0]?.kind === "smoke" &&
            compiled.effects[0]?.event === "cue-raised" &&
            summary.result?.kind === "measurement",
        ],
        [
          "summaryResultValues",
          () =>
            compileSucceeded &&
            compiled?.effects.length === 1 &&
            compiled.effects[0]?.kind === "smoke" &&
            compiled.effects[0]?.event === "cue-raised" &&
            summary.result?.kind === "measurement" &&
            summary.result.values.active === true,
        ],
        [
          "summaryResultValues2",
          () =>
            compileSucceeded &&
            compiled?.effects.length === 1 &&
            compiled.effects[0]?.kind === "smoke" &&
            compiled.effects[0]?.event === "cue-raised" &&
            summary.result?.kind === "measurement" &&
            summary.result.values.active === true &&
            Number(summary.result.values.particleCount) > 0,
        ],
        [
          "summaryResultValues3",
          () =>
            summary.result?.kind === "measurement" &&
            Number(summary.result.values.particleCount) <=
              Number(summary.result.values.particleCap),
        ],
        [
          "summaryResultValues4",
          () =>
            summary.result?.kind === "measurement" &&
            Number(summary.result.values.visibilityRisk) >= 0,
        ],
        [
          "summaryResultValues5",
          () =>
            summary.result?.kind === "measurement" &&
            compiled !== null &&
            summary.result.values.effectDigest === compiled.effects[0]?.digest,
        ],
        ["inactiveResultKind", () => inactive.result?.kind === "measurement"],
        [
          "inactiveResultValues",
          () =>
            inactive.result?.kind === "measurement" &&
            inactive.result.values.active === false,
        ],
        ["unsafeSubjectsResult", () => unsafeSubjects.result === null],
        [
          "unsafeSubjectsDiagnostics0",
          () => unsafeSubjects.diagnostics[0]?.message.includes("256 unique"),
        ],
        ["missingZoneResult", () => missingZone.result === null],
        [
          "invalidTimesEveryOutput",
          () => invalidTimes.every((output) => output.result === null),
        ],
        [
          "missingCompiledShotResult",
          () => missingCompiledShot.result === null,
        ],
        [
          "missingCompiledShotDiagnostics0",
          () =>
            missingCompiledShot.diagnostics[0]?.message.includes(
              "no current compiled source",
            ),
        ],
      ]),
      {
        compileSucceeded: true,
        compiledEffectsLength: true,
        compiledEffects0: true,
        compiledEffects02: true,
        summaryResultKind: true,
        summaryResultValues: true,
        summaryResultValues2: true,
        summaryResultValues3: true,
        summaryResultValues4: true,
        summaryResultValues5: true,
        inactiveResultKind: true,
        inactiveResultValues: true,
        unsafeSubjectsResult: true,
        unsafeSubjectsDiagnostics0: true,
        missingZoneResult: true,
        invalidTimesEveryOutput: true,
        missingCompiledShotResult: true,
        missingCompiledShotDiagnostics0: true,
      },
    );

    const cue = compiled!.effectCues![0]!;
    const validate = (
      cues: IAutoMovieShotEffectCue[],
      effects = compiled!.effects,
    ) =>
      validateAutoMovieEffects(shotContract(), {
        ...compiled!,
        effectCues: cues,
        effects,
      });
    const valid = validate([cue]);
    const invalid = [
      ...validate(
        Array.from({ length: 129 }, (_, index) => ({
          ...cue,
          id: `effect-${index}`,
        })),
      ),
      ...validate([{ ...cue, id: "" }]),
      ...validate([cue, { ...cue }]),
      ...validate([{ ...cue, zone: "missing-zone" }]),
      ...[
        { start: Number.NaN, end: 2 },
        { start: 1, end: Number.NaN },
        { start: -1, end: 2 },
        { start: 2, end: 2 },
        { start: 1, end: shotContract().durationSeconds + 1 },
      ].flatMap((time, index) =>
        validate([{ ...cue, id: `time-${index}`, ...time }]),
      ),
      ...[Number.NaN, -0.1, 1.1].flatMap((from, index) =>
        validate([
          {
            ...cue,
            id: `intensity-${index}`,
            intensity: { ...cue.intensity, from },
          },
        ]),
      ),
      ...validate([{ ...cue, event: "missing-event" }]),
      ...validate([{ ...cue, start: 2.5, end: 3 }]),
      ...validate([cue, { ...cue, id: "overlap", start: cue.start + 0.25 }]),
      ...validate([cue], []),
      ...validate([], compiled!.effects),
      ...validateAutoMovieEffects(shotContract(), {
        ...compiled!,
        effectCues: undefined,
      }),
    ];
    TestValidator.equals(
      "effect validation rejects every unsafe cue and compiler-stream mismatch",
      namedFacts([
        ["valid", () => valid.length === 0],
        [
          "atMostUnique",
          () =>
            [
              "at most 128",
              "unique inside the shot",
              "compiler-materialized world zone",
              "positive interval",
              "bounded 0..1",
              "compiled event realized inside",
              "must not overlap prior zone cue",
              "exactly one compiler-owned stream",
            ].every((message) =>
              invalid.some((diagnostic) =>
                diagnostic.message.includes(message),
              ),
            ),
        ],
        [
          "materializeCompiledEffectsContractShotContract",
          () =>
            materializeCompiledEffects({
              contract: shotContract(),
              cues: [cue],
            }).length === 0,
        ],
      ]),
      {
        valid: true,
        atMostUnique: true,
        materializeCompiledEffectsContractShotContract: true,
      },
    );

    const shotPath = path.join(
      fixture.root,
      "generated/fixture-film/shots/opening.json",
    );
    const manifestPath = path.join(
      fixture.root,
      ".automovie/productions/fixture-film/generated-manifest.json",
    );
    const originalShot = fs.readFileSync(shotPath);
    const originalManifest = fs.readFileSync(manifestPath);
    const ambiguous = structuredClone(compiled!);
    ambiguous.effects = [
      { ...compiled!.effects[0]!, id: "first", start: 1, end: 2 },
      { ...compiled!.effects[0]!, id: "second", start: 3, end: 4 },
    ];
    const manifest = JSON.parse(originalManifest.toString("utf8")) as {
      files: Array<{ path: string; digest: `sha256:${string}` }>;
    };
    const writeCurrentShot = (shot: IAutoMovieCompiledShotSource): void => {
      const bytes = Buffer.from(JSON.stringify(shot));
      fs.writeFileSync(shotPath, bytes);
      manifest.files.find(
        (file) => file.path === "shots/opening.json",
      )!.digest = digestAutoMovieBytes(bytes);
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    };
    writeCurrentShot(ambiguous);
    const ambiguousSummary = new AutoMovieProductionOracleService(
      project,
    ).query({
      request: {
        query: "effect",
        zone: "plaza-haze",
        shot: "opening",
        time: 2.5,
      },
    });
    const missingCamera = structuredClone(compiled!);
    missingCamera.scene.cameras = missingCamera.scene.cameras.filter(
      (camera) => camera.id !== missingCamera.shot.camera,
    );
    writeCurrentShot(missingCamera);
    const missingCameraSummary = new AutoMovieProductionOracleService(
      project,
    ).query({
      request: {
        query: "effect",
        zone: "plaza-haze",
        shot: "opening",
        time: 2,
      },
    });
    const bounds = compiled!.effects[0]!.bounds;
    const center = {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
      z: (bounds.min.z + bounds.max.z) / 2,
    };
    const subjectPositions = [
      { ...center, x: bounds.min.x - 1 },
      { ...center, x: bounds.max.x + 1 },
      { ...center, y: bounds.max.y + 1 },
      { ...center, z: bounds.min.z - 1 },
      { ...center, z: bounds.max.z + 1 },
      center,
    ];
    const subjectInsideCounts = subjectPositions.map((translation) => {
      const positioned = structuredClone(compiled!);
      positioned.shot.performances = [];
      positioned.scene.nodes.find(
        (node) => node.id === "soloist",
      )!.transform.translation = translation;
      writeCurrentShot(positioned);
      const output = new AutoMovieProductionOracleService(project).query({
        request: {
          query: "effect",
          zone: "plaza-haze",
          shot: "opening",
          time: 2,
          subjects: ["soloist"],
        },
      });
      return output.result?.kind === "measurement"
        ? output.result.values.subjectsInside
        : null;
    });
    const parallelOutside = structuredClone(compiled!);
    const parallelCamera = parallelOutside.scene.cameras.find(
      (camera) => camera.id === parallelOutside.shot.camera,
    )!;
    parallelOutside.shot.cameraMotion = null;
    parallelCamera.transform.translation = {
      x: bounds.max.x + 10,
      y: center.y,
      z: bounds.max.z + 10,
    };
    parallelCamera.transform.rotation = { x: 0, y: 0, z: 0, w: 1 };
    writeCurrentShot(parallelOutside);
    const parallelOutsideSummary = new AutoMovieProductionOracleService(
      project,
    ).query({
      request: {
        query: "effect",
        zone: "plaza-haze",
        shot: "opening",
        time: 2,
      },
    });
    const facingAway = structuredClone(compiled!);
    const facingAwayCamera = facingAway.scene.cameras.find(
      (camera) => camera.id === facingAway.shot.camera,
    )!;
    facingAway.shot.cameraMotion = null;
    facingAwayCamera.transform.translation = {
      x: center.x,
      y: center.y,
      z: bounds.max.z + 10,
    };
    facingAwayCamera.transform.rotation = { x: 0, y: 1, z: 0, w: 0 };
    writeCurrentShot(facingAway);
    const facingAwaySummary = new AutoMovieProductionOracleService(
      project,
    ).query({
      request: {
        query: "effect",
        zone: "plaza-haze",
        shot: "opening",
        time: 2,
      },
    });
    fs.writeFileSync(shotPath, originalShot);
    fs.writeFileSync(manifestPath, originalManifest);
    TestValidator.equals(
      "effect oracle refuses ambiguous streams and a missing compiled camera while bounding subjects and camera rays",
      namedFacts([
        ["ambiguousSummaryResult", () => ambiguousSummary.result === null],
        [
          "ambiguousSummaryDiagnosticsMessage",
          () =>
            ambiguousSummary.result === null &&
            ambiguousSummary.diagnostics[0]?.message.includes("unambiguous"),
        ],
        [
          "missingCameraSummaryResult",
          () => missingCameraSummary.result === null,
        ],
        [
          "missingCameraSummaryDiagnosticsMessage",
          () =>
            missingCameraSummary.result === null &&
            missingCameraSummary.diagnostics[0]?.message.includes(
              "no current compiled camera",
            ),
        ],
        [
          "stringifySubjectInsideCountsStringify",
          () =>
            JSON.stringify(subjectInsideCounts) ===
            JSON.stringify([0, 0, 0, 0, 0, 1]),
        ],
        [
          "parallelOutsideSummaryResultKind",
          () => parallelOutsideSummary.result?.kind === "measurement",
        ],
        [
          "parallelOutsideSummaryResultValues",
          () =>
            parallelOutsideSummary.result?.kind === "measurement" &&
            parallelOutsideSummary.result.values.cameraIntersectionLength === 0,
        ],
        [
          "facingAwaySummaryResultKind",
          () => facingAwaySummary.result?.kind === "measurement",
        ],
        [
          "facingAwaySummaryResultValues",
          () =>
            facingAwaySummary.result?.kind === "measurement" &&
            facingAwaySummary.result.values.cameraIntersectionLength === 0,
        ],
      ]),
      {
        ambiguousSummaryResult: true,
        ambiguousSummaryDiagnosticsMessage: true,
        missingCameraSummaryResult: true,
        missingCameraSummaryDiagnosticsMessage: true,
        stringifySubjectInsideCountsStringify: true,
        parallelOutsideSummaryResultKind: true,
        parallelOutsideSummaryResultValues: true,
        facingAwaySummaryResultKind: true,
        facingAwaySummaryResultValues: true,
      },
    );
  } catch (error) {
    productionEffectFailure = { error };
    throw error;
  } finally {
    preserveProductionEffectFixtureCleanup(productionEffectFailure, () =>
      fixture.dispose(),
    );
  }
};
