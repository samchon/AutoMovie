import { IAutoMovieScene, IAutoMovieVector3 } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpGeometryContext,
  IAutoMovieMcpMotion,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  IDENTITY_TRANSFORM,
  createSkeleton,
  keyframe,
  makePose,
} from "../internal/fixtures";
import { nclose, throwsError, vclose } from "../internal/predicates";

const app = new AutoMovieApplication();
const skeleton = createSkeleton();

const transform = (translation: IAutoMovieVector3) => ({
  ...IDENTITY_TRANSFORM,
  translation,
});

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "actor",
      model: "actor-model",
      transform: transform({ x: 1, y: 0, z: 2 }),
      motion: null,
      pose: null,
    },
    {
      id: "marker",
      model: "prop-model",
      transform: transform({ x: 4, y: 0, z: 2 }),
      motion: null,
      pose: null,
    },
  ],
  cameras: [],
  lights: [],
};

const motion: IAutoMovieMcpMotion = {
  id: "motion-1",
  skeleton: skeleton.id,
  duration: 1,
  loop: false,
  keyframes: [
    { ...keyframe(0, makePose([])), bezier: null },
    {
      ...keyframe(1, makePose([], transform({ x: 0.5, y: 0, z: 0 }))),
      bezier: null,
    },
  ],
};

const context: IAutoMovieMcpGeometryContext = {
  scene,
  models: [
    { id: "actor-model", skeleton },
    { id: "prop-model", skeleton: null },
  ],
  motions: { actor: motion },
  shot: {
    id: "shot-1",
    name: null,
    scene: scene.id,
    camera: "camera",
    cameraMotion: null,
    performances: [{ node: "actor", motion: motion.id, startOffset: 0 }],
    objectMotions: [],
    duration: 1,
  },
};

/**
 * MCP geometry query tools expose the spatial facts an agent needs before it
 * commits the next action.
 *
 * Scenarios:
 *
 * 1. `measureDistance` resolves node, point, and group targets through staged
 *    scene coordinates, while relative targets return null.
 * 2. `getResolvedPose` samples an MCP-safe motion and returns bone positions in
 *    scene world space.
 * 3. `getReach` reports per-arm reach distance, gap, and IK pose against a
 *    positional target.
 * 4. Ambiguous duplicate geometry state rejects before the agent can trust the
 *    wrong node or model.
 */
export const test_mcp_geometry_query_tools = (): void => {
  const nodeDistance = app.measureDistance({
    scene,
    from: { kind: "node", node: "actor" },
    to: { kind: "node", node: "marker" },
  }).measurement;
  TestValidator.predicate(
    "node distance",
    nodeDistance !== null && nclose(nodeDistance.distance, 3),
  );

  const groupDistance = app.measureDistance({
    scene,
    from: { kind: "group", nodes: ["actor", "marker"] },
    to: { kind: "point", point: { x: 2.5, y: 0, z: 4 } },
  }).measurement;
  TestValidator.predicate(
    "group centroid distance",
    groupDistance !== null && nclose(groupDistance.distance, 2),
  );
  TestValidator.equals(
    "relative target is not measurable",
    app.measureDistance({
      scene,
      from: { kind: "direction", headingDeg: 90 },
      to: { kind: "node", node: "actor" },
    }).measurement,
    null,
  );

  const resolved = app.getResolvedPose({
    context,
    actor: "actor",
    t: 1,
  }).resolvedPose;
  const hips = resolved?.bones.find((bone) => bone.bone === "hips");
  TestValidator.predicate(
    "sampled pose root reaches world space",
    hips !== undefined && vclose(hips.worldPosition, { x: 1.5, y: 1, z: 2 }),
  );
  TestValidator.equals(
    "missing actor pose",
    app.getResolvedPose({ context, actor: "missing" }).resolvedPose,
    null,
  );

  const reach = app.getReach({
    context,
    actor: "actor",
    target: { kind: "point", point: { x: 1.4, y: 1, z: 2.3 } },
  }).reach;
  TestValidator.predicate(
    "left arm reaches target",
    reach !== null &&
      reach.reachable &&
      reach.left !== null &&
      reach.left.pose !== null &&
      nclose(reach.left.maximumDistance, 0.55) &&
      nclose(reach.left.gap, 0) &&
      reach.right === null,
  );

  const farReach = app.getReach({
    context,
    actor: "actor",
    target: { kind: "point", point: { x: 2.4, y: 1.4, z: 2 } },
  }).reach;
  TestValidator.predicate(
    "far target reports positive gap",
    farReach !== null &&
      farReach.left !== null &&
      !farReach.reachable &&
      nclose(farReach.left.gap, 0.65, 1e-6),
  );
  TestValidator.equals(
    "relative reach target is null",
    app.getReach({
      context,
      actor: "actor",
      target: { kind: "offscreen", edge: "left" },
    }).reach,
    null,
  );

  TestValidator.predicate(
    "duplicate node rejects",
    throwsError(
      () =>
        app.measureDistance({
          scene: { ...scene, nodes: [...scene.nodes, scene.nodes[0]!] },
          from: { kind: "node", node: "actor" },
          to: { kind: "node", node: "marker" },
        }),
      ['scene node "actor"', "scene.nodes[2].id"],
    ),
  );
  TestValidator.predicate(
    "duplicate model rejects",
    throwsError(
      () =>
        app.getResolvedPose({
          context: {
            ...context,
            models: [...context.models, context.models[0]!],
          },
          actor: "actor",
        }),
      ['geometry model "actor-model"', "context.models[2].id"],
    ),
  );
};
