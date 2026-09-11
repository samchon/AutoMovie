import {
  type AutoMovieProductionRenderArtifactStage,
  type AutoMovieProductionRenderArtifactState,
  type AutoMovieProductionRenderCleanupAuthority,
  type IAutoMovieProductionRenderChunk,
  type IAutoMovieProductionRenderChunkReceipt,
  type IAutoMovieProductionRenderJobPlan,
  productionRenderMaterializationDecision,
  verifyProductionRenderChunkReceipt,
} from "@automovie/production";

import {
  type ICurrentRenderChunkPublication,
  type loadCurrentRenderChunkPublication,
  renderChunkReceiptObservation,
} from "./renderChunkSnapshot";
import type { IRenderGcTargetSnapshot } from "./renderGcSnapshot";

export interface IProductionRenderChunkFinding {
  authority: AutoMovieProductionRenderCleanupAuthority;
  generation: string | null;
  reason: string;
  stage: AutoMovieProductionRenderArtifactStage;
  state: AutoMovieProductionRenderArtifactState;
  target: string;
}

export interface IProductionRenderChunkInspection {
  current: ICurrentRenderChunkPublication | null;
  finding: IProductionRenderChunkFinding;
  pointer: IRenderGcTargetSnapshot | null;
}

/**
 * Admit only proven absence or one exact current receipt to the scheduler.
 *
 * The scheduler reads `null` as "materialize this chunk", so every finding that
 * is neither absence nor a verified current publication has to leave through a
 * refusal: returning `null` for an unresolved resident generation would send it
 * to the render adapter and overwrite the evidence the finding preserves.
 */
export const productionRenderSchedulerReceipt = (
  inspection: IProductionRenderChunkInspection,
): IAutoMovieProductionRenderChunkReceipt | null => {
  const decision = productionRenderMaterializationDecision(
    inspection.finding.state,
  );
  if (decision === "render") return null;
  if (decision === "refuse") throw new Error(inspection.finding.reason);
  if (inspection.current === null)
    throw new Error(
      `Chunk inspection of "${inspection.finding.target}" reported a current publication without its verified receipt.`,
    );
  return inspection.current.receipt;
};

/** Capture and load seams behind one chunk publication inspection. */
export interface IProductionRenderChunkInspectionSeams {
  capturePointer: (
    chunk: IAutoMovieProductionRenderChunk,
  ) => IRenderGcTargetSnapshot | null;
  loadCurrent: typeof loadCurrentRenderChunkPublication;
  locatorState: (
    chunk: IAutoMovieProductionRenderChunk,
  ) => "absent" | "resident" | "unsafe" | "unavailable";
}

/**
 * Classify one chunk's project-root pointer into a typed artifact finding.
 *
 * Absence is the only finding that permits materialization, and a verified
 * current publication is the only one that permits reuse. A pointer that is
 * resident but cannot be captured, authenticated, verified against the current
 * plan, or probed as media stays in place under its own state so that status,
 * resume, render, and finalize all consume the same finding.
 */
export const inspectRenderChunkPublication = (props: {
  chunk: IAutoMovieProductionRenderChunk;
  plan: IAutoMovieProductionRenderJobPlan;
  pointer?: IRenderGcTargetSnapshot | null;
  seams: IProductionRenderChunkInspectionSeams;
}): IProductionRenderChunkInspection => {
  const { chunk, plan, seams } = props;
  const target = `${plan.tier.kind}/pointers/${chunk.id.slice(7)}`;
  let currentPointer: IRenderGcTargetSnapshot | null;
  try {
    currentPointer =
      props.pointer === undefined ? seams.capturePointer(chunk) : props.pointer;
  } catch {
    const locator = seams.locatorState(chunk);
    return {
      current: null,
      pointer: null,
      finding: {
        authority: "none",
        generation: null,
        reason:
          locator === "unsafe"
            ? `Chunk "${chunk.slot}" pointer locator is unsafe. Preserve it and manually adjudicate the locator before retrying.`
            : `Chunk "${chunk.slot}" pointer could not be inspected. Preserve it and manually adjudicate availability before retrying.`,
        stage: locator === "unsafe" ? "locator" : "capture",
        state: locator === "unsafe" ? "unsafe-locator" : "unavailable",
        target,
      },
    };
  }
  if (currentPointer === null)
    return {
      current: null,
      pointer: null,
      finding: {
        authority: "none",
        generation: null,
        reason: `Chunk "${chunk.slot}" has no publication pointer and may be rendered.`,
        stage: "absence",
        state: "absent",
        target,
      },
    };
  // The receipt gate reports through this holder rather than a captured `let`,
  // because control-flow narrowing would read the closure-assigned binding as
  // still null after the call.
  const receiptGate: {
    observation: ReturnType<typeof renderChunkReceiptObservation>;
  } = { observation: null };
  let current: ICurrentRenderChunkPublication | null;
  try {
    current = seams.loadCurrent({
      assertReceipt: (receipt) => {
        try {
          verifyProductionRenderChunkReceipt({ plan, chunk, receipt });
        } catch {
          receiptGate.observation = renderChunkReceiptObservation({
            expected: chunk,
            receipt,
            verified: false,
          });
        }
      },
      chunk,
      frameFormat: plan.frameFormat,
      pointer: currentPointer,
    });
  } catch {
    return {
      current: null,
      pointer: currentPointer,
      finding: {
        authority: "none",
        generation: currentPointer.targetIdentity,
        reason: `Chunk "${chunk.slot}" publication did not authenticate a readable receipt-bound generation. Preserve it for manual adjudication.`,
        stage: "receipt",
        state: "integrity-failed",
        target,
      },
    };
  }
  const receiptObservation = receiptGate.observation;
  if (receiptObservation !== null)
    return {
      current: null,
      pointer: currentPointer,
      finding: {
        authority: receiptObservation.authority,
        generation: currentPointer.targetIdentity,
        reason:
          receiptObservation.state === "verified-stale"
            ? `Chunk "${chunk.slot}" publication is an exact verified stale generation. Render cleanup may remove only this captured pointer.`
            : `Chunk "${chunk.slot}" current receipt contradicts its declared frame, media, or semantic inventory. Quarantine its exact captured publication before rerendering.`,
        stage: receiptObservation.stage,
        state: receiptObservation.state,
        target,
      },
    };
  if (current === null)
    return {
      current: null,
      pointer: currentPointer,
      finding: {
        authority: "exact-quarantine",
        generation: currentPointer.targetIdentity,
        reason: `Chunk "${chunk.slot}" bytes fail the declared PNG or MP4 media contract. Quarantine only this captured pointer before rerendering.`,
        stage: "media",
        state: "integrity-failed",
        target,
      },
    };
  return {
    current,
    pointer: currentPointer,
    finding: {
      authority: "none",
      generation: currentPointer.targetIdentity,
      reason: `Chunk "${chunk.slot}" publication is current and must be retained.`,
      stage: "currentness",
      state: "current",
      target,
    },
  };
};
