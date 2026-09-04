import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  IAutoMovieProductionDeliverable,
  IAutoMovieProductionMediaProbe,
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenditionDelivery,
  IAutoMovieRepaintReceipt,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  type IAutoMovieProductionRenderChunk,
  type IAutoMovieProductionRenderJobPlan,
  assembleProductionChunkVideoMp4,
  assertProductionRenderDialogueRuntimeIdentity,
  canonicalAutoMovieCaptureRuntimeIdentity,
  canonicalAutoMovieJsonBytes,
  conformProductionRenditionVideoMp4,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  muxProductionFeatureMp4,
  openAutoMovieProduction,
  probeProductionMedia,
  productionPublicationInputFingerprint,
  readAutoMovieFilmTimeline,
  sampleProductionRenderFrame,
} from "@automovie/production";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  type IAutoMovieProductionRepaintSelection,
  assertProductionRepaintReceiptAdoption,
  assertProductionRepaintSelection,
} from "./productionConfiguration";
import { assertProductionSoundRenderClock } from "./productionRuntime";
import {
  type ICurrentRenderChunkPublication,
  consumeCurrentRenderChunkFrames,
} from "./renderChunkSnapshot";
import { productionRenderFrameCaptureInput } from "./renderFrameCaptureInput";
import type { IProductionRenderHost } from "./renderHost";
import type { createProductionRenderPlanningRuntime } from "./renderPlanningRuntime";
import {
  type IProductionRenderEncoderRuntime,
  type IProductionSoundBundle,
  type IProductionSoundRuntime,
  produceProductionSound as produceSoundBundle,
  runWithProductionRuntimeClosure,
} from "./renderSoundRuntime";

/** Digest every publication input without reading mutable process state. */
export const productionRenderPublicationFingerprint = (
  plan: IAutoMovieProductionRenderJobPlan,
): AutoMovieContentDigest =>
  digestAutoMovieBytes(
    Buffer.from(
      JSON.stringify({
        protocol: "automovie.production-publication.v2",
        productionId: plan.productionId,
        compileFingerprint: plan.compileFingerprint,
        editFingerprint: plan.editFingerprint,
        runtimeIdentity: plan.runtimeIdentity,
        tier: plan.tier,
        sourceFrameFormat: plan.sourceFrameFormat,
        frameFormat: plan.frameFormat,
        totalFrames: plan.totalFrames,
        chunkFrames: plan.chunkFrames,
        chunks: plan.chunks.map((chunk) => ({
          slot: chunk.slot,
          id: chunk.id,
          pass: chunk.pass,
        })),
        tracks: plan.tracks,
      }),
      "utf8",
    ),
  );

export interface IProductionRenderPublicationRuntime {
  assembleChunkVideo: (
    plan: IAutoMovieProductionRenderJobPlan,
    chunks: IAutoMovieProductionRenderChunk[],
  ) => Uint8Array;
  assertMatchingProxy: (
    project: AutoMovieProductionProject,
    plan: IAutoMovieProductionRenderJobPlan,
  ) => void;
  publishProxy: (
    plan: IAutoMovieProductionRenderJobPlan,
    publication: ReadonlyMap<string, Uint8Array>,
    manifest: IAutoMovieProductionRenderManifest,
    project: AutoMovieProductionProject,
  ) => {
    published: true;
    reused: boolean;
    bundle: string;
    manifest: IAutoMovieProductionRenderManifest;
  };
}

/** Own immutable proxy publication and current chunk assembly. */
export const createProductionRenderPublicationRuntime = (props: {
  assertCurrentEncoder: (plan: IAutoMovieProductionRenderJobPlan) => void;
  currentChunk: (
    plan: IAutoMovieProductionRenderJobPlan,
    chunk: IAutoMovieProductionRenderChunk,
  ) => ICurrentRenderChunkPublication | null;
  ensureDirectory: (root: string, relative: string) => string;
  filesystem: Pick<typeof import("node:fs"), "existsSync" | "readdirSync">;
  inspectProxy: (
    renderRoot: string,
    target: string,
  ) => {
    compileFingerprint: string;
    editFingerprint: string;
    sourceFrameFormat: unknown;
  };
  publicationFingerprint: (plan: IAutoMovieProductionRenderJobPlan) => string;
  publishProxyBundle: (props: {
    expected: ReadonlyMap<string, Uint8Array>;
    parent: string;
    processAlive: (pid: number) => boolean;
    renderRoot: string;
    target: string;
  }) => { reused: boolean };
  processAlive: (pid: number) => boolean;
}): IProductionRenderPublicationRuntime => ({
  assembleChunkVideo: (plan, chunks) => {
    if (chunks.length === 0) throw new Error("No current chunks to encode.");
    props.assertCurrentEncoder(plan);
    const ordered = [...chunks].sort(
      (left, right) => left.frameStart - right.frameStart,
    );
    return assembleProductionChunkVideoMp4({
      chunks: (function* () {
        for (const chunk of ordered) {
          const current = props.currentChunk(plan, chunk);
          if (current === null)
            throw new Error(
              `Chunk "${chunk.slot}" changed after final status verification. Reverify or rerender it before finalizing.`,
            );
          yield current.encoded;
        }
      })(),
      frameFormat: plan.frameFormat,
      totalFrames: plan.totalFrames,
    });
  },
  assertMatchingProxy: (project, plan) => {
    const proxyRoot = path.join(project.renderRoot(), "deliverables", "proxy");
    if (props.filesystem.existsSync(proxyRoot) === false)
      throw new Error(
        "Final publication requires one immutable proxy publication of the same compiler-owned EDL. Finalize the proxy tier, review it, then finalize this plan.",
      );
    const matched = props.filesystem
      .readdirSync(proxyRoot, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isSymbolicLink() === false &&
          (entry.isFile() || entry.isDirectory()) &&
          /^[0-9a-f]{64}$/u.test(entry.name),
      )
      .some((entry) => {
        try {
          const receipt = props.inspectProxy(
            project.renderRoot(),
            path.join(proxyRoot, entry.name),
          );
          return (
            receipt.compileFingerprint === plan.compileFingerprint &&
            receipt.editFingerprint === plan.editFingerprint &&
            isDeepStrictEqual(receipt.sourceFrameFormat, plan.sourceFrameFormat)
          );
        } catch {
          return false;
        }
      });
    if (matched === false)
      throw new Error(
        "No immutable proxy publication matches this final plan's compile fingerprint, EDL fingerprint, and source frame format. Replan and finalize proxy before final conform.",
      );
  },
  publishProxy: (plan, publication, manifest, project) => {
    const renderRoot = project.renderRoot();
    const fingerprint = props.publicationFingerprint(plan);
    const publicationSegment = fingerprint.slice(7);
    const bundle = ["deliverables", "proxy", publicationSegment].join("/");
    const parent = props.ensureDirectory(renderRoot, "deliverables/proxy");
    const target = path.join(parent, publicationSegment);
    const manifestBytes = Buffer.from(
      `${JSON.stringify(
        {
          version: 1,
          tier: plan.tier,
          publicationFingerprint: fingerprint,
          compileFingerprint: plan.compileFingerprint,
          editFingerprint: plan.editFingerprint,
          frameFormat: plan.frameFormat,
          sourceFrameFormat: plan.sourceFrameFormat,
          totalFrames: plan.totalFrames,
          manifest,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const files = new Map<string, Uint8Array>([
      ["publication.json", manifestBytes],
    ]);
    for (const [relative, bytes] of publication) {
      if (relative.startsWith(`${bundle}/`) === false)
        throw new Error(
          `Proxy publication path "${relative}" escapes current bundle "${bundle}".`,
        );
      files.set(relative.slice(bundle.length + 1), bytes);
    }
    const published = props.publishProxyBundle({
      expected: files,
      parent,
      processAlive: props.processAlive,
      renderRoot,
      target,
    });
    return { published: true, reused: published.reused, bundle, manifest };
  },
});

/** Own terminal deliverable validation, encoding, and immutable publication. */
export const createProductionRenderFinalizationRuntime = (props: {
  /** One invocation-wide snapshot from the tracked authoring declaration. */
  authoringEvidence?: IAutoMovieProductionEvidence;
  encoder: IProductionRenderEncoderRuntime;
  host: IProductionRenderHost;
  planning: ReturnType<typeof createProductionRenderPlanningRuntime>;
  productionId: string;
  progress: (
    stage: string,
    details?: Readonly<Record<string, number | string>>,
  ) => void;
  publication: IProductionRenderPublicationRuntime;
  repaintSelection: () => IAutoMovieProductionRepaintSelection | null;
  root: string;
  sound: IProductionSoundRuntime;
}) => {
  const encoderRuntime = props.encoder;
  const planningRuntime = props.planning;
  const productionId = props.productionId;
  const productionRepaintSelection = props.repaintSelection;
  const publicationRuntime = props.publication;
  const renderHost = props.host;
  const renderProgress = props.progress;
  const root = props.root;
  const soundRuntime = props.sound;

  const productionServices = () =>
    openAutoMovieProduction({
      projectRoot: root,
      productionId,
      capture: renderHost.capture,
      authoringEvidence: props.authoringEvidence,
    });

  const finalize = async (plan: IAutoMovieProductionRenderJobPlan) => {
    renderProgress("finalize.start", { tier: plan.tier.kind });
    // Final publication is gated on the production's own evidence graph rather
    // than on a stored review ledger. A film that has not answered its
    // contracts at review stage has not been reviewed, whatever a ledger would
    // have said about it.
    if (plan.tier.kind === "final") {
      const gate = new AutoMovieProductionCompiler(
        AutoMovieProductionProject.openReadOnly(root, productionId),
        props.authoringEvidence,
      ).lint({ scope: "final" });
      if (gate.success === false)
        // Carry each diagnostic's own message, not just its code and target. A
        // refusal here names the exact frames a shot or a staged model still
        // owes, and dropping that sends the author to run the same gate again to
        // learn what this one already knew.
        throw new Error(
          [
            "Final publication is blocked by the production's evidence gate:",
            ...gate.diagnostics
              .filter((diagnostic) => diagnostic.category === "error")
              .map(
                (diagnostic) =>
                  `  ${diagnostic.code} ${diagnostic.target}: ${diagnostic.message}`,
              ),
          ].join("\n"),
        );
    }
    const status = await planningRuntime.renderStatus(plan);
    renderProgress("finalize.status.complete", { tier: plan.tier.kind });
    const project = AutoMovieProductionProject.open(root, productionId);
    const graph = project.graph();
    if (graph.production === null)
      throw new Error(
        "Production design disappeared before final publication.",
      );
    const configuredRepaint = productionRepaintSelection();
    if (plan.tier.kind === "final")
      publicationRuntime.assertMatchingProxy(project, plan);
    const timeline =
      plan.tier.kind === "final" &&
      graph.production.visualDelivery === "repainted"
        ? readAutoMovieFilmTimeline(project, plan.compileFingerprint)
        : null;
    const selectedRepaint =
      plan.tier.kind === "final"
        ? assertProductionRepaintSelection({
            selected: configuredRepaint,
            visualDelivery: graph.production.visualDelivery,
            continuity: "film",
            shots:
              timeline === null
                ? []
                : [
                    ...new Set(
                      timeline.segments.map((segment) => segment.shot),
                    ),
                  ],
          })
        : configuredRepaint;
    const renditionReceipts: Map<string, IAutoMovieRepaintReceipt> =
      timeline === null
        ? new Map()
        : new Map(
            project
              .verifiedRepaintRenditions([
                ...new Set(timeline.segments.map((segment) => segment.shot)),
              ])
              .map((receipt) => [receipt.shot, receipt] as const),
          );
    if (plan.tier.kind === "final" && selectedRepaint !== null)
      assertProductionRepaintReceiptAdoption({
        selected: selectedRepaint,
        receipts: [...renditionReceipts.values()],
      });
    const requiredVideo = new Set(
      graph.production.deliverables
        .filter(
          (deliverable) =>
            deliverable.required &&
            (deliverable.kind === "feature" ||
              deliverable.kind === "guide-pass"),
        )
        .map((deliverable) => deliverable.id),
    );
    if (
      status.some(
        (item) =>
          requiredVideo.has(
            plan.chunks.find((chunk) => chunk.slot === item.slot)!.deliverable,
          ) && item.status !== "complete",
      )
    )
      throw new Error(
        "Final publication requires every required current chunk complete. Run render status and run first.",
      );
    const completeSlots = new Set(
      status
        .filter((item) => item.status === "complete")
        .map((item) => item.slot),
    );
    const publication = new Map<string, Uint8Array>();
    const manifest: IAutoMovieProductionRenderManifest = {
      version: 1,
      compileFingerprint: plan.compileFingerprint,
      deliverables: [],
    };
    let soundPromise: Promise<IProductionSoundBundle> | undefined;
    const currentSound = (): Promise<IProductionSoundBundle> =>
      (soundPromise ??= (async () => {
        renderProgress("sound.start");
        const sound = await produceSoundBundle({
          assertCurrent: soundRuntime.assertCurrent,
          assertRenderClock: assertProductionSoundRenderClock,
          audioSources: soundRuntime.audioSources,
          encoder: encoderRuntime,
          prepare: soundRuntime.prepare,
          progress: renderProgress,
          project,
          renderPlan: plan,
        });
        renderProgress("sound.complete");
        return sound;
      })());
    const publicationSegment =
      productionRenderPublicationFingerprint(plan).slice(7);
    for (const deliverable of graph.production.deliverables) {
      const owned = new Map<string, Uint8Array>();
      const deliverableChunks = plan.chunks.filter(
        (chunk) => chunk.deliverable === deliverable.id,
      );
      if (
        deliverableChunks.some(
          (chunk) => completeSlots.has(chunk.slot) === false,
        )
      ) {
        if (deliverable.required)
          throw new Error(
            `Required deliverable "${deliverable.id}" has incomplete current chunks.`,
          );
        continue;
      }
      let rendition: IAutoMovieProductionRenditionDelivery | undefined;
      if (deliverable.kind === "feature") {
        renderProgress("video.feature.encode.start", {
          deliverable: deliverable.id,
        });
        const video =
          timeline === null
            ? publicationRuntime.assembleChunkVideo(plan, deliverableChunks)
            : conformProductionRenditionVideoMp4({
                timeline,
                clips: new Map(
                  timeline.segments.map((segment) => {
                    const receipt = renditionReceipts.get(segment.shot);
                    if (receipt === undefined)
                      throw new Error(
                        `Repainted feature delivery is missing current receipt-bound output for shot "${segment.shot}".`,
                      );
                    return [
                      segment.shot,
                      project.readRenderFile(receipt.output.path),
                    ] as const;
                  }),
                ),
              });
        renderProgress("video.feature.encode.complete", {
          deliverable: deliverable.id,
        });
        const sound = await currentSound();
        renderProgress("video.feature.mux.start", {
          deliverable: deliverable.id,
        });
        owned.set(
          "feature.mp4",
          await runWithProductionRuntimeClosure(
            soundRuntime.assertCurrent,
            () => muxProductionFeatureMp4({ video, audio: sound.audio }),
          ),
        );
        renderProgress("video.feature.mux.complete", {
          deliverable: deliverable.id,
        });
        if (timeline !== null) {
          const shots = [
            ...new Set(timeline.segments.map((segment) => segment.shot)),
          ];
          rendition = {
            kind: "repainted",
            shots: shots.map((shot) => {
              const receipt = renditionReceipts.get(shot);
              if (receipt === undefined)
                throw new Error(
                  `Repainted feature delivery requires a current verified repaint receipt for shot "${shot}".`,
                );
              return {
                shot,
                path: receipt.output.path,
                digest: receipt.output.digest,
                receiptDigest: digestAutoMovieBytes(
                  canonicalAutoMovieJsonBytes(receipt),
                ),
              };
            }),
          };
        }
      } else if (deliverable.kind === "guide-pass") {
        const passes = [
          ...new Set(deliverableChunks.map((chunk) => chunk.pass)),
        ];
        if (passes.length !== 1)
          throw new Error(
            `Guide deliverable "${deliverable.id}" must own one declared pass, but owns ${passes.length}.`,
          );
        renderProgress("video.guide.encode.start", {
          deliverable: deliverable.id,
        });
        const video = publicationRuntime.assembleChunkVideo(
          plan,
          deliverableChunks,
        );
        renderProgress("video.guide.encode.complete", {
          deliverable: deliverable.id,
        });
        owned.set(`${passes[0]}.mp4`, video);
        for (const chunk of [...deliverableChunks].sort(
          (left, right) => left.frameStart - right.frameStart,
        )) {
          const current = await planningRuntime.currentChunk(plan, chunk);
          if (current === null)
            throw new Error(
              `Guide-pass chunk "${chunk.slot}" changed before control-frame publication.`,
            );
          consumeCurrentRenderChunkFrames(current, (frame) =>
            owned.set(
              `frames/${passes[0]}/frame_${String(
                frame.receipt.globalFrame,
              ).padStart(8, "0")}.png`,
              frame.bytes,
            ),
          );
        }
      } else if (deliverable.kind === "captions") {
        if (plan.tracks.captions.split("-->").length < 2) {
          if (deliverable.required)
            throw new Error("Required captions contain no timed compiler cue.");
        } else
          owned.set("captions.vtt", Buffer.from(plan.tracks.captions, "utf8"));
      } else if (deliverable.kind === "audio-mix") {
        const sound = await currentSound();
        const audioEvidence = {
          version: 2 as const,
          plan: sound.plan,
          analysis: sound.analysis,
          tts: sound.tts,
          audio: {
            path: "audio.mp4",
            mediaType: "audio/mp4" as const,
            bytes: sound.audio.byteLength,
            digest: digestAutoMovieBytes(sound.audio),
          },
          measurement: {
            source: "pre-encode-pcm" as const,
            algorithm: "automovie-production-sound-analysis-v1" as const,
          },
        };
        owned.set("audio.mp4", sound.audio);
        owned.set("waveform.png", sound.waveform);
        owned.set("spectrogram.png", sound.spectrogram);
        owned.set(
          "evidence.json",
          Buffer.from(`${JSON.stringify(audioEvidence, null, 2)}\n`, "utf8"),
        );
      } else {
        const timeline = readAutoMovieFilmTimeline(
          project,
          plan.compileFingerprint,
        );
        const sample = sampleProductionRenderFrame(timeline, 0);
        const frame = sample.layers.at(-1)!;
        const captured = await renderHost.capture(
          productionRenderFrameCaptureInput({
            root,
            productionId,
            plan,
            shot: frame.shot,
            sourceFrame: frame.sourceFrame,
            sourceFps: timeline.fps,
            sample,
            pass: "beauty",
          }),
        );
        assertProductionRenderDialogueRuntimeIdentity({
          boundary: `final preview ${deliverable.id}`,
          expected: plan.runtimeIdentity.dialogueRuntimeIdentity,
          observed: captured.dialogueRuntimeIdentity,
        });
        if (
          canonicalAutoMovieCaptureRuntimeIdentity(captured.runtimeIdentity) !==
          canonicalAutoMovieCaptureRuntimeIdentity(plan.runtimeIdentity.capture)
        )
          throw new Error(
            `Preview capture for "${deliverable.id}" used a different runtime identity. Replan before finalizing.`,
          );
        owned.set("preview.png", captured.bytes);
      }
      if (owned.size === 0) {
        if (deliverable.required)
          throw new Error(
            `Required deliverable "${deliverable.id}:${deliverable.kind}" produced no bytes.`,
          );
        continue;
      }
      const files: Array<{
        path: string;
        digest: AutoMovieContentDigest;
        bytes: number;
        mediaType: string;
        probe: ReturnType<typeof probeProductionMedia>;
      }> = [];
      for (const [name, bytes] of owned) {
        const relative = [
          "deliverables",
          plan.tier.kind,
          publicationSegment,
          encodeAutoMoviePathSegment(deliverable.id),
          name,
        ].join("/");
        const mediaType =
          deliverable.kind === "captions"
            ? "text/vtt"
            : name.endsWith(".json")
              ? "application/json"
              : deliverable.kind === "preview" || name.endsWith(".png")
                ? "image/png"
                : deliverable.kind === "audio-mix"
                  ? "audio/mp4"
                  : "video/mp4";
        const probe = probeProductionMedia({
          kind: deliverable.kind,
          mediaType,
          bytes,
        });
        assertDeliverableProbe(deliverable.kind, probe, plan);
        publication.set(relative, bytes);
        files.push({
          path: relative,
          digest: digestAutoMovieBytes(bytes),
          bytes: bytes.length,
          mediaType,
          probe,
        });
      }
      const video = files.find((file) => file.probe.kind === "video")?.probe;
      const audio = files.find((file) => file.probe.kind === "audio")?.probe;
      manifest.deliverables.push({
        id: deliverable.id,
        kind: deliverable.kind,
        files: files.map(({ probe: _probe, ...file }) => file),
        runtimeSeconds:
          deliverable.kind === "captions"
            ? plan.totalFrames / plan.frameFormat.fps
            : video?.kind === "video"
              ? video.runtimeSeconds
              : audio?.kind === "audio"
                ? audio.runtimeSeconds
                : null,
        frameCount: video?.kind === "video" ? video.frameCount : null,
        codec:
          video?.kind === "video"
            ? video.codec
            : audio?.kind === "audio"
              ? audio.codec
              : null,
        ...(rendition === undefined ? {} : { rendition }),
      });
    }
    if (plan.tier.kind === "proxy") {
      renderProgress("publication.proxy.start");
      const published = publicationRuntime.publishProxy(
        plan,
        publication,
        manifest,
        project,
      );
      renderProgress("publication.proxy.complete");
      renderProgress("finalize.complete", { tier: plan.tier.kind });
      return published;
    }
    renderProgress("publication.final.start");
    const snapshot = productionPublicationInputFingerprint(project);
    const revision = project.commitProductionPublication({
      files: publication,
      manifest,
      inputCurrent: () =>
        productionPublicationInputFingerprint(
          AutoMovieProductionProject.openReadOnly(root, productionId),
        ) === snapshot,
      publicationCurrent: () => {
        const staged = new AutoMovieProductionCompiler(
          AutoMovieProductionProject.openReadOnly(root, productionId),
          props.authoringEvidence,
        ).lint({ scope: "final" });
        if (staged.success === false)
          throw new Error(
            `Staged terminal publication failed the read-only final compiler gate: ${JSON.stringify(
              staged.diagnostics,
            )}`,
          );
      },
      expectedRevision: project.revision(),
    });
    const final = productionServices().compiler.compile({ scope: "final" });
    if (final.success === false)
      throw new Error(
        `Parser-verified publication committed at revision ${revision}, but final compilation rejected it: ${JSON.stringify(final.diagnostics)}`,
      );
    renderProgress("publication.final.complete");
    renderProgress("finalize.complete", { tier: plan.tier.kind });
    return { revision, manifest, final };
  };

  const assertDeliverableProbe = (
    kind: IAutoMovieProductionDeliverable["kind"],
    probe: IAutoMovieProductionMediaProbe,
    plan: IAutoMovieProductionRenderJobPlan,
  ): void => {
    const runtimeSeconds = plan.totalFrames / plan.frameFormat.fps;
    if (kind === "feature" || kind === "guide-pass") {
      if (kind === "guide-pass" && probe.kind === "png") {
        if (
          probe.width !== plan.frameFormat.width ||
          probe.height !== plan.frameFormat.height
        )
          throw new Error(
            "Published guide frame does not match the tier raster.",
          );
        return;
      }
      if (
        probe.kind !== "video" ||
        probe.width !== plan.frameFormat.width ||
        probe.height !== plan.frameFormat.height ||
        probe.frameCount !== plan.totalFrames ||
        Math.abs(probe.fps - plan.frameFormat.fps) > 1e-9 ||
        Math.abs(probe.runtimeSeconds - runtimeSeconds) > 1e-9
      )
        throw new Error(
          `${kind} output does not match the exact production raster, frame count, frame clock, and runtime.`,
        );
      return;
    }
    if (kind === "preview") {
      if (
        probe.kind !== "png" ||
        probe.width !== plan.frameFormat.width ||
        probe.height !== plan.frameFormat.height
      )
        throw new Error("Preview output does not match the production raster.");
      return;
    }
    if (kind === "captions") {
      if (probe.kind !== "webvtt" || probe.lastCueSeconds > runtimeSeconds)
        throw new Error(
          "Caption output is empty, malformed, unordered, or outside the production timeline.",
        );
      return;
    }
    if (probe.kind === "png" || probe.kind === "sound-evidence") {
      if (
        probe.kind === "sound-evidence" &&
        (probe.evidence.analysis.clippingSamples !== 0 ||
          probe.evidence.analysis.eventAlignment.some(
            (event) => event.passed === false,
          ))
      )
        throw new Error(
          "Sound evidence reports clipping or a semantic event outside its frame gate.",
        );
      return;
    }
    if (
      probe.kind !== "audio" ||
      Math.abs(probe.runtimeSeconds - runtimeSeconds) > 1e-9
    )
      throw new Error(
        "Audio output does not contain one exact-runtime parser-verified track.",
      );
  };

  return { finalize };
};
