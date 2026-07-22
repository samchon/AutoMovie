import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  IAutoMovieActorContext,
  makeActorSynthesizer,
  resolvePose,
  sampleMotion,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMoviePose,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
  IAutoMovieMcpGeometryContext,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { throwsError, vclose } from "../internal/predicates";

type RestFrames = NonNullable<IAutoMovieActorContext["restFrames"]>;

const CUSTOM_FRAMES: RestFrames = {
  leftUpperArm: { abduction: { sign: -1, neutral: 30 } },
};

/** Add a model-space offset to the fixture's unrotated staged placement. */
const offset = (
  origin: IAutoMovieVector3,
  local: IAutoMovieVector3,
): IAutoMovieVector3 => ({
  x: origin.x + local.x,
  y: origin.y + local.y,
  z: origin.z + local.z,
});

/**
 * Geometry queries must read the same per-actor clinical frame as performance
 * and playback (#1377).
 *
 * The scenario persists one actor with a deliberately non-canonical shoulder
 * frame, then compares explicit context, reopened resident state, direct FK,
 * and the perform synthesizer. It also pins the two omission meanings: absent =
 * canonical humanoid, explicit `{}` = raw rig space.
 */
export const test_mcp_geometry_rest_frames = (): void => {
  const scriptWrite = makeScriptWrite();
  const stagedResult = new AutoMovieApplication().stage({
    script: scriptWrite,
    staging: makeStagingWrite(),
  }).staged;
  if (stagedResult.success !== true)
    throw new Error("staging fixture must succeed");
  const skeleton = createSkeleton();
  const actorNode = stagedResult.scene.nodes.find(
    (node) => node.id === "knightA",
  )!;
  const clinicalPose: IAutoMoviePose = makePose([
    joint("leftUpperArm", { abduction: 90 }),
  ]);
  const scene = {
    ...stagedResult.scene,
    nodes: stagedResult.scene.nodes.map((node) =>
      node.id === actorNode.id ? { ...node, pose: clinicalPose } : node,
    ),
  };
  const explicitContext: IAutoMovieMcpGeometryContext = {
    scene,
    models: [{ id: actorNode.model, skeleton }],
    motions: {},
    actorRestFrames: { [actorNode.id]: CUSTOM_FRAMES },
    shot: null,
  };
  const target = offset(actorNode.transform.translation, {
    x: 0.4,
    y: 1,
    z: 0.3,
  });
  const pointTarget = { kind: "point" as const, point: target };

  const explicit = new AutoMovieApplication();
  const explicitPose = explicit.getResolvedPose({
    context: explicitContext,
    actor: actorNode.id,
  }).resolvedPose!;
  const directHand = resolvePose(
    clinicalPose,
    skeleton,
    HUMANOID_JOINT_AXES,
    CUSTOM_FRAMES,
  ).find((bone) => bone.bone === "leftHand")!;
  const explicitHand = explicitPose.bones.find(
    (bone) => bone.bone === "leftHand",
  )!;
  TestValidator.predicate(
    "explicit geometry FK applies the actor's custom frame",
    vclose(
      explicitHand.worldPosition,
      offset(actorNode.transform.translation, directHand.worldPosition),
    ),
  );

  const explicitReach = explicit.getReach({
    context: explicitContext,
    actor: actorNode.id,
    target: pointTarget,
  }).reach!;
  const actorContext: IAutoMovieMcpActorContext & IAutoMovieActorContext = {
    skeleton: skeleton.id,
    gaits: [],
    position: actorNode.transform.translation,
    speed: 1,
    facingDeg: 0,
    eyeHeight: 1.6,
    restPose: clinicalPose,
    rig: skeleton,
    restFrames: CUSTOM_FRAMES,
  };
  const reachAction: IAutoMovieActionCall = {
    verb: "reach",
    actor: actorNode.id,
    start: 0,
    duration: 0.6,
    hand: "left",
    to: pointTarget,
  };
  const performed = makeActorSynthesizer(
    new Map([[actorNode.id, actorContext]]),
    new Map(),
  )(reachAction, actorNode.id)!;
  TestValidator.equals(
    "getReach returns the pose the perform synthesizer emits",
    explicitReach.left?.pose,
    sampleMotion(performed, performed.duration).pose,
  );

  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-geometry-frames-"),
  );
  try {
    const resident = new AutoMovieApplication({ projectRoot: root });
    resident.commitScript({
      script: {
        logline: scriptWrite.logline,
        theme: scriptWrite.theme,
        cast: scriptWrite.cast,
        beats: scriptWrite.beats,
      },
    });
    resident.commitScene({
      scene,
      models: [...new Set(scene.nodes.map((node) => node.model))].map((id) => ({
        id,
        skeleton: null,
      })),
    });
    const stored = resident.perform({
      performance: makePerformanceWrite({
        draft: [
          {
            verb: "hold",
            actor: actorNode.id,
            start: 0,
            duration: 1,
          },
        ],
      }),
      actors: { [actorNode.id]: actorContext },
    }).performed;
    TestValidator.equals(
      "the custom actor context persists",
      stored.success,
      true,
    );

    const reopened = new AutoMovieApplication({ projectRoot: root });
    TestValidator.equals(
      "reopened FK matches the explicit custom-frame context",
      reopened.getResolvedPose({ actor: actorNode.id }).resolvedPose,
      explicitPose,
    );
    TestValidator.equals(
      "reopened reach matches the explicit custom-frame context",
      reopened.getReach({ actor: actorNode.id, target: pointTarget }).reach,
      explicitReach,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  const canonical = explicit.getResolvedPose({
    context: { ...explicitContext, actorRestFrames: undefined },
    actor: actorNode.id,
  }).resolvedPose!;
  const canonicalHand = resolvePose(
    clinicalPose,
    skeleton,
    HUMANOID_JOINT_AXES,
    HUMANOID_REST_FRAME,
  ).find((bone) => bone.bone === "leftHand")!;
  TestValidator.predicate(
    "omitting frames keeps the canonical humanoid default",
    vclose(
      canonical.bones.find((bone) => bone.bone === "leftHand")!.worldPosition,
      offset(actorNode.transform.translation, canonicalHand.worldPosition),
    ),
  );
  const raw = explicit.getResolvedPose({
    context: {
      ...explicitContext,
      actorRestFrames: { [actorNode.id]: {} },
    },
    actor: actorNode.id,
  }).resolvedPose!;
  TestValidator.predicate(
    "an explicit empty table selects raw rig space",
    !vclose(
      raw.bones.find((bone) => bone.bone === "leftHand")!.worldPosition,
      canonical.bones.find((bone) => bone.bone === "leftHand")!.worldPosition,
    ),
  );
  TestValidator.predicate(
    "a malformed actor frame registry is refused at its explicit path",
    throwsError(
      () =>
        explicit.getResolvedPose({
          context: {
            ...explicitContext,
            actorRestFrames: null as never,
          },
          actor: actorNode.id,
        }),
      ["$input.context.actorRestFrames", "JSON object"],
    ),
  );
};
