import { IAutoMovieCompiledShotSource } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionOracleService,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

import {
  formationDesign,
  productionDesign,
  productionFixture,
  worldDesign,
} from "./productionFixtures";

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

/** Geometry queries and preview frames use current compiler-owned artifacts. */
export const test_mcp_production_oracle = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    project.setFormationDesign(formationDesign());
    const compiler = new AutoMovieProductionCompiler(project);
    TestValidator.predicate(
      "oracle fixture compiles",
      compiler.compile({ scope: "source" }).success,
    );
    const oracle = new AutoMovieProductionOracleService(project);
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
    const physicalReach = oracle.query({
      request: {
        query: "reach",
        actor: "sentinel",
        shot: "opening",
        target: { kind: "landmark", landmark: "signal-ground" },
        time: 2,
      },
    });
    TestValidator.predicate(
      "actor-to-landmark reach uses the compiled arm chains",
      physicalReach.result?.kind === "measurement" &&
        physicalReach.result.values.leftMeasurable === true &&
        physicalReach.result.values.rightMeasurable === true &&
        typeof physicalReach.result.values.leftGap === "number",
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
    TestValidator.predicate(
      "formation and sampled pose measurements",
      oracle.query({
        request: { query: "formation", formation: "line" },
      }).result?.kind === "measurement" &&
        oracle.query({
          request: {
            query: "pose",
            actor: "sentinel",
            shot: "opening",
            time: 2,
          },
        }).result?.kind === "measurement",
    );
    const cameraMeasurement = oracle.query({
      request: {
        query: "camera",
        shot: "opening",
        time: 2,
        subjects: ["sentinel", "absent"],
      },
    }).result;
    TestValidator.predicate(
      "camera query projects current animated root points and distinguishes the occlusion contract",
      cameraMeasurement?.kind === "measurement" &&
        cameraMeasurement.values.requestedSubjects === 2 &&
        cameraMeasurement.values.resolvedSubjectRootPoints === 1 &&
        cameraMeasurement.values.inFrameRootPoints === 1 &&
        cameraMeasurement.values.missingSubjects === 1 &&
        cameraMeasurement.values.maxAllowedOcclusionRatio === 0.05 &&
        cameraMeasurement.values.occlusionMeasured === false,
    );
    TestValidator.predicate(
      "camera query rejects dishonest empty, duplicate and out-of-range samples",
      oracle.query({
        request: {
          query: "camera",
          shot: "opening",
          time: 2,
          subjects: [],
        },
      }).result === null &&
        oracle.query({
          request: {
            query: "camera",
            shot: "opening",
            time: 2,
            subjects: ["sentinel", "sentinel"],
          },
        }).result === null &&
        oracle.query({
          request: {
            query: "camera",
            shot: "opening",
            time: 7,
            subjects: ["sentinel"],
          },
        }).result === null,
    );
    const missingOnlyCameraMeasurement = oracle.query({
      request: {
        query: "camera",
        shot: "opening",
        time: 2,
        subjects: ["absent"],
      },
    }).result;
    TestValidator.predicate(
      "camera query reports a deterministic negative margin when no requested root resolves",
      missingOnlyCameraMeasurement?.kind === "measurement" &&
        missingOnlyCameraMeasurement.values.resolvedSubjectRootPoints === 0 &&
        missingOnlyCameraMeasurement.values.minimumRootPointMargin === -1,
    );
    TestValidator.predicate(
      "bad selectors return compact diagnostics",
      oracle.query({
        request: {
          query: "distance",
          from: { kind: "landmark", landmark: "absent" },
          to: { kind: "actor", actor: "absent" },
        },
      }).diagnostics[0]?.code === "geometry-selector-invalid" &&
        oracle.query({
          request: { query: "formation", formation: "absent" },
        }).result === null &&
        oracle.query({
          request: {
            query: "camera",
            shot: "absent",
            time: 0,
            subjects: [],
          },
        }).result === null &&
        oracle.query({
          request: {
            query: "distance",
            from: { kind: "actor", actor: "absent" },
            to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
          },
        }).result === null,
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
      "generated/shots/opening.json",
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
    const writeCorrupted = (value: IAutoMovieCompiledShotSource): void =>
      fs.writeFileSync(generatedShotPath, JSON.stringify(value));

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
      ".automovie/design/production.json",
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
        translation: { x: 1, y: 0, z: 0 },
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
    TestValidator.predicate(
      "reach and bone oracles refuse corrupt rigs and preserve one-sided measurements",
      [
        degenerateReach,
        unriggedReach,
        unriggedBone,
        missingBone,
        missingActorModel,
        missingActorInShot,
        armlessReach,
        zeroLengthReach,
      ].every((output) => output.result === null) &&
        rightOnlyReach.result?.kind === "measurement" &&
        rightOnlyReach.result.values.leftMeasurable === false &&
        leftOnlyReach.result?.kind === "measurement" &&
        leftOnlyReach.result.values.rightMeasurable === false &&
        rootedReach.result?.kind === "measurement" &&
        rootedActorDistance.result?.kind === "distance" &&
        heldActorDistance.result?.kind === "distance",
    );

    writeCorrupted(generatedShot);
    generatedShot.shot.performances[0]!.motion = null;
    fs.writeFileSync(generatedShotPath, JSON.stringify(generatedShot));
    const heldPose = oracle.query({
      request: {
        query: "pose",
        actor: "sentinel",
        shot: "opening",
        time: 2,
      },
    });
    generatedShot.shot.performances[0]!.node = "ghost";
    fs.writeFileSync(generatedShotPath, JSON.stringify(generatedShot));
    const heldWithoutNode = oracle.query({
      request: {
        query: "pose",
        actor: "ghost",
        time: 2,
      },
    });
    generatedShot.shot.performances[0]!.motion = generatedShot.motions[0]!.id;
    fs.writeFileSync(generatedShotPath, JSON.stringify(generatedShot));
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
    fs.writeFileSync(generatedShotPath, JSON.stringify(generatedShot));
    const movingWithRoot = oracle.query({
      request: {
        query: "pose",
        actor: "sentinel",
        time: 2,
      },
    });
    generatedShot.shot.performances[0]!.motion = "absent";
    fs.writeFileSync(generatedShotPath, JSON.stringify(generatedShot));
    const missingMotion = oracle.query({
      request: {
        query: "pose",
        actor: "sentinel",
        shot: "opening",
        time: 2,
      },
    });
    generatedShot.shot.performances = [];
    fs.writeFileSync(generatedShotPath, JSON.stringify(generatedShot));
    const missingPerformance = oracle.query({
      request: {
        query: "pose",
        actor: "sentinel",
        shot: "opening",
        time: 2,
      },
    });
    fs.writeFileSync(generatedShotPath, "{}");
    const invalidGenerated = oracle.query({
      request: { query: "ground", point: { x: 0, z: 0 } },
    });
    fs.writeFileSync(generatedShotPath, generatedShotBytes);
    TestValidator.predicate(
      "pose oracle refuses unstaged actors and missing performance or motion",
      heldPose.result?.kind === "measurement" &&
        heldPose.result.values.held === true &&
        heldWithoutNode.result === null &&
        movingWithoutRootOrNode.result === null &&
        movingWithRoot.result?.kind === "measurement" &&
        movingWithRoot.result.values.rootX === 7 &&
        missingMotion.result === null &&
        missingPerformance.result === null &&
        invalidGenerated.result === null,
    );

    const manifestPath = path.join(
      fixture.root,
      ".automovie/generated-manifest.json",
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
      { kind: "column" as const, ranks: 2, files: 3 },
      { kind: "wedge" as const, depth: 3 },
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
    TestValidator.predicate(
      "ground oracle handles planes and an absent bounded world",
      slopedGround.result?.kind === "ground" &&
        slopedGround.result.height === 2.5 &&
        absentWorld.result?.kind === "ground" &&
        absentWorld.result.surface === null,
    );

    project.eraseDesignArtifact({ kind: "production" });
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
      async () => ({ bytes: png(2, 2), width: 2, height: 2 }),
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
    TestValidator.predicate(
      "oracle freshness covers stale and invalid current compiler states",
      stalePreview.diagnostics[0]?.code === "generated-stale" &&
        invalidStatusOracle.query({
          request: { query: "ground", point: { x: 0, z: 0 } },
        }).diagnostics[0]?.code === "compile-current-invalid" &&
        diagnosticStatusOracle
          .query({
            request: { query: "ground", point: { x: 0, z: 0 } },
          })
          .diagnostics[0]?.message.includes("current compiler error"),
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
      async () => ({ bytes: png(2, 2), width: 2, height: 2 }),
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
    const absentTargetOracle = new AutoMovieProductionOracleService(
      project,
      async () => ({ bytes: png(2, 2), width: 2, height: 2 }),
    );
    const absentShot = await absentTargetOracle.preview({
      target: { kind: "shot", id: "absent" },
      time: 0,
      width: 2,
      height: 2,
    });
    const absentFilm = await absentTargetOracle.preview({
      target: { kind: "film", id: "absent" },
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
        absentFilm.diagnostics[0]?.code === "preview-target-missing" &&
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
        async () => ({ bytes, width: 2, height: 2 }),
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
      width: 2,
      height: 2,
    } as {
      bytes: Uint8Array;
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
      async () => ({ bytes: png(1, 1), width: 3, height: 3 }),
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
    TestValidator.predicate(
      "uniform captures cannot become visual review evidence",
      (
        await Promise.all(
          [1, 2].map((size) =>
            new AutoMovieProductionOracleService(project, async () => ({
              bytes: blankPng(size, size),
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
    TestValidator.predicate(
      "verified frames are content addressed and frame-snapped",
      defaultSized.captured &&
        beauty.captured &&
        beauty.frame?.time === 1 / 24 &&
        fs.existsSync(path.join(fixture.root, beauty.frame.path)) &&
        mask.captured &&
        mask.renderBundle === beauty.renderBundle &&
        mask.frame?.path.endsWith(".mask.png") === true,
    );
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

    const emptyRoot = productionFixture();
    try {
      const emptyProject = AutoMovieProductionProject.open(emptyRoot.root);
      fs.rmSync(
        path.join(emptyRoot.root, ".automovie/generated-manifest.json"),
        { force: true },
      );
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
    } finally {
      emptyRoot.dispose();
    }
  } finally {
    fixture.dispose();
  }
};
