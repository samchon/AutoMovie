import type { AutoMovieGuidePass } from "@automovie/interface";
import type { IAutoMovieProductionRenderJobPlan } from "@automovie/production";

import type { IProductionRenderHost } from "./renderHost";

/**
 * Build the one shot-frame request shared by chunk and preview publication.
 *
 * Keeping the delivery window here makes the production plan's projection an
 * inseparable part of both capture paths instead of two look-alike object
 * literals that can drift independently.
 */
export const productionRenderFrameCaptureInput = (props: {
  root: string;
  productionId: string;
  plan: IAutoMovieProductionRenderJobPlan;
  shot: string;
  sourceFrame: number;
  sourceFps: number;
  globalFrame: number;
  pass: AutoMovieGuidePass;
}): Parameters<IProductionRenderHost["capture"]>[0] => ({
  projectRoot: props.root,
  productionId: props.productionId,
  compileFingerprint: props.plan.compileFingerprint,
  target: { kind: "shot", id: props.shot },
  time: props.sourceFrame / props.sourceFps,
  globalFrame: props.globalFrame,
  pass: props.pass,
  width: props.plan.frameFormat.width,
  height: props.plan.frameFormat.height,
  crop:
    props.plan.frameFormat.crop === undefined
      ? undefined
      : { ...props.plan.frameFormat.crop },
});
