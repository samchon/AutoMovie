import {
  AutoMovieFilmTime,
  IAutoMovieCompiledShotSource,
  IAutoMovieRenderBundleManifest,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionOracleService,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

import {
  formationDesign,
  productionDesign,
  productionFixture,
  setProductionFixtureShotContract,
  shotContract,
  testCaptureRuntimeIdentity,
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

const png = (width: number, height: number): Uint8Array => {
  const image = new PNG({ width, height });
  image.data.fill(255);
  if (width * height > 1) image.data[0] = 0;
  return PNG.sync.write(image);
};

const blankPng = (width: number, height: number): Uint8Array => {
  const image = new PNG({ width, height });
  image.data.fill(255);
  return PNG.sync.write(image);
};

interface IProductionOracleFixtureFailure {
  error: unknown;
}

class ProductionOracleFixtureCleanupError extends AggregateError {}

export const preserveProductionOracleFixtureCleanup = (
  failure: IProductionOracleFixtureFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionOracleFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Production-oracle fixture teardown failed after the test failed.",
    );
  }
};

interface IProductionOracleHookCleanup {
  cleanup: () => unknown;
  resource: string;
}

class ProductionOracleHookCleanupError extends AggregateError {}

/** Attempt every oracle harness hook restoration without hiding failure. */
export const preserveProductionOracleHookCleanup = (
  failure: IProductionOracleFixtureFailure | undefined,
  resources: readonly IProductionOracleHookCleanup[],
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
    throw new ProductionOracleHookCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `Production oracle hook cleanup failed${
        failure === undefined ? "" : " after the preview failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};

/**
 * Geometry queries and preview frames use current compiler-owned artifacts,
 * including scale-aware promoted-hero visibility at the camera boundary.
 */
export const test_mcp_production_oracle = async (): Promise<void> => {
  let productionOracleFailure: IProductionOracleFixtureFailure | undefined;
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const routedWorld = structuredClone(project.graph().world!);
    routedWorld.routes.push({
      id: "formation-clearance",
      waypoints: [
        { x: -5, z: 0 },
        { x: 5, z: 0 },
      ],
      allowedFormationWidth: 10,
    });
    project.setWorldDesign(routedWorld);
    project.setFormationDesign({
      ...formationDesign(),
      heroOverrides: [{ slot: 1, actor: "sentinel" }],
    });
    setProductionFixtureShotContract(project, {
      ...shotContract(),
      participants: [
        { kind: "actor", id: "sentinel" },
        { kind: "formation", id: "line" },
      ],
    });
    const compiler = new AutoMovieProductionCompiler(project);
    const initialCompile = compiler.compile({ scope: "source" });
    if (initialCompile.success === false)
      throw new Error(
        `Oracle fixture compile failed:\n${JSON.stringify(
          initialCompile.diagnostics,
          null,
          2,
        )}`,
      );
    TestValidator.predicate("oracle fixture compiles", initialCompile.success);
    const oracle = new AutoMovieProductionOracleService(project);
    const filmFrame = oracle.query({
      request: { query: "film-time", at: { seconds: 2 } },
    });
    TestValidator.equals(
      "film-global time resolves through the compiler-owned timeline",
      namedFacts([
        ["filmFrameResult", () => filmFrame.result?.kind === "measurement"],
        [
          "filmFrameResult2",
          () => filmFrame.result.values.film === "fixture-film",
        ],
        ["filmFrameResult3", () => filmFrame.result.values.globalFrame === 48],
        ["filmFrameResult4", () => filmFrame.result.values.shot === "opening"],
        ["filmFrameResult5", () => filmFrame.result.values.sourceFrame === 48],
        ["filmFrameResult6", () => filmFrame.result.values.shotTime === 2],
      ]),
      {
        filmFrameResult: true,
        filmFrameResult2: true,
        filmFrameResult3: true,
        filmFrameResult4: true,
        filmFrameResult5: true,
        filmFrameResult6: true,
      },
    );
    TestValidator.predicate(
      "film-global oracle rejects off-grid and out-of-range selectors",
      (
        [
          { seconds: 0.1 },
          { frame: -1 },
          { frame: 144 },
          { frame: Number.NaN },
        ] satisfies AutoMovieFilmTime[]
      ).every(
        (at) =>
          oracle.query({
            request: { query: "film-time", at },
          }).result === null,
      ),
    );
    TestValidator.equals(
      "point distance",
      oracle.query({
        request: {
          query: "distance",
          from: { kind: "point", position: { x: 0, y: 0, z: 0 } },
          to: { kind: "point", position: { x: 3, y: 4, z: 0 } },
        },
      }).result,
      { kind: "distance", meters: 5 },
    );
    TestValidator.equals(
      "distance and actor samples reject dishonest times",
      namedFacts([
        [
          "naNTime",
          () =>
            [-1, Number.NaN].every(
              (time) =>
                oracle.query({
                  request: {
                    query: "distance",
                    from: { kind: "point", position: { x: 0, y: 0, z: 0 } },
                    to: { kind: "point", position: { x: 1, y: 0, z: 0 } },
                    time,
                  },
                }).result === null,
            ),
        ],
        [
          "timeOracle",
          () =>
            [-1, 999].every(
              (time) =>
                oracle.query({
                  request: {
                    query: "pose",
                    actor: "sentinel",
                    shot: "opening",
                    time,
                  },
                }).result === null,
            ),
        ],
        [
          "oracleQuery",
          () =>
            oracle.query({
              request: {
                query: "distance",
                from: { kind: "actor", actor: "sentinel" },
                to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
                shot: "opening",
                time: 999,
              },
            }).result === null,
        ],
      ]),
      {
        naNTime: true,
        timeOracle: true,
        oracleQuery: true,
      },
    );
    const physicalReach = oracle.query({
      request: {
        query: "reach",
        actor: "sentinel",
        shot: "opening",
        target: { kind: "landmark", landmark: "signal-ground" },
        time: 2,
      },
    });
    TestValidator.equals(
      "actor-to-landmark reach uses the compiled arm chains",
      namedFacts([
        [
          "physicalReachResult",
          () => physicalReach.result?.kind === "measurement",
        ],
        [
          "physicalReachResult2",
          () => physicalReach.result.values.leftMeasurable === true,
        ],
        [
          "physicalReachResult3",
          () => physicalReach.result.values.rightMeasurable === true,
        ],
        [
          "typeofPhysicalReach",
          () => typeof physicalReach.result.values.leftGap === "number",
        ],
      ]),
      {
        physicalReachResult: true,
        physicalReachResult2: true,
        physicalReachResult3: true,
        typeofPhysicalReach: true,
      },
    );
    TestValidator.predicate(
      "reach defaults its sampled time",
      oracle.query({
        request: {
          query: "reach",
          actor: "sentinel",
          target: { kind: "landmark", landmark: "signal-ground" },
        },
      }).result?.kind === "measurement",
    );
    TestValidator.equals(
      "ground inside world surface",
      oracle.query({
        request: { query: "ground", point: { x: 0, z: 0 } },
      }).result,
      { kind: "ground", height: 0, surface: "ground", walkable: true },
    );
    const boneDistance = oracle.query({
      request: {
        query: "distance",
        from: { kind: "actor", actor: "sentinel", bone: "head" },
        to: { kind: "actor", actor: "sentinel" },
      },
    }).result;
    TestValidator.predicate(
      "actor bone selectors resolve through current skeleton FK",
      boneDistance?.kind === "distance" && boneDistance.meters > 0,
    );
    TestValidator.equals(
      "ground outside world surface",
      oracle.query({
        request: { query: "ground", point: { x: 100, z: 100 } },
      }).result,
      { kind: "ground", height: 0, surface: null, walkable: false },
    );
    const formationMeasurement = oracle.query({
      request: { query: "formation", formation: "line" },
    }).result;
    const nonParticipatingFormationShot = oracle.query({
      request: {
        query: "formation",
        formation: "line",
        shot: "absent",
      },
    });
    TestValidator.equals(
      "formation and sampled pose measurements use compiler-owned slots",
      namedFacts([
        [
          "formationMeasurementMeasurement",
          () => formationMeasurement?.kind === "measurement",
        ],
        [
          "formationMeasurementValues",
          () => formationMeasurement.values.designCount === 6,
        ],
        [
          "formationMeasurementValues2",
          () => formationMeasurement.values.materializedCount === 6,
        ],
        [
          "formationMeasurementValues3",
          () => formationMeasurement.values.participatingShots === 1,
        ],
        [
          "formationMeasurementValues4",
          () => Number(formationMeasurement.values.routeClearance) > 0,
        ],
        [
          "formationMeasurementValues5",
          () => formationMeasurement.values.heroVisible === 1,
        ],
        [
          "nonParticipatingFormationShotResult",
          () => nonParticipatingFormationShot.result === null,
        ],
        [
          "nonParticipatingFormationShotDiagnostics",
          () =>
            nonParticipatingFormationShot.diagnostics[0]?.message.includes(
              "does not participate",
            ),
        ],
        [
          "oracleQuery",
          () =>
            oracle.query({
              request: {
                query: "formation",
                formation: "line",
                shot: "opening",
                time: -1,
              },
            }).result === null,
        ],
        [
          "oracleQuery2",
          () =>
            oracle.query({
              request: {
                query: "formation",
                formation: "line",
                shot: "opening",
                time: 7,
              },
            }).result === null,
        ],
        [
          "oracleQuery3",
          () =>
            oracle.query({
              request: {
                query: "pose",
                actor: "sentinel",
                shot: "opening",
                time: 2,
              },
            }).result?.kind === "measurement",
        ],
      ]),
      {
        formationMeasurementMeasurement: true,
        formationMeasurementValues: true,
        formationMeasurementValues2: true,
        formationMeasurementValues3: true,
        formationMeasurementValues4: true,
        formationMeasurementValues5: true,
        nonParticipatingFormationShotResult: true,
        nonParticipatingFormationShotDiagnostics: true,
        oracleQuery: true,
        oracleQuery2: true,
        oracleQuery3: true,
      },
    );
    const cameraMeasurement = oracle.query({
      request: {
        query: "camera",
        shot: "opening",
        time: 2,
        subjects: ["sentinel", "absent"],
      },
    }).result;
    TestValidator.equals(
      "camera query projects current animated root points and distinguishes the occlusion contract",
      namedFacts([
        [
          "cameraMeasurementMeasurement",
          () => cameraMeasurement?.kind === "measurement",
        ],
        [
          "cameraMeasurementValues",
          () => cameraMeasurement.values.requestedSubjects === 2,
        ],
        [
          "cameraMeasurementValues2",
          () => cameraMeasurement.values.resolvedSubjectRootPoints === 1,
        ],
        [
          "cameraMeasurementValues3",
          () => cameraMeasurement.values.inFrameRootPoints === 1,
        ],
        [
          "cameraMeasurementValues4",
          () => cameraMeasurement.values.missingSubjects === 1,
        ],
        [
          "cameraMeasurementValues5",
          () => cameraMeasurement.values.maxAllowedOcclusionRatio === 0.05,
        ],
        [
          "cameraMeasurementValues6",
          () => cameraMeasurement.values.occlusionMeasured === false,
        ],
      ]),
      {
        cameraMeasurementMeasurement: true,
        cameraMeasurementValues: true,
        cameraMeasurementValues2: true,
        cameraMeasurementValues3: true,
        cameraMeasurementValues4: true,
        cameraMeasurementValues5: true,
        cameraMeasurementValues6: true,
      },
    );
    TestValidator.equals(
      "camera query rejects dishonest empty, duplicate and out-of-range samples",
      namedFacts([
        [
          "oracleQuery",
          () =>
            oracle.query({
              request: {
                query: "camera",
                shot: "opening",
                time: 2,
                subjects: [],
              },
            }).result === null,
        ],
        [
          "oracleQuery2",
          () =>
            oracle.query({
              request: {
                query: "camera",
                shot: "opening",
                time: 2,
                subjects: ["sentinel", "sentinel"],
              },
            }).result === null,
        ],
        [
          "oracleQuery3",
          () =>
            oracle.query({
              request: {
                query: "camera",
                shot: "opening",
                time: 7,
                subjects: ["sentinel"],
              },
            }).result === null,
        ],
      ]),
      {
        oracleQuery: true,
        oracleQuery2: true,
        oracleQuery3: true,
      },
    );
    const missingOnlyCameraMeasurement = oracle.query({
      request: {
        query: "camera",
        shot: "opening",
        time: 2,
        subjects: ["absent"],
      },
    }).result;
    TestValidator.equals(
      "camera query reports a deterministic negative margin when no requested root resolves",
      namedFacts([
        [
          "missingOnlyCameraMeasurementMeasurement",
          () => missingOnlyCameraMeasurement?.kind === "measurement",
        ],
        [
          "missingOnlyCameraMeasurementValues",
          () =>
            missingOnlyCameraMeasurement.values.resolvedSubjectRootPoints === 0,
        ],
        [
          "missingOnlyCameraMeasurementValues2",
          () =>
            missingOnlyCameraMeasurement.values.minimumRootPointMargin === -1,
        ],
      ]),
      {
        missingOnlyCameraMeasurementMeasurement: true,
        missingOnlyCameraMeasurementValues: true,
        missingOnlyCameraMeasurementValues2: true,
      },
    );
    TestValidator.equals(
      "bad selectors return compact diagnostics",
      namedFacts([
        [
          "oracleQuery",
          () =>
            oracle.query({
              request: {
                query: "distance",
                from: { kind: "landmark", landmark: "absent" },
                to: { kind: "actor", actor: "absent" },
              },
            }).diagnostics[0]?.code === "geometry-selector-invalid",
        ],
        [
          "oracleQuery2",
          () =>
            oracle.query({
              request: { query: "formation", formation: "absent" },
            }).result === null,
        ],
        [
          "oracleQuery3",
          () =>
            oracle.query({
              request: {
                query: "camera",
                shot: "absent",
                time: 0,
                subjects: [],
              },
            }).result === null,
        ],
        [
          "oracleQuery4",
          () =>
            oracle.query({
              request: {
                query: "distance",
                from: { kind: "actor", actor: "absent" },
                to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
              },
            }).result === null,
        ],
      ]),
      {
        oracleQuery: true,
        oracleQuery2: true,
        oracleQuery3: true,
        oracleQuery4: true,
      },
    );
    const explosiveSelector = new Proxy(
      {
        kind: "point" as const,
        position: { x: 0, y: 0, z: 0 },
      },
      {
        get(target, property, receiver) {
          if (property === "kind") {
            const iterator = (function* (): Generator<void> {
              yield;
            })();
            iterator.next();
            return iterator.throw("non-error selector") as never;
          }
          return Reflect.get(target, property, receiver);
        },
      },
    );
    TestValidator.predicate(
      "non-Error selector failures remain compact diagnostics",
      oracle
        .query({
          request: {
            query: "distance",
            from: explosiveSelector,
            to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
          },
        })
        .diagnostics[0]?.message.includes("Correct its current selectors"),
    );

    const generatedShotPath = path.join(
      fixture.root,
      "generated/fixture-film/shots/opening.json",
    );
    const generatedShotBytes = fs.readFileSync(generatedShotPath, "utf8");
    const generatedShot = JSON.parse(
      generatedShotBytes,
    ) as IAutoMovieCompiledShotSource;
    const reachRequest = {
      query: "reach" as const,
      actor: "sentinel",
      shot: "opening",
      target: {
        kind: "point" as const,
        position: { x: 0.5, y: 1.5, z: 0 },
      },
      time: 2,
    };
    const corrupted = (): IAutoMovieCompiledShotSource =>
      JSON.parse(generatedShotBytes) as IAutoMovieCompiledShotSource;

    const generatedManifestPath = path.join(
      fixture.root,
      ".automovie/productions/fixture-film/generated-manifest.json",
    );
    const generatedManifestBytes = fs.readFileSync(generatedManifestPath);
    const generatedManifest = JSON.parse(
      generatedManifestBytes.toString("utf8"),
    ) as {
      files: Array<{
        path: string;
        owner: "compiler";
        digest: `sha256:${string}`;
        sourceTargets: string[];
      }>;
    };
    const writeGeneratedBytes = (bytes: Uint8Array): void => {
      fs.writeFileSync(generatedShotPath, bytes);
      const current = JSON.parse(
        fs.readFileSync(generatedManifestPath, "utf8"),
      ) as typeof generatedManifest;
      const opening = current.files.find(
        (entry) => entry.path === "shots/opening.json",
      );
      if (opening === undefined)
        throw new Error("oracle fixture lost its generated opening entry");
      opening.digest = digestAutoMovieBytes(bytes);
      fs.writeFileSync(generatedManifestPath, JSON.stringify(current));
    };
    const writeCorrupted = (value: IAutoMovieCompiledShotSource): void =>
      writeGeneratedBytes(Buffer.from(JSON.stringify(value)));
    const sidePlaneFormation = corrupted();
    const sidePlaneRuntime = sidePlaneFormation.formations[0]!;
    const sidePlaneChunk = sidePlaneRuntime.chunks[0]!;
    sidePlaneRuntime.anchor = { x: 0, y: 0, z: 0 };
    sidePlaneRuntime.facingDeg = 0;
    sidePlaneRuntime.projectionRadius = 1;
    sidePlaneChunk.centroid = { x: 11.2, y: 0, z: -10 };
    sidePlaneChunk.bounds = {
      min: { ...sidePlaneChunk.centroid },
      max: { ...sidePlaneChunk.centroid },
    };
    const sidePlaneCamera = sidePlaneFormation.scene.cameras.find(
      (camera) => camera.id === sidePlaneFormation.shot.camera,
    )!;
    sidePlaneCamera.transform = {
      translation: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    };
    sidePlaneCamera.fovY = 90;
    sidePlaneFormation.shot.cameraMotion = null;
    sidePlaneFormation.formationMotions = [];
    writeCorrupted(sidePlaneFormation);
    const sidePlaneFormationResult = oracle.query({
      request: { query: "formation", formation: "line" },
    });
    TestValidator.equals(
      "formation chunk visibility uses normalized frustum-plane distance",
      sidePlaneFormationResult.result?.kind === "measurement"
        ? {
            anonymous: sidePlaneFormationResult.result.values.anonymousCount,
            visible:
              Number(sidePlaneFormationResult.result.values.nearVisible) +
              Number(sidePlaneFormationResult.result.values.farVisible),
            culled: sidePlaneFormationResult.result.values.culled,
          }
        : null,
      {
        anonymous: sidePlaneRuntime.anonymousCount,
        visible: sidePlaneChunk.anonymousCount,
        culled: 0,
      },
    );
    const partialFormation = corrupted();
    partialFormation.formations = partialFormation.formations.filter(
      (formation) => formation.id !== "line",
    );
    writeCorrupted(partialFormation);
    const partialFormationResult = oracle.query({
      request: { query: "formation", formation: "line" },
    });
    const emptyFormationChunks = corrupted();
    emptyFormationChunks.formations[0]!.chunks = [];
    writeCorrupted(emptyFormationChunks);
    const emptyFormationChunksResult = oracle.query({
      request: { query: "formation", formation: "line" },
    });
    const missingFormationCamera = corrupted();
    missingFormationCamera.scene.cameras =
      missingFormationCamera.scene.cameras.filter(
        (camera) => camera.id !== missingFormationCamera.shot.camera,
      );
    writeCorrupted(missingFormationCamera);
    const missingFormationCameraResult = oracle.query({
      request: { query: "formation", formation: "line" },
    });
    writeGeneratedBytes(Buffer.from(generatedShotBytes));
    const manifestWithoutShots = JSON.parse(
      generatedManifestBytes.toString("utf8"),
    ) as typeof generatedManifest;
    manifestWithoutShots.files = manifestWithoutShots.files.filter(
      (entry) => entry.path.startsWith("shots/") === false,
    );
    fs.writeFileSync(
      generatedManifestPath,
      JSON.stringify(manifestWithoutShots),
    );
    const missingCompiledFormationResult = oracle.query({
      request: { query: "formation", formation: "line" },
    });
    fs.writeFileSync(generatedManifestPath, generatedManifestBytes);
    TestValidator.equals(
      "formation measurement refuses partial slots, missing chunks, and missing compiled shots",
      namedFacts([
        [
          "partialFormationResultEmptyFormationChunksResult",
          () =>
            [
              partialFormationResult,
              emptyFormationChunksResult,
              missingCompiledFormationResult,
            ].every(
              (output) =>
                output.result === null &&
                output.diagnostics[0]?.message.includes(
                  "not fully materialized",
                ),
            ),
        ],
        [
          "missingFormationCameraResultResult",
          () => missingFormationCameraResult.result === null,
        ],
        [
          "missingFormationCameraResultDiagnostics",
          () =>
            missingFormationCameraResult.diagnostics[0]?.message.includes(
              "no current compiled camera",
            ),
        ],
      ]),
      {
        partialFormationResultEmptyFormationChunksResult: true,
        missingFormationCameraResultResult: true,
        missingFormationCameraResultDiagnostics: true,
      },
    );
    const recurringShot = corrupted();
    recurringShot.shot.id = "second";
    const recurringBytes = Buffer.from(JSON.stringify(recurringShot));
    const recurringPath = path.join(
      fixture.root,
      "generated/fixture-film/shots/second.json",
    );
    fs.writeFileSync(recurringPath, recurringBytes);
    generatedManifest.files.push({
      ...generatedManifest.files.find(
        (entry) => entry.path === "shots/opening.json",
      )!,
      path: "shots/second.json",
      digest: digestAutoMovieBytes(recurringBytes),
      sourceTargets: ["shot:second"],
    });
    fs.writeFileSync(generatedManifestPath, JSON.stringify(generatedManifest));
    const ambiguousActor = oracle.query({
      request: {
        query: "distance",
        from: { kind: "actor", actor: "sentinel" },
        to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
      },
    });
    const explicitActor = oracle.query({
      request: {
        query: "distance",
        from: { kind: "actor", actor: "sentinel" },
        to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
        shot: "opening",
      },
    });
    fs.writeFileSync(generatedManifestPath, generatedManifestBytes);
    fs.rmSync(recurringPath);
    TestValidator.equals(
      "recurring actors require an explicit shot selector",
      namedFacts([
        ["ambiguousActorResult", () => ambiguousActor.result === null],
        [
          "ambiguousActorDiagnostics",
          () =>
            ambiguousActor.diagnostics[0]?.message.includes(
              "multiple compiled shots",
            ),
        ],
        [
          "explicitActorResult",
          () => explicitActor.result?.kind === "distance",
        ],
      ]),
      {
        ambiguousActorResult: true,
        ambiguousActorDiagnostics: true,
        explicitActorResult: true,
      },
    );
    fs.writeFileSync(
      generatedShotPath,
      Buffer.concat([Buffer.from(generatedShotBytes), Buffer.from(" ")]),
    );
    const racedGenerated = oracle.query({
      request: {
        query: "distance",
        from: { kind: "point", position: { x: 0, y: 0, z: 0 } },
        to: { kind: "point", position: { x: 1, y: 0, z: 0 } },
      },
    });
    writeGeneratedBytes(Buffer.from(generatedShotBytes));
    TestValidator.predicate(
      "oracle refuses generated bytes changed after freshness validation",
      racedGenerated.result === null &&
        racedGenerated.diagnostics[0]?.message.includes(
          "changed after compiler freshness validation",
        ),
    );

    const staticPose = corrupted();
    staticPose.shot.performances[0]!.motion = null;
    staticPose.scene.nodes[0]!.pose = {
      skeleton: staticPose.models[0]!.skeleton!.id,
      root: {
        translation: { x: 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      joints: [],
    };
    writeCorrupted(staticPose);
    const staticPoseDistance = oracle.query({
      request: {
        query: "distance",
        from: { kind: "actor", actor: "sentinel" },
        to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
        shot: "opening",
        time: 2,
      },
    });
    const objectAnimated = corrupted();
    objectAnimated.shot.performances[0]!.motion = null;
    objectAnimated.scene.nodes[0]!.pose = {
      skeleton: objectAnimated.models[0]!.skeleton!.id,
      root: {
        translation: { x: 1, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        // Pose-root scale is intentionally ignored by engine FK and viewer.
        scale: { x: 7, y: 7, z: 7 },
      },
      joints: [],
    };
    objectAnimated.shot.objectMotions = [
      {
        id: "sentinel-object-motion",
        name: null,
        duration: objectAnimated.shot.duration,
        loop: false,
        tracks: [
          {
            channel: {
              kind: "node",
              node: "sentinel",
              path: "translation",
            },
            times: [0, 2],
            values: [0, 0, 0, 4, 5, 6],
            interpolation: "linear",
          },
          {
            channel: {
              kind: "node",
              node: "sentinel",
              path: "rotation",
            },
            times: [0, 2],
            values: [0, 0, 0, 1, 0, 0, 0, 1],
            interpolation: "linear",
          },
          {
            channel: { kind: "node", node: "sentinel", path: "scale" },
            times: [0, 2],
            values: [1, 1, 1, 2, 2, 2],
            interpolation: "linear",
          },
        ],
      },
    ];
    writeCorrupted(objectAnimated);
    const objectMotionDistance = oracle.query({
      request: {
        query: "distance",
        from: { kind: "actor", actor: "sentinel" },
        to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
        shot: "opening",
        time: 2,
      },
    });
    // The sentinel is also this formation's promoted hero, so its compiled node
    // transform is the compiler-owned slot. The pose root composes beneath that
    // transform, which is exactly what the viewer draws, so the expected
    // distance is derived from the node rather than written down.
    const staticNode = staticPose.scene.nodes[0]!.transform;
    TestValidator.equals(
      "pose roots compose beneath object TRS exactly as the viewer renders them",
      {
        staticKind: staticPoseDistance.result?.kind ?? null,
        staticNodeIsUnrotatedUnitScale:
          staticNode.rotation.w === 1 &&
          staticNode.rotation.x === 0 &&
          staticNode.rotation.y === 0 &&
          staticNode.rotation.z === 0 &&
          staticNode.scale.x === 1 &&
          staticNode.scale.y === 1 &&
          staticNode.scale.z === 1,
        staticMeters:
          staticPoseDistance.result?.kind === "distance"
            ? staticPoseDistance.result.meters.toFixed(9)
            : null,
        animatedKind: objectMotionDistance.result?.kind ?? null,
        animatedMeters:
          objectMotionDistance.result?.kind === "distance"
            ? objectMotionDistance.result.meters.toFixed(9)
            : null,
      },
      {
        staticKind: "distance",
        staticNodeIsUnrotatedUnitScale: true,
        staticMeters: Math.hypot(
          staticNode.translation.x + 2,
          staticNode.translation.y,
          staticNode.translation.z,
        ).toFixed(9),
        animatedKind: "distance",
        animatedMeters: Math.sqrt(97).toFixed(9),
      },
    );

    const missingCamera = corrupted();
    missingCamera.scene.cameras = [];
    writeCorrupted(missingCamera);
    const missingCompiledCamera = oracle.query({
      request: {
        query: "camera",
        shot: "opening",
        time: 2,
        subjects: ["sentinel"],
      },
    });
    writeCorrupted(corrupted());
    const productionPath = path.join(
      fixture.root,
      ".automovie/design/fixture-film/production.json",
    );
    const productionBytes = fs.readFileSync(productionPath);
    fs.rmSync(productionPath);
    const missingFrameFormat = oracle.query({
      request: {
        query: "camera",
        shot: "opening",
        time: 2,
        subjects: ["sentinel"],
      },
    });
    fs.writeFileSync(productionPath, productionBytes);
    TestValidator.predicate(
      "camera projection refuses corrupt compiled cameras and absent production frame format",
      missingCompiledCamera.result === null &&
        missingFrameFormat.result === null,
    );

    const degenerate = corrupted();
    degenerate.scene.nodes[0]!.transform.scale.x = 0;
    writeCorrupted(degenerate);
    const degenerateReach = oracle.query({ request: reachRequest });

    const unrigged = corrupted();
    unrigged.models[0]!.skeleton = null;
    unrigged.shot.performances[0]!.motion = null;
    writeCorrupted(unrigged);
    const unriggedReach = oracle.query({ request: reachRequest });
    const unriggedBone = oracle.query({
      request: {
        query: "distance",
        from: { kind: "actor", actor: "sentinel", bone: "head" },
        to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
      },
    });

    writeCorrupted(corrupted());
    const missingBone = oracle.query({
      request: {
        query: "distance",
        from: { kind: "actor", actor: "sentinel", bone: "jaw" },
        to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
      },
    });

    const missingModel = corrupted();
    missingModel.scene.nodes[0]!.model = "absent";
    writeCorrupted(missingModel);
    const missingActorModel = oracle.query({
      request: {
        query: "distance",
        from: { kind: "actor", actor: "sentinel" },
        to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
      },
    });
    const missingActorInShot = oracle.query({
      request: {
        ...reachRequest,
        actor: "absent",
      },
    });

    const armless = corrupted();
    armless.models[0]!.skeleton!.bones =
      armless.models[0]!.skeleton!.bones.filter(
        (bone) =>
          bone.bone.startsWith("left") === false &&
          bone.bone.startsWith("right") === false,
      );
    writeCorrupted(armless);
    const armlessReach = oracle.query({ request: reachRequest });

    const leftMissing = corrupted();
    leftMissing.models[0]!.skeleton!.bones =
      leftMissing.models[0]!.skeleton!.bones.filter(
        (bone) => bone.bone.startsWith("left") === false,
      );
    writeCorrupted(leftMissing);
    const rightOnlyReach = oracle.query({ request: reachRequest });

    const rightMissing = corrupted();
    rightMissing.models[0]!.skeleton!.bones =
      rightMissing.models[0]!.skeleton!.bones.filter(
        (bone) => bone.bone.startsWith("right") === false,
      );
    writeCorrupted(rightMissing);
    const leftOnlyReach = oracle.query({ request: reachRequest });

    const zeroLengthArm = corrupted();
    zeroLengthArm.models[0]!.skeleton!.bones =
      zeroLengthArm.models[0]!.skeleton!.bones.filter(
        (bone) => bone.bone.startsWith("right") === false,
      );
    for (const bone of zeroLengthArm.models[0]!.skeleton!.bones)
      if (bone.bone === "leftLowerArm" || bone.bone === "leftHand")
        bone.rest.translation = { x: 0, y: 0, z: 0 };
    writeCorrupted(zeroLengthArm);
    const zeroLengthReach = oracle.query({ request: reachRequest });

    const rooted = corrupted();
    for (const keyframe of rooted.motions[0]!.keyframes)
      keyframe.pose.root = {
        ...rooted.scene.nodes[0]!.transform,
        translation: { x: 10_000, y: 0, z: 0 },
      };
    writeCorrupted(rooted);
    const rootedReach = oracle.query({ request: reachRequest });
    const rootedActorDistance = oracle.query({
      request: {
        query: "distance",
        from: { kind: "actor", actor: "sentinel" },
        to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
      },
    });
    const rootedFormation = oracle.query({
      request: {
        query: "formation",
        formation: "line",
        shot: "opening",
        time: 2,
      },
    });
    const scaledHero = corrupted();
    scaledHero.scene.nodes[0]!.transform.translation.x = 6;
    scaledHero.scene.nodes[0]!.transform.scale = { x: 8, y: 8, z: 8 };
    writeCorrupted(scaledHero);
    const scaledHeroFormation = oracle.query({
      request: {
        query: "formation",
        formation: "line",
        shot: "opening",
        time: 2,
      },
    });
    const missingHero = corrupted();
    missingHero.formations[0]!.heroes[0]!.actor = "ghost";
    writeCorrupted(missingHero);
    const missingHeroFormation = oracle.query({
      request: {
        query: "formation",
        formation: "line",
        shot: "opening",
        time: 2,
      },
    });

    const noPerformanceForSelector = corrupted();
    noPerformanceForSelector.shot.performances = [];
    writeCorrupted(noPerformanceForSelector);
    const heldActorDistance = oracle.query({
      request: {
        query: "distance",
        from: { kind: "actor", actor: "sentinel" },
        to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
      },
    });
    TestValidator.equals(
      "reach and bone oracles refuse corrupt rigs and preserve one-sided measurements",
      namedFacts([
        [
          "degenerateReachUnriggedReach",
          () =>
            [
              degenerateReach,
              unriggedReach,
              unriggedBone,
              missingBone,
              missingActorModel,
              missingActorInShot,
              armlessReach,
              zeroLengthReach,
            ].every((output) => output.result === null),
        ],
        [
          "rightOnlyReachResult",
          () => rightOnlyReach.result?.kind === "measurement",
        ],
        [
          "rightOnlyReachResult2",
          () => rightOnlyReach.result.values.leftMeasurable === false,
        ],
        [
          "leftOnlyReachResult",
          () => leftOnlyReach.result?.kind === "measurement",
        ],
        [
          "leftOnlyReachResult2",
          () => leftOnlyReach.result.values.rightMeasurable === false,
        ],
        ["rootedReachResult", () => rootedReach.result?.kind === "measurement"],
        [
          "rootedActorDistanceResult",
          () => rootedActorDistance.result?.kind === "distance",
        ],
        [
          "rootedFormationResult",
          () => rootedFormation.result?.kind === "measurement",
        ],
        [
          "rootedFormationResult2",
          () => rootedFormation.result.values.heroVisible === 0,
        ],
        [
          "scaledHeroFormationResult",
          () => scaledHeroFormation.result?.kind === "measurement",
        ],
        [
          "scaledHeroFormationResult2",
          () => scaledHeroFormation.result.values.heroVisible === 1,
        ],
        [
          "missingHeroFormationResult",
          () => missingHeroFormation.result?.kind === "measurement",
        ],
        [
          "missingHeroFormationResult2",
          () => missingHeroFormation.result.values.heroVisible === 0,
        ],
        [
          "heldActorDistanceResult",
          () => heldActorDistance.result?.kind === "distance",
        ],
      ]),
      {
        degenerateReachUnriggedReach: true,
        rightOnlyReachResult: true,
        rightOnlyReachResult2: true,
        leftOnlyReachResult: true,
        leftOnlyReachResult2: true,
        rootedReachResult: true,
        rootedActorDistanceResult: true,
        rootedFormationResult: true,
        rootedFormationResult2: true,
        scaledHeroFormationResult: true,
        scaledHeroFormationResult2: true,
        missingHeroFormationResult: true,
        missingHeroFormationResult2: true,
        heldActorDistanceResult: true,
      },
    );

    writeCorrupted(generatedShot);
    generatedShot.shot.performances[0]!.motion = null;
    writeCorrupted(generatedShot);
    const heldPose = oracle.query({
      request: {
        query: "pose",
        actor: "sentinel",
        shot: "opening",
        time: 2,
      },
    });
    generatedShot.shot.performances[0]!.node = "ghost";
    writeCorrupted(generatedShot);
    const heldWithoutNode = oracle.query({
      request: {
        query: "pose",
        actor: "ghost",
        time: 2,
      },
    });
    generatedShot.shot.performances[0]!.motion = generatedShot.motions[0]!.id;
    writeCorrupted(generatedShot);
    const movingWithoutRootOrNode = oracle.query({
      request: {
        query: "pose",
        actor: "ghost",
        time: 2,
      },
    });
    for (const keyframe of generatedShot.motions[0]!.keyframes)
      keyframe.pose.root = {
        ...generatedShot.scene.nodes[0]!.transform,
        translation: { x: 7, y: 8, z: 9 },
      };
    generatedShot.shot.performances[0]!.node = "sentinel";
    writeCorrupted(generatedShot);
    const movingWithRoot = oracle.query({
      request: {
        query: "pose",
        actor: "sentinel",
        time: 2,
      },
    });
    generatedShot.shot.performances[0]!.motion = "absent";
    writeCorrupted(generatedShot);
    const missingMotion = oracle.query({
      request: {
        query: "pose",
        actor: "sentinel",
        shot: "opening",
        time: 2,
      },
    });
    generatedShot.scene.nodes[0]!.motion = generatedShot.motions[0]!.id;
    generatedShot.shot.performances = [];
    writeCorrupted(generatedShot);
    const missingPerformance = oracle.query({
      request: {
        query: "pose",
        actor: "sentinel",
        shot: "opening",
        time: 2,
      },
    });
    writeGeneratedBytes(Buffer.from("{}"));
    const invalidGenerated = oracle.query({
      request: { query: "ground", point: { x: 0, z: 0 } },
    });
    writeGeneratedBytes(Buffer.from(generatedShotBytes));
    TestValidator.equals(
      "pose oracle refuses unstaged actors and missing motion but uses scene-node fallback",
      {
        heldKind: heldPose.result?.kind ?? null,
        held:
          heldPose.result?.kind === "measurement"
            ? heldPose.result.values.held
            : null,
        heldWithoutNode: heldWithoutNode.result?.kind ?? null,
        movingWithoutRootOrNode: movingWithoutRootOrNode.result?.kind ?? null,
        movingWithRootKind: movingWithRoot.result?.kind ?? null,
        movingRootX:
          movingWithRoot.result?.kind === "measurement"
            ? Number(movingWithRoot.result.values.rootX).toFixed(9)
            : null,
        missingMotion: missingMotion.result?.kind ?? null,
        missingPerformanceKind: missingPerformance.result?.kind ?? null,
        missingPerformanceHeld:
          missingPerformance.result?.kind === "measurement"
            ? missingPerformance.result.values.held
            : null,
        invalidGenerated: invalidGenerated.result?.kind ?? null,
      },
      {
        heldKind: "measurement",
        held: true,
        heldWithoutNode: null,
        movingWithoutRootOrNode: null,
        movingWithRootKind: "measurement",
        // The sentinel node is this formation's promoted hero slot, so an
        // authored pose root of 7 lands at the slot plus 7, exactly as the
        // viewer composes it.
        movingRootX: (
          generatedShot.scene.nodes[0]!.transform.translation.x + 7
        ).toFixed(9),
        missingMotion: null,
        missingPerformanceKind: "measurement",
        missingPerformanceHeld: false,
        invalidGenerated: null,
      },
    );

    const manifestPath = path.join(
      fixture.root,
      ".automovie/productions/fixture-film/generated-manifest.json",
    );
    const manifestBytes = fs.readFileSync(manifestPath, "utf8");
    const racingOracle = new AutoMovieProductionOracleService(
      project,
      undefined,
      () => {
        const status = compiler.lint({ scope: "source" });
        const manifest = JSON.parse(manifestBytes) as {
          inputFingerprint: string;
        };
        manifest.inputFingerprint =
          "sha256:0000000000000000000000000000000000000000000000000000000000000000";
        fs.writeFileSync(manifestPath, JSON.stringify(manifest));
        return status;
      },
    );
    const racedManifest = racingOracle.query({
      request: { query: "ground", point: { x: 0, z: 0 } },
    });
    fs.writeFileSync(manifestPath, manifestBytes);
    TestValidator.predicate(
      "a generated manifest race is refused as an oracle diagnostic",
      racedManifest.result === null &&
        racedManifest.diagnostics[0]?.code === "geometry-selector-invalid",
    );

    for (const layout of [
      {
        kind: "column" as const,
        ranks: 2,
        files: 3,
        spacing: { lateral: 0.8, depth: 0.9 },
      },
      {
        kind: "wedge" as const,
        depth: 3,
        spacing: { lateral: 0.8, depth: 0.9 },
      },
      { kind: "arc" as const, radius: 4, arcDegrees: 120 },
      { kind: "scatter" as const, radius: 5, seed: 9 },
    ]) {
      project.setFormationDesign(formationDesign(layout));
      compiler.compile({ scope: "source" });
      TestValidator.predicate(
        `formation dimensions ${layout.kind}`,
        oracle.query({
          request: { query: "formation", formation: "line" },
        }).result?.kind === "measurement",
      );
    }
    project.setWorldDesign({
      ...worldDesign(),
      surfaces: [
        {
          ...worldDesign().surfaces[0]!,
          height: {
            kind: "plane",
            originHeight: 1,
            slopeX: 0.25,
            slopeZ: 0.5,
          },
        },
      ],
    });
    compiler.compile({ scope: "source" });
    const slopedGround = oracle.query({
      request: { query: "ground", point: { x: 2, z: 2 } },
    });
    project.eraseDesignArtifact({ kind: "world" });
    const absentWorld = oracle.query({
      request: { query: "ground", point: { x: 0, z: 0 } },
    });
    project.setWorldDesign(worldDesign());
    compiler.compile({ scope: "source" });
    const unroutedFormation = oracle.query({
      request: { query: "formation", formation: "line" },
    });
    TestValidator.equals(
      "ground oracle handles planes and an absent bounded world",
      namedFacts([
        ["slopedGroundResult", () => slopedGround.result?.kind === "ground"],
        ["slopedGroundResult2", () => slopedGround.result.height === 2.5],
        ["absentWorldResult", () => absentWorld.result?.kind === "ground"],
        ["absentWorldResult2", () => absentWorld.result.surface === null],
        [
          "unroutedFormationResult",
          () => unroutedFormation.result?.kind === "measurement",
        ],
        [
          "unroutedFormationResult2",
          () => unroutedFormation.result.values.routeClearance === 0,
        ],
      ]),
      {
        slopedGroundResult: true,
        slopedGroundResult2: true,
        absentWorldResult: true,
        absentWorldResult2: true,
        unroutedFormationResult: true,
        unroutedFormationResult2: true,
      },
    );

    fs.rmSync(
      path.join(fixture.root, ".automovie/design/fixture-film/production.json"),
    );
    const noProductionPreview = await new AutoMovieProductionOracleService(
      project,
    )
      .preview({
        target: { kind: "shot", id: "opening" },
        time: 0,
      })
      .catch((error: unknown) => error);
    project.setProductionDesign(productionDesign());
    compiler.compile({ scope: "source" });
    TestValidator.predicate(
      "preview needs current production frame metadata",
      noProductionPreview instanceof Error,
    );

    const currentStatus = compiler.lint({ scope: "source" });
    const staleOracle = new AutoMovieProductionOracleService(
      project,
      async () => ({
        bytes: png(2, 2),
        runtimeIdentity: testCaptureRuntimeIdentity(),
        width: 2,
        height: 2,
      }),
      () => ({
        ...currentStatus,
        compiler: {
          ...currentStatus.compiler,
          inputFingerprint:
            "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        },
      }),
    );
    const stalePreview = await staleOracle.preview({
      target: { kind: "shot", id: "opening" },
      time: 0,
      width: 2,
      height: 2,
    });
    const invalidStatusOracle = new AutoMovieProductionOracleService(
      project,
      undefined,
      () => ({
        ...currentStatus,
        success: false,
        diagnostics: [],
      }),
    );
    const diagnosticStatusOracle = new AutoMovieProductionOracleService(
      project,
      undefined,
      () => ({
        ...currentStatus,
        success: false,
        diagnostics: [
          {
            code: "source-invalid",
            category: "error",
            phase: "source",
            target: "opening",
            path: "src/shots/opening.ts",
            message: "current compiler error",
          },
        ],
      }),
    );
    TestValidator.equals(
      "oracle freshness covers stale and invalid current compiler states",
      namedFacts([
        [
          "stalePreviewDiagnostics",
          () => stalePreview.diagnostics[0]?.code === "generated-stale",
        ],
        [
          "invalidStatusOracleQuery",
          () =>
            invalidStatusOracle.query({
              request: { query: "ground", point: { x: 0, z: 0 } },
            }).diagnostics[0]?.code === "compile-current-invalid",
        ],
        [
          "diagnosticStatusOracleQuery",
          () =>
            diagnosticStatusOracle
              .query({
                request: { query: "ground", point: { x: 0, z: 0 } },
              })
              .diagnostics[0]?.message.includes("current compiler error"),
        ],
      ]),
      {
        stalePreviewDiagnostics: true,
        invalidStatusOracleQuery: true,
        diagnosticStatusOracleQuery: true,
      },
    );

    const unavailable = await oracle.preview({
      target: { kind: "shot", id: "opening" },
      time: 0,
      width: 2,
      height: 2,
    });
    TestValidator.predicate(
      "capture host is explicit",
      unavailable.captured === false &&
        unavailable.diagnostics[0]?.code === "capture-host-unavailable",
    );
    const invalidInput = await new AutoMovieProductionOracleService(
      project,
      async () => ({
        bytes: png(2, 2),
        runtimeIdentity: testCaptureRuntimeIdentity(),
        width: 2,
        height: 2,
      }),
    ).preview({
      target: { kind: "shot", id: "opening" },
      time: -1,
      width: 0,
      height: 2,
    });
    TestValidator.predicate(
      "preview dimensions and time are validated",
      invalidInput.diagnostics[0]?.code === "preview-input-invalid",
    );
    const inputValidationOracle = new AutoMovieProductionOracleService(
      project,
      async () => ({
        bytes: png(2, 2),
        runtimeIdentity: testCaptureRuntimeIdentity(),
        width: 2,
        height: 2,
      }),
    );
    const invalidPreviewInputs = await Promise.all([
      inputValidationOracle.preview({
        target: { kind: "shot", id: "opening" },
        time: 0,
        width: 1.5,
        height: 2,
      }),
      inputValidationOracle.preview({
        target: { kind: "shot", id: "opening" },
        time: 0,
        width: 2,
        height: 1.5,
      }),
      inputValidationOracle.preview({
        target: { kind: "shot", id: "opening" },
        time: 0,
        width: 2,
        height: 0,
      }),
      inputValidationOracle.preview({
        target: { kind: "shot", id: "opening" },
        time: 0,
        width: productionDesign().frameFormat.width + 1,
        height: 2,
      }),
      inputValidationOracle.preview({
        target: { kind: "shot", id: "opening" },
        time: 0,
        width: 2,
        height: productionDesign().frameFormat.height + 1,
      }),
      inputValidationOracle.preview({
        target: { kind: "shot", id: "opening" },
        time: Number.NaN,
        width: 2,
        height: 2,
      }),
    ]);
    TestValidator.predicate(
      "every preview dimension and clock branch is bounded",
      invalidPreviewInputs.every(
        (output) => output.diagnostics[0]?.code === "preview-input-invalid",
      ),
    );
    const absentTargetOracle = new AutoMovieProductionOracleService(
      project,
      async () => ({
        bytes: png(2, 2),
        runtimeIdentity: testCaptureRuntimeIdentity(),
        width: 2,
        height: 2,
      }),
    );
    const absentShot = await absentTargetOracle.preview({
      target: { kind: "shot", id: "absent" },
      time: 0,
      width: 2,
      height: 2,
    });
    const outOfRange = await absentTargetOracle.preview({
      target: { kind: "shot", id: "opening" },
      time: 99,
      width: 2,
      height: 2,
    });
    TestValidator.predicate(
      "preview target and target duration belong to current compiled output",
      absentShot.diagnostics[0]?.code === "preview-target-missing" &&
        outOfRange.diagnostics[0]?.code === "preview-input-invalid",
    );
    const failed = await new AutoMovieProductionOracleService(
      project,
      async () => {
        throw new Error("browser failed");
      },
    ).preview({
      target: { kind: "shot", id: "opening" },
      time: 0,
      width: 2,
      height: 2,
    });
    TestValidator.predicate(
      "capture exceptions become diagnostics",
      failed.diagnostics[0]?.code === "capture-failed",
    );
    const failedNonError = await new AutoMovieProductionOracleService(
      project,
      async () => {
        const iterator = (function* (): Generator<void> {
          yield;
        })();
        iterator.next();
        return iterator.throw("capture string failure") as never;
      },
    ).preview({
      target: { kind: "shot", id: "opening" },
      time: 0,
      width: 2,
      height: 2,
    });
    TestValidator.predicate(
      "non-Error capture failures remain diagnostics",
      failedNonError.diagnostics[0]?.message.includes("capture string failure"),
    );
    for (const bytes of [new Uint8Array(), Buffer.from("not-png")]) {
      const malformed = await new AutoMovieProductionOracleService(
        project,
        async () => ({
          bytes,
          runtimeIdentity: testCaptureRuntimeIdentity(),
          width: 2,
          height: 2,
        }),
      ).preview({
        target: { kind: "shot", id: "opening" },
        time: 0,
        width: 2,
        height: 2,
      });
      TestValidator.predicate(
        "non-PNG capture is refused",
        malformed.diagnostics[0]?.code === "capture-png-invalid",
      );
    }
    const exceptionalBytes = {
      bytes: new Uint8Array(),
      runtimeIdentity: testCaptureRuntimeIdentity(),
      width: 2,
      height: 2,
    } as {
      bytes: Uint8Array;
      runtimeIdentity: ReturnType<typeof testCaptureRuntimeIdentity>;
      width: number;
      height: number;
    };
    Object.defineProperty(exceptionalBytes, "bytes", {
      get: () => {
        const iterator = (function* (): Generator<void> {
          yield;
        })();
        iterator.next();
        return iterator.throw("PNG byte getter failed") as never;
      },
    });
    const nonErrorPng = await new AutoMovieProductionOracleService(
      project,
      async () => exceptionalBytes,
    ).preview({
      target: { kind: "shot", id: "opening" },
      time: 0,
      width: 2,
      height: 2,
    });
    TestValidator.predicate(
      "non-Error PNG failures remain diagnostics",
      nonErrorPng.diagnostics[0]?.message.includes("PNG byte getter failed"),
    );
    const mismatch = await new AutoMovieProductionOracleService(
      project,
      async () => ({
        bytes: png(1, 1),
        runtimeIdentity: testCaptureRuntimeIdentity(),
        width: 3,
        height: 3,
      }),
    ).preview({
      target: { kind: "shot", id: "opening" },
      time: 0,
      width: 2,
      height: 2,
    });
    TestValidator.predicate(
      "adapter and decoded size must agree",
      mismatch.diagnostics[0]?.code === "capture-size-mismatch",
    );
    const captureManifestBytes = fs.readFileSync(manifestPath);
    const missingManifestCapture = await new AutoMovieProductionOracleService(
      project,
      async () => {
        fs.rmSync(manifestPath);
        return {
          bytes: png(2, 2),
          runtimeIdentity: testCaptureRuntimeIdentity(),
          width: 2,
          height: 2,
        };
      },
    ).preview({
      target: { kind: "shot", id: "opening" },
      time: 0,
      width: 2,
      height: 2,
    });
    fs.writeFileSync(manifestPath, captureManifestBytes);
    const mismatchedManifestCapture =
      await new AutoMovieProductionOracleService(project, async () => {
        const manifest = JSON.parse(captureManifestBytes.toString("utf8"));
        manifest.inputFingerprint =
          "sha256:0000000000000000000000000000000000000000000000000000000000000000";
        fs.writeFileSync(manifestPath, JSON.stringify(manifest));
        return {
          bytes: png(2, 2),
          runtimeIdentity: testCaptureRuntimeIdentity(),
          width: 2,
          height: 2,
        };
      }).preview({
        target: { kind: "shot", id: "opening" },
        time: 0,
        width: 2,
        height: 2,
      });
    fs.writeFileSync(manifestPath, captureManifestBytes);
    const currentCaptureStatus = compiler.lint({ scope: "source" });
    let captureStatusReads = 0;
    const invalidatedCompileCapture =
      await new AutoMovieProductionOracleService(
        project,
        async () => ({
          bytes: png(2, 2),
          runtimeIdentity: testCaptureRuntimeIdentity(),
          width: 2,
          height: 2,
        }),
        () =>
          captureStatusReads++ === 0
            ? currentCaptureStatus
            : {
                ...currentCaptureStatus,
                success: false,
                diagnostics: [
                  ...currentCaptureStatus.diagnostics,
                  {
                    code: "synthetic-capture-race",
                    category: "error" as const,
                    phase: "compile" as const,
                    target: "generated-manifest",
                    path: null,
                    message: "The compile became invalid during capture.",
                  },
                ],
              },
      ).preview({
        target: { kind: "shot", id: "opening" },
        time: 0,
        width: 2,
        height: 2,
      });
    const viewerPath = path.join(fixture.root, "viewer/index.html");
    const viewerBytes = fs.readFileSync(viewerPath);
    const racedCapture = await new AutoMovieProductionOracleService(
      project,
      async () => {
        fs.appendFileSync(viewerPath, "\n<!-- capture race -->\n");
        return {
          bytes: png(2, 2),
          runtimeIdentity: testCaptureRuntimeIdentity(),
          width: 2,
          height: 2,
        };
      },
    ).preview({
      target: { kind: "shot", id: "opening" },
      time: 0,
      width: 2,
      height: 2,
    });
    fs.writeFileSync(viewerPath, viewerBytes);
    const residentCommitRenderBundle = project.commitRenderBundle;
    project.commitRenderBundle = ((
      ...args: Parameters<typeof project.commitRenderBundle>
    ) => {
      fs.appendFileSync(viewerPath, "\n<!-- pre-commit race -->\n");
      return residentCommitRenderBundle.call(project, ...args);
    }) as typeof project.commitRenderBundle;
    const lateRacedCapture = await new AutoMovieProductionOracleService(
      project,
      async () => ({
        bytes: png(2, 2),
        runtimeIdentity: testCaptureRuntimeIdentity(),
        width: 2,
        height: 2,
      }),
    ).preview({
      target: { kind: "shot", id: "opening" },
      time: 0,
      width: 2,
      height: 2,
    });
    project.commitRenderBundle = residentCommitRenderBundle;
    fs.writeFileSync(viewerPath, viewerBytes);
    let genericCommitRejected = false;
    project.commitRenderBundle = (() => {
      throw new Error("injected generic render commit failure");
    }) as typeof project.commitRenderBundle;
    try {
      await new AutoMovieProductionOracleService(project, async () => ({
        bytes: png(2, 2),
        runtimeIdentity: testCaptureRuntimeIdentity(),
        width: 2,
        height: 2,
      })).preview({
        target: { kind: "shot", id: "opening" },
        time: 0,
        width: 2,
        height: 2,
      });
    } catch (error) {
      genericCommitRejected =
        error instanceof Error &&
        error.message === "injected generic render commit failure";
    } finally {
      project.commitRenderBundle = residentCommitRenderBundle;
    }
    TestValidator.equals(
      "capture refuses every manifest, compiler and renderer-input race",
      namedFacts([
        [
          "missingManifestCaptureMismatchedManifestCapture",
          () =>
            [
              missingManifestCapture,
              mismatchedManifestCapture,
              invalidatedCompileCapture,
            ].every(
              (output) =>
                output.captured === false &&
                output.renderBundle === null &&
                output.frame === null &&
                output.diagnostics[0]?.code === "capture-input-changed",
            ),
        ],
        ["racedCaptureCaptured", () => racedCapture.captured === false],
        ["racedCaptureRenderBundle", () => racedCapture.renderBundle === null],
        ["racedCaptureFrame", () => racedCapture.frame === null],
        [
          "racedCaptureDiagnostics",
          () => racedCapture.diagnostics[0]?.code === "capture-input-changed",
        ],
        ["lateRacedCaptureCaptured", () => lateRacedCapture.captured === false],
        [
          "lateRacedCaptureRenderBundle",
          () => lateRacedCapture.renderBundle === null,
        ],
        ["lateRacedCaptureFrame", () => lateRacedCapture.frame === null],
        [
          "lateRacedCaptureDiagnostics",
          () =>
            lateRacedCapture.diagnostics[0]?.code === "capture-input-changed",
        ],
        ["genericCommitRejected", () => genericCommitRejected],
      ]),
      {
        missingManifestCaptureMismatchedManifestCapture: true,
        racedCaptureCaptured: true,
        racedCaptureRenderBundle: true,
        racedCaptureFrame: true,
        racedCaptureDiagnostics: true,
        lateRacedCaptureCaptured: true,
        lateRacedCaptureRenderBundle: true,
        lateRacedCaptureFrame: true,
        lateRacedCaptureDiagnostics: true,
        genericCommitRejected: true,
      },
    );
    TestValidator.predicate(
      "uniform captures cannot become visual review evidence",
      (
        await Promise.all(
          [1, 2].map((size) =>
            new AutoMovieProductionOracleService(project, async () => ({
              bytes: blankPng(size, size),
              runtimeIdentity: testCaptureRuntimeIdentity(),
              width: size,
              height: size,
            })).preview({
              target: { kind: "shot", id: "opening" },
              time: 0,
              width: size,
              height: size,
            }),
          ),
        )
      ).every((output) => output.diagnostics[0]?.code === "capture-png-blank"),
    );

    const actual = new AutoMovieProductionOracleService(
      project,
      async (input) => ({
        bytes: png(input.width!, input.height!),
        runtimeIdentity: testCaptureRuntimeIdentity(),
        width: input.width!,
        height: input.height!,
      }),
    );
    const defaultSized = await actual.preview({
      target: { kind: "shot", id: "opening" },
      time: 0,
    });
    const beauty = await actual.preview({
      target: { kind: "shot", id: "opening" },
      time: 1 / 48,
      width: 2,
      height: 2,
    });
    const mask = await actual.preview({
      target: { kind: "shot", id: "opening" },
      time: 1 / 48,
      pass: "mask",
      width: 2,
      height: 2,
    });
    const alternateRenderer = await new AutoMovieProductionOracleService(
      project,
      async (input) => ({
        bytes: png(input.width!, input.height!),
        runtimeIdentity: testCaptureRuntimeIdentity("148.0.7778.97"),
        width: input.width!,
        height: input.height!,
      }),
    ).preview({
      target: { kind: "shot", id: "opening" },
      time: 1 / 48,
      width: 2,
      height: 2,
    });
    const blankRenderer = await new AutoMovieProductionOracleService(
      project,
      async (input) => ({
        bytes: png(input.width!, input.height!),
        runtimeIdentity: {
          ...testCaptureRuntimeIdentity(),
          graphics: {
            ...testCaptureRuntimeIdentity().graphics,
            renderer: " ",
          },
        },
        width: input.width!,
        height: input.height!,
      }),
    ).preview({
      target: { kind: "shot", id: "opening" },
      time: 1 / 48,
      width: 2,
      height: 2,
    });
    TestValidator.equals(
      "verified frames are target-, renderer-, and frame-addressed",
      namedFacts([
        ["defaultSizedCaptured", () => defaultSized.captured],
        ["beautyCaptured", () => beauty.captured],
        ["beautyFrame", () => beauty.frame?.time === 1 / 24],
        [
          "fixtureResident",
          () => fs.existsSync(path.join(fixture.root, beauty.frame.path)),
        ],
        ["maskCaptured", () => mask.captured],
        ["maskRenderBundle", () => mask.renderBundle === beauty.renderBundle],
        ["maskFrame", () => mask.frame?.path.endsWith(".mask.png") === true],
        ["alternateRendererCaptured", () => alternateRenderer.captured],
        [
          "alternateRendererRenderBundle",
          () => alternateRenderer.renderBundle !== beauty.renderBundle,
        ],
        [
          "blankRendererDiagnostics",
          () =>
            blankRenderer.diagnostics[0]?.code ===
            "capture-renderer-identity-invalid",
        ],
      ]),
      {
        defaultSizedCaptured: true,
        beautyCaptured: true,
        beautyFrame: true,
        fixtureResident: true,
        maskCaptured: true,
        maskRenderBundle: true,
        maskFrame: true,
        alternateRendererCaptured: true,
        alternateRendererRenderBundle: true,
        blankRendererDiagnostics: true,
      },
    );
    if (
      beauty.renderBundle !== null &&
      beauty.frame !== null &&
      mask.frame !== null
    ) {
      const bundleRoot = path.join(fixture.root, beauty.renderBundle);
      const relativeBundle = path
        .relative(project.renderRoot(), bundleRoot)
        .split(path.sep)
        .join("/");
      const currentManifest = project.verifiedRenderManifest(
        path.join(bundleRoot, "manifest.json"),
      )!;
      const retainedFiles = new Map<string, Uint8Array>(
        currentManifest.frames.map((frame) => [
          frame.path,
          project.readRenderFile(`${relativeBundle}/${frame.path}`),
        ]),
      );
      const visible = png(2, 2);
      const blank = blankPng(2, 2);
      const goodDigest = digestAutoMovieBytes(visible);
      const badFrames: IAutoMovieRenderBundleManifest["frames"] = [
        {
          index: 0.5,
          time: 0.5 / 24,
          pass: "beauty",
          path: "preview/fractional.png",
          digest: goodDigest,
          width: 2,
          height: 2,
        },
        {
          index: -1,
          time: 0,
          pass: "beauty",
          path: "preview/negative.png",
          digest: goodDigest,
          width: 2,
          height: 2,
        },
        {
          index: 3,
          time: 0,
          pass: "beauty",
          path: "preview/off-clock.png",
          digest: goodDigest,
          width: 2,
          height: 2,
        },
        {
          index: 10_000,
          time: 10_000 / 24,
          pass: "beauty",
          path: "preview/past-duration.png",
          digest: goodDigest,
          width: 2,
          height: 2,
        },
        {
          index: 4,
          time: 4 / 24,
          pass: "beauty",
          path: "",
          digest: goodDigest,
          width: 2,
          height: 2,
        },
        {
          index: 5,
          time: 5 / 24,
          pass: "beauty",
          path: "../escape.png",
          digest: goodDigest,
          width: 2,
          height: 2,
        },
        {
          index: 6,
          time: 6 / 24,
          pass: "beauty",
          path: "../../escape.png",
          digest: goodDigest,
          width: 2,
          height: 2,
        },
        {
          index: 7,
          time: 7 / 24,
          pass: "beauty",
          path: "C:/cross-drive.png",
          digest: goodDigest,
          width: 2,
          height: 2,
        },
        {
          index: 8,
          time: 8 / 24,
          pass: "beauty",
          path: "preview/wrong-digest.png",
          digest:
            "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          width: 2,
          height: 2,
        },
        {
          index: 9,
          time: 9 / 24,
          pass: "beauty",
          path: "preview/wrong-size.png",
          digest: goodDigest,
          width: 3,
          height: 2,
        },
        {
          index: 10,
          time: 10 / 24,
          pass: "beauty",
          path: "preview/wrong-height.png",
          digest: goodDigest,
          width: 2,
          height: 3,
        },
        {
          index: 11,
          time: 11 / 24,
          pass: "beauty",
          path: "preview/blank.png",
          digest: digestAutoMovieBytes(blank),
          width: 2,
          height: 2,
        },
        {
          index: 12,
          time: 12 / 24,
          pass: "beauty",
          path: "preview/malformed.png",
          digest: digestAutoMovieBytes(Buffer.from("not-png")),
          width: 2,
          height: 2,
        },
        {
          index: 13,
          time: 13 / 24,
          pass: "beauty",
          path: "preview/missing.png",
          digest: goodDigest,
          width: 2,
          height: 2,
        },
      ];
      for (const file of [
        "fractional.png",
        "negative.png",
        "off-clock.png",
        "past-duration.png",
        "wrong-digest.png",
        "wrong-size.png",
        "wrong-height.png",
      ])
        retainedFiles.set(`preview/${file}`, visible);
      retainedFiles.set("preview/blank.png", blank);
      retainedFiles.set("preview/malformed.png", Buffer.from("not-png"));
      project.commitRenderBundle(relativeBundle, retainedFiles, {
        ...currentManifest,
        frames: [...currentManifest.frames, ...badFrames],
      });
      const residentVerifiedRenderManifestForForgery =
        project.verifiedRenderManifest;
      project.verifiedRenderManifest = (() => ({
        ...currentManifest,
        frames: badFrames,
      })) as typeof project.verifiedRenderManifest;
      let afterForgedLedger: Awaited<ReturnType<typeof actual.preview>>;
      try {
        afterForgedLedger = await actual.preview({
          target: { kind: "shot", id: "opening" },
          time: 2 / 24,
          width: 2,
          height: 2,
        });
      } finally {
        project.verifiedRenderManifest =
          residentVerifiedRenderManifestForForgery;
      }
      const repairedManifest = project.verifiedRenderManifest(
        path.join(bundleRoot, "manifest.json"),
      );
      TestValidator.equals(
        "preview replaces a bundle whose manifest contains unverified evidence",
        namedFacts([
          ["afterForgedLedgerCaptured", () => afterForgedLedger.captured],
          [
            "repairedManifestCount",
            () => repairedManifest?.frames.length === 1,
          ],
          [
            "repairedManifestFrames",
            () => repairedManifest.frames[0]?.index === 2,
          ],
          [
            "repairedManifestFrames2",
            () => repairedManifest.frames[0].pass === "beauty",
          ],
        ]),
        {
          afterForgedLedgerCaptured: true,
          repairedManifestCount: true,
          repairedManifestFrames: true,
          repairedManifestFrames2: true,
        },
      );
      const retainedRaceManifest = project.verifiedRenderManifest(
        path.join(bundleRoot, "manifest.json"),
      )!;
      const residentVerifiedRenderManifest = project.verifiedRenderManifest;
      const residentReadRenderFile = project.readRenderFile;
      project.verifiedRenderManifest = (() =>
        retainedRaceManifest) as typeof project.verifiedRenderManifest;
      project.readRenderFile = (() => {
        throw new Error("retained frame disappeared after verification");
      }) as typeof project.readRenderFile;
      let retainedReadRace: Awaited<ReturnType<typeof actual.preview>>;
      let retainedReadRaceFailure: IProductionOracleFixtureFailure | undefined;
      try {
        retainedReadRace = await actual.preview({
          target: { kind: "shot", id: "opening" },
          time: 3 / 24,
          width: 2,
          height: 2,
        });
      } catch (error) {
        retainedReadRaceFailure = { error };
        throw error;
      } finally {
        preserveProductionOracleHookCleanup(retainedReadRaceFailure, [
          {
            resource: "retained-read verified-manifest hook",
            cleanup: () => {
              project.verifiedRenderManifest = residentVerifiedRenderManifest;
            },
          },
          {
            resource: "retained-read file hook",
            cleanup: () => {
              project.readRenderFile = residentReadRenderFile;
            },
          },
        ]);
      }
      const retainedRaceResult = project.verifiedRenderManifest(
        path.join(bundleRoot, "manifest.json"),
      );
      TestValidator.equals(
        "a retained frame read race discards stale evidence without aborting the new capture",
        namedFacts([
          ["retainedReadRaceCaptured", () => retainedReadRace.captured],
          [
            "retainedRaceResultCount",
            () => retainedRaceResult?.frames.length === 1,
          ],
          [
            "retainedRaceResultFrames",
            () => retainedRaceResult.frames[0]?.index === 3,
          ],
        ]),
        {
          retainedReadRaceCaptured: true,
          retainedRaceResultCount: true,
          retainedRaceResultFrames: true,
        },
      );
    }
    if (beauty.renderBundle !== null) {
      fs.writeFileSync(
        path.join(fixture.root, beauty.renderBundle, "manifest.json"),
        "{}",
      );
      TestValidator.predicate(
        "structurally invalid previous bundles are replaced",
        (
          await actual.preview({
            target: { kind: "shot", id: "opening" },
            time: 0,
            width: 2,
            height: 2,
          })
        ).captured,
      );
      fs.writeFileSync(
        path.join(fixture.root, beauty.renderBundle, "manifest.json"),
        "{bad",
      );
      TestValidator.predicate(
        "malformed previous bundle is replaced",
        (
          await actual.preview({
            target: { kind: "shot", id: "opening" },
            time: 0,
            width: 2,
            height: 2,
          })
        ).captured,
      );
    }

    let emptyRootFailure: IProductionOracleFixtureFailure | undefined;
    const emptyRoot = productionFixture();
    try {
      const emptyProject = AutoMovieProductionProject.open(emptyRoot.root);
      fs.rmSync(emptyProject.trackedStatePath("generated-manifest.json"), {
        force: true,
      });
      TestValidator.predicate(
        "queries and preview refuse a missing compile",
        new AutoMovieProductionOracleService(emptyProject).query({
          request: {
            query: "ground",
            point: { x: 0, z: 0 },
          },
        }).compileFingerprint === null &&
          (await new AutoMovieProductionOracleService(emptyProject)
            .preview({
              target: { kind: "shot", id: "opening" },
              time: 0,
            })
            .catch((error: unknown) => error)) instanceof Error,
      );
    } catch (error) {
      emptyRootFailure = { error };
      throw error;
    } finally {
      preserveProductionOracleFixtureCleanup(emptyRootFailure, () =>
        emptyRoot.dispose(),
      );
    }
  } catch (error) {
    productionOracleFailure = { error };
    throw error;
  } finally {
    preserveProductionOracleFixtureCleanup(productionOracleFailure, () =>
      fixture.dispose(),
    );
  }
};
