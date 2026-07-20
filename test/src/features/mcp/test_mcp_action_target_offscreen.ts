import { IAutoMovieScene } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";

const app = new AutoMovieApplication();

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "marker",
      model: "prop-model",
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
  ],
  cameras: [
    {
      id: "camera",
      transform: IDENTITY_TRANSFORM,
      fovY: 45,
      near: 0.1,
      far: 100,
    },
  ],
  lights: [],
};

/**
 * Offscreen action targets are RELATIVE (a frame edge, not a point), so the
 * geometry queries answer a diagnosing reason instead of inventing a position
 * (#994 discipline, #1040 coverage): `isRuntimeSafeActionTarget` recognizes all
 * four frame edges, and the engine's `resolveTargetPoint` deliberately resolves
 * them to `null`.
 *
 * Scenarios:
 *
 * 1. Every valid edge (left/right/forward/back) is recognized and answers the
 *    relative-kind reason naming that kind: none leaks a fabricated point.
 * 2. Negative twin: an unknown edge ("up") is not a runtime-safe target and
 *    likewise answers a reason, never a distance.
 */
export const test_mcp_action_target_offscreen = (): void => {
  // 1. all four edges: recognized, relative, reasoned
  for (const edge of ["left", "right", "forward", "back"] as const) {
    const output = app.measureDistance({
      scene,
      from: { kind: "node", node: "marker" },
      to: { kind: "offscreen", edge },
    });
    TestValidator.predicate(
      `offscreen edge "${edge}" answers the relative-kind reason`,
      output.measurement === null &&
        (output.reason ?? "").includes(
          'a target of kind "offscreen" is relative',
        ),
    );
  }

  // 2. negative twin: an unknown edge is refused the same honest way
  const unknown = app.measureDistance({
    scene,
    from: { kind: "node", node: "marker" },
    to: { kind: "offscreen", edge: "up" } as never,
  });
  TestValidator.predicate(
    "an unknown offscreen edge never yields a distance",
    unknown.measurement === null && unknown.reason !== null,
  );
};
