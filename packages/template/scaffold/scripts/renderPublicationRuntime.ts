import { resolveProductionFrameRate } from "@automovie/engine";
import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  IAutoMovieProductionDeliverable,
  IAutoMovieProductionMediaProbe,
  IAutoMovieProductionPublicationIdentity,
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenditionDelivery,
  IAutoMovieRepaintReceipt,
  IAutoMovieRepaintSequenceObservation,
  IAutoMovieSemanticMask,
} from "@automovie/interface";
import {
  AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  type IAutoMovieProductionRenderChunk,
  type IAutoMovieProductionRenderJobPlan,
  type IAutoMovieProductionSemanticMaskReceipt,
  type IAutoMovieVisualDeliveryLane,
  assembleProductionChunkVideoMp4,
  assertProductionOpusProfile,
  assertProductionPngPicture,
  assertProductionRenderDialogueRuntimeIdentity,
  assertProductionVideoProfile,
  autoMovieRepaintSequenceObservationDiagnostics,
  canonicalAutoMovieCaptureRuntimeIdentity,
  canonicalAutoMovieJsonBytes,
  conformProductionVisualDeliveryVideoMp4,
  createAutoMovieProductionSemanticMaskReceipt,
  digestAutoMovieBytes,
  digestAutoMovieRepaintObservationMembers,
  encodeAutoMoviePathSegment,
  muxProductionFeatureMp4,
  normalizeAutoMovieVisualDeliveryLanes,
  planAutoMovieVisualDelivery,
  probeProductionMedia,
  productionDeterministicVisualSourceDigest,
  productionPublicationInputFingerprint,
  productionRenderPublicationIdentity,
  productionVisualDeliveryOccurrence,
  readAutoMovieFilmTimeline,
  resolveProductionPngProfile,
  resolveProductionVideoProfile,
  sampleProductionRenderFrame,
  verifyAutoMovieProductionSemanticMaskReceipt,
  verifyProductionNonVideoDeliverables,
} from "@automovie/production";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { assertProxyPublicationCandidate } from "./assertProxyBundle";
import {
  type IAutoMovieProductionRepaintSelection,
  assertProductionRepaintReceiptAdoption,
  assertProductionRepaintSelection,
} from "./productionConfiguration";
import { assertProductionSoundRenderClock } from "./productionRuntime";
import {
  captureRenderChunkPublicationFromPointer,
  consumeCurrentRenderChunkFrames,
  readRenderChunkPublicationFile,
} from "./renderChunkSnapshot";
import { productionRenderFrameCaptureInput } from "./renderFrameCaptureInput";
import type { IProductionRenderHost } from "./renderHost";
import {
  assertRenderPlanHead,
  captureExistingRenderPlan,
} from "./renderPlanSnapshot";
import type {
  IProductionRenderChunkInspection,
  createProductionRenderPlanningRuntime,
} from "./renderPlanningRuntime";
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
  productionRenderPublicationIdentity(plan).fingerprint;

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
  inspectChunk: (
    plan: IAutoMovieProductionRenderJobPlan,
    chunk: IAutoMovieProductionRenderChunk,
  ) => IProductionRenderChunkInspection;
  ensureDirectory: (root: string, relative: string) => string;
  filesystem: Pick<typeof import("node:fs"), "existsSync" | "readdirSync">;
  inspectProxy: (props: {
    plan: IAutoMovieProductionRenderJobPlan;
    renderRoot: string;
    target: string;
  }) => {
    compileFingerprint: string;
    editFingerprint: string;
    publicationIdentity: IAutoMovieProductionPublicationIdentity;
    sourceFrameFormat: unknown;
  };
  publicationFingerprint: (plan: IAutoMovieProductionRenderJobPlan) => string;
  publishProxyBundle: (props: {
    expected: ReadonlyMap<string, Uint8Array>;
    parent: string;
    preflight: () => void;
    renderRoot: string;
    target: string;
  }) => { reused: boolean };
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
          const inspection = props.inspectChunk(plan, chunk);
          if (inspection.current === null)
            throw new Error(inspection.finding.reason);
          yield inspection.current.encoded;
        }
      })(),
      frameFormat: plan.frameFormat,
      totalFrames: plan.totalFrames,
    });
  },
  assertMatchingProxy: (project, plan) => {
    const proxyStateRoot = path.join(
      project.root,
      "automovie",
      "productions",
      encodeAutoMoviePathSegment(project.productionId),
      "render-job",
      "proxy",
    );
    const proxyPlanSnapshot = props.filesystem.existsSync(proxyStateRoot)
      ? captureExistingRenderPlan(
          proxyStateRoot,
          path.join(proxyStateRoot, "plan.json"),
        )
      : null;
    if (proxyPlanSnapshot === null)
      throw new Error(
        "Final publication requires the current proxy render-plan generation. Plan and finalize the proxy tier before final conform.",
      );
    const proxyPlan = proxyPlanSnapshot.plan;
    const proxyIdentity = productionRenderPublicationIdentity(proxyPlan);
    const target = path.join(
      project.renderRoot(),
      "deliverables",
      "proxy",
      proxyIdentity.fingerprint.slice(7),
    );
    if (props.filesystem.existsSync(target) === false)
      throw new Error(
        "Final publication requires the publication of the current proxy render plan, and none exists. Finalize the proxy tier, review it, then finalize this plan.",
      );
    // The seam binds the publication to the proxy plan itself: its structured
    // identity must equal that plan and every resident file, semantic sidecar
    // included, must reopen against the mask frame that plan schedules.
    const receipt = props.inspectProxy({
      plan: proxyPlan,
      renderRoot: project.renderRoot(),
      target,
    });
    if (
      receipt.compileFingerprint !== plan.compileFingerprint ||
      receipt.editFingerprint !== plan.editFingerprint ||
      isDeepStrictEqual(receipt.sourceFrameFormat, plan.sourceFrameFormat) ===
        false
    )
      throw new Error(
        "The current proxy publication does not match this final plan's compiler-owned EDL and source frame format. Replan and finalize both tiers.",
      );
    try {
      assertRenderPlanHead(
        proxyStateRoot,
        path.join(proxyStateRoot, "plan.json"),
        proxyPlanSnapshot,
      );
    } catch {
      throw new Error(
        "The current proxy render-plan generation changed during final admission. Retry finalization.",
      );
    }
  },
  publishProxy: (plan, publication, manifest, project) => {
    const renderRoot = project.renderRoot();
    const fingerprint = props.publicationFingerprint(plan);
    const publicationIdentity = productionRenderPublicationIdentity(plan);
    if (fingerprint !== publicationIdentity.fingerprint)
      throw new Error(
        "Proxy publication fingerprint differs from the canonical render-plan identity.",
      );
    const publicationSegment = fingerprint.slice(7);
    const bundle = ["deliverables", "proxy", publicationSegment].join("/");
    const manifestBytes = Buffer.from(
      `${JSON.stringify(
        {
          version: 1,
          tier: plan.tier,
          publicationFingerprint: fingerprint,
          publicationIdentity,
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
    const parent = props.ensureDirectory(renderRoot, "deliverables/proxy");
    const target = path.join(parent, publicationSegment);
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
      preflight: () =>
        assertProxyPublicationCandidate({
          bundle,
          expected: publication,
          plan,
          receipt: manifestBytes,
        }),
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
  repaintSequenceBaseline: () =>
    | IAutoMovieRepaintSequenceObservation["baseline"]
    | null;
  repaintSequenceObservation: () => IAutoMovieRepaintSequenceObservation | null;
  root: string;
  sound: IProductionSoundRuntime;
}) => {
  const encoderRuntime = props.encoder;
  const planningRuntime = props.planning;
  const productionId = props.productionId;
  const productionRepaintSelection = props.repaintSelection;
  const productionRepaintSequenceBaseline = props.repaintSequenceBaseline;
  const productionRepaintSequenceObservation = props.repaintSequenceObservation;
  const publicationRuntime = props.publication;
  const renderHost = props.host;
  const renderProgress = props.progress;
  const root = props.root;
  const soundRuntime = props.sound;

  const finalize = async (plan: IAutoMovieProductionRenderJobPlan) => {
    renderProgress("finalize.start", { tier: plan.tier.kind });
    // Final publication is gated on the production's own evidence graph rather
    // than on a stored review ledger. A film that has not answered its
    // contracts at review stage has not been reviewed, whatever a ledger would
    // have said about it.
    //
    // This is the review-scope gate, deliberately. The final scope adds the
    // aggregate delivery ledger, which is what this very run is about to
    // create, so asking for it here refuses every first final publication as
    // "no render manifest". The ledger is judged where it exists: the staged
    // final gate inside the terminal commit and the final compile after it,
    // both against the exact plan being published.
    if (plan.tier.kind === "final") {
      const gate = new AutoMovieProductionCompiler(
        AutoMovieProductionProject.openReadOnly(root, productionId),
        props.authoringEvidence,
      ).lint({ scope: "review" });
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
      plan.tier.kind === "final"
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
                      timeline.segments.flatMap((segment, index) => {
                        const lane =
                          graph.production!.visualDelivery === "mixed"
                            ? graph.production!.visualDeliveryLanes?.find(
                                (candidate) =>
                                  candidate.occurrence ===
                                  productionVisualDeliveryOccurrence(
                                    segment,
                                    index,
                                  ),
                              )?.lane
                            : graph.production!.visualDelivery;
                        return lane === "repainted" ? [segment.shot] : [];
                      }),
                    ),
                  ],
          })
        : configuredRepaint;
    const renditionSelections =
      timeline === null
        ? new Map()
        : new Map(
            project
              .verifiedRepaintSelections(
                timeline.segments.flatMap((segment, index) => {
                  const lane =
                    graph.production!.visualDelivery === "mixed"
                      ? graph.production!.visualDeliveryLanes?.find(
                          (candidate) =>
                            candidate.occurrence ===
                            productionVisualDeliveryOccurrence(segment, index),
                        )?.lane
                      : graph.production!.visualDelivery;
                  return lane === "repainted" ? [segment.shot] : [];
                }),
              )
              .map((selection) => [selection.receipt.shot, selection] as const),
          );
    const renditionReceipts: Map<string, IAutoMovieRepaintReceipt> = new Map(
      [...renditionSelections].map(([shot, selection]) => [
        shot,
        selection.receipt,
      ]),
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
    const blockingStatus = status.filter(
      (item) =>
        requiredVideo.has(
          plan.chunks.find((chunk) => chunk.slot === item.slot)!.deliverable,
        ) && item.status !== "complete",
    );
    if (blockingStatus.length !== 0)
      throw new Error(
        [
          "Final publication requires every required current chunk complete:",
          ...blockingStatus.map(
            (item) => `  ${item.slot}: ${item.artifact.reason}`,
          ),
        ].join("\n"),
      );
    const completeSlots = new Set(
      status
        .filter((item) => item.status === "complete")
        .map((item) => item.slot),
    );
    const publication = new Map<string, Uint8Array>();
    const manifest: IAutoMovieProductionRenderManifest = {
      version: 2,
      compileFingerprint: plan.compileFingerprint,
      publication: productionRenderPublicationIdentity(plan),
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
    const publicationFrameRate = resolveProductionFrameRate(plan.frameFormat);
    for (const deliverable of graph.production.deliverables) {
      const owned = new Map<string, Uint8Array>();
      // Semantic sidecars a mask guide carries beside its frames, keyed by the
      // owned name their bytes are published under. The chunk receipt that
      // produced each one is kept so the publication record can be re-bound to
      // the new path against the exact same shot, frame, palette, and coverage.
      const semantics = new Map<
        string,
        {
          receipt: IAutoMovieProductionSemanticMaskReceipt;
          mask: IAutoMovieSemanticMask;
        }
      >();
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
        const deterministicVideo = publicationRuntime.assembleChunkVideo(
          plan,
          deliverableChunks,
        );
        let video = deterministicVideo;
        if (timeline !== null) {
          const timelineOccurrences = timeline.segments.map(
            (segment, index) => ({
              occurrence: productionVisualDeliveryOccurrence(segment, index),
              shot: segment.shot,
            }),
          );
          const lanes: IAutoMovieVisualDeliveryLane[] =
            graph.production.visualDelivery === "mixed"
              ? (graph.production.visualDeliveryLanes ?? []).map((lane) => {
                  if (lane.lane === "deterministic")
                    return {
                      ...lane,
                      lane: "deterministic" as const,
                      deterministic: {
                        path: `generated/deterministic/${encodeAutoMoviePathSegment(lane.occurrence)}`,
                        digest: productionDeterministicVisualSourceDigest({
                          compileFingerprint: plan.compileFingerprint,
                          occurrence: lane.occurrence,
                        }),
                      },
                      repaint: null,
                    };
                  const selection = renditionSelections.get(lane.shot);
                  if (selection === undefined)
                    throw new Error(
                      `Repaint occurrence "${lane.occurrence}" has no current verified selection.`,
                    );
                  return {
                    ...lane,
                    lane: "repainted" as const,
                    deterministic: null,
                    repaint: {
                      path: selection.receipt.output.path,
                      digest: selection.receipt.output.digest,
                      receiptDigest: digestAutoMovieBytes(
                        canonicalAutoMovieJsonBytes(selection.receipt),
                      ),
                      selectionDigest: selection.selectionDigest,
                    },
                  };
                })
              : normalizeAutoMovieVisualDeliveryLanes({
                  timeline: timelineOccurrences,
                  visualDelivery: graph.production.visualDelivery,
                  deterministic: (occurrence) => ({
                    path: `generated/deterministic/${encodeAutoMoviePathSegment(occurrence.occurrence)}`,
                    digest: productionDeterministicVisualSourceDigest({
                      compileFingerprint: plan.compileFingerprint,
                      occurrence: occurrence.occurrence,
                    }),
                  }),
                  repaint: (occurrence) => {
                    const selection = renditionSelections.get(occurrence.shot);
                    if (selection === undefined)
                      throw new Error(
                        `Repaint occurrence "${occurrence.occurrence}" has no current verified selection.`,
                      );
                    return {
                      path: selection.receipt.output.path,
                      digest: selection.receipt.output.digest,
                      receiptDigest: digestAutoMovieBytes(
                        canonicalAutoMovieJsonBytes(selection.receipt),
                      ),
                      selectionDigest: selection.selectionDigest,
                    };
                  },
                });
          const members = lanes.map((lane) => {
            if (lane.lane === "deterministic")
              return {
                occurrence: lane.occurrence,
                shot: lane.shot,
                lane: "deterministic" as const,
                sourceDigest: lane.deterministic.digest,
              };
            const selection = renditionSelections.get(lane.shot)!;
            return {
              occurrence: lane.occurrence,
              shot: lane.shot,
              lane: "repainted" as const,
              requestId: selection.receipt.requestId!,
              attemptId: selection.receipt.attemptId,
              outputDigest: selection.receipt.output.digest,
              candidateReceiptDigest: lane.repaint.receiptDigest,
              selectionId: selection.selectionId,
              selectionDigest: selection.selectionDigest,
            };
          });
          const baseline = productionRepaintSequenceBaseline();
          const observation = productionRepaintSequenceObservation();
          let observationArtifactDigest: AutoMovieContentDigest | null = null;
          if (observation !== null)
            try {
              observationArtifactDigest = digestAutoMovieBytes(
                project.readRenderFile(observation.artifact.path),
              );
            } catch {
              observationArtifactDigest = null;
            }
          const observationDigest =
            observation === null
              ? null
              : digestAutoMovieBytes(canonicalAutoMovieJsonBytes(observation));
          if (
            lanes.some((lane) => lane.lane === "repainted") &&
            (baseline === null ||
              observation === null ||
              autoMovieRepaintSequenceObservationDiagnostics({
                observation,
                productionId,
                compileFingerprint: plan.compileFingerprint,
                timelineFingerprint: digestAutoMovieBytes(
                  canonicalAutoMovieJsonBytes(timeline),
                ),
                baseline,
                members,
                artifactDigest: observationArtifactDigest,
              }).length !== 0)
          )
            throw new Error(
              "Final visual delivery requires one current completed five-pass aggregate sequence observation.",
            );
          if (
            lanes.every((lane) => lane.lane === "deterministic") &&
            baseline !== null
          )
            throw new Error(
              "All-deterministic visual delivery must not invent a repaint sequence baseline.",
            );
          const deliveryPlan = planAutoMovieVisualDelivery({
            timeline: timelineOccurrences,
            lanes,
            policy:
              graph.production.visualDelivery === "mixed"
                ? (graph.production.mixedVisualDeliveryPolicy ?? null)
                : null,
            currentObservationDigest: observationDigest,
          });
          if (deliveryPlan.diagnostics.length !== 0)
            throw new Error(
              `Visual delivery plan was refused: ${deliveryPlan.diagnostics.join(", ")}.`,
            );
          if (
            deliveryPlan.segments.some(
              (segment) => segment.lane === "repainted",
            )
          )
            video = conformProductionVisualDeliveryVideoMp4({
              timeline,
              sources: deliveryPlan.segments.map((segment) => ({
                occurrence: segment.occurrence,
                lane: segment.lane,
                bytes:
                  segment.lane === "deterministic"
                    ? deterministicVideo
                    : project.readRenderFile(segment.repaint.path),
              })),
            });
          rendition = {
            version: 2,
            kind: "visual-lanes",
            memberSetDigest: digestAutoMovieRepaintObservationMembers(members),
            observationDigest,
            observation:
              observation === null ? null : structuredClone(observation),
            shots: deliveryPlan.segments.map((segment) => {
              if (segment.lane === "deterministic")
                return {
                  occurrence: segment.occurrence,
                  shot: segment.shot,
                  lane: "deterministic" as const,
                  path: segment.deterministic.path,
                  digest: segment.deterministic.digest,
                  sourceDigest: segment.deterministic.digest,
                  receiptDigest: null,
                  selectionDigest: null,
                };
              const selection = renditionSelections.get(segment.shot)!;
              return {
                occurrence: segment.occurrence,
                shot: segment.shot,
                lane: "repainted" as const,
                path: segment.repaint.path,
                digest: segment.repaint.digest,
                sourceDigest: segment.repaint.digest,
                receiptDigest: segment.repaint.receiptDigest,
                selectionDigest: segment.repaint.selectionDigest,
                selectionId: selection.selectionId,
                requestId: selection.receipt.requestId!,
                attemptId: selection.receipt.attemptId,
              };
            }),
          };
        }
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
          const inspection = planningRuntime.inspectChunkPublication(
            plan,
            chunk,
          );
          if (inspection.current === null)
            throw new Error(inspection.finding.reason);
          consumeCurrentRenderChunkFrames(inspection.current, (frame) =>
            owned.set(
              `frames/${passes[0]}/frame_${String(
                frame.receipt.globalFrame,
              ).padStart(8, "0")}.png`,
              frame.bytes,
            ),
          );
          // A mask frame is unreadable without the palette that names its
          // colours, so the chunk's semantic sidecars are published beside the
          // frames as exact bytes. The pointer the inspection judged current is
          // the only publication read, and every sidecar is reopened against
          // the chunk receipt that sealed it before it is carried anywhere.
          if (passes[0] === "mask") {
            const chunkPublication = captureRenderChunkPublicationFromPointer(
              inspection.pointer!,
            );
            for (const semantic of inspection.current.receipt.semanticMasks) {
              const bytes = readRenderChunkPublicationFile(
                chunkPublication,
                semantic.sidecar.path,
              );
              const probe = probeProductionMedia({
                kind: "guide-pass",
                mediaType: AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE,
                bytes,
              });
              if (probe.kind !== "semantic-mask")
                throw new Error(
                  `Chunk "${chunk.slot}" sidecar "${semantic.sidecar.path}" did not probe as a semantic-mask sidecar.`,
                );
              verifyAutoMovieProductionSemanticMaskReceipt({
                receipt: semantic,
                expectedFrame: semantic.frame,
                expectedShot: semantic.shot,
                evidence: {
                  version: 1,
                  shot: semantic.shot,
                  mask: probe.mask,
                  coverage: semantic.coverage,
                },
                resident: { path: semantic.sidecar.path, bytes },
              });
              const name = `frames/mask/frame_${String(semantic.frame).padStart(
                8,
                "0",
              )}.semantic.json`;
              if (owned.has(name))
                throw new Error(
                  `Guide deliverable "${deliverable.id}" publishes two semantic sidecars for frame ${semantic.frame}.`,
                );
              owned.set(name, bytes);
              semantics.set(name, { receipt: semantic, mask: probe.mask });
            }
          }
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
        verifyProductionNonVideoDeliverables({
          caption: null,
          sound: {
            expectedPlan: sound.plan,
            expectedAnalysis: sound.analysis,
            expectedTts: sound.tts,
            expectedAudio: audioEvidence.audio,
            evidence: audioEvidence,
          },
        });
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
        semanticMask?: IAutoMovieProductionSemanticMaskReceipt;
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
        const chunkSemantic = semantics.get(name);
        const mediaType =
          deliverable.kind === "captions"
            ? "text/vtt"
            : chunkSemantic !== undefined
              ? AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE
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
        assertDeliverableProbe(deliverable.kind, name, bytes, probe, plan);
        publication.set(relative, bytes);
        files.push({
          path: relative,
          digest: digestAutoMovieBytes(bytes),
          bytes: bytes.length,
          mediaType,
          // The publication record names the sidecar at its delivered path
          // while keeping the chunk receipt's shot, frame, palette digest, and
          // coverage; the palette is the one the chunk's own bytes reopened as.
          ...(chunkSemantic === undefined
            ? {}
            : {
                semanticMask: createAutoMovieProductionSemanticMaskReceipt({
                  frame: chunkSemantic.receipt.frame,
                  expectedShot: chunkSemantic.receipt.shot,
                  evidence: {
                    version: 1,
                    shot: chunkSemantic.receipt.shot,
                    mask: chunkSemantic.mask,
                    coverage: chunkSemantic.receipt.coverage,
                  },
                  sidecar: { path: relative, bytes },
                }),
              }),
          probe,
        });
      }
      const feature = files.find(
        (file) => file.probe.kind === "feature",
      )?.probe;
      const video =
        feature?.kind === "feature"
          ? feature.video
          : files.find((file) => file.probe.kind === "video")?.probe;
      const audio =
        feature?.kind === "feature"
          ? feature.audio
          : files.find((file) => file.probe.kind === "audio")?.probe;
      manifest.deliverables.push({
        id: deliverable.id,
        kind: deliverable.kind,
        files: files.map(({ probe: _probe, ...file }) => file),
        runtimeSeconds:
          deliverable.kind === "captions"
            ? (plan.totalFrames * publicationFrameRate.denominator) /
              publicationFrameRate.numerator
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
      plan,
      planCurrent: () => {
        planningRuntime.assertPlanCurrent(plan);
        return true;
      },
      inputCurrent: () =>
        productionPublicationInputFingerprint(
          AutoMovieProductionProject.openReadOnly(root, productionId),
        ) === snapshot,
      publicationCurrent: () => {
        const staged = new AutoMovieProductionCompiler(
          AutoMovieProductionProject.openReadOnly(root, productionId),
          props.authoringEvidence,
          undefined,
          plan,
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
    const final = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.openReadOnly(root, productionId),
      props.authoringEvidence,
      undefined,
      plan,
    ).compile({ scope: "final" });
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
    name: string,
    bytes: Uint8Array,
    probe: IAutoMovieProductionMediaProbe,
    plan: IAutoMovieProductionRenderJobPlan,
  ): void => {
    if (kind === "feature" || kind === "guide-pass") {
      if (kind === "guide-pass" && probe.kind === "semantic-mask") return;
      if (kind === "guide-pass" && probe.kind === "png") {
        assertProductionPngPicture({
          profile: resolveProductionPngProfile({
            role: "guide-frame",
            width: plan.frameFormat.width,
            height: plan.frameFormat.height,
          }),
          actual: probe.picture,
        });
        return;
      }
      const video =
        kind === "feature" && probe.kind === "feature"
          ? probe.video
          : kind === "guide-pass" && probe.kind === "video"
            ? probe
            : null;
      if (video === null || video.frameCount !== plan.totalFrames)
        throw new Error(
          `${kind} output does not match the exact production raster, frame count, frame clock, and runtime.`,
        );
      assertProductionVideoProfile({
        expected: resolveProductionVideoProfile({
          width: plan.frameFormat.width,
          height: plan.frameFormat.height,
          frameRate: resolveProductionFrameRate(plan.frameFormat),
        }),
        actual: video,
      });
      if (probe.kind === "feature") assertProductionOpusProfile(probe.audio);
      return;
    }
    if (kind === "preview") {
      if (probe.kind !== "png")
        throw new Error("Preview output does not match the production raster.");
      assertProductionPngPicture({
        profile: resolveProductionPngProfile({
          role: "preview",
          width: plan.frameFormat.width,
          height: plan.frameFormat.height,
        }),
        actual: probe.picture,
      });
      return;
    }
    if (kind === "captions") {
      if (probe.kind !== "webvtt")
        throw new Error(
          "Caption output is empty, malformed, unordered, or outside the production timeline.",
        );
      verifyProductionNonVideoDeliverables({
        caption: {
          required: true,
          expected: plan.tracks.captions,
          actual: bytes,
        },
        sound: null,
      });
      return;
    }
    if (probe.kind === "png") {
      const role =
        name === "waveform.png"
          ? "waveform"
          : name === "spectrogram.png"
            ? "spectrogram"
            : null;
      if (role === null)
        throw new Error(`Audio evidence contains unexpected PNG "${name}".`);
      assertProductionPngPicture({
        profile: resolveProductionPngProfile({ role }),
        actual: probe.picture,
      });
      return;
    }
    if (probe.kind === "sound-evidence") {
      if (
        probe.evidence.analysis.clippingSamples !== 0 ||
        probe.evidence.analysis.eventAlignment.some(
          (event) => event.passed === false,
        )
      )
        throw new Error(
          "Sound evidence reports clipping or a semantic event outside its frame gate.",
        );
      return;
    }
    if (probe.kind !== "audio")
      throw new Error(
        "Audio output does not contain one exact-runtime parser-verified track.",
      );
    assertProductionOpusProfile(probe);
  };

  return { finalize };
};
