import type {
  AutoMovieCaptureObservation,
  AutoMovieContentDigest,
  IAutoMovieCaptureFrame,
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
  captureAutoMovieProductionFrame,
  encodeAutoMoviePathSegment,
  openAutoMovieProduction,
  planProductionRenderJob,
  productionRenderChunkStatuses,
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

import { PRODUCTION_DELIVERY_TONE_MAPPING } from "./capture";
import { listRenderAttempts } from "./renderAttemptSnapshot";
import {
  assessProductionRenderBudget,
  publishRenderBudgetEvidence,
} from "./renderBudgetSnapshot";
import type { ICurrentRenderChunkPublication } from "./renderChunkSnapshot";
import { loadCurrentRenderChunkPublication } from "./renderChunkSnapshot";
import type { IRenderGcTargetSnapshot } from "./renderGcSnapshot";
import { ensureRenderPhysicalDirectory } from "./renderGcSnapshot";
import type { IProductionRenderHost } from "./renderHost";
import {
  captureExistingRenderPlan,
  publishRenderPlan,
} from "./renderPlanSnapshot";
import type { IProductionSoundRuntime } from "./renderSoundRuntime";
import { snapshotRuntimePackage } from "./runtimePackageSnapshot";

interface IStoredRenderPlan {
  compileFingerprint: string;
  runtimeIdentity: unknown;
}

interface IRenderStatusRow {
  status: string;
}

export interface IProductionRenderPlanningRuntime<
  Plan extends IStoredRenderPlan,
  Inputs extends { runtimeIdentity: unknown },
> {
  currentInputs: (plan: Plan) => Inputs | Promise<Inputs>;
  currentStoredPlan: () => Plan | Promise<Plan>;
  output: (value: unknown) => void;
  readPlan: () => Plan;
  renderStatus: (
    plan: Plan,
  ) => IRenderStatusRow[] | Promise<IRenderStatusRow[]>;
  sourceFingerprint: () => string;
  staleRows: (plan: Plan, reason: string) => unknown;
  verifyPlan: (props: { plan: Plan } & Inputs) => void;
}

/** Report current, stale-source, stale-runtime, or invalid-plan status. */
export const reportProductionRenderStatus = async <
  Plan extends IStoredRenderPlan,
  Inputs extends { runtimeIdentity: unknown },
>(
  runtime: IProductionRenderPlanningRuntime<Plan, Inputs>,
): Promise<void> => {
  const plan = runtime.readPlan();
  if (runtime.sourceFingerprint() !== plan.compileFingerprint) {
    runtime.output(
      runtime.staleRows(
        plan,
        "Source/design input changed. Run automovie render plan, then rerender only the new chunk identities.",
      ),
    );
    return;
  }
  const inputs = await runtime.currentInputs(plan);
  if (
    isDeepStrictEqual(inputs.runtimeIdentity, plan.runtimeIdentity) === false
  ) {
    runtime.output(
      runtime.staleRows(
        plan,
        "Capture, graphics, render-source, or encoder identity changed. Run automovie render plan, then rerender only the new chunk identities.",
      ),
    );
    return;
  }
  try {
    runtime.verifyPlan({ plan, ...inputs });
    runtime.output(await runtime.renderStatus(plan));
  } catch {
    runtime.output(
      runtime.staleRows(
        plan,
        "Stored render plan differs from current compiler-owned inputs. Run automovie render plan, then rerender only the new chunk identities.",
      ),
    );
  }
};

/** Verify that every chunk of the current immutable plan is complete. */
export const verifyCurrentProductionRender = async <
  Plan extends IStoredRenderPlan,
  Inputs extends { runtimeIdentity: unknown },
>(
  runtime: IProductionRenderPlanningRuntime<Plan, Inputs>,
): Promise<void> => {
  const current = await runtime.currentStoredPlan();
  const chunks = await runtime.renderStatus(current);
  if (chunks.some((item) => item.status !== "complete"))
    throw new Error(
      "Render verification found incomplete chunks. Run automovie render status, then run.",
    );
  runtime.output({ verified: true, plan: current, chunks });
};

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
  captureCurrentChunkPointer: (
    chunk: IAutoMovieProductionRenderChunk,
  ) => IRenderGcTargetSnapshot | null;
  compareCodeUnits: (left: string, right: string) => number;
  h264Entry: string;
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
    });

  const readPlan = (): IAutoMovieProductionRenderJobPlan => {
    const captured = captureExistingRenderPlan(stateRoot, planPath);
    if (captured === null)
      throw new Error("No render plan exists. Run automovie render plan.");
    return captured.plan;
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
  ) =>
    plan.chunks.map((chunk) => ({
      slot: chunk.slot,
      chunk: chunk.id,
      status: "stale" as const,
      correction,
    }));

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
    return {
      protocolVersion: "automovie.production-render-runtime.v1",
      sourceDigest: soundRuntime.sourceDigest(
        props.project,
        props.timeline,
        preparedSound.dialogueRuntime,
      ),
      capture: preflight.runtimeIdentity,
      encoder: productionEncoderIdentity(props.fps),
    };
  };

  const productionEncoderIdentity = (
    fps: number,
  ): IAutoMovieProductionEncoderIdentity => {
    const snapshot = snapshotRuntimePackage({
      entry: props.h264Entry,
      packageName: "h264-mp4-encoder",
    });
    const encoder = {
      package: snapshot.package,
      version: snapshot.version,
      entryDigest: snapshot.entryDigest,
    };
    return {
      ...encoder,
      codec: "h264",
      arguments: {
        quantizationParameter: 24,
        speed: 10,
        groupOfPictures: fps,
      },
    };
  };

  return {
    captureReviewEvidence,
    currentChunk,
    currentChunkPublication,
    currentPlan,
    currentReceipt,
    currentStoredPlan,
    enforceRenderBudget,
    productionEncoderIdentity,
    renderStatus,
    reportStatus: () =>
      reportProductionRenderStatus({
        currentInputs: currentRenderPlanInputs,
        currentStoredPlan,
        output,
        readPlan,
        renderStatus,
        sourceFingerprint,
        staleRows: stalePlanRows,
        verifyPlan: verifyProductionRenderJobPlan,
      }),
    sourceFingerprint,
    uncheckedDeliveryTone,
    verify: () =>
      verifyCurrentProductionRender({
        currentInputs: currentRenderPlanInputs,
        currentStoredPlan,
        output,
        readPlan,
        renderStatus,
        sourceFingerprint,
        staleRows: stalePlanRows,
        verifyPlan: verifyProductionRenderJobPlan,
      }),
  };
};
