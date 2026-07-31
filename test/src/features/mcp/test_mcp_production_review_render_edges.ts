import {
  IAutoMovieDiagnostic,
  IAutoMovieRenderBundleManifest,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionOracleService,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
  compareCodeUnits,
  digestAutoMovieBytes,
  productionRenderBundleRelativePath,
  productionRenderTargetFingerprint,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

import {
  fixtureWorldDesign,
  productionFixture,
  testCaptureRuntimeIdentity,
  testRendererIdentity,
} from "./productionFixtures";

const png = (width = 16, height = 16): Uint8Array => {
  const image = new PNG({ width, height });
  image.data.fill(180);
  image.data[0] = 0;
  return PNG.sync.write(image);
};

/**
 * Review frame inventory rejects malformed, escaping and raced evidence,
 * including a physical bundle replaced after discovery but before consumption.
 */
export const test_mcp_production_review_render_edges =
  async (): Promise<void> => {
    const fixture = productionFixture();
    try {
      const project = AutoMovieProductionProject.open(fixture.root);
      const compiler = new AutoMovieProductionCompiler(project);
      TestValidator.predicate(
        "render review fixture compiles",
        compiler.compile({ scope: "source" }).success,
      );
      const oracle = new AutoMovieProductionOracleService(
        project,
        async (request) => {
          const width = request.width ?? 16;
          const height = request.height ?? 16;
          return {
            bytes: png(width, height),
            runtimeIdentity: testCaptureRuntimeIdentity(),
            width,
            height,
          };
        },
      );
      const review = new AutoMovieProductionReviewService(project);
      const target = { kind: "shot" as const, id: "opening" };
      const smallPreview = await oracle.preview({
        target,
        time: 2,
        width: 2,
        height: 2,
      });
      const smallPrepared = review.prepare({ target });
      const smallThumbnailContract =
        smallPreview.captured &&
        smallPrepared.frames.length === 0 &&
        smallPrepared.diagnostics.some(
          (diagnostic) => diagnostic.code === "render-frame-invalid",
        );
      if (smallThumbnailContract === false)
        throw new Error(
          `Review thumbnail contract failed:\n${JSON.stringify(
            {
              preview: smallPreview,
              preparedFrames: smallPrepared.frames,
              reviewDiagnostics: smallPrepared.diagnostics,
            },
            null,
            2,
          )}`,
        );
      TestValidator.predicate(
        "a decodable thumbnail remains previewable but cannot satisfy production review",
        smallThumbnailContract,
      );
      fs.rmSync(path.join(fixture.root, smallPreview.renderBundle!), {
        recursive: true,
        force: true,
      });
      await oracle.preview({
        target: { kind: "shot", id: "opening" },
        time: 2,
        width: 16,
        height: 16,
      });
      await oracle.preview({
        target: { kind: "shot", id: "opening" },
        time: 2,
        pass: "mask",
        width: 16,
        height: 16,
      });
      await oracle.preview({
        target: { kind: "shot", id: "opening" },
        time: 2,
        pass: "pose",
        width: 16,
        height: 16,
      });
      await oracle.preview({
        target: { kind: "shot", id: "opening" },
        time: 1 / 24,
        width: 16,
        height: 16,
      });
      const prepared = review.prepare({ target });
      const staleWorld = fixtureWorldDesign();
      staleWorld.landmarks[0]!.meaning += " Stale.";
      project.setWorldDesign(staleWorld);
      const stalePrepared = review.prepare({ target });
      // Put back what the fixture actually wrote. The full starter world is a
      // different design, and every bundle bound to the fixture slice would
      // stop matching for good rather than coming back.
      project.setWorldDesign(fixtureWorldDesign());
      // Restoring the design and recompiling brings the same pixels back: the
      // frames were retired because the design they answer to moved, not
      // because they were rewritten.
      compiler.compile({ scope: "source" });
      const restoredPrepared = review.prepare({ target });
      TestValidator.equals(
        "review inventory refuses stale output but preserves target-identical frames after recompile",
        {
          preparedHasFrames: prepared.frames.length > 0,
          staleFrames: stalePrepared.frames.length,
          reportsStale: stalePrepared.diagnostics.some(
            (diagnostic) => diagnostic.code === "review-evidence-stale",
          ),
          restoredHasFrames: restoredPrepared.frames.length > 0,
          restoredCodes: [
            ...new Set(restoredPrepared.diagnostics.map((item) => item.code)),
          ].sort(compareCodeUnits),
          preservesTargetIdenticalFrame: restoredPrepared.frames.some(
            (candidate) =>
              candidate.digest === prepared.frames[0]?.digest &&
              candidate.reviewFrame === prepared.frames[0]?.reviewFrame,
          ),
        },
        {
          preparedHasFrames: true,
          staleFrames: 0,
          reportsStale: true,
          restoredHasFrames: true,
          restoredCodes: [],
          preservesTargetIdenticalFrame: true,
        },
      );
      const staleTargetBytes = png();
      const staleTargetManifest: IAutoMovieRenderBundleManifest = {
        version: 3,
        target,
        compileFingerprint: project.generatedManifest()!.inputFingerprint,
        rendererIdentity: testRendererIdentity(),
        targetFingerprint:
          "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        renderSpec: {
          target: target.id,
          frameFormat: { width: 16, height: 16, fps: 24 },
          toneMapping: "none",
          codec: "h264",
          pixelFormat: "yuv420p",
          crf: 17,
        },
        frames: [
          {
            index: 48,
            time: 2,
            pass: "beauty",
            path: "stale-target.png",
            digest: digestAutoMovieBytes(staleTargetBytes),
            width: 16,
            height: 16,
          },
        ],
      };
      const staleTargetBundle =
        productionRenderBundleRelativePath(staleTargetManifest);
      project.commitRenderBundle(
        staleTargetBundle,
        new Map([["stale-target.png", staleTargetBytes]]),
        staleTargetManifest,
      );
      const staleTargetPrepared = review.prepare({ target });
      TestValidator.predicate(
        "review inventory refuses a bundle bound to a stale target fingerprint",
        staleTargetPrepared.frames.every(
          (frame) => frame.bundle.endsWith(staleTargetBundle) === false,
        ),
      );
      const filmManifest: IAutoMovieRenderBundleManifest = {
        version: 3,
        target: { kind: "film", id: "fixture-film" },
        compileFingerprint: project.generatedManifest()!.inputFingerprint,
        rendererIdentity: testRendererIdentity(),
        targetFingerprint: productionRenderTargetFingerprint(
          project,
          project.generatedManifest()!,
          { kind: "film", id: "fixture-film" },
        ),
        renderSpec: {
          target: "fixture-film",
          frameFormat: { width: 16, height: 16, fps: 24 },
          toneMapping: "none",
          codec: "h264",
          pixelFormat: "yuv420p",
          crf: 17,
        },
        frames: [
          {
            index: 48,
            time: 2,
            pass: "beauty",
            path: "film.png",
            digest: digestAutoMovieBytes(png()),
            width: 16,
            height: 16,
          },
        ],
      };
      const filmBundle = productionRenderBundleRelativePath(filmManifest);
      project.commitRenderBundle(
        filmBundle,
        new Map([["film.png", png()]]),
        filmManifest,
      );
      const filmBundlePrepared = review.prepare({
        target: { kind: "film", id: "fixture-film" },
      });
      TestValidator.predicate(
        "film review recognizes its own renderer-owned bundle",
        filmBundlePrepared.diagnostics.every(
          (diagnostic) =>
            !(
              diagnostic.code === "render-bundle-unowned" &&
              diagnostic.path?.includes(filmBundle)
            ),
        ),
      );
      const aggregateManifest = path.join(
        fixture.root,
        ".automovie/productions/fixture-film/render-manifest.json",
      );
      const beforeAggregate = review.prepare({
        target: { kind: "film", id: "fixture-film" },
      });
      fs.writeFileSync(
        aggregateManifest,
        JSON.stringify({ compileFingerprint: "current-test" }),
      );
      const validAggregate = review.prepare({
        target: { kind: "film", id: "fixture-film" },
      });
      fs.writeFileSync(aggregateManifest, "{bad");
      const malformedAggregate = review.prepare({
        target: { kind: "film", id: "fixture-film" },
      });
      fs.rmSync(aggregateManifest);
      const outsideAggregate = path.join(
        fixture.root,
        "outside-aggregate-manifest",
      );
      fs.mkdirSync(outsideAggregate);
      fs.writeFileSync(
        path.join(outsideAggregate, "foreign.json"),
        JSON.stringify({ compileFingerprint: "foreign" }),
      );
      fs.symlinkSync(outsideAggregate, aggregateManifest, "junction");
      const linkedAggregate = review.prepare({
        target: { kind: "film", id: "fixture-film" },
      });
      TestValidator.predicate(
        "terminal publication stays outside human review identity and never follows linked aggregate bytes",
        beforeAggregate.fingerprint === validAggregate.fingerprint &&
          validAggregate.fingerprint === malformedAggregate.fingerprint &&
          malformedAggregate.fingerprint === linkedAggregate.fingerprint,
      );
      fs.rmSync(aggregateManifest, { force: true, recursive: true });
      fs.rmSync(outsideAggregate, { force: true, recursive: true });
      const frame = prepared.frames[0]!;
      const baseManifest = JSON.parse(
        fs.readFileSync(
          path.join(fixture.root, frame.bundle, "manifest.json"),
          "utf8",
        ),
      ) as IAutoMovieRenderBundleManifest;
      const baseFrame = baseManifest.frames.find(
        (entry) => entry.index === frame.frame && entry.pass === frame.pass,
      )!;
      const sourceFrame = path.join(fixture.root, frame.bundle, baseFrame.path);
      const wrongClockBytes = fs.readFileSync(sourceFrame);
      const wrongClockManifest: IAutoMovieRenderBundleManifest = {
        ...baseManifest,
        renderSpec: {
          ...baseManifest.renderSpec,
          frameFormat: {
            ...baseManifest.renderSpec.frameFormat,
            fps: 12,
          },
        },
        frames: [
          {
            ...baseFrame,
            time: baseFrame.index / 12,
            path: "wrong-clock.png",
            digest: digestAutoMovieBytes(wrongClockBytes),
          },
        ],
      };
      const wrongClockBundle =
        productionRenderBundleRelativePath(wrongClockManifest);
      project.commitRenderBundle(
        wrongClockBundle,
        new Map([["wrong-clock.png", wrongClockBytes]]),
        wrongClockManifest,
      );
      const wrongClockPrepared = review.prepare({ target });
      TestValidator.predicate(
        "required review frames stay on the current production frame clock",
        wrongClockPrepared.diagnostics.some(
          (diagnostic) => diagnostic.code === "render-frame-invalid",
        ) &&
          wrongClockPrepared.frames.every(
            (preparedFrame) =>
              preparedFrame.reviewFrame !== frame.reviewFrame ||
              preparedFrame.time === frame.time,
          ),
      );
      fs.rmSync(
        path.join(fixture.root, "renders", "fixture-film", wrongClockBundle),
        {
          recursive: true,
          force: true,
        },
      );

      const malformedDirectory = path.join(
        fixture.root,
        "renders/fixture-film/review-malformed",
      );
      fs.mkdirSync(malformedDirectory, { recursive: true });
      fs.writeFileSync(path.join(malformedDirectory, "manifest.json"), "{bad");
      const malformedShotPrepared = review.prepare({ target });
      const malformedAssetPrepared = review.prepare({
        target: { kind: "asset", id: "sentinel" },
      });
      const malformedManifestPath =
        "renders/fixture-film/review-malformed/manifest.json";
      const shotInvalidManifest = malformedShotPrepared.diagnostics.find(
        (item) =>
          item.code === "render-bundle-invalid" &&
          item.path === malformedManifestPath,
      );
      const assetInvalidManifest = malformedAssetPrepared.diagnostics.find(
        (item) =>
          item.code === "render-bundle-invalid" &&
          item.path === malformedManifestPath,
      );
      TestValidator.equals(
        "malformed bundle manifests retain exact diagnostics during asset review",
        {
          assetDiagnostic:
            assetInvalidManifest === undefined
              ? null
              : {
                  code: assetInvalidManifest.code,
                  category: assetInvalidManifest.category,
                  phase: assetInvalidManifest.phase,
                  target: assetInvalidManifest.target,
                  path: assetInvalidManifest.path,
                  preservesValidationEvidence:
                    assetInvalidManifest.message.startsWith(
                      "Render bundle manifest is invalid: ",
                    ) &&
                    assetInvalidManifest.message.length >
                      "Render bundle manifest is invalid: . Recreate the bundle through captureFrame."
                        .length,
                  preservesRecaptureAndSafetyGuidance:
                    assetInvalidManifest.message.includes(
                      ". Recreate the bundle through captureFrame.",
                    ) &&
                    assetInvalidManifest.message.endsWith(
                      "Correction feedback does not authorize deleting the artifact.",
                    ),
                },
          sameAsShot:
            JSON.stringify(assetInvalidManifest) ===
            JSON.stringify(shotInvalidManifest),
          preservesMissingViews: malformedAssetPrepared.diagnostics.some(
            (item) => item.code === "review-evidence-missing",
          ),
        },
        {
          assetDiagnostic: {
            code: "render-bundle-invalid",
            category: "error",
            phase: "render",
            target: malformedManifestPath,
            path: malformedManifestPath,
            preservesValidationEvidence: true,
            preservesRecaptureAndSafetyGuidance: true,
          },
          sameAsShot: true,
          preservesMissingViews: true,
        },
      );
      fs.rmSync(malformedDirectory, { recursive: true, force: true });

      const mismatchedAssetBytes = png();
      const mismatchedAssetTarget = {
        kind: "asset" as const,
        id: "sentinel",
        angleDeg: 0,
        elevationDeg: 15,
        pose: "rest" as const,
      };
      const mismatchedAssetBase: IAutoMovieRenderBundleManifest = {
        version: 3,
        target: mismatchedAssetTarget,
        compileFingerprint: project.generatedManifest()!.inputFingerprint,
        rendererIdentity: testRendererIdentity(),
        targetFingerprint: productionRenderTargetFingerprint(
          project,
          project.generatedManifest()!,
          mismatchedAssetTarget,
        ),
        renderSpec: {
          target: mismatchedAssetTarget.id,
          frameFormat: { width: 16, height: 16, fps: 24 },
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
            path: "asset.png",
            digest: digestAutoMovieBytes(mismatchedAssetBytes),
            width: 16,
            height: 16,
          },
        ],
      };
      const mismatchedAssetManifests: IAutoMovieRenderBundleManifest[] = [
        {
          ...mismatchedAssetBase,
          renderSpec: {
            ...mismatchedAssetBase.renderSpec,
            target: "another-asset",
          },
        },
        {
          ...mismatchedAssetBase,
          renderSpec: {
            ...mismatchedAssetBase.renderSpec,
            frameFormat: {
              ...mismatchedAssetBase.renderSpec.frameFormat,
              fps: 12,
            },
          },
        },
        {
          ...mismatchedAssetBase,
          renderSpec: {
            ...mismatchedAssetBase.renderSpec,
            frameFormat: {
              ...mismatchedAssetBase.renderSpec.frameFormat,
              width: 15,
            },
          },
        },
        {
          ...mismatchedAssetBase,
          renderSpec: {
            ...mismatchedAssetBase.renderSpec,
            frameFormat: {
              ...mismatchedAssetBase.renderSpec.frameFormat,
              height: 15,
            },
          },
        },
      ];
      const mismatchedAssetBundles = mismatchedAssetManifests.map(
        (manifest) => {
          const bundle = productionRenderBundleRelativePath(manifest);
          project.commitRenderBundle(
            bundle,
            new Map([["asset.png", mismatchedAssetBytes]]),
            manifest,
          );
          return bundle;
        },
      );
      const staleAssetManifest: IAutoMovieRenderBundleManifest = {
        ...mismatchedAssetBase,
        targetFingerprint:
          "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        renderSpec: {
          ...mismatchedAssetBase.renderSpec,
          target: "stale-other-asset",
          crf: 18,
        },
      };
      const staleAssetBundle =
        productionRenderBundleRelativePath(staleAssetManifest);
      project.commitRenderBundle(
        staleAssetBundle,
        new Map([["asset.png", mismatchedAssetBytes]]),
        staleAssetManifest,
      );
      const mismatchedAssetPaths = mismatchedAssetBundles.map((bundle) => ({
        target: path
          .relative(fixture.root, path.join(project.renderRoot(), bundle))
          .replaceAll(path.sep, "/"),
        manifest: path
          .relative(
            fixture.root,
            path.join(project.renderRoot(), bundle, "manifest.json"),
          )
          .replaceAll(path.sep, "/"),
      }));
      const staleAssetManifestPath = path
        .relative(
          fixture.root,
          path.join(project.renderRoot(), staleAssetBundle, "manifest.json"),
        )
        .replaceAll(path.sep, "/");
      const mismatchedAssetPrepared = review.prepare({
        target: { kind: "asset", id: "sentinel" },
      });
      const mismatchedAssetDiagnostics = mismatchedAssetPrepared.diagnostics
        .filter(
          (diagnostic) =>
            diagnostic.path !== null &&
            mismatchedAssetPaths.some(
              (candidate) => candidate.manifest === diagnostic.path,
            ),
        )
        .sort((left, right) =>
          compareCodeUnits(left.path ?? "", right.path ?? ""),
        );
      TestValidator.equals(
        "asset review rejects every mismatched renderer-owned render spec",
        {
          admittedFrames: mismatchedAssetPrepared.frames.length,
          diagnostics: mismatchedAssetDiagnostics,
          missingViews: mismatchedAssetPrepared.diagnostics
            .filter(
              (diagnostic) => diagnostic.code === "review-evidence-missing",
            )
            .map((diagnostic) => diagnostic.target)
            .sort(compareCodeUnits),
          staleBundleAdmitted: mismatchedAssetPrepared.frames.some((frame) =>
            frame.bundle.endsWith(staleAssetBundle),
          ),
          staleBundleReportedAsRenderSpecMismatch:
            mismatchedAssetPrepared.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "render-frame-invalid" &&
                diagnostic.path === staleAssetManifestPath,
            ),
        },
        {
          admittedFrames: 0,
          diagnostics: mismatchedAssetPaths
            .sort((left, right) =>
              compareCodeUnits(left.manifest, right.manifest),
            )
            .map(
              (candidate) =>
                ({
                  code: "render-frame-invalid",
                  category: "warning",
                  phase: "render",
                  target: candidate.target,
                  path: candidate.manifest,
                  message:
                    "This asset view does not match the current asset, production FPS, and exact production raster, so it cannot discharge review. Capture the required view again without width/height overrides before submitReview.",
                }) satisfies IAutoMovieDiagnostic,
            ),
          missingViews: [
            "asset:sentinel:rig-rom-extremes",
            "asset:sentinel:top-outline",
            "asset:sentinel:turntable-back",
            "asset:sentinel:turntable-front",
            "asset:sentinel:turntable-left",
            "asset:sentinel:turntable-right",
          ],
          staleBundleAdmitted: false,
          staleBundleReportedAsRenderSpecMismatch: false,
        },
      );

      for (const [name, framePath] of [
        ["absolute", path.resolve(fixture.root, "outside.png")],
        ["escape", "../outside.png"],
      ]) {
        const directory = path.join(
          fixture.root,
          `renders/fixture-film/review-${name}`,
        );
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(
          path.join(directory, "manifest.json"),
          JSON.stringify({
            ...baseManifest,
            frames: [{ ...baseFrame, path: framePath }],
          }),
        );
        TestValidator.predicate(
          `unreceipted render frame ${name} paths never reach PNG reads`,
          review
            .prepare({ target })
            .diagnostics.some((item) => item.code === "render-bundle-unowned"),
        );
        fs.rmSync(directory, { recursive: true, force: true });
      }

      const symlinkDirectory = path.join(
        fixture.root,
        "renders/fixture-film/review-symlink",
      );
      const externalFrames = path.join(fixture.root, "external-frames");
      fs.mkdirSync(symlinkDirectory, { recursive: true });
      fs.mkdirSync(externalFrames, { recursive: true });
      fs.copyFileSync(sourceFrame, path.join(externalFrames, "frame.png"));
      fs.symlinkSync(
        externalFrames,
        path.join(symlinkDirectory, "linked"),
        "junction",
      );
      fs.writeFileSync(
        path.join(symlinkDirectory, "manifest.json"),
        JSON.stringify({
          ...baseManifest,
          frames: [{ ...baseFrame, path: "linked/frame.png" }],
        }),
      );
      TestValidator.predicate(
        "unreceipted render frame cannot escape through a directory junction",
        review
          .prepare({ target })
          .diagnostics.some((item) => item.code === "render-bundle-unowned"),
      );
      fs.rmSync(symlinkDirectory, { recursive: true, force: true });
      fs.rmSync(externalFrames, { recursive: true, force: true });

      for (const [name, mutate] of [
        [
          "digest",
          (entry: IAutoMovieRenderBundleManifest["frames"][number]) => ({
            ...entry,
            digest:
              "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" as const,
          }),
        ],
        [
          "width",
          (entry: IAutoMovieRenderBundleManifest["frames"][number]) => ({
            ...entry,
            width: entry.width + 1,
          }),
        ],
        [
          "height",
          (entry: IAutoMovieRenderBundleManifest["frames"][number]) => ({
            ...entry,
            height: entry.height + 1,
          }),
        ],
      ] as const) {
        const directory = path.join(
          fixture.root,
          `renders/fixture-film/review-${name}`,
        );
        fs.mkdirSync(directory, { recursive: true });
        fs.copyFileSync(sourceFrame, path.join(directory, "frame.png"));
        fs.writeFileSync(
          path.join(directory, "manifest.json"),
          JSON.stringify({
            ...baseManifest,
            frames: [
              mutate({
                ...baseFrame,
                path: "frame.png",
              }),
            ],
          }),
        );
        TestValidator.predicate(
          `unreceipted render frame ${name} metadata never reaches PNG reads`,
          review
            .prepare({ target })
            .diagnostics.some((item) => item.code === "render-bundle-unowned"),
        );
        fs.rmSync(directory, { recursive: true, force: true });
      }

      for (const [name, time, crf] of [
        ["subframe", baseFrame.time + 0.01, 18],
        ["wrong-index", baseFrame.time + 0.25, 19],
      ] as const) {
        const bytes = fs.readFileSync(sourceFrame);
        const manifest: IAutoMovieRenderBundleManifest = {
          ...baseManifest,
          renderSpec: {
            ...baseManifest.renderSpec,
            crf,
          },
          frames: [
            {
              ...baseFrame,
              path: `${name}.png`,
              time,
              digest: digestAutoMovieBytes(bytes),
            },
          ],
        };
        const bundle = productionRenderBundleRelativePath(manifest);
        project.commitRenderBundle(
          bundle,
          new Map([[`${name}.png`, bytes]]),
          manifest,
        );
        TestValidator.predicate(
          `renderer-owned ${name} frame clock is rejected`,
          review
            .prepare({ target })
            .diagnostics.some((item) => item.code === "render-frame-invalid"),
        );
        fs.rmSync(path.join(project.renderRoot(), bundle), {
          recursive: true,
          force: true,
        });
      }

      for (const [channel, bytes] of [
        [
          "green",
          (() => {
            const image = new PNG({ width: 16, height: 16 });
            for (let offset = 0; offset < image.data.length; offset += 4) {
              image.data[offset] = 10;
              image.data[offset + 1] = 20;
              image.data[offset + 2] = 30;
              image.data[offset + 3] = 255;
            }
            image.data[5] = 21;
            return PNG.sync.write(image);
          })(),
        ],
        [
          "blue",
          (() => {
            const image = new PNG({ width: 16, height: 16 });
            for (let offset = 0; offset < image.data.length; offset += 4) {
              image.data[offset] = 10;
              image.data[offset + 1] = 20;
              image.data[offset + 2] = 30;
              image.data[offset + 3] = 255;
            }
            image.data[6] = 31;
            return PNG.sync.write(image);
          })(),
        ],
        [
          "alpha",
          (() => {
            const image = new PNG({ width: 16, height: 16 });
            image.data.fill(0);
            image.data[7] = 255;
            return PNG.sync.write(image);
          })(),
        ],
      ] as const) {
        const digest = digestAutoMovieBytes(bytes);
        const manifest: IAutoMovieRenderBundleManifest = {
          ...baseManifest,
          frames: [
            {
              ...baseFrame,
              path: `${channel}.png`,
              digest,
            },
          ],
        };
        const bundle = productionRenderBundleRelativePath(manifest);
        project.commitRenderBundle(
          bundle,
          new Map([[`${channel}.png`, bytes]]),
          manifest,
        );
        TestValidator.predicate(
          `${channel}-only visible variance remains admissible evidence`,
          review
            .prepare({ target })
            .frames.some((candidate) => candidate.digest === digest),
        );
      }

      const invalidDirectory = path.join(
        fixture.root,
        "renders/fixture-film/review-invalid-frame",
      );
      const invalidFrame = path.join(invalidDirectory, "frame.png");
      fs.mkdirSync(invalidDirectory, { recursive: true });
      fs.writeFileSync(invalidFrame, new Uint8Array());
      fs.writeFileSync(
        path.join(invalidDirectory, "manifest.json"),
        JSON.stringify({ ...baseManifest, rendererIdentity: " " }),
      );
      TestValidator.predicate(
        "unparseable renderer identity cannot enter review inventory",
        review
          .prepare({ target })
          .diagnostics.some(
            (item) =>
              item.code === "render-bundle-invalid" &&
              item.message.includes("Capture runtime identity"),
          ),
      );
      fs.writeFileSync(
        path.join(invalidDirectory, "manifest.json"),
        JSON.stringify({
          ...baseManifest,
          version: 2,
          rendererIdentity: " ",
        }),
      );
      TestValidator.predicate(
        "malformed v2 renderer provenance remains invalid",
        review
          .prepare({ target })
          .diagnostics.some(
            (item) =>
              item.code === "render-bundle-invalid" &&
              item.path?.includes("review-invalid-frame"),
          ),
      );
      fs.writeFileSync(
        path.join(invalidDirectory, "manifest.json"),
        JSON.stringify({ ...baseManifest, version: 2 }),
      );
      const legacyPrepared = review.prepare({ target });
      TestValidator.predicate(
        "v2 render evidence remains historical without blocking current v3 frames",
        legacyPrepared.frames.length !== 0 &&
          legacyPrepared.diagnostics.some(
            (item) =>
              item.code === "render-bundle-legacy" &&
              item.category === "warning" &&
              item.message.includes("Recapture"),
          ),
      );
      fs.writeFileSync(
        path.join(invalidDirectory, "manifest.json"),
        JSON.stringify({
          ...baseManifest,
          frames: [{ ...baseFrame, path: "frame.png" }],
        }),
      );
      TestValidator.predicate(
        "empty frame bytes are rejected",
        review
          .prepare({ target })
          .diagnostics.some((item) => item.code === "render-bundle-unowned"),
      );
      fs.rmSync(invalidDirectory, { recursive: true, force: true });

      const racedBytes = png();
      const racedManifest: IAutoMovieRenderBundleManifest = {
        ...baseManifest,
        renderSpec: {
          ...baseManifest.renderSpec,
          crf: 20,
        },
        frames: [
          {
            ...baseFrame,
            path: "raced.png",
            digest: digestAutoMovieBytes(racedBytes),
          },
        ],
      };
      const racedBundle = productionRenderBundleRelativePath(racedManifest);
      project.commitRenderBundle(
        racedBundle,
        new Map([["raced.png", racedBytes]]),
        racedManifest,
      );
      const racedManifestPath = path.join(
        project.renderRoot(),
        racedBundle,
        "manifest.json",
      );
      const residentVerifiedRenderManifest =
        project.verifiedRenderManifest.bind(project);
      const residentReadRenderFile = project.readRenderFile.bind(project);
      let ownershipVerified = false;
      let postVerificationFailure: "digest" | "non-error" = "digest";
      project.verifiedRenderManifest = ((manifestPath: string) => {
        const manifest = residentVerifiedRenderManifest(manifestPath);
        if (
          path.resolve(manifestPath) === path.resolve(racedManifestPath) &&
          manifest !== null
        )
          ownershipVerified = true;
        return manifest;
      }) as typeof project.verifiedRenderManifest;
      project.readRenderFile = ((relativePath: string): Uint8Array => {
        if (
          ownershipVerified &&
          relativePath ===
            path.join(racedBundle, "raced.png").split(path.sep).join("/")
        ) {
          if (postVerificationFailure === "digest") return png(15, 16);
          const iterator = (function* (): Generator<void> {
            yield;
          })();
          iterator.next();
          return iterator.throw("non-error frame read") as never;
        }
        return residentReadRenderFile(relativePath);
      }) as typeof project.readRenderFile;
      try {
        TestValidator.predicate(
          "post-verification byte changes remain actionable",
          review
            .prepare({ target })
            .diagnostics.some(
              (item) =>
                item.code === "render-frame-invalid" &&
                item.message.includes(
                  "frame bytes changed after renderer ownership verification",
                ),
            ),
        );
        ownershipVerified = false;
        postVerificationFailure = "non-error";
        TestValidator.predicate(
          "post-verification non-Error frame failures remain actionable",
          review
            .prepare({ target })
            .diagnostics.some(
              (item) =>
                item.code === "render-frame-invalid" &&
                item.message.includes("non-error frame read"),
            ),
        );
      } finally {
        project.verifiedRenderManifest =
          residentVerifiedRenderManifest as typeof project.verifiedRenderManifest;
        project.readRenderFile =
          residentReadRenderFile as typeof project.readRenderFile;
      }
      const racedBundleRoot = path.join(project.renderRoot(), racedBundle);
      const outsideRacedFrame = path.join(
        fixture.root,
        "review-outside-frame.png",
      );
      const linkedRacedFrame = path.join(racedBundleRoot, "linked.png");
      fs.copyFileSync(sourceFrame, outsideRacedFrame);
      fs.symlinkSync(outsideRacedFrame, linkedRacedFrame, "file");
      let injectedFramePath = "";
      project.verifiedRenderManifest = ((manifestPath: string) => {
        const manifest = residentVerifiedRenderManifest(manifestPath);
        return manifest === null ||
          path.resolve(manifestPath) !== path.resolve(racedManifestPath)
          ? manifest
          : {
              ...manifest,
              frames: manifest.frames.map((frame, index) =>
                index === 0 ? { ...frame, path: injectedFramePath } : frame,
              ),
            };
      }) as typeof project.verifiedRenderManifest;
      try {
        TestValidator.equals(
          "verified frame paths cannot escape their content-addressed bundle",
          [
            [path.resolve(outsideRacedFrame), "must be bundle-relative"],
            ["../outside.png", "escapes its bundle"],
            ["linked.png", "frame escapes its bundle through a symlink"],
          ].map(([framePath, message]) => {
            injectedFramePath = framePath!;
            return review
              .prepare({ target })
              .diagnostics.some(
                (item) =>
                  item.code === "render-frame-invalid" &&
                  item.message.includes(message!),
              );
          }),
          [true, true, true],
        );
      } finally {
        project.verifiedRenderManifest =
          residentVerifiedRenderManifest as typeof project.verifiedRenderManifest;
        fs.unlinkSync(linkedRacedFrame);
        fs.rmSync(outsideRacedFrame);
      }
      fs.rmSync(path.join(project.renderRoot(), racedBundle), {
        recursive: true,
        force: true,
      });

      for (const size of [1, 2, 16]) {
        const blankImage = new PNG({ width: size, height: size });
        blankImage.data.fill(180);
        const blankBytes = PNG.sync.write(blankImage);
        const blankManifest: IAutoMovieRenderBundleManifest = {
          ...baseManifest,
          renderSpec: {
            ...baseManifest.renderSpec,
            crf: 20 + size,
            frameFormat: {
              ...baseManifest.renderSpec.frameFormat,
              width: size,
              height: size,
            },
          },
          frames: [
            {
              ...baseFrame,
              path: "frame.png",
              digest: digestAutoMovieBytes(blankBytes),
              width: size,
              height: size,
            },
          ],
        };
        const blankBundle = productionRenderBundleRelativePath(blankManifest);
        project.commitRenderBundle(
          blankBundle,
          new Map([["frame.png", blankBytes]]),
          blankManifest,
        );
        TestValidator.predicate(
          `uniform ${size}x${size} review frame is rejected`,
          review
            .prepare({ target })
            .diagnostics.some((item) => item.code === "render-frame-invalid"),
        );
        fs.rmSync(path.join(project.renderRoot(), blankBundle), {
          recursive: true,
          force: true,
        });
      }

      const disappearingDirectory = path.join(
        fixture.root,
        "renders/fixture-film/review-disappearing",
      );
      const disappearingManifest = path.join(
        disappearingDirectory,
        "manifest.json",
      );
      fs.mkdirSync(disappearingDirectory, { recursive: true });
      fs.writeFileSync(disappearingManifest, JSON.stringify(baseManifest));
      const stableOpenSync = fs.openSync;
      Reflect.set(fs, "openSync", (file: fs.PathLike, ...args: unknown[]) => {
        if (path.resolve(String(file)) === path.resolve(disappearingManifest))
          fs.rmSync(disappearingManifest, { force: true });
        return (stableOpenSync as (...parameters: unknown[]) => number)(
          file,
          ...args,
        );
      });
      try {
        TestValidator.predicate(
          "a disappearing manifest is invalid rather than absent",
          review
            .prepare({ target })
            .diagnostics.some((item) => item.code === "render-bundle-invalid"),
        );
      } finally {
        Reflect.set(fs, "openSync", stableOpenSync);
      }

      const inventoryRaceFixture = (name: string) => {
        const directory = path.join(
          fixture.root,
          "renders",
          "fixture-film",
          `review-inventory-${name}`,
        );
        const parked = `${directory}-parked`;
        const external = path.join(
          fixture.root,
          `external-review-inventory-${name}`,
        );
        fs.mkdirSync(directory, { recursive: true });
        fs.mkdirSync(external, { recursive: true });
        for (const root of [directory, external]) {
          fs.copyFileSync(sourceFrame, path.join(root, "frame.png"));
          fs.writeFileSync(
            path.join(root, "manifest.json"),
            JSON.stringify({
              ...baseManifest,
              frames: [{ ...baseFrame, path: "frame.png" }],
            }),
          );
        }
        return { directory, parked, external };
      };
      const disposeInventoryRaceFixture = (race: {
        directory: string;
        parked: string;
        external: string;
      }): void => {
        fs.rmSync(race.directory, { recursive: true, force: true });
        fs.rmSync(race.parked, { recursive: true, force: true });
        fs.rmSync(race.external, { recursive: true, force: true });
      };
      const postReadDirectoryRace = (
        replacement: "directory" | "file" | "junction",
      ): boolean => {
        const race = inventoryRaceFixture(`post-read-${replacement}`);
        const residentReaddirSync = fs.readdirSync;
        let swapped = false;
        let rejected = false;
        Reflect.set(
          fs,
          "readdirSync",
          (directory: fs.PathLike, ...args: unknown[]) => {
            const entries = (
              residentReaddirSync as (...parameters: unknown[]) => unknown
            )(directory, ...args);
            if (
              swapped === false &&
              path.resolve(String(directory)) === path.resolve(race.directory)
            ) {
              fs.renameSync(race.directory, race.parked);
              if (replacement === "directory") fs.mkdirSync(race.directory);
              else if (replacement === "file")
                fs.writeFileSync(race.directory, "replacement");
              else fs.symlinkSync(race.external, race.directory, "junction");
              swapped = true;
            }
            return entries;
          },
        );
        try {
          try {
            review.prepare({ target });
          } catch (error) {
            rejected =
              error instanceof Error &&
              error.message.includes("Render inventory directory");
          }
        } finally {
          Reflect.set(fs, "readdirSync", residentReaddirSync);
          disposeInventoryRaceFixture(race);
        }
        return swapped && rejected;
      };
      TestValidator.predicate(
        "render inventory rejects every post-read directory replacement",
        postReadDirectoryRace("junction") &&
          postReadDirectoryRace("file") &&
          postReadDirectoryRace("directory"),
      );

      const lstatToRealpathRace = (
        observation: 1 | 2,
        fragment: string,
      ): boolean => {
        const race = inventoryRaceFixture(`lstat-${observation}`);
        const residentLstatSync = fs.lstatSync;
        let observed = 0;
        let swapped = false;
        let rejected = false;
        Reflect.set(fs, "lstatSync", (file: fs.PathLike) => {
          const status = residentLstatSync(file);
          if (
            path.resolve(String(file)) === path.resolve(race.directory) &&
            ++observed === observation
          ) {
            fs.renameSync(race.directory, race.parked);
            fs.symlinkSync(race.external, race.directory, "junction");
            swapped = true;
          }
          return status;
        });
        try {
          try {
            review.prepare({ target });
          } catch (error) {
            rejected =
              error instanceof Error && error.message.includes(fragment);
          }
        } finally {
          Reflect.set(fs, "lstatSync", residentLstatSync);
          disposeInventoryRaceFixture(race);
        }
        return swapped && rejected;
      };
      TestValidator.predicate(
        "render inventory refuses ancestry swaps between lstat and realpath",
        lstatToRealpathRace(1, "Render inventory path") &&
          lstatToRealpathRace(2, "Render inventory directory"),
      );

      const lateImage = new PNG({ width: 16, height: 16 });
      lateImage.data.fill(180);
      lateImage.data[0] = 1;
      lateImage.data[1] = 2;
      const lateBytes = PNG.sync.write(lateImage);
      const lateDigest = digestAutoMovieBytes(lateBytes);
      const lateManifest: IAutoMovieRenderBundleManifest = {
        ...baseManifest,
        renderSpec: {
          ...baseManifest.renderSpec,
          crf: 49,
        },
        frames: [
          {
            ...baseFrame,
            path: "late.png",
            digest: lateDigest,
          },
        ],
      };
      const lateBundle = productionRenderBundleRelativePath(lateManifest);
      project.commitRenderBundle(
        lateBundle,
        new Map([["late.png", lateBytes]]),
        lateManifest,
      );
      const lateRoot = path.join(project.renderRoot(), lateBundle);
      const lateManifestPath = path.join(lateRoot, "manifest.json");
      const lateParked = `${lateRoot}-parked`;
      const lateSource = path.join(
        project.renderRoot(),
        "review-post-inventory-source",
      );
      fs.cpSync(lateRoot, lateSource, { recursive: true });
      const residentVerifiedManifest =
        project.verifiedRenderManifest.bind(project);
      let lateSwapped = false;
      project.verifiedRenderManifest = ((manifestPath: string) => {
        if (
          lateSwapped === false &&
          path.resolve(manifestPath) === path.resolve(lateManifestPath)
        ) {
          fs.renameSync(lateRoot, lateParked);
          fs.symlinkSync(lateSource, lateRoot, "junction");
          lateSwapped = true;
        }
        return residentVerifiedManifest(manifestPath);
      }) as typeof project.verifiedRenderManifest;
      try {
        const prepared = review.prepare({ target });
        TestValidator.predicate(
          "a bundle replaced after inventory cannot become review evidence",
          lateSwapped &&
            prepared.frames.every((frame) => frame.digest !== lateDigest) &&
            prepared.diagnostics.some(
              (item) =>
                item.code === "render-bundle-unowned" &&
                path.resolve(fixture.root, item.path ?? "") ===
                  path.resolve(lateManifestPath),
            ),
        );
      } finally {
        project.verifiedRenderManifest =
          residentVerifiedManifest as typeof project.verifiedRenderManifest;
        if (lateSwapped) fs.unlinkSync(lateRoot);
        fs.rmSync(lateSource, { recursive: true, force: true });
        if (fs.existsSync(lateParked)) fs.renameSync(lateParked, lateRoot);
        fs.rmSync(lateRoot, { recursive: true, force: true });
      }
    } finally {
      fixture.dispose();
    }
  };
