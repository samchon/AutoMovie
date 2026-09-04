import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type {
  AutoMovieCaptureObservation,
  AutoMovieContentDigest,
  IAutoMovieCaptureFrame,
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenderReceipt,
  IAutoMovieRenderReport,
  IAutoMovieRenderSpec,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionContext,
  AutoMovieProductionProject,
  type IAutoMovieProductionEncoderIdentity,
  type IAutoMovieProductionRenderChunk,
  type IAutoMovieProductionRenderChunkReceipt,
  type IAutoMovieProductionRenderJobPlan,
  type IAutoMovieProductionRenderRuntimeIdentity,
  type IAutoMovieProductionRenderTier,
  assertProductionRenderDialogueRuntimeIdentity,
  assertProductionRenderPublicationCurrent,
  captureAutoMovieProductionFrame,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  openAutoMovieProduction,
  planProductionRenderJob,
  productionRenderChunkStatuses,
  productionRenderPublicationIdentity,
  readAutoMovieFilmTimeline,
  resolveProductionRenderTierFrameFormat,
  sampleProductionRenderFrame,
  selectAutoMovieFilmReviewFrames,
  verifyProductionRenderChunkReceipt,
  verifyProductionRenderJobPlan,
} from "@automovie/production";
import { autoMovieRenderBudgetRefusal } from "@automovie/render";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { inspectPublishedProxyBundle } from "./assertProxyBundle";
import { PRODUCTION_DELIVERY_TONE_MAPPING } from "./capture";
import { inspectCurrentCaptureRuntimeClosure } from "./capture-browser";
import { readAutoMovieHostCaptureBrowser } from "./hostBoundary";
import { productionDialogueRuntimeIdentity } from "./productionRuntime";
import { listRenderAttempts } from "./renderAttemptSnapshot";
import {
  assessProductionRenderBudget,
  publishRenderBudgetEvidence,
} from "./renderBudgetSnapshot";
import {
  type ICurrentRenderChunkPublication,
  loadCurrentRenderChunkPublication,
} from "./renderChunkSnapshot";
import {
  type IRenderGcTargetSnapshot,
  ensureRenderPhysicalDirectory,
} from "./renderGcSnapshot";
import type { IProductionRenderHost } from "./renderHost";
import {
  captureExistingRenderPlan,
  publishRenderPlan,
} from "./renderPlanSnapshot";
import {
  type ProductionRenderReadOnlyInputInspection,
  reportProductionRenderStatus,
  verifyCurrentProductionRender,
} from "./renderReadOnlyRuntime";
import type { IProductionSoundRuntime } from "./renderSoundRuntime";

export interface IProductionDeliveryToneCheck {
  requested: IAutoMovieRenderSpec["toneMapping"];
  status: "checked" | "not-run";
  bundle: string | null;
  recorded: IAutoMovieRenderSpec["toneMapping"] | null;
  reason: string | null;
}

/** State that no sealed delivery curve was available to inspect. */
export const uncheckedProductionDeliveryTone = (
  reason: string,
): IProductionDeliveryToneCheck => ({
  requested: PRODUCTION_DELIVERY_TONE_MAPPING,
  status: "not-run",
  bundle: null,
  recorded: null,
  reason,
});

/** Refuse when any captured bundle contradicts the requested delivery curve. */
export const checkProductionDeliveryTone = (props: {
  compareCodeUnits: (left: string, right: string) => number;
  frames: readonly IAutoMovieCaptureFrame[];
  project: AutoMovieProductionProject;
}): IProductionDeliveryToneCheck => {
  const bundles = [
    ...new Set(
      props.frames.flatMap((frame) =>
        frame.receipt === null ? [] : [frame.receipt.bundle],
      ),
    ),
  ].sort(props.compareCodeUnits);
  let checkedBundle: string | null = null;
  for (const bundle of bundles) {
    const manifest = props.project.verifiedRenderManifest(
      path.join(
        props.project.renderRoot(),
        ...bundle.split("/"),
        "manifest.json",
      ),
    );
    if (manifest === null) continue;
    if (manifest.renderSpec.toneMapping !== PRODUCTION_DELIVERY_TONE_MAPPING)
      throw new Error(
        `The capture host opened the viewer with tone mapping "${PRODUCTION_DELIVERY_TONE_MAPPING}", but bundle "${bundle}" records "${manifest.renderSpec.toneMapping}". Correct PRODUCTION_DELIVERY_TONE_MAPPING in scripts/capture.ts so the page and the sealed render spec state one curve.`,
      );
    checkedBundle ??= bundle;
  }
  if (checkedBundle !== null)
    return {
      requested: PRODUCTION_DELIVERY_TONE_MAPPING,
      status: "checked",
      bundle: checkedBundle,
      recorded: PRODUCTION_DELIVERY_TONE_MAPPING,
      reason: null,
    };
  return uncheckedProductionDeliveryTone(
    `review capture committed no verifiable render bundle out of ${bundles.length}, so no sealed render spec states the delivery curve for this run`,
  );
};

/** Own planning inputs, runtime identity, status, verification, and budget evidence. */
export const createProductionRenderPlanningRuntime = (props: {
  /** One invocation-wide snapshot from the tracked authoring declaration. */
  authoringEvidence?: IAutoMovieProductionEvidence;
  captureCurrentChunkPointer: (
    chunk: IAutoMovieProductionRenderChunk,
  ) => IRenderGcTargetSnapshot | null;
  compareCodeUnits: (left: string, right: string) => number;
  host: IProductionRenderHost;
  output: (value: unknown) => void;
  planPath: string;
  productionId: string;
  productionSegment: string;
  renderChunkFrames: number;
  renderTier: IAutoMovieProductionRenderTier;
  root: string;
  soundRuntime: IProductionSoundRuntime;
  stateRoot: string;
}) => {
  const renderHost = props.host;
  const root = props.root;
  const productionId = props.productionId;
  const productionSegment = props.productionSegment;
  const renderChunkFrames = props.renderChunkFrames;
  const renderTier = props.renderTier;
  const stateRoot = props.stateRoot;
  const planPath = props.planPath;
  const soundRuntime = props.soundRuntime;
  const compareCodeUnits = props.compareCodeUnits;
  const gcRuntime = {
    captureCurrentChunkPointer: props.captureCurrentChunkPointer,
  };
  const output = props.output;

  const sourceFingerprint = (): AutoMovieContentDigest => {
    const checked = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.openReadOnly(root, productionId),
      props.authoringEvidence,
    ).lint({ scope: "source" });
    if (checked.success === false)
      throw new Error(
        `Source lint failed while checking render status: ${JSON.stringify(
          checked.diagnostics,
        )}`,
      );
    return checked.compiler.inputFingerprint;
  };

  const uncheckedDeliveryTone = uncheckedProductionDeliveryTone;

  const captureReviewEvidence = async (): Promise<{
    frames: IAutoMovieCaptureFrame[];
    deliveryTone: IProductionDeliveryToneCheck;
  }> => {
    const context = productionCaptureContext();
    const compiled = productionServices().compiler.compile({ scope: "source" });
    if (compiled.success === false)
      throw new Error(
        `Source compilation failed before review capture: ${JSON.stringify(
          compiled.diagnostics,
        )}`,
      );
    const project = AutoMovieProductionProject.openReadOnly(root, productionId);
    const graph = project.graph();
    if (graph.production === null)
      throw new Error("Review capture requires a production design.");
    const timeline = readAutoMovieFilmTimeline(
      project,
      compiled.compiler.inputFingerprint,
    );
    const frames: IAutoMovieCaptureFrame[] = [];
    for (const segment of timeline.segments) {
      const contract = graph.shots.get(segment.shot);
      if (contract === undefined)
        throw new Error(
          `Compiled film segment references missing shot "${segment.shot}".`,
        );
      for (const request of selectAutoMovieFilmReviewFrames(
        segment,
        contract,
        timeline.fps,
      ))
        for (const pass of request.passes)
          frames.push(
            await captureAutoMovieProductionFrame(context, {
              target: {
                kind: "shot",
                productionId,
                id: segment.shot,
                time: request.time,
                pass,
              },
            }),
          );
    }
    const failed = frames.filter((frame) => frame.captured === false);
    if (failed.length !== 0)
      throw new Error(
        `Review evidence capture failed for ${failed.length} current frame(s): ${JSON.stringify(
          failed,
        )}`,
      );
    return { frames, deliveryTone: checkCapturedDeliveryTone(project, frames) };
  };

  const checkCapturedDeliveryTone = (
    project: AutoMovieProductionProject,
    frames: readonly IAutoMovieCaptureFrame[],
  ): IProductionDeliveryToneCheck =>
    checkProductionDeliveryTone({ compareCodeUnits, frames, project });

  /**
   * Measure this tier's artifact against the budget the production declares for
   * it, publish the evidence, and refuse an over-budget render.
   *
   * The check belongs here and nowhere earlier. A budget verdict is a claim about
   * a specific renderer drawing specific bytes at a specific raster, and only the
   * render job knows all three: the compiler never sees a GPU, and the plan's own
   * capture preflight is the first moment WebGL has answered.
   *
   * Only `over` refuses. `incomplete` and `not-run` are published exactly as they
   * are, because an unmeasured cost has not been cleared and dressing it as a
   * pass is the one failure this evidence exists to prevent.
   */
  const enforceRenderBudget = (plan: IAutoMovieProductionRenderJobPlan) => {
    const project = AutoMovieProductionProject.openReadOnly(root, productionId);
    const graph = project.graph();
    if (graph.production === null)
      throw new Error("Render budget preflight requires a production design.");
    const timeline = readAutoMovieFilmTimeline(
      project,
      plan.compileFingerprint,
    );
    const evidence = assessProductionRenderBudget({
      project,
      production: graph.production,
      tier: plan.tier.kind,
      shots: [...new Set(timeline.segments.map((segment) => segment.shot))],
      frameFormat: plan.frameFormat,
      // The recorded browser scale, not an assumed one: the viewer pins the
      // renderer's own pixel ratio to match it, and a fingerprint carrying a
      // number nobody measured could not detect a host that changed it.
      pixelRatio: plan.runtimeIdentity.capture.mode.deviceScaleFactor,
      delivery: PRODUCTION_DELIVERY_TONE_MAPPING,
      graphics: plan.runtimeIdentity.capture.graphics,
      audioAssets: new Set(timeline.tracks.audio.map((cue) => cue.asset)),
    });
    const published = publishRenderBudgetEvidence({ stateRoot, evidence });
    const relative = path
      .relative(root, published.path)
      .split(path.sep)
      .join("/");
    const refusal = autoMovieRenderBudgetRefusal(evidence);
    if (refusal !== null)
      throw new Error(
        `${refusal} Raise the limit for tier "${evidence.tier}" deliberately or reduce the named owners, then replan. The evidence is at ${relative}.`,
      );
    return {
      summary: {
        tier: evidence.tier,
        status: evidence.status,
        budgeted: evidence.budgeted,
        declaredTiers: evidence.declaredTiers,
        digest: evidence.digest,
        evidence: relative,
        shots: evidence.shots.map((shot) => ({
          shot: shot.shot,
          status: shot.status,
          reason: shot.reason,
          report: shot.report?.digest ?? null,
          target: shot.target?.digest ?? null,
        })),
      },
      reports: new Map<
        string,
        AutoMovieCaptureObservation<IAutoMovieRenderReport>
      >(
        evidence.shots.map((shot) => [
          shot.shot,
          shot.report === null
            ? {
                status: "not-run",
                reason:
                  shot.reason ??
                  "render budget preflight produced no report for this shot",
              }
            : { status: "available", value: shot.report },
        ]),
      ),
    };
  };

  const currentPlan = async (): Promise<IAutoMovieProductionRenderJobPlan> => {
    ensureRenderPhysicalDirectory(
      root,
      [
        "automovie",
        "productions",
        productionSegment,
        "render-job",
        renderTier.kind,
      ].join("/"),
    );
    const predecessor = captureExistingRenderPlan(stateRoot, planPath);
    const compiled = productionServices().compiler.compile({ scope: "source" });
    if (compiled.success === false)
      throw new Error(
        `Source compilation failed before render planning: ${JSON.stringify(
          compiled.diagnostics,
        )}`,
      );
    const project = AutoMovieProductionProject.openReadOnly(root, productionId);
    const graph = project.graph();
    if (graph.production === null)
      throw new Error("Render planning requires a production design.");
    if (
      graph.production.frameFormat.width % 2 !== 0 ||
      graph.production.frameFormat.height % 2 !== 0
    )
      throw new Error(
        "The package-owned H.264 adapter requires even production width and height.",
      );
    const timeline = readAutoMovieFilmTimeline(
      project,
      compiled.compiler.inputFingerprint,
    );
    const frameFormat = resolveProductionRenderTierFrameFormat(
      graph.production.frameFormat,
      renderTier,
    );
    const first = sampleProductionRenderFrame(timeline, 0).layers.at(-1)!;
    const runtimeIdentity = await renderRuntimeIdentity({
      project,
      compileFingerprint: compiled.compiler.inputFingerprint,
      timeline,
      first,
      width: frameFormat.width,
      height: frameFormat.height,
      fps: frameFormat.fps,
    });
    const planned = planProductionRenderJob({
      timeline,
      production: graph.production,
      audioAssets: soundRuntime.audioAssets(project, timeline),
      runtimeIdentity,
      sourceFingerprints: renderShotFingerprints(project, timeline),
      chunkFrames: renderChunkFrames,
      tier: renderTier,
    });
    const published = await publishRenderPlan({
      base: stateRoot,
      inputCurrent: async () => {
        if (sourceFingerprint() !== planned.compileFingerprint)
          throw new Error("Render planning inputs changed before publication.");
        const inputs = await currentRenderPlanInputs(planned);
        verifyProductionRenderJobPlan({ plan: planned, ...inputs });
      },
      plan: planned,
      predecessor,
      target: planPath,
    });
    return published.plan;
  };

  const renderShotFingerprints = (
    project: AutoMovieProductionProject,
    timeline: ReturnType<typeof readAutoMovieFilmTimeline>,
  ): Record<string, AutoMovieContentDigest> => {
    const manifest = project.generatedManifest();
    if (manifest === null)
      throw new Error("Render planning requires current generated ownership.");
    return Object.fromEntries(
      [...new Set(timeline.segments.map((segment) => segment.shot))]
        .sort(compareCodeUnits)
        .map((shot) => {
          const generated = manifest.files.find(
            (file) =>
              file.path === `shots/${encodeAutoMoviePathSegment(shot)}.json`,
          );
          if (generated === undefined)
            throw new Error(
              `Render planning cannot find compiler-owned source bytes for shot "${shot}".`,
            );
          return [shot, generated.digest];
        }),
    );
  };

  const renderStatus = async (plan: IAutoMovieProductionRenderJobPlan) => {
    const currentChunks = await Promise.all(
      plan.chunks.map((chunk) => currentChunk(plan, chunk)),
    );
    const receipts = currentChunks.flatMap((current) =>
      current === null ? [] : [current.receipt],
    );
    const attempts = listRenderAttempts(
      stateRoot,
      path.join(stateRoot, "attempts"),
    ).map((attempt) => attempt.record);
    const rows = productionRenderChunkStatuses({ plan, receipts, attempts });
    return rows.map((row, index) => {
      if (row.status !== "complete") return row;
      return currentChunks[index] === null
        ? {
            ...row,
            status: "failed" as const,
            correction:
              "Chunk publication tree or receipt is partial, changed, corrupt, or parser-inconsistent. Quarantine and rerender this chunk.",
          }
        : row;
    });
  };

  /** Compare the terminal ledger with the current final plan for status only. */
  const tierPublicationStatus = (
    plan: IAutoMovieProductionRenderJobPlan,
  ): Array<{
    slot: string;
    chunk: AutoMovieContentDigest;
    status: "planned" | "complete" | "stale";
    correction: string;
  }> => {
    const expected = productionRenderPublicationIdentity(plan);
    const project = AutoMovieProductionProject.openReadOnly(root, productionId);
    if (plan.tier.kind === "proxy") {
      const target = path.join(
        project.renderRoot(),
        "deliverables",
        "proxy",
        expected.fingerprint.slice(7),
      );
      if (renderHost.filesystem.existsSync(target) === false)
        return [
          {
            slot: "publication/proxy",
            chunk: expected.fingerprint,
            status: "planned",
            correction:
              "Current proxy chunks have not been published. Run automovie render finalize after every required chunk is complete.",
          },
        ];
      try {
        const receipt = inspectPublishedProxyBundle(
          project.renderRoot(),
          target,
        );
        assertProductionRenderPublicationCurrent({
          identity: receipt.publicationIdentity,
          plan,
        });
        return [
          {
            slot: "publication/proxy",
            chunk: expected.fingerprint,
            status: "complete",
            correction: "No correction required.",
          },
        ];
      } catch (error) {
        return [
          {
            slot: "publication/proxy",
            chunk: expected.fingerprint,
            status: "stale",
            correction: `${error instanceof Error ? error.message : String(error)} Re-run automovie render finalize for the current proxy plan.`,
          },
        ];
      }
    }
    const manifestBytes = project.readTrackedStateFile("render-manifest.json");
    const receiptBytes = project.readTrackedStateFile(
      "render-manifest-receipt.json",
    );
    if (manifestBytes === null || receiptBytes === null)
      return [
        {
          slot: "publication/final",
          chunk: expected.fingerprint,
          status: "planned",
          correction:
            "Current final chunks have not been published. Run automovie render finalize after every required chunk is complete.",
        },
      ];
    try {
      const manifest = JSON.parse(
        Buffer.from(manifestBytes).toString("utf8"),
      ) as IAutoMovieProductionRenderManifest;
      const receipt = JSON.parse(
        Buffer.from(receiptBytes).toString("utf8"),
      ) as IAutoMovieProductionRenderReceipt;
      const identity = assertProductionRenderPublicationCurrent({
        identity: manifest.publication,
        plan,
      });
      if (
        manifest.version !== 2 ||
        receipt.version !== 4 ||
        receipt.manifestDigest !== digestAutoMovieBytes(manifestBytes) ||
        receipt.publicationFingerprint !== identity.fingerprint
      )
        throw new Error(
          "The manifest and renderer receipt do not carry one matching current publication identity.",
        );
      return [
        {
          slot: "publication/final",
          chunk: identity.fingerprint,
          status: "complete",
          correction: "No correction required.",
        },
      ];
    } catch (error) {
      return [
        {
          slot: "publication/final",
          chunk: expected.fingerprint,
          status: "stale",
          correction: `${error instanceof Error ? error.message : String(error)} Re-run automovie render finalize for the current final plan.`,
        },
      ];
    }
  };

  const currentReceipt = async (
    plan: IAutoMovieProductionRenderJobPlan,
    chunk: IAutoMovieProductionRenderChunk,
  ): Promise<IAutoMovieProductionRenderChunkReceipt | null> => {
    const current = await currentChunk(plan, chunk);
    return current?.receipt ?? null;
  };

  const currentChunk = async (
    plan: IAutoMovieProductionRenderJobPlan,
    chunk: IAutoMovieProductionRenderChunk,
    pointer?: IRenderGcTargetSnapshot | null,
  ): Promise<ICurrentRenderChunkPublication | null> =>
    currentChunkPublication(plan, chunk, pointer);

  /**
   * The synchronous core of {@link currentChunk}, so the final assembly can pull
   * one chunk's verified bytes at a time from a plain iterator instead of holding
   * every chunk of the film at once.
   */
  const currentChunkPublication = (
    plan: IAutoMovieProductionRenderJobPlan,
    chunk: IAutoMovieProductionRenderChunk,
    pointer?: IRenderGcTargetSnapshot | null,
  ): ICurrentRenderChunkPublication | null => {
    try {
      const currentPointer =
        pointer === undefined
          ? gcRuntime.captureCurrentChunkPointer(chunk)
          : pointer;
      if (currentPointer === null) return null;
      return loadCurrentRenderChunkPublication({
        assertReceipt: (receipt) =>
          verifyProductionRenderChunkReceipt({ plan, chunk, receipt }),
        chunk,
        frameFormat: plan.frameFormat,
        pointer: currentPointer,
      });
    } catch {
      return null;
    }
  };

  const productionCaptureContext = (): AutoMovieProductionContext =>
    new AutoMovieProductionContext(renderHost.capture, root, productionId);

  const productionServices = () =>
    openAutoMovieProduction({
      projectRoot: root,
      productionId,
      capture: renderHost.capture,
      authoringEvidence: props.authoringEvidence,
    });

  const observedPlanGenerations = new WeakMap<
    IAutoMovieProductionRenderJobPlan,
    string
  >();

  const readPlan = (): IAutoMovieProductionRenderJobPlan => {
    const captured = captureExistingRenderPlan(stateRoot, planPath);
    if (captured === null)
      throw new Error("No render plan exists. Run automovie render plan.");
    observedPlanGenerations.set(captured.plan, captured.generation);
    return captured.plan;
  };

  const assertPlanCurrent = (plan: IAutoMovieProductionRenderJobPlan): void => {
    const generation = observedPlanGenerations.get(plan);
    const current = captureExistingRenderPlan(stateRoot, planPath);
    if (generation === undefined || current?.generation !== generation)
      throw new Error(
        "Stored render plan generation changed during read-only inspection. Retry automovie render status or verify.",
      );
  };

  const currentStoredPlan =
    async (): Promise<IAutoMovieProductionRenderJobPlan> => {
      const plan = readPlan();
      if (sourceFingerprint() !== plan.compileFingerprint)
        throw new Error(
          "The stored render plan is stale. Run automovie render plan, then rerender only changed chunk identities.",
        );
      const inputs = await currentRenderPlanInputs(plan);
      if (
        isDeepStrictEqual(inputs.runtimeIdentity, plan.runtimeIdentity) ===
        false
      )
        throw new Error(
          "The stored render runtime identity changed. Run automovie render plan, then rerender only changed chunk identities.",
        );
      verifyProductionRenderJobPlan({ plan, ...inputs });
      return plan;
    };

  const stalePlanRows = (
    plan: IAutoMovieProductionRenderJobPlan,
    correction: string,
    runtimeComparison: "not-ready" | "not-run" | "stale" = "stale",
  ) =>
    plan.chunks.map((chunk) => ({
      slot: chunk.slot,
      chunk: chunk.id,
      status: "stale" as const,
      runtimeComparison,
      correction,
    }));

  const snapshotProductionEncoderIdentity = (fps: number) => {
    renderHost.assertRuntimePackagesCurrent();
    const snapshot = renderHost.h264Generation.snapshot;
    const encoder: IAutoMovieProductionEncoderIdentity = {
      package: snapshot.package,
      version: snapshot.version,
      closureDigest: snapshot.contentFingerprint,
      codec: "h264",
      arguments: {
        quantizationParameter: 24,
        speed: 10,
        groupOfPictures: fps,
      },
    };
    return {
      identity: encoder,
      assertCurrent: renderHost.assertRuntimePackagesCurrent,
    };
  };

  const productionEncoderIdentity = (
    fps: number,
  ): IAutoMovieProductionEncoderIdentity => {
    const snapshot = snapshotProductionEncoderIdentity(fps);
    return snapshot.identity;
  };

  const currentRenderPlanInputs = async (
    plan: IAutoMovieProductionRenderJobPlan,
  ) => {
    const project = AutoMovieProductionProject.openReadOnly(root, productionId);
    const graph = project.graph();
    const production = graph.production;
    if (production === null)
      throw new Error("Render runtime preflight requires a production design.");
    const timeline = readAutoMovieFilmTimeline(
      project,
      plan.compileFingerprint,
    );
    const first = sampleProductionRenderFrame(timeline, 0).layers.at(-1);
    if (first === undefined)
      throw new Error(
        "Render runtime preflight requires one film video frame.",
      );
    const runtimeIdentity = await renderRuntimeIdentity({
      project,
      compileFingerprint: plan.compileFingerprint,
      timeline,
      first,
      width: plan.frameFormat.width,
      height: plan.frameFormat.height,
      fps: plan.frameFormat.fps,
    });
    return {
      timeline,
      production,
      runtimeIdentity,
      sourceFingerprints: renderShotFingerprints(project, timeline),
      audioAssets: soundRuntime.audioAssets(project, timeline),
    };
  };

  /**
   * Observe resident plan inputs without synthesis, installation, capture,
   * publication, or any other repair. Graphics remains explicitly `not-run`
   * because only `capture:doctor` may launch a browser to re-establish it.
   */
  const inspectCurrentRenderPlanInputs = (
    plan: IAutoMovieProductionRenderJobPlan,
  ): ProductionRenderReadOnlyInputInspection<
    Awaited<ReturnType<typeof currentRenderPlanInputs>>
  > => {
    const project = AutoMovieProductionProject.openReadOnly(root, productionId);
    const graph = project.graph();
    if (graph.production === null)
      throw new Error(
        "Render runtime inspection requires a production design.",
      );
    const timeline = readAutoMovieFilmTimeline(
      project,
      plan.compileFingerprint,
    );
    const sound = soundRuntime.inspectCurrent({
      project,
      compileFingerprint: plan.compileFingerprint,
      timeline,
    });
    if (sound.status === "not-ready")
      return {
        status: "not-ready",
        correction: sound.correction,
        assertCurrent: sound.assertCurrent,
        resources: [],
      };
    const capture = inspectCurrentCaptureRuntimeClosure({
      projectRoot: root,
      config: readAutoMovieHostCaptureBrowser(process.env),
    });
    if (capture.status === "not-ready")
      return {
        status: "not-ready",
        correction: capture.correction,
        assertCurrent: sound.assertCurrent,
        resources: [],
      };
    const encoder = snapshotProductionEncoderIdentity(plan.frameFormat.fps);
    const assertCurrent = (): void => {
      sound.assertCurrent();
      capture.assertCurrent();
      encoder.assertCurrent();
    };
    assertCurrent();
    const stored =
      plan.runtimeIdentity as Partial<IAutoMovieProductionRenderRuntimeIdentity> | null;
    if (
      stored === null ||
      stored.protocolVersion !== "automovie.production-render-runtime.v3" ||
      stored.sourceDigest !== sound.sourceDigest ||
      stored.dialogueRuntimeIdentity !==
        (sound.plan.dialogue.length === 0
          ? null
          : productionDialogueRuntimeIdentity(sound.dialogueRuntime)) ||
      isDeepStrictEqual(stored.capture?.runtimeClosure, capture.identity) ===
        false ||
      isDeepStrictEqual(stored.encoder, encoder.identity) === false
    )
      return {
        status: "stale",
        correction:
          "Capture closure, render source, sound runtime, or encoder identity changed. Run automovie render plan, then rerender only the new chunk identities.",
        assertCurrent,
        resources: [],
      };
    return {
      status: "not-run",
      correction:
        "Capture graphics identity comparison is not-run because read-only inspection cannot launch a browser. Run npm run capture:doctor to re-establish it without repairing render state.",
      assertCurrent,
      resources: [],
    };
  };

  const renderRuntimeIdentity = async (props: {
    project: AutoMovieProductionProject;
    compileFingerprint: AutoMovieContentDigest;
    timeline: ReturnType<typeof readAutoMovieFilmTimeline>;
    first: { shot: string; sourceFrame: number };
    width: number;
    height: number;
    fps: number;
  }): Promise<IAutoMovieProductionRenderRuntimeIdentity> => {
    const preparedSound = await soundRuntime.prepare({
      project: props.project,
      compileFingerprint: props.compileFingerprint,
      timeline: props.timeline,
    });
    const preflight = await renderHost.capture({
      projectRoot: root,
      productionId,
      compileFingerprint: props.compileFingerprint,
      target: { kind: "shot", id: props.first.shot },
      time: props.first.sourceFrame / props.timeline.fps,
      globalFrame: 0,
      pass: "beauty",
      width: props.width,
      height: props.height,
    });
    const dialogueRuntimeIdentity =
      preparedSound.plan.dialogue.length === 0
        ? null
        : productionDialogueRuntimeIdentity(preparedSound.dialogueRuntime);
    assertProductionRenderDialogueRuntimeIdentity({
      boundary: "render planning preflight",
      expected: dialogueRuntimeIdentity,
      observed: preflight.dialogueRuntimeIdentity,
    });
    return {
      protocolVersion: "automovie.production-render-runtime.v3",
      sourceDigest: soundRuntime.sourceDigest(
        props.project,
        props.timeline,
        preparedSound.dialogueRuntime,
      ),
      dialogueRuntimeIdentity,
      capture: preflight.runtimeIdentity,
      encoder: productionEncoderIdentity(props.fps),
    };
  };

  return {
    assertPlanCurrent,
    captureReviewEvidence,
    currentChunk,
    currentChunkPublication,
    currentPlan,
    currentReceipt,
    currentStoredPlan,
    enforceRenderBudget,
    productionEncoderIdentity,
    renderStatus,
    /** Observe existing plan/cache/runtime evidence without materialization. */
    reportStatus: () =>
      reportProductionRenderStatus({
        assertPlanCurrent,
        inspectInputs: inspectCurrentRenderPlanInputs,
        output,
        readPlan,
        reportStatus: async (plan) => [
          ...(await renderStatus(plan)),
          ...tierPublicationStatus(plan),
        ],
        renderStatus,
        runtimeIdentitiesEqual: isDeepStrictEqual,
        sourceFingerprint,
        staleRows: stalePlanRows,
        verifyPlan: verifyProductionRenderJobPlan,
      }),
    sourceFingerprint,
    uncheckedDeliveryTone,
    /** Refuse incomplete or unproved evidence without materialization. */
    verify: () =>
      verifyCurrentProductionRender({
        assertPlanCurrent,
        inspectInputs: inspectCurrentRenderPlanInputs,
        output,
        readPlan,
        renderStatus,
        runtimeIdentitiesEqual: isDeepStrictEqual,
        sourceFingerprint,
        staleRows: stalePlanRows,
        verifyPlan: verifyProductionRenderJobPlan,
      }),
  };
};
