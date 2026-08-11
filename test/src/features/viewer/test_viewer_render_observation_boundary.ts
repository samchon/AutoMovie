import type {
  IAutoMovieRenderObservation,
  IAutoMovieRenderReport,
} from "@automovie/interface";
import { auditAutoMovieRenderObservation } from "@automovie/render";
import { observeAutoMovieRendererFrame } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import type * as THREE from "three";

/**
 * Renderer counters, rather than scene membership, own live render evidence.
 *
 * Scenarios:
 *
 * 1. Multiple render passes accumulate draw calls and triangles after one
 *    frame reset, and the renderer's reset policy is restored afterward.
 * 2. Dimensions the renderer cannot measure stay null and therefore unchecked.
 */
export const test_viewer_render_observation_boundary = (): void => {
  const render = { calls: 41, triangles: 99 };
  const info = {
    autoReset: true,
    render,
    reset: () => {
      render.calls = 0;
      render.triangles = 0;
    },
  };
  const renderer = { info } as unknown as THREE.WebGLRenderer;
  const frame = observeAutoMovieRendererFrame(renderer, () => {
    render.calls += 2;
    render.triangles += 12;
    render.calls += 1;
    render.triangles += 2;
    return "drawn";
  });
  TestValidator.equals("all passes are accumulated", frame, {
    output: "drawn",
    observed: {
      meshes: null,
      drawCalls: 3,
      triangles: 14,
      materials: null,
      textures: null,
      lights: null,
      shadowMaps: null,
      instanceSlots: null,
    },
  });
  TestValidator.equals(
    "renderer reset policy is restored",
    info.autoReset,
    true,
  );
  let refused = false;
  try {
    observeAutoMovieRendererFrame(renderer, () => {
      throw new Error("draw failed");
    });
  } catch {
    refused = true;
  }
  TestValidator.equals(
    "draw failures restore the reset policy",
    {
      refused,
      autoReset: info.autoReset,
    },
    {
      refused: true,
      autoReset: true,
    },
  );

  const report: IAutoMovieRenderReport = {
    version: 1,
    protocol: "automovie.render-report.v1",
    tier: "boundary-test",
    status: "within",
    findings: ["triangles", "drawCalls"].map((metric) => ({
      metric: metric as "triangles" | "drawCalls",
      status: "within" as const,
      measured: metric === "triangles" ? 14 : 3,
      limit: 14,
      excess: 0,
      contributors: [],
      omittedContributors: 0,
      omittedCost: 0,
      recovery: null,
    })),
    mask: "sha256:mask",
    target: {
      protocol: "automovie.render-target.v1",
      renderer: { api: "test", vendor: "test", device: "test" },
      settings: {
        width: 1,
        height: 1,
        pixelRatio: 1,
        shadows: false,
        shadowType: "none",
        toneMapping: "none",
        exposure: 1,
      },
      assets: [],
      digest: "sha256:target",
    },
    digest: "sha256:report",
  };
  TestValidator.equals(
    "unobservable metrics cannot claim agreement",
    auditAutoMovieRenderObservation({
      report,
      observed: frame.observed as IAutoMovieRenderObservation,
    }),
    {
      agrees: false,
      breaches: [],
      unchecked: [
        "materials",
        "textures",
        "lights",
        "shadowMaps",
        "instanceSlots",
      ],
    },
  );
};
