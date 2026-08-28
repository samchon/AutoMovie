import {
  IAutoMovieAssetManifest,
  IAutoMovieRenderBundleManifest,
  IAutoMovieRepaintReceipt,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  canonicalAutoMovieRepaintRuntimeIdentity,
  digestAutoMovieBytes,
  probeProductionVideoMp4,
  productionRenderBundleRelativePath,
  productionRepaintActiveReceiptPath,
  productionRepaintOutputPath,
  productionRepaintReceiptPath,
  productionRepaintStructuralControls,
  productionSourceRenderFingerprint,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  productionCompileSucceeded,
  productionFixture,
  testRendererIdentity,
} from "./productionFixtures";
import { productionH264Mp4, productionPng } from "./productionMediaFixtures";

interface IRepaintRecordCleanupFailure {
  error: unknown;
}

class RepaintRecordCleanupError extends AggregateError {}

const preserveRepaintRecordCleanup = (
  failure: IRepaintRecordCleanupFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new RepaintRecordCleanupError(
      [failure.error, cleanupFailure],
      "Repaint-record fixture cleanup failed after the assertion failed.",
    );
  }
};

const writeTrackedJson = (
  project: AutoMovieProductionProject,
  relative: string,
  value: unknown,
): void => {
  const file = project.trackedStatePath(relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

const repaintReceipt = (shot: string): IAutoMovieRepaintReceipt => {
  const outputPath = "repaint/missing-output.mp4";
  return {
    version: 3,
    productionId: "fixture-film",
    shot,
    compileFingerprint: `sha256:${"1".repeat(64)}`,
    sourceRenderFingerprint: `sha256:${"2".repeat(64)}`,
    attemptId: "00000000-0000-4000-8000-000000000001",
    sourceBundle: "shot-opening/source/render",
    controls: [
      {
        pass: "depth",
        frameDigests: [`sha256:${"3".repeat(64)}`],
      },
    ],
    references: [
      {
        role: "style",
        path: "public/assets/repaint-reference.png",
        digest: `sha256:${"4".repeat(64)}`,
      },
    ],
    adapterIdentity: canonicalAutoMovieRepaintRuntimeIdentity({
      protocolVersion: "automovie.repaint-runtime.v1",
      provider: "runtime-shape-test",
      model: "runtime-shape-test",
      version: "1",
      execution: "local",
    }),
    generatorProvenance: {
      source: "local://runtime-shape-test",
      license: "test-only",
      termsCheckedAt: "2026-08-28",
      cost: "local test fixture",
      consumer: {
        kind: "repaint",
        reason: "Exercise stored repaint receipt integrity.",
      },
    },
    structuralAuthority: "deterministic-source-only",
    parameters: {
      prompt: "Keep the deterministic structure.",
      negativePrompt: "Do not alter camera or motion.",
      seed: 7,
      strength: 0.5,
      controls: { guidance: 1 },
    },
    output: {
      path: outputPath,
      digest: digestAutoMovieBytes(Buffer.from("missing output")),
      bytes: 14,
      probe: {
        kind: "video",
        container: "mp4",
        codec: "h264",
        width: 16,
        height: 16,
        runtimeSeconds: 6,
        frameCount: 144,
        fps: 24,
      },
    },
  };
};

/**
 * Enumerate stored repaint records through every early integrity boundary.
 * Each corrupt resident is omitted rather than trusted, while the active
 * pointer/receipt bytes are asserted so a missing write cannot make the same
 * empty result pass.
 *
 * Scenarios:
 *
 * 1. Malformed and schema-invalid active pointers are omitted.
 * 2. Missing, malformed, schema-invalid, wrong-shot, and noncanonical immutable
 *    receipts are omitted while their resident bytes are asserted.
 * 3. A canonical pointer/receipt with absent output bytes is omitted.
 * 4. The positive twin compiles current inputs, commits a verified source
 *    bundle, real H.264 output, fixed reference, and immutable repaint receipt,
 *    then enumerates that exact receipt once from duplicate shot requests.
 * 5. Missing/stale compile and source evidence plus invalid adapter identities
 *    refuse before any receipt update.
 * 6. Asset-manifest, resident-byte, shot-use, role-duplicate, and all-role
 *    collapse probes preserve distinct fixed-reference authority.
 * 7. Output production/path/digest/size and parsed raster/clock/count facts are
 *    each checked against real H.264 bytes.
 * 8. Removing the production or shot record proves stored media targets are
 *    revalidated rather than trusted from an old receipt.
 */
export const test_production_project_runtime_shape_repaint_records =
  async (): Promise<void> => {
    const fixture = productionFixture();
    let failure: IRepaintRecordCleanupFailure | undefined;
    try {
      const project = AutoMovieProductionProject.open(
        fixture.root,
        "fixture-film",
      );
      const shot = "opening";
      const activePath = productionRepaintActiveReceiptPath(shot);
      const activeFile = project.trackedStatePath(activePath);
      fs.mkdirSync(path.dirname(activeFile), { recursive: true });

      fs.writeFileSync(activeFile, "{broken");
      TestValidator.equals(
        "malformed active pointer is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      writeTrackedJson(project, activePath, { version: 99 });
      TestValidator.equals(
        "wrong active-pointer schema is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      const receipt = repaintReceipt(shot);
      const trackedReceipt = productionRepaintReceiptPath(receipt.output.path);
      const pointer = {
        version: 1 as const,
        shot,
        receipt: trackedReceipt,
        output: receipt.output.path,
      };
      writeTrackedJson(project, activePath, pointer);
      TestValidator.equals(
        "active pointer without its immutable receipt is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      const receiptFile = project.trackedStatePath(trackedReceipt);
      fs.mkdirSync(path.dirname(receiptFile), { recursive: true });
      fs.writeFileSync(receiptFile, "{broken");
      TestValidator.equals(
        "malformed immutable receipt is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      writeTrackedJson(project, trackedReceipt, { version: 3 });
      TestValidator.equals(
        "wrong receipt schema is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      writeTrackedJson(project, trackedReceipt, repaintReceipt("other-shot"));
      TestValidator.equals(
        "receipt addressed to another shot is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      writeTrackedJson(project, trackedReceipt, receipt);
      writeTrackedJson(project, activePath, {
        ...pointer,
        output: "wrong.mp4",
      });
      TestValidator.equals(
        "noncanonical active pointer is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );

      writeTrackedJson(project, activePath, pointer);
      TestValidator.equals(
        "canonical record with missing output bytes is omitted",
        project.verifiedRepaintRenditions([shot]),
        [],
      );
      TestValidator.predicate(
        "the final omission was tested against resident pointer and receipt bytes",
        fs.existsSync(activeFile) && fs.existsSync(receiptFile),
      );
      fs.rmSync(activeFile);
      fs.rmSync(receiptFile);

      const referencePath = "public/assets/runtime-shape-reference.png";
      const referenceBytes = productionPng(16, 16);
      const referenceFile = path.join(fixture.root, referencePath);
      fs.mkdirSync(path.dirname(referenceFile), { recursive: true });
      fs.writeFileSync(referenceFile, referenceBytes);
      const assetFile = path.join(fixture.root, "automovie/assets.json");
      const assets = JSON.parse(
        fs.readFileSync(assetFile, "utf8"),
      ) as IAutoMovieAssetManifest;
      const referenceDigest = digestAutoMovieBytes(referenceBytes);
      assets.assets.push({
        path: referencePath,
        digest: referenceDigest,
        original: {
          url: "https://example.invalid/runtime-shape-reference.png",
          digest: referenceDigest,
        },
        license: {
          identifier: "test-only",
          url: "https://example.invalid/test-only-license",
          notice: "Generated entirely inside the runtime-shape test.",
        },
        processing: [],
        uses: [
          {
            production: "fixture-film",
            consumer: { kind: "rendition-reference", id: shot },
            reason: "Positive stored repaint selection fixture.",
          },
        ],
      });
      assets.assets.sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
      );
      fs.writeFileSync(assetFile, `${JSON.stringify(assets, null, 2)}\n`);

      const compiled = new AutoMovieProductionCompiler(project).compile({
        scope: "source",
      });
      if (
        productionCompileSucceeded("stored repaint record", compiled) === false
      )
        throw new Error("Stored repaint record fixture did not compile.");
      const generated = project.generatedManifest();
      if (generated === null)
        throw new Error(
          "Stored repaint record fixture has no generated manifest.",
        );

      const frameBytes = productionPng(16, 16);
      const sourceManifest: IAutoMovieRenderBundleManifest = {
        version: 4,
        target: { kind: "shot", id: shot },
        compileFingerprint: generated.inputFingerprint,
        dialogueRuntimeIdentity: null,
        rendererIdentity: testRendererIdentity(),
        targetFingerprint: digestAutoMovieBytes(
          Buffer.from("runtime-shape-opening-target"),
        ),
        renderSpec: {
          target: shot,
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
            pass: "depth",
            path: "depth-000000.png",
            digest: digestAutoMovieBytes(frameBytes),
            width: 16,
            height: 16,
          },
        ],
      };
      const sourceBundle = productionRenderBundleRelativePath(sourceManifest);
      project.commitRenderBundle(
        sourceBundle,
        new Map([["depth-000000.png", frameBytes]]),
        sourceManifest,
      );

      const outputBytes = await productionH264Mp4({
        width: 16,
        height: 16,
        fps: 24,
        frameCount: 144,
      });
      const outputDigest = digestAutoMovieBytes(outputBytes);
      const adapterIdentity = canonicalAutoMovieRepaintRuntimeIdentity({
        protocolVersion: "automovie.repaint-runtime.v1",
        provider: "runtime-shape-test",
        model: "runtime-shape-test",
        version: "1",
        execution: "local",
      });
      const generatorProvenance = {
        source: "local://runtime-shape-test",
        license: "test-only",
        termsCheckedAt: "2026-08-28",
        cost: "local test fixture",
        consumer: {
          kind: "repaint" as const,
          reason: "Exercise a complete stored repaint receipt.",
        },
      };
      const parameters = {
        prompt: "Keep the deterministic structure.",
        negativePrompt: "Do not alter camera or motion.",
        seed: 7,
        strength: 0.5,
        controls: { guidance: 1 },
      };
      const references = [
        {
          role: "style" as const,
          path: referencePath,
          digest: referenceDigest,
        },
      ];
      const sourceRenderFingerprint = productionSourceRenderFingerprint({
        manifest: sourceManifest,
        frames: sourceManifest.frames,
      });
      const outputPath = productionRepaintOutputPath({
        shot,
        sourceRenderFingerprint,
        attemptId: "00000000-0000-4000-8000-000000000002",
        adapterIdentity,
        generatorProvenance,
        parameters,
        references,
        outputDigest,
      });
      const validReceipt: IAutoMovieRepaintReceipt = {
        version: 3,
        productionId: "fixture-film",
        shot,
        compileFingerprint: generated.inputFingerprint,
        sourceRenderFingerprint,
        attemptId: "00000000-0000-4000-8000-000000000002",
        sourceBundle,
        controls: productionRepaintStructuralControls(sourceManifest),
        references,
        adapterIdentity,
        generatorProvenance,
        structuralAuthority: "deterministic-source-only",
        parameters,
        output: {
          path: outputPath,
          digest: outputDigest,
          bytes: outputBytes.length,
          probe: probeProductionVideoMp4(outputBytes),
        },
      };
      project.commitRepaintRendition(validReceipt, outputBytes);
      TestValidator.equals(
        "complete resident repaint receipt and MP4 enumerate once per unique shot",
        project.verifiedRepaintRenditions([shot, shot]),
        [validReceipt],
      );

      const expectRefusal = (
        label: string,
        candidate: IAutoMovieRepaintReceipt,
        message: string,
        bytes: Uint8Array = outputBytes,
      ): void => {
        try {
          project.commitRepaintRendition(candidate, bytes);
          throw new Error(`${label} unexpectedly committed.`);
        } catch (error) {
          TestValidator.predicate(
            label,
            error instanceof Error && error.message.includes(message),
          );
        }
      };
      const generatedManifestFile = project.trackedStatePath(
        "generated-manifest.json",
      );
      const generatedManifestBytes = fs.readFileSync(generatedManifestFile);
      fs.rmSync(generatedManifestFile);
      expectRefusal(
        "repaint refuses when the current generated manifest is absent",
        validReceipt,
        "current compiler input",
      );
      fs.writeFileSync(generatedManifestFile, generatedManifestBytes);
      expectRefusal(
        "repaint refuses a stale compiler fingerprint",
        {
          ...validReceipt,
          compileFingerprint: `sha256:${"f".repeat(64)}`,
        },
        "current compiler input",
      );
      expectRefusal(
        "repaint refuses a source bundle that is not verifiable",
        { ...validReceipt, sourceBundle: "missing/source/bundle" },
        "source evidence is stale",
      );

      const filmSourceManifest: IAutoMovieRenderBundleManifest = {
        ...sourceManifest,
        target: { kind: "film", id: "fixture-film" },
        targetFingerprint: digestAutoMovieBytes(
          Buffer.from("runtime-shape-film-target"),
        ),
      };
      const filmSourceBundle =
        productionRenderBundleRelativePath(filmSourceManifest);
      project.commitRenderBundle(
        filmSourceBundle,
        new Map([["depth-000000.png", frameBytes]]),
        filmSourceManifest,
      );
      expectRefusal(
        "repaint structural evidence must be owned by a shot render",
        {
          ...validReceipt,
          sourceBundle: filmSourceBundle,
          sourceRenderFingerprint: productionSourceRenderFingerprint({
            manifest: filmSourceManifest,
            frames: filmSourceManifest.frames,
          }),
          controls: productionRepaintStructuralControls(filmSourceManifest),
        },
        "source evidence is stale",
      );
      expectRefusal(
        "repaint source evidence must name the receipt shot",
        { ...validReceipt, shot: "other-shot" },
        "source evidence is stale",
      );
      expectRefusal(
        "repaint refuses a stale source-render fingerprint",
        {
          ...validReceipt,
          sourceRenderFingerprint: `sha256:${"e".repeat(64)}`,
        },
        "source evidence is stale",
      );
      expectRefusal(
        "repaint refuses structural controls that differ from the source bundle",
        {
          ...validReceipt,
          controls: [
            {
              ...validReceipt.controls[0]!,
              frameDigests: [`sha256:${"d".repeat(64)}`],
            },
          ],
        },
        "source evidence is stale",
      );

      expectRefusal(
        "repaint refuses a non-JSON adapter identity",
        { ...validReceipt, adapterIdentity: "{broken" },
        "adapter identity is not JSON",
      );
      expectRefusal(
        "repaint refuses an adapter identity outside the strict runtime schema",
        { ...validReceipt, adapterIdentity: JSON.stringify({}) },
        "adapter identity is invalid",
      );
      expectRefusal(
        "repaint refuses a noncanonical serialization of a valid adapter identity",
        {
          ...validReceipt,
          adapterIdentity: JSON.stringify(
            JSON.parse(validReceipt.adapterIdentity),
            null,
            2,
          ),
        },
        "adapter identity is invalid",
      );

      const assetBytes = fs.readFileSync(assetFile);
      fs.rmSync(assetFile);
      expectRefusal(
        "repaint references require the declared asset manifest",
        validReceipt,
        "current declared asset manifest",
      );
      fs.writeFileSync(assetFile, assetBytes);
      fs.writeFileSync(assetFile, "{broken");
      expectRefusal(
        "repaint refuses a malformed asset manifest",
        validReceipt,
        "not valid JSON",
      );
      fs.writeFileSync(
        assetFile,
        JSON.stringify({ version: 1, assets: "bad" }),
      );
      expectRefusal(
        "repaint refuses an asset manifest outside its strict schema",
        validReceipt,
        "strict schema",
      );
      fs.writeFileSync(assetFile, assetBytes);
      expectRefusal(
        "repaint requires at least one role-specific reference",
        { ...validReceipt, references: [] },
        "at least one fixed reference",
      );
      expectRefusal(
        "repaint refuses an exact duplicate role and path",
        {
          ...validReceipt,
          references: [
            validReceipt.references[0]!,
            validReceipt.references[0]!,
          ],
        },
        "duplicate, absent, byte-stale",
      );
      expectRefusal(
        "repaint refuses an unregistered reference path",
        {
          ...validReceipt,
          references: [
            {
              ...validReceipt.references[0]!,
              path: "public/assets/absent-reference.png",
            },
          ],
        },
        "duplicate, absent, byte-stale",
      );
      fs.rmSync(referenceFile);
      expectRefusal(
        "repaint refuses a registered reference whose bytes are absent",
        validReceipt,
        "duplicate, absent, byte-stale",
      );
      fs.writeFileSync(referenceFile, referenceBytes);
      expectRefusal(
        "repaint refuses a reference digest that differs from its asset record",
        {
          ...validReceipt,
          references: [
            {
              ...validReceipt.references[0]!,
              digest: `sha256:${"c".repeat(64)}`,
            },
          ],
        },
        "duplicate, absent, byte-stale",
      );
      fs.writeFileSync(referenceFile, Buffer.from("changed reference"));
      expectRefusal(
        "repaint refuses reference bytes that differ from the declared digest",
        validReceipt,
        "duplicate, absent, byte-stale",
      );
      fs.writeFileSync(referenceFile, referenceBytes);
      const assetsWithoutUse = structuredClone(assets);
      assetsWithoutUse.assets.find(
        (asset) => asset.path === referencePath,
      )!.uses = [];
      fs.writeFileSync(
        assetFile,
        `${JSON.stringify(assetsWithoutUse, null, 2)}\n`,
      );
      expectRefusal(
        "repaint refuses a reference without the addressed shot use",
        validReceipt,
        "not registered to shot",
      );
      fs.writeFileSync(assetFile, assetBytes);
      expectRefusal(
        "one image cannot stand as canonical guidance for every repaint role",
        {
          ...validReceipt,
          references: [
            "structure",
            "character",
            "costume",
            "style",
            "material",
            "color",
            "environment",
          ].map((role) => ({
            ...validReceipt.references[0]!,
            role: role as IAutoMovieRepaintReceipt["references"][number]["role"],
          })),
        },
        "cannot stand as canonical guidance for every role",
      );

      expectRefusal(
        "repaint output identity refuses another production",
        { ...validReceipt, productionId: "other-production" },
        "output identity is invalid",
      );
      expectRefusal(
        "repaint output identity refuses a noncanonical path",
        {
          ...validReceipt,
          output: { ...validReceipt.output, path: "repaint/wrong.mp4" },
        },
        "output identity is invalid",
      );
      const wrongOutputDigest = `sha256:${"b".repeat(64)}` as const;
      const wrongDigestReceipt: IAutoMovieRepaintReceipt = {
        ...validReceipt,
        output: {
          ...validReceipt.output,
          digest: wrongOutputDigest,
          path: productionRepaintOutputPath({
            shot,
            sourceRenderFingerprint,
            attemptId: validReceipt.attemptId,
            adapterIdentity,
            generatorProvenance,
            parameters,
            references,
            outputDigest: wrongOutputDigest,
          }),
        },
      };
      expectRefusal(
        "repaint output identity refuses a digest that differs from bytes",
        wrongDigestReceipt,
        "output identity is invalid",
      );
      expectRefusal(
        "repaint output identity refuses a byte-count mismatch",
        {
          ...validReceipt,
          output: {
            ...validReceipt.output,
            bytes: validReceipt.output.bytes + 1,
          },
        },
        "output identity is invalid",
      );
      const validVideoProbe = validReceipt.output.probe;
      if (validVideoProbe.kind !== "video")
        throw new Error("The valid repaint fixture must probe as video.");
      expectRefusal(
        "repaint refuses probe facts that differ from the parsed MP4",
        {
          ...validReceipt,
          output: {
            ...validReceipt.output,
            probe: { ...validVideoProbe, width: 17 },
          },
        },
        "media facts are stale",
      );

      const receiptForBytes = (
        mediaBytes: Uint8Array,
      ): IAutoMovieRepaintReceipt => {
        const digest = digestAutoMovieBytes(mediaBytes);
        return {
          ...validReceipt,
          output: {
            path: productionRepaintOutputPath({
              shot,
              sourceRenderFingerprint,
              attemptId: validReceipt.attemptId,
              adapterIdentity,
              generatorProvenance,
              parameters,
              references,
              outputDigest: digest,
            }),
            digest,
            bytes: mediaBytes.length,
            probe: probeProductionVideoMp4(mediaBytes),
          },
        };
      };
      for (const [label, mediaBytes] of [
        [
          "repaint media width must equal the production raster",
          await productionH264Mp4({
            width: 8,
            height: 16,
            fps: 24,
            frameCount: 144,
          }),
        ],
        [
          "repaint media height must equal the production raster",
          await productionH264Mp4({
            width: 16,
            height: 8,
            fps: 24,
            frameCount: 144,
          }),
        ],
        [
          "repaint media fps must equal the production frame clock",
          await productionH264Mp4({
            width: 16,
            height: 16,
            fps: 12,
            frameCount: 72,
          }),
        ],
        [
          "repaint media frame count must equal the shot duration",
          await productionH264Mp4({
            width: 16,
            height: 16,
            fps: 24,
            frameCount: 143,
          }),
        ],
      ] as const)
        expectRefusal(
          label,
          receiptForBytes(mediaBytes),
          "media facts are stale",
          mediaBytes,
        );

      const productionDesignFile = path.join(
        fixture.root,
        project.designRecordPath({ kind: "production" }),
      );
      const productionDesignBytes = fs.readFileSync(productionDesignFile);
      fs.rmSync(productionDesignFile);
      expectRefusal(
        "repaint refuses when its production media target is absent",
        validReceipt,
        "media target is stale",
      );
      fs.writeFileSync(productionDesignFile, productionDesignBytes);
      const shotDesignFile = path.join(
        fixture.root,
        project.designRecordPath({ kind: "shot", id: shot }),
      );
      const shotDesignBytes = fs.readFileSync(shotDesignFile);
      fs.rmSync(shotDesignFile);
      expectRefusal(
        "repaint refuses when its shot media target is absent",
        validReceipt,
        "media target is stale",
      );
      fs.writeFileSync(shotDesignFile, shotDesignBytes);
    } catch (error) {
      failure = { error };
      throw error;
    } finally {
      preserveRepaintRecordCleanup(failure, fixture.dispose);
    }
  };
