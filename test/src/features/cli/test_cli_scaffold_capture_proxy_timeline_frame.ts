import type { IAutoMovieProductionRenderJobPlan } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

const { productionRenderFrameCaptureInput } = loadSourceModule<{
  productionRenderFrameCaptureInput: (
    props: ParametersProductionRenderFrameCaptureInput,
  ) => unknown;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/renderFrameCaptureInput.ts",
  ),
);

type ParametersProductionRenderFrameCaptureInput = {
  root: string;
  productionId: string;
  plan: IAutoMovieProductionRenderJobPlan;
  shot: string;
  sourceFrame: number;
  sourceFps: number;
  sample: { timelineFrame: number };
  pass: "pose" | "depth" | "id";
};

/**
 * Validate that proxy capture dialogue uses the sampled film clock.
 *
 * Scenarios:
 * 1. Sparse proxy output frame 3 may sample film frame 12 while preserving its
 *    source-shot time and production crop.
 * 2. The capture request publishes timeline frame 12 as the dialogue clock;
 *    output slot 3 never leaks into the renderer's global-frame input.
 */
export const test_cli_scaffold_capture_proxy_timeline_frame = (): void => {
  const request = productionRenderFrameCaptureInput({
    root: "C:/project",
    productionId: "film",
    plan: {
      compileFingerprint: "sha256:plan",
      frameFormat: {
        width: 1_920,
        height: 1_080,
        fps: 24,
        colorSpace: "srgb",
        crop: { left: 0.1, top: 0.2, right: 0.8, bottom: 0.8 },
      },
    } as unknown as IAutoMovieProductionRenderJobPlan,
    shot: "shot-a",
    sourceFrame: 6,
    sourceFps: 12,
    sample: { timelineFrame: 12 },
    pass: "pose",
  });
  TestValidator.equals(
    "capture dialogue is keyed by sampled film frame instead of proxy slot",
    request,
    {
      projectRoot: "C:/project",
      productionId: "film",
      compileFingerprint: "sha256:plan",
      target: { kind: "shot", id: "shot-a" },
      time: 0.5,
      globalFrame: 12,
      pass: "pose",
      width: 1_920,
      height: 1_080,
      crop: { left: 0.1, top: 0.2, right: 0.8, bottom: 0.8 },
    },
  );
  TestValidator.equals(
    "an uncropped request preserves the same sampled-frame clock",
    productionRenderFrameCaptureInput({
      root: "C:/project",
      productionId: "film",
      plan: {
        compileFingerprint: "sha256:plan",
        frameFormat: {
          width: 640,
          height: 360,
          fps: 24,
          colorSpace: "srgb",
        },
      } as unknown as IAutoMovieProductionRenderJobPlan,
      shot: "shot-b",
      sourceFrame: 0,
      sourceFps: 24,
      sample: { timelineFrame: 0 },
      pass: "depth",
    }),
    {
      projectRoot: "C:/project",
      productionId: "film",
      compileFingerprint: "sha256:plan",
      target: { kind: "shot", id: "shot-b" },
      time: 0,
      globalFrame: 0,
      pass: "depth",
      width: 640,
      height: 360,
      crop: undefined,
    },
  );
};
