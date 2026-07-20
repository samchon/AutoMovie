import {
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";
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
import { throwsError } from "../internal/predicates";

const app = new AutoMovieApplication();
const skeleton = createSkeleton();

const transform = (
  translation: IAutoMovieVector3,
  scale: IAutoMovieVector3 = { x: 1, y: 1, z: 1 },
) => ({
  ...IDENTITY_TRANSFORM,
  translation,
  scale,
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
    { ...keyframe(1, makePose([])), bezier: null },
  ],
};

const shot: IAutoMovieShot = {
  id: "shot-1",
  name: null,
  scene: scene.id,
  camera: "camera",
  cameraMotion: null,
  performances: [{ node: "actor", motion: motion.id, startOffset: 0 }],
  objectMotions: [],
  duration: 1,
};

const context: IAutoMovieMcpGeometryContext = {
  scene,
  models: [
    { id: "actor-model", skeleton },
    { id: "prop-model", skeleton: null },
  ],
  motions: { actor: motion },
  shot,
};

const pointTarget = { kind: "point", point: { x: 2, y: 0, z: 2 } } as const;

/** A humanoid whose left AND right arm chains are both fully measurable. */
const bothArmsSkeleton = (): IAutoMovieSkeleton => ({
  id: "skeleton-both",
  bones: [
    ...skeleton.bones,
    {
      bone: "rightHand",
      parent: "rightLowerArm",
      rest: {
        translation: { x: -0.25, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      constraint: null,
    },
  ],
});

/** A humanoid whose left arm bones coincide, so no arm length is measurable. */
const degenerateArmSkeleton = (): IAutoMovieSkeleton => {
  const zero = {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  };
  return {
    id: "skeleton-degenerate",
    bones: [
      { bone: "hips", parent: null, rest: zero, constraint: null },
      { bone: "chest", parent: "hips", rest: zero, constraint: null },
      { bone: "leftUpperArm", parent: "chest", rest: zero, constraint: null },
      {
        bone: "leftLowerArm",
        parent: "leftUpperArm",
        rest: zero,
        constraint: null,
      },
      {
        bone: "leftHand",
        parent: "leftLowerArm",
        rest: zero,
        constraint: null,
      },
    ],
  };
};

const contextWith = (
  over: Partial<IAutoMovieMcpGeometryContext>,
): IAutoMovieMcpGeometryContext => ({ ...context, ...over });

/**
 * GeometryService query-edge and shape-guard branches the happy-path geometry
 * tools never reach (#1040 coverage): degenerate transforms and rigs answer a
 * diagnosing reason, ambiguous or dangling explicit collections reject with the
 * field path, and every nested malformed shape rejects before an engine helper
 * dereferences it.
 *
 * Scenarios:
 *
 * 1. `getReach` against an actor whose node scale is degenerate answers the
 *    "degenerate node scale" reason (the target cannot drop into model space).
 * 2. `getReach` against a rig whose only arm chain has zero-length bones answers
 *    "no measurable arm chain"; a both-arms rig past every arm's span reports
 *    an unreachable verdict from BOTH sides.
 * 3. `measureDistance` with BOTH targets relative pluralizes the not-positional
 *    reason ("targets are").
 * 4. A shot-less context resolves an actor's AMBIENT node motion (and, with an
 *    empty performance list, still falls back to it); a context with neither
 *    motion nor performance returns the rest pose.
 * 5. An explicit context whose actor places a model absent from the models list
 *    answers "not in the models list".
 * 6. Ambiguous duplicate node / performance / motion state rejects before the
 *    agent can trust the wrong entry.
 * 7. Every malformed nested shape (context root, shot, scene node, model skeleton,
 *    skeleton bone, shot performance, motion keyframe, keyframe pose, keyframe
 *    bezier, pose joint) rejects at its own `context...` path.
 * 8. A context with many malformed nodes summarizes the violation overflow ("+N
 *    more").
 */
export const test_mcp_geometry_query_edges = (): void => {
  // 1. degenerate node scale
  const degenerateScale = app.getReach({
    context: contextWith({
      scene: {
        ...scene,
        nodes: [
          {
            ...scene.nodes[0]!,
            transform: transform({ x: 1, y: 0, z: 2 }, { x: 1e-9, y: 1, z: 1 }),
          },
          scene.nodes[1]!,
        ],
      },
    }),
    actor: "actor",
    target: pointTarget,
  });
  TestValidator.predicate(
    "a degenerate node scale answers the model-space reason",
    degenerateScale.reach === null &&
      (degenerateScale.reason ?? "").includes("degenerate node scale"),
  );

  // 2. unmeasurable / both-arms reach
  const degenerateArm = app.getReach({
    context: contextWith({
      models: [
        { id: "actor-model", skeleton: degenerateArmSkeleton() },
        { id: "prop-model", skeleton: null },
      ],
    }),
    actor: "actor",
    target: pointTarget,
  });
  TestValidator.predicate(
    "a zero-length arm chain answers the no-measurable-arm reason",
    degenerateArm.reach === null &&
      (degenerateArm.reason ?? "").includes("no measurable arm chain"),
  );
  const bothArms = app.getReach({
    context: contextWith({
      models: [
        { id: "actor-model", skeleton: bothArmsSkeleton() },
        { id: "prop-model", skeleton: null },
      ],
    }),
    actor: "actor",
    target: { kind: "point", point: { x: 100, y: 100, z: 100 } },
  }).reach;
  TestValidator.predicate(
    "a both-arms rig past every span is unreachable from both sides",
    bothArms !== null &&
      bothArms.left !== null &&
      bothArms.right !== null &&
      !bothArms.reachable,
  );

  // 3. both targets relative
  TestValidator.predicate(
    "two relative targets pluralize the not-positional reason",
    (
      app.measureDistance({
        scene,
        from: { kind: "direction", headingDeg: 0 },
        to: { kind: "direction", headingDeg: 90 },
      }).reason ?? ""
    ).includes("targets are"),
  );

  // 4. ambient / rest-pose fallbacks
  const ambientScene: IAutoMovieScene = {
    ...scene,
    nodes: [{ ...scene.nodes[0]!, motion: motion.id }, scene.nodes[1]!],
  };
  const ambient = app.getResolvedPose({
    context: contextWith({ scene: ambientScene, shot: null }),
    actor: "actor",
    t: 0,
  }).resolvedPose;
  TestValidator.predicate(
    "a shot-less context samples the actor's ambient node motion",
    ambient !== null && ambient.motion === motion.id,
  );
  const ambientNoPerformance = app.getResolvedPose({
    context: contextWith({
      scene: ambientScene,
      shot: { ...shot, performances: [] },
    }),
    actor: "actor",
    t: 0,
  }).resolvedPose;
  TestValidator.predicate(
    "an empty performance list still falls back to the ambient node motion",
    ambientNoPerformance !== null && ambientNoPerformance.motion === motion.id,
  );
  const restPose = app.getResolvedPose({
    context: contextWith({ shot: null }),
    actor: "actor",
    t: 0,
  }).resolvedPose;
  TestValidator.predicate(
    "no motion and no performance returns the rest pose",
    restPose !== null && restPose.motion === null && restPose.bones.length > 0,
  );

  // 5. model absent from the list
  const missingModel = app.getResolvedPose({
    context: contextWith({ models: [{ id: "prop-model", skeleton: null }] }),
    actor: "actor",
  });
  TestValidator.predicate(
    "an actor placing an unlisted model answers not-in-the-models-list",
    missingModel.resolvedPose === null &&
      (missingModel.reason ?? "").includes("not in the models list"),
  );

  // 6. duplicate ambiguity
  TestValidator.predicate(
    "a duplicate scene node id rejects",
    throwsError(
      () =>
        app.getResolvedPose({
          context: contextWith({
            scene: { ...scene, nodes: [...scene.nodes, scene.nodes[0]!] },
          }),
          actor: "actor",
        }),
      ['scene node "actor" is duplicated', "$input.context.scene.nodes[2].id"],
    ),
  );
  TestValidator.predicate(
    "a duplicate shot performance rejects",
    throwsError(
      () =>
        app.getResolvedPose({
          context: contextWith({
            shot: {
              ...shot,
              performances: [shot.performances[0]!, shot.performances[0]!],
            },
          }),
          actor: "actor",
        }),
      [
        'shot performance for "actor" is duplicated',
        "$input.context.shot.performances[1].node",
      ],
    ),
  );
  TestValidator.predicate(
    "a duplicate motion id rejects",
    throwsError(
      () =>
        app.getResolvedPose({
          context: contextWith({
            motions: { actor: motion, echo: { ...motion } },
          }),
          actor: "actor",
        }),
      ['motion "motion-1" is duplicated', "$input.context.motions.echo.id"],
    ),
  );

  // 7. nested shape guards
  TestValidator.predicate(
    "a non-object context rejects at the context root",
    throwsError(
      () =>
        app.getResolvedPose({
          context: 7 as unknown as IAutoMovieMcpGeometryContext,
          actor: "actor",
        }),
      ["$input.context", "JSON object"],
    ),
  );
  TestValidator.predicate(
    "a non-object context shot rejects at the shot path",
    throwsError(
      () =>
        app.getResolvedPose({
          context: contextWith({
            shot: 7 as unknown as IAutoMovieMcpGeometryContext["shot"],
          }),
          actor: "actor",
        }),
      ["$input.context.shot", "JSON object"],
    ),
  );
  TestValidator.predicate(
    "a non-object scene node rejects at its index",
    throwsError(
      () =>
        app.getResolvedPose({
          context: contextWith({
            scene: {
              ...scene,
              nodes: [null] as unknown as IAutoMovieScene["nodes"],
            },
          }),
          actor: "actor",
        }),
      ["$input.context.scene.nodes[0]", "JSON object"],
    ),
  );
  TestValidator.predicate(
    "a non-object model skeleton rejects at the skeleton path",
    throwsError(
      () =>
        app.getResolvedPose({
          context: contextWith({
            models: [
              {
                id: "actor-model",
                skeleton: 7 as unknown as IAutoMovieSkeleton,
              },
              { id: "prop-model", skeleton: null },
            ],
          }),
          actor: "actor",
        }),
      ["$input.context.models[0].skeleton", "JSON object"],
    ),
  );
  TestValidator.predicate(
    "a non-object skeleton bone rejects at its index",
    throwsError(
      () =>
        app.getResolvedPose({
          context: contextWith({
            models: [
              {
                id: "actor-model",
                skeleton: {
                  ...skeleton,
                  bones: [null] as unknown as IAutoMovieSkeleton["bones"],
                },
              },
              { id: "prop-model", skeleton: null },
            ],
          }),
          actor: "actor",
        }),
      ["$input.context.models[0].skeleton.bones[0]", "JSON object"],
    ),
  );
  TestValidator.predicate(
    "a non-object shot performance rejects at its index",
    throwsError(
      () =>
        app.getResolvedPose({
          context: contextWith({
            shot: {
              ...shot,
              performances: [null] as unknown as IAutoMovieShot["performances"],
            },
          }),
          actor: "actor",
        }),
      ["$input.context.shot.performances[0]", "JSON object"],
    ),
  );
  TestValidator.predicate(
    "a non-object motion keyframe rejects at its index",
    throwsError(
      () =>
        app.getResolvedPose({
          context: contextWith({
            motions: {
              actor: {
                ...motion,
                keyframes: [
                  null,
                  motion.keyframes[1]!,
                ] as unknown as IAutoMovieMcpMotion["keyframes"],
              },
            },
          }),
          actor: "actor",
        }),
      ["$input.context.motions.actor.keyframes[0]", "JSON object"],
    ),
  );
  TestValidator.predicate(
    "a non-object motion keyframe pose rejects at its pose path",
    throwsError(
      () =>
        app.getResolvedPose({
          context: contextWith({
            motions: {
              actor: {
                ...motion,
                keyframes: [
                  {
                    ...motion.keyframes[0]!,
                    pose: 7 as unknown as IAutoMovieMcpMotion["keyframes"][number]["pose"],
                  },
                  motion.keyframes[1]!,
                ],
              },
            },
          }),
          actor: "actor",
        }),
      ["$input.context.motions.actor.keyframes[0].pose", "JSON object"],
    ),
  );
  TestValidator.predicate(
    "a non-object keyframe bezier rejects at its bezier path",
    throwsError(
      () =>
        app.getResolvedPose({
          context: contextWith({
            motions: {
              actor: {
                ...motion,
                keyframes: [
                  { ...motion.keyframes[0]!, bezier: 7 as never },
                  motion.keyframes[1]!,
                ],
              },
            },
          }),
          actor: "actor",
        }),
      ["$input.context.motions.actor.keyframes[0].bezier", "JSON object"],
    ),
  );
  TestValidator.predicate(
    "a non-object pose joint rejects at its index",
    throwsError(
      () =>
        app.getResolvedPose({
          context: contextWith({
            motions: {
              actor: {
                ...motion,
                keyframes: [
                  {
                    ...motion.keyframes[0]!,
                    pose: {
                      ...motion.keyframes[0]!.pose,
                      joints: [
                        null,
                      ] as unknown as IAutoMovieMcpMotion["keyframes"][number]["pose"]["joints"],
                    },
                  },
                  motion.keyframes[1]!,
                ],
              },
            },
          }),
          actor: "actor",
        }),
      [
        "$input.context.motions.actor.keyframes[0].pose.joints[0]",
        "JSON object",
      ],
    ),
  );

  // 8. violation overflow summary
  TestValidator.predicate(
    "many malformed nodes summarize the violation overflow",
    throwsError(
      () =>
        app.getResolvedPose({
          context: contextWith({
            scene: {
              ...scene,
              nodes: Array.from(
                { length: 6 },
                () => ({}) as unknown as IAutoMovieScene["nodes"][number],
              ),
            },
          }),
          actor: "actor",
        }),
      ["more"],
    ),
  );

  // action-target: an unknown target kind is not runtime-safe and resolves null.
  TestValidator.predicate(
    "an unknown action-target kind is refused by that kind",
    (() => {
      const output = app.measureDistance({
        scene,
        from: { kind: "mystery" } as never,
        to: { kind: "node", node: "marker" },
      });
      return (
        output.measurement === null &&
        (output.reason ?? "").includes(
          '"mystery" is not a positional target kind',
        )
      );
    })(),
  );
};
