import {
  deriveProductionSoundPlan,
  digestAutoMovieSemanticMask,
  productionFrameBoundaryToGridTick,
  renderAutoMovieSemanticMaskSidecar,
  resolveProductionFrameRate,
} from "@automovie/engine";
import {
  type IAutoMovieProductionEvidence,
  readAutoMovieProductionEvidence,
} from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  IAutoMovieAssetProvenance,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionDesign,
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionSoundEvidence,
  IAutoMovieSemanticMask,
} from "@automovie/interface";
import {
  AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  type IAutoMovieProductionRenderJobPlan,
  type IAutoMovieProductionSemanticMaskReceipt,
  createAutoMovieProductionSemanticMaskReceipt,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  muxProductionFeatureMp4,
  planProductionRenderJob,
  probeProductionMedia,
  productionRenderLayersForPass,
  productionRenderPublicationIdentity,
  readAutoMovieFilmEffects,
  readAutoMovieFilmTimeline,
} from "@automovie/production";
import fs from "node:fs";
import path from "node:path";

import { completedFilmEvidenceConfig } from "../internal/completedFilmFixture";
import {
  completedProductionFixture,
  productionCompileSucceeded,
  productionFixture,
  testCaptureRuntimeIdentity,
} from "./productionFixtures";
import {
  productionH264Mp4,
  productionOpusMp4,
  productionPng,
} from "./productionMediaFixtures";

/** One caption cue and one silent guide stem so every deliverable has content. */
const FILM_SOURCE = `import type { IAutoMovieFilmSource } from "@automovie/interface";

export const film = {
  build(context) {
    return {
      id: context.production.id,
      omissions: [],
      tracks: {
        video: [{
          shot: "opening",
          sourceIn: { frame: 0 },
          sourceOut: { seconds: 6 },
          start: { frame: 0 },
          handles: { head: { frame: 0 }, tail: { frame: 0 } },
          transitionIn: { kind: "cut" },
          transitionOut: { kind: "cut" },
        }],
        audio: [{
          id: "starter-silent-guide",
          asset: "public/audio/starter-tone.json",
          sourceDuration: { seconds: 6 },
          sourceOffset: { frame: 0 },
          start: { frame: 0 },
          duration: { seconds: 6 },
          gain: 0,
          fadeIn: { frame: 0 },
          fadeOut: { frame: 0 },
          bus: "ambience",
        }],
        captions: [{
          id: "cue-caption",
          text: "The soloist raises the cue.",
          language: "en",
          start: { seconds: 1.5 },
          end: { seconds: 3 },
        }],
        effects: [],
      },
    };
  },
} satisfies IAutoMovieFilmSource;
`;

/** The rendition reference the repainted one-shot fixture registers. */
export const REPAINT_REFERENCE_PATH = "public/references/structure.png";

export interface IFinalPublicationFixture {
  root: string;
  dispose: () => void;
  project: AutoMovieProductionProject;
  /** The graph-backed authoring evidence the compilers read. */
  evidence: IAutoMovieProductionEvidence;
  production: IAutoMovieProductionDesign;
  inputFingerprint: AutoMovieContentDigest;
  timeline: IAutoMovieFilmTimeline;
  plan: IAutoMovieProductionRenderJobPlan;
  /** Every deliverable byte source keyed by its portable render path. */
  files: Map<string, Uint8Array>;
  manifest: IAutoMovieProductionRenderManifest;
  /** Reusable media the publication was built from. */
  media: {
    video: Uint8Array;
    audio: Uint8Array;
    feature: Uint8Array;
    picture: Uint8Array;
  };
  /** Publish `files` and `manifest` as the current terminal publication. */
  publish: (
    override?: Partial<
      Parameters<AutoMovieProductionProject["commitProductionPublication"]>[0]
    >,
  ) => number;
  /** The final-scope render diagnostics of the current publication. */
  finalRenderDiagnostics: (
    plan?: IAutoMovieProductionRenderJobPlan | null,
  ) => Array<{ code: string; target: string; message: string }>;
  /** Every error diagnostic of a final-scope compile against `plan`. */
  finalErrors: (
    plan?: IAutoMovieProductionRenderJobPlan,
  ) => Array<{ code: string; target: string; message: string }>;
}

/** The semantic mask every mask frame of the fixture publishes. */
export const fixtureSemanticMask = (): IAutoMovieSemanticMask => {
  const payload = {
    version: 2,
    protocol: "automovie.semantic-mask.v2",
    background: "#000000",
    entries: [
      {
        id: "node:soloist",
        kind: "node",
        label: null,
        color: "#123456",
        owner: null,
        nodes: ["soloist"],
        slot: null,
      },
    ],
    unaddressed: [],
  } as unknown as Omit<IAutoMovieSemanticMask, "digest">;
  return { ...payload, digest: digestAutoMovieSemanticMask(payload) };
};

/**
 * Compile the one-shot fixture with every deliverable kind, plan its final
 * render, and assemble one complete parser-valid terminal publication the way
 * the scaffold publisher does, without publishing it yet.
 */
export const finalPublicationFixture = async (
  props: {
    /**
     * Which authored film backs the publication: the complete two-shot film at
     * its authored raster, or the one-shot slice at a 16 by 16 raster with one
     * caption cue and one silent guide stem written into its film source.
     */
    film?: "complete" | "one-shot";
    /** Final visual delivery declared by the tracked production design. */
    visualDelivery?: "deterministic" | "repainted";
    /** Reshape the tracked production design before compilation. */
    production?: (
      design: IAutoMovieProductionDesign,
    ) => IAutoMovieProductionDesign;
  } = {},
): Promise<IFinalPublicationFixture> => {
  const film = props.film ?? "complete";
  const visualDelivery = props.visualDelivery ?? "deterministic";
  const fixture =
    film === "complete" ? completedProductionFixture() : productionFixture();
  try {
    if (film === "one-shot") {
      fs.writeFileSync(path.join(fixture.root, "src", "film.ts"), FILM_SOURCE);
      // The one-shot fixture hands every asset use to a sibling library
      // production; the guide stem has to be declared for this film again.
      const assetsFile = path.join(fixture.root, "automovie", "assets.json");
      const assets = JSON.parse(fs.readFileSync(assetsFile, "utf8")) as {
        assets: Array<{ path: string; uses: Array<{ production: string }> }>;
      };
      for (const asset of assets.assets)
        if (asset.path === "public/audio/starter-tone.json")
          for (const use of asset.uses) use.production = "fixture-film";
      if (visualDelivery === "repainted") {
        // A repaint needs one registered rendition reference for the shot.
        const stem = assets.assets.find(
          (asset) => asset.path === "public/audio/starter-tone.json",
        ) as IAutoMovieAssetProvenance;
        const reference = productionPng(16, 16);
        fs.mkdirSync(path.join(fixture.root, "public", "references"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(fixture.root, ...REPAINT_REFERENCE_PATH.split("/")),
          reference,
        );
        (assets.assets as IAutoMovieAssetProvenance[]).push({
          path: REPAINT_REFERENCE_PATH,
          digest: digestAutoMovieBytes(reference),
          original: {
            url: "https://raw.githubusercontent.com/samchon/AutoMovie/7458eabf8a383cbdac9f4da779f553936a72c1f4/test/fixtures/references/structure.png",
            digest: digestAutoMovieBytes(reference),
          },
          license: structuredClone(stem.license),
          processing: [],
          uses: [
            {
              production: "fixture-film",
              consumer: { kind: "rendition-reference", id: "opening" },
              reason:
                "The structure reference constrains the opening repaint fixture.",
            },
          ],
        });
      }
      fs.writeFileSync(assetsFile, `${JSON.stringify(assets, null, 2)}\n`);
    }
    // The mask guide joins the authored design at its source and its tracked
    // record together, so the derived design still equals the checked one.
    const productionSource = path.join(fixture.root, "src", "production.ts");
    const authoredSource = fs.readFileSync(productionSource, "utf8");
    const poseGuide = `      pass: "pose",
      required: true,
    },
`;
    const authoredDelivery = `  visualDelivery: "deterministic",`;
    if (
      authoredSource.includes(poseGuide) === false ||
      authoredSource.includes(authoredDelivery) === false
    )
      throw new Error("The completed film production source changed shape.");
    if (film === "complete")
      fs.writeFileSync(
        productionSource,
        authoredSource
          .replace(
            poseGuide,
            `${poseGuide}    {
      id: "starter-mask-guide",
      kind: "guide-pass",
      pass: "mask",
      required: true,
    },
`,
          )
          .replace(authoredDelivery, `  visualDelivery: "${visualDelivery}",`),
      );
    const productionFile = path.join(
      fixture.root,
      "automovie",
      "design",
      "fixture-film",
      "production.json",
    );
    const authored = JSON.parse(
      fs.readFileSync(productionFile, "utf8"),
    ) as IAutoMovieProductionDesign;
    const design = (props.production ?? ((value) => value))({
      ...authored,
      visualDelivery,
      deliverables: [
        // A repainted delivery must ship at least one required feature.
        ...authored.deliverables.map((deliverable) =>
          deliverable.kind === "feature" && visualDelivery === "repainted"
            ? { ...deliverable, required: true }
            : deliverable,
        ),
        {
          id: "starter-mask-guide",
          kind: "guide-pass",
          pass: "mask",
          required: film === "complete",
        },
      ],
    });
    fs.writeFileSync(productionFile, `${JSON.stringify(design, null, 2)}\n`);
    // Review and final scopes admit only graph-selected reviewed source owners,
    // so the compiler reads the same authoring evidence the completed film
    // carries.
    const evidence = readAutoMovieProductionEvidence({
      root: fixture.root,
      productionEvidence: completedFilmEvidenceConfig(fixture.root),
    });
    const compiled = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
      evidence,
      () => evidence,
    ).compile({ scope: "source" });
    if (
      productionCompileSucceeded("final publication fixture", compiled) ===
      false
    )
      throw new Error("The final publication fixture did not compile.");
    const project = AutoMovieProductionProject.open(fixture.root);
    const generated = project.generatedManifest()!;
    const inputFingerprint = generated.inputFingerprint;
    const graph = project.graph();
    const production = graph.production!;
    const timeline = readAutoMovieFilmTimeline(project, inputFingerprint);
    const frameRate = resolveProductionFrameRate(timeline);
    const tick = (frame: number): number =>
      productionFrameBoundaryToGridTick({
        frame,
        frameRate,
        ticksPerSecond: 48_000,
        rounding: "nearest",
      });
    const plan = planProductionRenderJob({
      timeline,
      effects: readAutoMovieFilmEffects(project, inputFingerprint),
      production,
      runtimeIdentity: {
        protocolVersion: "automovie.production-render-runtime.v3",
        sourceDigest: digestAutoMovieBytes(Buffer.from("render-source")),
        dialogueRuntimeIdentity: null,
        capture: testCaptureRuntimeIdentity(),
        encoder: {
          package: "h264-mp4-encoder",
          version: "1.0.12",
          closureDigest: digestAutoMovieBytes(Buffer.from("encoder-closure")),
          codec: "h264",
          arguments: {
            quantizationParameter: 10,
            speed: 10,
            groupOfPictures: 24,
          },
        },
      },
      sourceFingerprints: Object.fromEntries(
        [...new Set(timeline.segments.map((segment) => segment.shot))].map(
          (shot) => [
            shot,
            generated.files.find(
              (file) =>
                file.path === `shots/${encodeAutoMoviePathSegment(shot)}.json`,
            )!.digest,
          ],
        ),
      ),
      audioAssets: timeline.tracks.audio.map((cue) => {
        const sourceFrames = tick(cue.sourceDurationFrames);
        return {
          kind: "placeholder-audio-stem" as const,
          path: cue.asset,
          digest: digestAutoMovieBytes(
            fs.readFileSync(path.join(fixture.root, ...cue.asset.split("/"))),
          ),
          durationSeconds: sourceFrames / 48_000,
          sourceFrames,
          sampleRate: 48_000,
          channels: 2,
        };
      }),
      chunkFrames: 48,
    });
    const totalFrames = plan.totalFrames;
    const video = await productionH264Mp4({
      width: plan.frameFormat.width,
      height: plan.frameFormat.height,
      fps: plan.frameFormat.fps,
      frameCount: totalFrames,
    });
    const sampleFrames = tick(totalFrames);
    const audio = productionOpusMp4(sampleFrames);
    const feature = muxProductionFeatureMp4({ video, audio });
    const picture = productionPng(
      plan.frameFormat.width,
      plan.frameFormat.height,
    );
    const compiledShots = new Map<string, IAutoMovieCompiledShotSource>(
      timeline.segments.map((segment) => [
        segment.shot,
        JSON.parse(
          Buffer.from(
            project.readGeneratedFile(
              `shots/${encodeAutoMoviePathSegment(segment.shot)}.json`,
            ),
          ).toString("utf8"),
        ) as IAutoMovieCompiledShotSource,
      ]),
    );
    const soundPlan = deriveProductionSoundPlan({
      timeline,
      contracts: graph.shots,
      compiled: compiledShots,
    });
    const soundEvidence: IAutoMovieProductionSoundEvidence = {
      version: 2,
      plan: soundPlan,
      analysis: {
        version: 1,
        sampleRate: 48_000,
        sampleFrames,
        runtimeSeconds: sampleFrames / 48_000,
        integratedLoudness: null,
        samplePeak: 0,
        clippingSamples: 0,
        longestSilenceSeconds: sampleFrames / 48_000,
        eventAlignment: soundPlan.events.map((event) => {
          const seconds =
            tick(
              event.propagation?.boundary === "trimmed-at-segment"
                ? event.frame
                : (event.propagation?.arrivalFrame ?? event.frame),
            ) / 48_000;
          return {
            id: event.id,
            expectedSeconds: seconds,
            peakSeconds: seconds,
            errorFrames: 0,
            passed: true,
          };
        }),
      },
      tts: soundPlan.dialogue.map((line) => ({
        version: 6 as const,
        line: line.id,
        cacheKey: digestAutoMovieBytes(Buffer.from(`tts:${line.id}`)),
        model: "onnx-community/Kokoro-82M-v1.0-ONNX" as const,
        modelRevision: "1939ad2a8e416c0acfeecc08a694d14ef25f2231" as const,
        voice: "af_heart",
        generatorProvenance: {
          source: "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX",
          license: "Apache-2.0",
          termsCheckedAt: "2026-08-28",
          cost: "local compute; no per-line provider fee",
          consumer: {
            kind: "dialogue-synthesis" as const,
            reason:
              "The fixture dialogue is voiced by the reviewed local model.",
          },
        },
        generatedAt: "2026-08-28T00:00:00.000Z",
        sourceSampleRate: 24_000,
        sourceSamples: 24_000,
        pcmDigest: digestAutoMovieBytes(Buffer.from(`pcm:${line.id}`)),
        phonemes: "",
        phonemeChunks: [],
        runtimeAssets: [],
        visemes: [],
      })),
      audio: {
        path: "audio.mp4",
        mediaType: "audio/mp4",
        bytes: audio.length,
        digest: digestAutoMovieBytes(audio),
      },
      measurement: {
        source: "pre-encode-pcm",
        algorithm: "automovie-production-sound-analysis-v1",
      },
    };
    const mask = fixtureSemanticMask();
    const sidecarBytes = Buffer.from(renderAutoMovieSemanticMaskSidecar(mask));
    const segment = manifestPublicationSegment(plan);
    const files = new Map<string, Uint8Array>();
    const manifest: IAutoMovieProductionRenderManifest = {
      version: 2,
      compileFingerprint: plan.compileFingerprint,
      publication: productionRenderPublicationIdentity(plan),
      deliverables: [],
    };
    for (const deliverable of production.deliverables) {
      const owned = new Map<string, Uint8Array>();
      const semantics = new Map<
        string,
        IAutoMovieProductionSemanticMaskReceipt
      >();
      const relativeOf = (name: string): string =>
        [
          "deliverables",
          "final",
          segment,
          encodeAutoMoviePathSegment(deliverable.id),
          name,
        ].join("/");
      if (deliverable.kind === "preview") owned.set("preview.png", picture);
      else if (deliverable.kind === "feature")
        owned.set("feature.mp4", feature);
      else if (deliverable.kind === "guide-pass") {
        const pass = deliverable.pass ?? "pose";
        const maskFrames = plan.chunks
          .filter(
            (chunk) =>
              chunk.deliverable === deliverable.id && chunk.pass === "mask",
          )
          .flatMap((chunk) => chunk.frames);
        owned.set(`${pass}.mp4`, video);
        for (let frame = 0; frame < totalFrames; ++frame) {
          const index = String(frame).padStart(8, "0");
          owned.set(`frames/${pass}/frame_${index}.png`, picture);
          if (pass === "mask") {
            const name = `frames/mask/frame_${index}.semantic.json`;
            // The sidecar belongs to the shot the plan draws on this frame.
            const shot = productionRenderLayersForPass(
              maskFrames.find((planned) => planned.globalFrame === frame)!,
              "mask",
            )[0]!.shot;
            owned.set(name, sidecarBytes);
            semantics.set(
              name,
              createAutoMovieProductionSemanticMaskReceipt({
                frame,
                expectedShot: shot,
                evidence: {
                  version: 1,
                  shot,
                  mask,
                  coverage: { unresolved: [], unaddressed: 0 },
                },
                sidecar: { path: relativeOf(name), bytes: sidecarBytes },
              }),
            );
          }
        }
      } else if (deliverable.kind === "captions")
        owned.set("captions.vtt", Buffer.from(plan.tracks.captions, "utf8"));
      else {
        owned.set("audio.mp4", audio);
        owned.set("waveform.png", productionPng(960, 240));
        owned.set("spectrogram.png", productionPng(512, 192));
        owned.set(
          "evidence.json",
          Buffer.from(`${JSON.stringify(soundEvidence, null, 2)}\n`, "utf8"),
        );
      }
      const entries = [...owned].map(([name, bytes]) => {
        const relative = relativeOf(name);
        const semanticMask = semantics.get(name);
        const mediaType =
          deliverable.kind === "captions"
            ? "text/vtt"
            : semanticMask !== undefined
              ? AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE
              : name.endsWith(".json")
                ? "application/json"
                : name.endsWith(".png")
                  ? "image/png"
                  : deliverable.kind === "audio-mix"
                    ? "audio/mp4"
                    : "video/mp4";
        files.set(relative, bytes);
        return {
          file: {
            path: relative,
            digest: digestAutoMovieBytes(bytes),
            bytes: bytes.length,
            mediaType,
            ...(semanticMask === undefined ? {} : { semanticMask }),
          },
          probe: probeProductionMedia({
            kind: deliverable.kind,
            mediaType,
            bytes,
          }),
        };
      });
      const featureProbe = entries.find(
        (entry) => entry.probe.kind === "feature",
      )?.probe;
      const videoProbe =
        featureProbe?.kind === "feature"
          ? featureProbe.video
          : entries.find((entry) => entry.probe.kind === "video")?.probe;
      const audioProbe =
        featureProbe?.kind === "feature"
          ? featureProbe.audio
          : entries.find((entry) => entry.probe.kind === "audio")?.probe;
      manifest.deliverables.push({
        id: deliverable.id,
        kind: deliverable.kind,
        files: entries.map((entry) => entry.file),
        runtimeSeconds:
          deliverable.kind === "captions"
            ? production.targetRuntimeSeconds
            : videoProbe?.kind === "video"
              ? videoProbe.runtimeSeconds
              : audioProbe?.kind === "audio"
                ? audioProbe.runtimeSeconds
                : null,
        frameCount: videoProbe?.kind === "video" ? videoProbe.frameCount : null,
        codec:
          videoProbe?.kind === "video"
            ? videoProbe.codec
            : audioProbe?.kind === "audio"
              ? audioProbe.codec
              : null,
      });
    }
    return {
      root: fixture.root,
      dispose: fixture.dispose,
      project,
      evidence,
      production,
      inputFingerprint,
      timeline,
      plan,
      files,
      manifest,
      media: { video, audio, feature, picture },
      publish: (override = {}) =>
        project.commitProductionPublication({
          files,
          manifest,
          plan,
          planCurrent: () => true,
          inputCurrent: () => true,
          publicationCurrent: () => undefined,
          expectedRevision: project.revision(),
          ...override,
        }),
      finalErrors: (renderPlan = plan) =>
        new AutoMovieProductionCompiler(
          AutoMovieProductionProject.open(fixture.root),
          evidence,
          () => evidence,
          renderPlan,
        )
          .compile({ scope: "final" })
          .diagnostics.filter((diagnostic) => diagnostic.category === "error")
          .map((diagnostic) => ({
            code: diagnostic.code,
            target: diagnostic.target,
            message: diagnostic.message,
          })),
      finalRenderDiagnostics: (renderPlan = plan) =>
        new AutoMovieProductionCompiler(
          AutoMovieProductionProject.open(fixture.root),
          evidence,
          () => evidence,
          renderPlan ?? undefined,
        )
          .compile({ scope: "final" })
          .diagnostics.filter((diagnostic) =>
            diagnostic.code.startsWith("render-"),
          )
          .map((diagnostic) => ({
            code: diagnostic.code,
            target: diagnostic.target,
            message: diagnostic.message,
          })),
    };
  } catch (error) {
    fixture.dispose();
    throw error;
  }
};

/** The publication path segment the scaffold publisher derives from a plan. */
export const manifestPublicationSegment = (
  plan: IAutoMovieProductionRenderJobPlan,
): string => productionRenderPublicationIdentity(plan).fingerprint.slice(7);
