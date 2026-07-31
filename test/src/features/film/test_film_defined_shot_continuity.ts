import {
  IAutoMovieActorContext,
  compileDefinedShot,
  defineShot,
  makeActorSynthesizer,
} from "@automovie/engine";
import {
  IAutoMovieBeatEndState,
  IAutoMovieGait,
  IAutoMovieShotProgram,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, joint, makePose } from "../internal/fixtures";

const WALK: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [
    {
      bone: "leftUpperLeg",
      phase: 0,
      duty: 0.7,
      amplitude: 12,
    },
  ],
};

/**
 * A second registered shot resumes every beat-end channel as live input.
 *
 * The prior root/facing/pose/mount become the staged opening, gait phase seeds
 * the next cycle, horizontal root velocity becomes the auto-locomotion speed,
 * and a stance beginning at frame zero reuses the prior world foot pin.
 */
export const test_film_defined_shot_continuity = (): void => {
  const rig = createSkeleton();
  rig.bones.push({
    bone: "leftFoot",
    parent: "leftLowerLeg",
    rest: {
      translation: { x: 0, y: -0.5, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    constraint: null,
  });
  const stage = makeStagingWrite();
  const program: IAutoMovieShotProgram = {
    actors: [{ node: "knightA", model: "knightA", speed: 0.5, eyeHeight: 1.6 }],
    script: makeScriptWrite(),
    stage,
    blocking: makeBlockingWrite({
      actors: [
        { node: "knightA", beats: "continues the established walk" },
        { node: "knightB", beats: "rides the established mount" },
      ],
      duration: 2,
    }),
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "locomote",
          actor: "knightA",
          start: 0,
          duration: "auto",
          gait: "walk",
          to: { kind: "point", point: { x: 3, y: 0, z: 8 } },
        },
        {
          verb: "frame",
          actor: "cam-main",
          start: 0,
          duration: "auto",
          framing: "medium",
          move: "static",
          on: { kind: "node", node: "knightA" },
        },
      ],
      revise: { review: "The carried stride remains continuous.", final: null },
      duration: 2,
    }),
    eventSamples: [],
  };
  const priorPose = makePose([joint("leftLowerArm", { flexion: 30 })]);
  const previous: IAutoMovieBeatEndState = {
    beat: "prior-beat",
    shot: "prior-shot",
    actors: [
      {
        node: "knightA",
        transform: {
          translation: { x: 3, y: 0, z: 4 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        facing: { x: 0, y: 0, z: 1 },
        pose: priorPose,
        motion: "prior-walk",
        localTime: 0.4,
        gaitPhase: 0.4,
        rootVelocity: { x: 0, y: 0, z: 2 },
        footPlants: [
          {
            foot: "leftFoot",
            start: 0,
            end: 1,
            position: { x: 3.1, y: 0, z: 4 },
          },
        ],
        mount: null,
      },
      {
        node: "knightB",
        transform: {
          translation: { x: 0, y: 0, z: 0.7 },
          rotation: { x: 0, y: 1, z: 0, w: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        facing: { x: 0, y: 0, z: -1 },
        pose: null,
        motion: null,
        localTime: 2,
        gaitPhase: null,
        rootVelocity: null,
        footPlants: null,
        mount: { parent: "knightA", bone: "hips" },
      },
    ],
  };
  const contexts = new Map<string, IAutoMovieActorContext>([
    [
      "knightA",
      {
        skeleton: rig.id,
        rig,
        gaits: [WALK],
        position: stage.actors[0]!.position,
        speed: 0.5,
        facingDeg: stage.actors[0]!.facingDeg,
        eyeHeight: 1.6,
        restPose: makePose([]),
      },
    ],
  ]);
  const nodes = new Map<string, IAutoMovieVector3>([
    ...stage.actors.map((actor) => [actor.node, actor.position] as const),
    ...stage.cameras.map((camera) => [camera.node, camera.position] as const),
  ]);
  const shot = defineShot("SB-CONTINUITY", {
    scene: "scene-duel",
    contract: {
      beat: "beat-1",
      durationSeconds: 2,
      participants: [{ kind: "actor", id: "knightA" }],
      opening: [],
      closing: [],
      camera: {
        intent: "Keep the continuing walker readable.",
        requiredSubjects: ["knightA"],
        maxOcclusionRatio: 0.2,
      },
      events: [],
      reviewFrames: [{ id: "middle", time: 1, passes: ["beauty"] }],
    },
    build: () => program,
  });
  const compiled = compileDefinedShot({
    shot,
    context: undefined,
    runtime: {
      synthesize: makeActorSynthesizer(contexts, nodes),
      skeleton: (node) =>
        node === "knightA" || node === "knightB" ? rig : null,
      hasActorContext: (node) => node === "knightA",
      gaits: (node) => (node === "knightA" ? ["walk"] : undefined),
      frameFormat: { width: 1920, height: 1080 },
      previous,
    },
  });
  TestValidator.predicate(
    "all prior simulation channels reach the next compiled opening",
    compiled.success &&
      compiled.source.scene.nodes.find((node) => node.id === "knightA")
        ?.transform.translation.x === 3 &&
      compiled.source.scene.nodes
        .find((node) => node.id === "knightA")
        ?.pose?.joints.some(
          (entry) => entry.bone === "leftLowerArm" && entry.flexion === 30,
        ) === true &&
      compiled.source.motions[0]?.duration === 2 &&
      compiled.source.motions[0]?.gaitCycle?.phaseAt === 0.4 &&
      compiled.continuity.opening.actors.find(
        (actor) => actor.node === "knightA",
      )?.rootVelocity?.z === 2 &&
      compiled.continuity.opening.actors.find(
        (actor) => actor.node === "knightA",
      )?.footPlants?.[0]?.position.x === 3.1 &&
      compiled.continuity.closing.actors.find(
        (actor) => actor.node === "knightB",
      )?.mount?.parent === "knightA",
  );
};
