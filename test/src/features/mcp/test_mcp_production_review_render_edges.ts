import { IAutoMovieRenderBundleManifest } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionOracleService,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
  digestAutoMovieBytes,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

import { productionFixture, worldDesign } from "./productionFixtures";

const png = (): Uint8Array => {
  const image = new PNG({ width: 2, height: 2 });
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
        async () => ({ bytes: png(), width: 2, height: 2 }),
      );
      await oracle.preview({
        target: { kind: "shot", id: "opening" },
        time: 0,
        width: 2,
        height: 2,
      });
      await oracle.preview({
        target: { kind: "shot", id: "opening" },
        time: 0,
        pass: "mask",
        width: 2,
        height: 2,
      });
      await oracle.preview({
        target: { kind: "shot", id: "opening" },
        time: 1 / 24,
        width: 2,
        height: 2,
      });
      const review = new AutoMovieProductionReviewService(project);
      const target = { kind: "shot" as const, id: "opening" };
      const prepared = review.prepare({ target });
      const staleWorld = worldDesign();
      staleWorld.landmarks[0]!.meaning += " Stale.";
      project.setWorldDesign(staleWorld);
      const stalePrepared = review.prepare({ target });
      project.setWorldDesign(worldDesign());
      compiler.compile({ scope: "source" });
      TestValidator.predicate(
        "review inventory refuses frames from a stale generated compile",
        stalePrepared.frames.length === 0 &&
          stalePrepared.diagnostics.some(
            (diagnostic) => diagnostic.code === "review-evidence-stale",
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
      const sourceFrame = path.join(
        fixture.root,
        frame.bundle,
        baseManifest.frames[0]!.path,
      );

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
            frames: [{ ...baseManifest.frames[0]!, path: framePath }],
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
          frames: [{ ...baseManifest.frames[0]!, path: "linked/frame.png" }],
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
                ...baseManifest.frames[0]!,
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

      const invalidDirectory = path.join(
        fixture.root,
        "renders/review-invalid-frame",
      );
      const invalidFrame = path.join(invalidDirectory, "frame.png");
      fs.mkdirSync(invalidDirectory, { recursive: true });
      fs.writeFileSync(invalidFrame, new Uint8Array());
      fs.writeFileSync(
        path.join(invalidDirectory, "manifest.json"),
        JSON.stringify({
          ...baseManifest,
          frames: [{ ...baseManifest.frames[0]!, path: "frame.png" }],
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

      for (const size of [1, 2]) {
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
                ...baseManifest.frames[0]!,
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
