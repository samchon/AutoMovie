import { IAutoMovieRenderBundleManifest } from "@automovie/interface";
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
  productionFixture,
  testCaptureRuntimeIdentity,
  testRendererIdentity,
  worldDesign,
} from "./productionFixtures";

const png = (width = 16, height = 16): Uint8Array => {
  const image = new PNG({ width, height });
  image.data.fill(180);
  image.data[0] = 0;
  return PNG.sync.write(image);
};

/** Review frame inventory rejects malformed, escaping and raced evidence. */
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
      TestValidator.predicate(
        "a decodable thumbnail remains previewable but cannot satisfy production review",
        smallPreview.captured &&
          smallPrepared.frames.length === 0 &&
          smallPrepared.diagnostics.some(
            (diagnostic) => diagnostic.code === "render-frame-invalid",
          ),
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
      const staleWorld = worldDesign();
      staleWorld.landmarks[0]!.meaning += " Stale.";
      project.setWorldDesign(staleWorld);
      const stalePrepared = review.prepare({ target });
      project.setWorldDesign(worldDesign());
      // Restoring the design and recompiling has to bring the same pixels back:
      // the frames were retired because the world design they depend on moved,
      // not because they were rewritten. Render evidence is still fingerprinted
      // by the whole compile input, so an edit to any other source module
      // retires them too; that is a separate freshness question from this one.
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
        ".automovie/render-manifest.json",
      );
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
        "film review fingerprints malformed and linked tracked manifests without following external bytes",
        validAggregate.fingerprint !== malformedAggregate.fingerprint &&
          malformedAggregate.fingerprint !== linkedAggregate.fingerprint,
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
      fs.rmSync(path.join(fixture.root, "renders", wrongClockBundle), {
        recursive: true,
        force: true,
      });

      const malformedDirectory = path.join(
        fixture.root,
        "renders/review-malformed",
      );
      fs.mkdirSync(malformedDirectory, { recursive: true });
      fs.writeFileSync(path.join(malformedDirectory, "manifest.json"), "{bad");
      TestValidator.predicate(
        "malformed bundle manifests are explicit",
        review
          .prepare({ target })
          .diagnostics.some((item) => item.code === "render-bundle-invalid"),
      );
      fs.rmSync(malformedDirectory, { recursive: true, force: true });

      for (const [name, framePath] of [
        ["absolute", path.resolve(fixture.root, "outside.png")],
        ["escape", "../outside.png"],
      ]) {
        const directory = path.join(fixture.root, `renders/review-${name}`);
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(
          path.join(directory, "manifest.json"),
          JSON.stringify({
            ...baseManifest,
            frames: [{ ...baseFrame, path: framePath }],
          }),
        );
        TestValidator.predicate(
          `render frame ${name} paths stay bundle-relative`,
          review
            .prepare({ target })
            .diagnostics.some((item) => item.code === "render-frame-invalid"),
        );
        fs.rmSync(directory, { recursive: true, force: true });
      }

      const symlinkDirectory = path.join(
        fixture.root,
        "renders/review-symlink",
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
        "render frame cannot escape through a directory junction",
        review
          .prepare({ target })
          .diagnostics.some((item) => item.code === "render-frame-invalid"),
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
        [
          "clock",
          (entry: IAutoMovieRenderBundleManifest["frames"][number]) => ({
            ...entry,
            time: entry.time + 0.25,
          }),
        ],
      ] as const) {
        const directory = path.join(fixture.root, `renders/review-${name}`);
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
          `render frame ${name} metadata is verified`,
          review
            .prepare({ target })
            .diagnostics.some((item) => item.code === "render-frame-invalid"),
        );
        fs.rmSync(directory, { recursive: true, force: true });
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
        "renders/review-invalid-frame",
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
          .diagnostics.some((item) => item.code === "render-frame-invalid"),
      );
      const residentReadFileSync = fs.readFileSync;
      Reflect.set(
        fs,
        "readFileSync",
        (file: fs.PathOrFileDescriptor, ...args: unknown[]) => {
          if (path.resolve(String(file)) === path.resolve(invalidFrame)) {
            const iterator = (function* (): Generator<void> {
              yield;
            })();
            iterator.next();
            return iterator.throw("non-error frame read") as never;
          }
          return (
            residentReadFileSync as (...parameters: unknown[]) => unknown
          )(file, ...args);
        },
      );
      try {
        TestValidator.predicate(
          "non-Error frame failures remain actionable",
          review
            .prepare({ target })
            .diagnostics.some(
              (item) =>
                item.code === "render-frame-invalid" &&
                item.message.includes("non-error frame read"),
            ),
        );
      } finally {
        Reflect.set(fs, "readFileSync", residentReadFileSync);
      }
      fs.rmSync(invalidDirectory, { recursive: true, force: true });

      for (const size of [1, 2, 16]) {
        const blankDirectory = path.join(
          fixture.root,
          `renders/review-blank-${size}`,
        );
        const blankFrame = path.join(blankDirectory, "frame.png");
        const blankImage = new PNG({ width: size, height: size });
        blankImage.data.fill(180);
        const blankBytes = PNG.sync.write(blankImage);
        fs.mkdirSync(blankDirectory, { recursive: true });
        fs.writeFileSync(blankFrame, blankBytes);
        fs.writeFileSync(
          path.join(blankDirectory, "manifest.json"),
          JSON.stringify({
            ...baseManifest,
            renderSpec: {
              ...baseManifest.renderSpec,
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
          }),
        );
        TestValidator.predicate(
          `uniform ${size}x${size} review frame is rejected`,
          review
            .prepare({ target })
            .diagnostics.some((item) => item.code === "render-frame-invalid"),
        );
        fs.rmSync(blankDirectory, { recursive: true, force: true });
      }

      const disappearingDirectory = path.join(
        fixture.root,
        "renders/review-disappearing",
      );
      const disappearingManifest = path.join(
        disappearingDirectory,
        "manifest.json",
      );
      fs.mkdirSync(disappearingDirectory, { recursive: true });
      fs.writeFileSync(disappearingManifest, JSON.stringify(baseManifest));
      const stableReadFileSync = fs.readFileSync;
      Reflect.set(
        fs,
        "readFileSync",
        (file: fs.PathOrFileDescriptor, ...args: unknown[]) => {
          if (path.resolve(String(file)) === path.resolve(disappearingManifest))
            fs.rmSync(disappearingManifest, { force: true });
          return (stableReadFileSync as (...parameters: unknown[]) => unknown)(
            file,
            ...args,
          );
        },
      );
      try {
        TestValidator.predicate(
          "a disappearing manifest is invalid rather than absent",
          review
            .prepare({ target })
            .diagnostics.some((item) => item.code === "render-bundle-invalid"),
        );
      } finally {
        Reflect.set(fs, "readFileSync", stableReadFileSync);
      }
    } finally {
      fixture.dispose();
    }
  };
