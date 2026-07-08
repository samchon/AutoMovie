import {
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieShot,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpGeometryContext,
  IAutoMovieMcpMotion,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
  cameras: [
    {
      id: "camera",
      transform: transform({ x: 0, y: 1.5, z: 5 }),
      fovY: 45,
      near: 0.1,
      far: 100,
    },
  ],
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

const script: IAutoMovieScript = {
  logline: "an actor reaches toward a marker",
  theme: "measure before moving",
  cast: [{ node: "actor", character: "the measured actor", modelRef: null }],
  beats: [
    {
      id: "beat-1",
      name: "the reach",
      summary: "the actor shifts toward the marker",
      durationHint: 1,
    },
  ],
};

const residentShot: IAutoMovieShot = {
  ...context.shot!,
  id: "shot:beat-1",
  scene: scene.id,
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
 * 4. Resident project queries may omit explicit context after commitScene and
 *    commitShot supplied the session-only model/motion payloads; a reopened
 *    project explains that those rig payloads are not persisted.
 * 5. A resident project with parseable but invalid `scene.json` reports a
 *    project-state repair error naming the file before geometry helpers run.
 * 6. Ambiguous duplicate geometry state rejects before the agent can trust the
 *    wrong node or model.
 * 7. Malformed geometry motion registries reject with `context.motions...` paths
 *    instead of leaking wrapper TypeErrors.
 * 8. Malformed query targets resolve to null instead of leaking target-shape
 *    TypeErrors.
 * 9. Malformed explicit geometry collections reject with path-bearing errors
 *    before helper array iteration.
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
  TestValidator.equals(
    "malformed distance source is null",
    app.measureDistance({
      scene,
      from: { kind: "group", nodes: null } as never,
      to: { kind: "node", node: "actor" },
    }).measurement,
    null,
  );
  TestValidator.equals(
    "malformed distance target is null",
    app.measureDistance({
      scene,
      from: { kind: "node", node: "actor" },
      to: null as never,
    }).measurement,
    null,
  );
  TestValidator.predicate(
    "malformed distance scene rejects",
    throwsError(
      () =>
        app.measureDistance({
          scene: null as unknown as IAutoMovieScene,
          from: { kind: "node", node: "actor" },
          to: { kind: "node", node: "marker" },
        }),
      ["scene", "JSON object"],
    ),
  );
  TestValidator.predicate(
    "malformed distance scene nodes reject",
    throwsError(
      () =>
        app.measureDistance({
          scene: {
            ...scene,
            nodes: null as unknown as IAutoMovieScene["nodes"],
          },
          from: { kind: "node", node: "actor" },
          to: { kind: "node", node: "marker" },
        }),
      ["scene.nodes", "array"],
    ),
  );
  TestValidator.predicate(
    "malformed distance scene node transform rejects",
    throwsError(
      () =>
        app.measureDistance({
          scene: {
            ...scene,
            nodes: [
              {
                ...scene.nodes[0]!,
                transform:
                  null as unknown as IAutoMovieScene["nodes"][number]["transform"],
              },
              scene.nodes[1]!,
            ],
          },
          from: { kind: "node", node: "actor" },
          to: { kind: "node", node: "marker" },
        }),
      ["scene.nodes[0].transform", "JSON object"],
    ),
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
  TestValidator.predicate(
    "malformed pose context scene nodes reject",
    throwsError(
      () =>
        app.getResolvedPose({
          context: {
            ...context,
            scene: {
              ...scene,
              nodes: null as unknown as IAutoMovieScene["nodes"],
            },
          },
          actor: "actor",
        }),
      ["context.scene.nodes", "array"],
    ),
  );
  TestValidator.predicate(
    "malformed pose context models reject",
    throwsError(
      () =>
        app.getResolvedPose({
          context: {
            ...context,
            models: null as unknown as IAutoMovieMcpGeometryContext["models"],
          },
          actor: "actor",
        }),
      ["context.models", "array"],
    ),
  );
  TestValidator.predicate(
    "malformed pose context model entry rejects",
    throwsError(
      () =>
        app.getResolvedPose({
          context: {
            ...context,
            models: [
              null as unknown as IAutoMovieMcpGeometryContext["models"][number],
            ],
          },
          actor: "actor",
        }),
      ["context.models[0]", "JSON object"],
    ),
  );
  TestValidator.predicate(
    "malformed pose context model skeleton rejects",
    throwsError(
      () =>
        app.getResolvedPose({
          context: {
            ...context,
            models: [
              {
                ...context.models[0]!,
                skeleton: {
                  ...skeleton,
                  bones: null as unknown as NonNullable<
                    IAutoMovieMcpGeometryContext["models"][number]["skeleton"]
                  >["bones"],
                },
              },
              context.models[1]!,
            ],
          },
          actor: "actor",
        }),
      ["context.models[0].skeleton.bones", "array"],
    ),
  );
  TestValidator.predicate(
    "malformed pose shot performances reject",
    throwsError(
      () =>
        app.getResolvedPose({
          context: {
            ...context,
            shot: {
              ...context.shot!,
              performances: null as unknown as IAutoMovieShot["performances"],
            },
          },
          actor: "actor",
        }),
      ["context.shot.performances", "array"],
    ),
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
  TestValidator.equals(
    "malformed reach target is null",
    app.getReach({
      context,
      actor: "actor",
      target: null as never,
    }).reach,
    null,
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-geometry-"));
  try {
    const resident = new AutoMovieApplication();
    resident.openProject({ root });
    resident.commitScript({ script });
    resident.commitScene({ scene, models: context.models });
    resident.commitShot({ shot: residentShot, motions: context.motions });

    const residentDistance = resident.measureDistance({
      from: { kind: "node", node: "actor" },
      to: { kind: "node", node: "marker" },
    }).measurement;
    TestValidator.predicate(
      "resident distance reads committed scene",
      residentDistance !== null && nclose(residentDistance.distance, 3),
    );

    const residentPose = resident.getResolvedPose({
      actor: "actor",
      beat: "beat-1",
      t: 1,
    }).resolvedPose;
    const residentHips = residentPose?.bones.find(
      (bone) => bone.bone === "hips",
    );
    TestValidator.predicate(
      "resident pose samples remembered motion registry",
      residentHips !== undefined &&
        vclose(residentHips.worldPosition, { x: 1.5, y: 1, z: 2 }),
    );

    const residentReach = resident.getReach({
      actor: "actor",
      target: { kind: "point", point: { x: 1.4, y: 1, z: 2.3 } },
    }).reach;
    TestValidator.predicate(
      "resident reach uses remembered model skeletons",
      residentReach !== null &&
        residentReach.reachable &&
        residentReach.left !== null &&
        nclose(residentReach.left.gap, 0),
    );

    const reopened = new AutoMovieApplication({ projectRoot: root });
    TestValidator.predicate(
      "reopened rig query explains session-only models",
      throwsError(
        () =>
          reopened.getReach({
            actor: "actor",
            target: { kind: "point", point: { x: 1.4, y: 1, z: 2.3 } },
          }),
        ["commitScene with models", "context explicitly"],
      ),
    );

    const corruptScene = {
      ...scene,
      nodes: [...scene.nodes, scene.nodes[0]!],
    };
    fs.writeFileSync(
      path.join(root, "scene.json"),
      `${JSON.stringify(corruptScene, null, 2)}\n`,
    );
    const sceneFileError = [
      "AutoMovie project file",
      "scene.json",
      "Fix or remove",
      'scene node id "actor" must be unique',
    ];
    TestValidator.predicate(
      "resident distance corrupt scene has project guidance",
      throwsError(
        () =>
          resident.measureDistance({
            from: { kind: "node", node: "actor" },
            to: { kind: "node", node: "marker" },
          }),
        sceneFileError,
      ),
    );
    TestValidator.predicate(
      "resident reach corrupt scene has project guidance",
      throwsError(
        () =>
          resident.getReach({
            actor: "actor",
            target: { kind: "point", point: { x: 1.4, y: 1, z: 2.3 } },
          }),
        sceneFileError,
      ),
    );
    TestValidator.predicate(
      "resident pose corrupt scene has project guidance",
      throwsError(
        () => resident.getResolvedPose({ actor: "actor", beat: "beat-1" }),
        sceneFileError,
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

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
  TestValidator.predicate(
    "malformed motion registry rejects",
    throwsError(
      () =>
        app.getResolvedPose({
          context: {
            ...context,
            motions: null as unknown as Record<string, IAutoMovieMcpMotion>,
          },
          actor: "actor",
        }),
      ["motion registry", "context.motions"],
    ),
  );
  TestValidator.predicate(
    "malformed motion registry entry rejects",
    throwsError(
      () =>
        app.getResolvedPose({
          context: {
            ...context,
            motions: {
              actor: undefined,
            } as unknown as Record<string, IAutoMovieMcpMotion>,
          },
          actor: "actor",
        }),
      ["motion registry entry", "context.motions.actor"],
    ),
  );
  TestValidator.predicate(
    "malformed motion keyframes reject",
    throwsError(
      () =>
        app.getResolvedPose({
          context: {
            ...context,
            motions: {
              actor: {
                ...motion,
                keyframes: null as unknown as IAutoMovieMcpMotion["keyframes"],
              },
            },
          },
          actor: "actor",
        }),
      ["context.motions.actor.keyframes", "array"],
    ),
  );
};
