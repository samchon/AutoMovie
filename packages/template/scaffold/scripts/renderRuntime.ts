import { readAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AutoMovieProductionProject,
  type IAutoMovieProductionRenderTier,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  readAutoMovieProductionOwnedFile,
  runProductionRenderJob,
} from "@automovie/production";
import path from "node:path";

import { productionEvidence } from "../lint.config";
import { repaintSelectionReviews } from "../repaintSelectionReviews";
import { inspectPublishedProxyBundle } from "./assertProxyBundle";
import { preserveProductionEncoderCleanup } from "./preserveProductionEncoderCleanup";
import {
  type IAutoMovieProductionRepaintSelection,
  productionRepaintInput,
  readProductionDialogueSynthesis,
  readProductionRenderTiers,
  readProductionRepaintSelection,
  readProductionSpeakerBindings,
} from "./productionConfiguration";
import { readAutoMovieProjectProductionId } from "./projectIdentity";
import { publishProxyBundle } from "./publishProxyBundle";
import {
  type IProductionRenderInvocationObservationState,
  createProductionRenderChunkCaptureRuntime,
  createProductionRenderChunkLeaseRuntime,
} from "./renderChunkRuntime";
import {
  publishRenderChunkSnapshot,
} from "./renderChunkSnapshot";
import {
  type IProductionRenderCommand,
  runProductionRenderCommand,
} from "./renderCommand";
import { createProductionRenderGarbageRuntime } from "./renderGcRuntime";
import {
  type IRenderGcTargetSnapshot,
  captureRenderGcTarget,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
  removeCapturedRenderGcTarget,
} from "./renderGcSnapshot";
import {
  type IProductionRenderHost,
  createNodeProductionRenderHost,
} from "./renderHost";
import {
  acquireRenderSessionLease,
  preserveRenderLivenessLease,
} from "./renderLiveness";
import {
  auditProductionRenderCapture,
  publishProductionMaskSidecar,
  summarizeProductionRenderObservations,
} from "./renderObservationAudit";
import { createProductionRenderPlanningRuntime } from "./renderPlanningRuntime";
import {
  createProductionRenderFinalizationRuntime,
  createProductionRenderPublicationRuntime,
  productionRenderPublicationFingerprint,
} from "./renderPublicationRuntime";
import {
  createProductionRenderEncoderRuntime,
  createProductionSoundRuntime,
} from "./renderSoundRuntime";
import {
  type IRenderChunkTemporaryTree,
  assertRenderChunkTemporaryTree,
  createRenderChunkTemporaryTree,
} from "./renderTemporarySnapshot";

const executeProductionRenderCommand = async (
  command: IProductionRenderCommand,
  renderHost: IProductionRenderHost,
): Promise<void> => {
  const root = renderHost.root;
  const productionId = readAutoMovieProjectProductionId(root);
  const authoringEvidence = readAutoMovieProductionEvidence({
    root,
    productionEvidence,
  });
  /** Every delivery decision this render obeys, read from its own design. */
  const design = AutoMovieProductionProject.productionDesign(
    root,
    productionId,
  );
  const renderTiers = readProductionRenderTiers(design?.renderTiers);
  const renderTier: IAutoMovieProductionRenderTier =
    command.tier === "proxy" ? renderTiers.proxy : renderTiers.final;
  const renderChunkFrames = command.chunkFrames;
  const productionSegment = encodeAutoMoviePathSegment(productionId);
  const renderLivenessScope = digestAutoMovieBytes(
    Buffer.from(
      JSON.stringify({
        protocol: "automovie.render-liveness.v1",
        productionId,
      }),
    ),
  ).slice(7);
  const productionStateRoot = path.join(
    root,
    "automovie",
    "productions",
    productionSegment,
  );
  const renderJobRoot = path.join(productionStateRoot, "render-job");
  const stateRoot = path.join(renderJobRoot, renderTier.kind);
  const planPath = path.join(stateRoot, "plan.json");
  /** Read every reviewed repaint choice before a render path can use it. */
  const productionRepaintSelection =
    (): IAutoMovieProductionRepaintSelection | null =>
      readProductionRepaintSelection(
        productionRepaintInput(design?.repaint, repaintSelectionReviews),
      );
  const renderObservations: IProductionRenderInvocationObservationState = {
    audits: [],
    maskSidecars: [],
  };

  const main = async (command: IProductionRenderCommand): Promise<void> => {
    const action = command.action;
    if (action === "gc") {
      output(gcRuntime.collect(command.apply));
      return;
    }
    if (action === "status") {
      await planningRuntime.reportStatus();
      return;
    }
    if (action === "verify") {
      await planningRuntime.verify();
      return;
    }
    const session = acquireRenderSessionLease({
      coordinationRoot: root,
      observeProcessOwner: renderHost.observeProcessOwner,
      owner: renderHost.owner,
      scope: renderLivenessScope,
      tier: renderTier.kind,
    });
    let sessionFailure: { error: unknown } | undefined;
    try {
      if (action === "finalize") {
        output(
          await finalizationRuntime.finalize(
            await planningRuntime.currentStoredPlan(),
          ),
        );
        return;
      }
      const current = await planningRuntime.currentPlan();
      const enforcedBudget = planningRuntime.enforceRenderBudget(current);
      const budget = enforcedBudget.summary;
      if (action === "plan") {
        output({
          ...current,
          budget,
          deliveryTone: planningRuntime.uncheckedDeliveryTone(
            "planning captures no review evidence, so no committed bundle states the sealed delivery curve",
          ),
        });
        return;
      }
      const deliveryTone =
        action === "all"
          ? (await planningRuntime.captureReviewEvidence()).deliveryTone
          : planningRuntime.uncheckedDeliveryTone(
              `the "${action}" action captures no review evidence, so no committed bundle states the sealed delivery curve`,
            );
      if (action === "run" || action === "all") {
        gcRuntime.recoverAbandonedTemporaryDirectories(current.chunks);
        gcRuntime.quarantineStaleSlotOutputs(current);
        const result = await runProductionRenderJob({
          plan: current,
          workers: command.workers,
          deliverable: command.deliverable,
          adapters: {
            current: (chunk) => planningRuntime.currentReceipt(current, chunk),
            acquire: chunkLease.acquire,
            render: (chunk) =>
              chunkCapture.render(current, chunk, enforcedBudget.reports),
            fail: chunkLease.fail,
            release: chunkLease.release,
          },
        });
        output({
          plan: {
            compileFingerprint: current.compileFingerprint,
            editFingerprint: current.editFingerprint,
            tier: current.tier,
          },
          budget,
          deliveryTone,
          capture: renderHost.captureMetrics(),
          observation: {
            ...summarizeProductionRenderObservations(renderObservations.audits),
            maskSidecars: [...renderObservations.maskSidecars].sort(
              (left, right) =>
                left.globalFrame - right.globalFrame ||
                compareCodeUnits(left.pass, right.pass) ||
                compareCodeUnits(left.shot, right.shot),
            ),
          },
          result,
          chunks: await planningRuntime.renderStatus(current),
        });
        if (result.failed.length !== 0 || result.busy.length !== 0)
          renderHost.setExitCode(1);
        if (
          action === "run" ||
          result.failed.length !== 0 ||
          result.busy.length !== 0
        )
          return;
      }
      output(await finalizationRuntime.finalize(current));
    } catch (error) {
      sessionFailure = { error };
      throw error;
    } finally {
      preserveRenderLivenessLease(sessionFailure, session);
    }
  };

  const writeRenderFile = (props: {
    bytes: Uint8Array;
    file: string;
    ownership: IRenderChunkTemporaryTree;
  }): IRenderGcTargetSnapshot => {
    if (path.dirname(path.resolve(props.file)) !== props.ownership.tree.path)
      throw new Error("Render chunk file changed declared parent.");
    assertRenderChunkTemporaryTree(props.ownership);
    const snapshot = createRenderGcFileSnapshot(
      props.ownership.tree.path,
      props.file,
      props.bytes,
    );
    if (
      snapshot.base.path !== props.ownership.tree.path ||
      snapshot.base.real !== props.ownership.tree.real ||
      snapshot.base.identity !== props.ownership.tree.identity
    )
      throw new Error("Render chunk file changed parent ownership.");
    assertRenderChunkTemporaryTree(props.ownership);
    return snapshot;
  };

  const readRendererJson = <T>(ownershipRoot: string, file: string): T =>
    JSON.parse(
      Buffer.from(
        readAutoMovieProductionOwnedFile({
          root: ownershipRoot,
          directory: path.dirname(file),
          relative: path.basename(file),
        }),
      ).toString("utf8"),
    ) as T;

  const compareCodeUnits = (left: string, right: string): number =>
    left < right ? -1 : left > right ? 1 : 0;

  const output = (value: unknown): void => {
    renderHost.stdout(`${JSON.stringify(value, null, 2)}\n`);
  };

  const renderProgress = (
    stage: string,
    details: Readonly<Record<string, number | string>> = {},
  ): void => {
    renderHost.stderr(
      `[automovie:render] ${JSON.stringify({ stage, ...details })}\n`,
    );
  };

  const soundRuntime = createProductionSoundRuntime({
    dialogueSelection: readProductionDialogueSynthesis(
      design?.sound?.dialogueSynthesis ?? null,
    ),
    host: renderHost,
    inspectChunk: (plan, chunk, pointer) =>
      planningRuntime.inspectChunkPublication(plan, chunk, pointer),
    liveWearableSoftBodies: design?.simulation?.liveWearableSoftBodies ?? [],
    productionStateRoot,
    progress: renderProgress,
    speakerBindings: readProductionSpeakerBindings(
      design?.sound?.speakerBindings ?? [],
    ),
  });
  const gcRuntime = createProductionRenderGarbageRuntime({
    captureTarget: captureRenderGcTarget,
    compareCodeUnits,
    finalTier: renderTiers.final,
    host: renderHost,
    productionId,
    productionStateRoot,
    proxyTier: renderTiers.proxy,
    readRendererJson,
    removeTarget: removeCapturedRenderGcTarget,
    renderJobRoot,
    renderLivenessScope,
    renderPublicationFingerprint: productionRenderPublicationFingerprint,
    renderTier,
    root,
    soundRuntime,
    sourceFingerprint: () => planningRuntime.sourceFingerprint(),
    stateRoot,
  });
  const planningRuntime = createProductionRenderPlanningRuntime({
    authoringEvidence,
    captureCurrentChunkPointer: gcRuntime.captureCurrentChunkPointer,
    compareCodeUnits,
    host: renderHost,
    output,
    planPath,
    productionId,
    productionSegment,
    renderChunkFrames,
    renderTier,
    root,
    soundRuntime,
    stateRoot,
  });
  const encoderRuntime = createProductionRenderEncoderRuntime({
    h264Generation: renderHost.h264Generation,
    mp4Generation: renderHost.mp4Generation,
    pngGeneration: renderHost.pngGeneration,
    preserveCleanup: preserveProductionEncoderCleanup,
    productionEncoderIdentity: planningRuntime.productionEncoderIdentity,
  });
  const publicationRuntime = createProductionRenderPublicationRuntime({
    assertCurrentEncoder: encoderRuntime.assertCurrent,
    currentChunk: planningRuntime.currentChunkPublication,
    ensureDirectory: ensureRenderPhysicalDirectory,
    filesystem: renderHost.filesystem,
    inspectProxy: inspectPublishedProxyBundle,
    publicationFingerprint: productionRenderPublicationFingerprint,
    publishProxyBundle,
  });
  const finalizationRuntime = createProductionRenderFinalizationRuntime({
    authoringEvidence,
    encoder: encoderRuntime,
    host: renderHost,
    planning: planningRuntime,
    productionId,
    progress: renderProgress,
    publication: publicationRuntime,
    repaintSelection: productionRepaintSelection,
    root,
    sound: soundRuntime,
  });
  const chunkLease = createProductionRenderChunkLeaseRuntime({
    captureExisting: gcRuntime.captureExistingRenderStateTarget,
    host: renderHost,
    quarantine: (target, reason, snapshot) =>
      gcRuntime.quarantine(target, reason, snapshot),
    readJson: gcRuntime.readCapturedRenderJson,
    remove: gcRuntime.removeOwnedChunkClaim,
    stateRoot,
  });
  const chunkCapture = createProductionRenderChunkCaptureRuntime({
    capture: renderHost.capture,
    captureCompleted: captureRenderGcTarget,
    createTemporary: createRenderChunkTemporaryTree,
    inspect: planningRuntime.inspectChunk,
    encode: (frames, plan) =>
      encoderRuntime.encodePngFrames((consumeFrame) => {
        for (const frame of frames) consumeFrame(frame);
      }, plan),
    lease: chunkLease,
    observations: {
      audit: auditProductionRenderCapture,
      publishMask: publishProductionMaskSidecar,
      state: renderObservations,
    },
    pngGeneration: renderHost.pngGeneration,
    owner: renderHost.owner,
    productionId,
    publication: {
      publish: publishRenderChunkSnapshot,
    },
    randomUuid: renderHost.randomUuid,
    renderLivenessScope,
    root,
    stateRoot,
    tier: renderTier.kind,
    write: writeRenderFile,
  });

  let renderFailure: { error: unknown } | undefined;
  try {
    await main(command);
  } catch (error) {
    renderFailure = { error };
    throw error;
  } finally {
    await renderHost.closeCapture(renderFailure);
  }
};

/** Run the Node-backed renderer through the shared raw-argument command seam. */
export const runProductionRenderWithHost = async (
  args: readonly string[],
  host: IProductionRenderHost,
): Promise<void> =>
  runProductionRenderCommand(args, (command) =>
    executeProductionRenderCommand(command, host),
  );

/** Run the actual generated CLI on the real Node production host. */
export const runNodeProductionRender = async (
  args: readonly string[],
): Promise<void> =>
  runProductionRenderWithHost(args, createNodeProductionRenderHost());
