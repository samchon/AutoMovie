import {
  IAutoMovieActorContext,
  Quaternion,
  Vector3,
  compileDefinedShot,
  defineShot,
  makeActorSynthesizer,
  resolvePose,
  sampleMotion,
} from "@automovie/engine";
import {
  IAutoMovieBeatEndState,
  IAutoMovieDefinedShotContract,
  IAutoMovieGait,
  IAutoMovieShotProgram,
  IAutoMovieSkeleton,
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
import { vclose } from "../internal/predicates";

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

const walkingProgram = (
  stage: ReturnType<typeof makeStagingWrite>,
  target: IAutoMovieVector3,
  speed: number,
  duration: number | "auto",
): IAutoMovieShotProgram => ({
  actors: [{ node: "knightA", model: "knightA", speed, eyeHeight: 1.6 }],
  script: makeScriptWrite(),
  stage,
  blocking: makeBlockingWrite({
    actors: [{ node: "knightA", beats: "continues one grounded stride" }],
    duration: 1,
  }),
  performance: makePerformanceWrite({
    draft: [
      {
        verb: "locomote",
        actor: "knightA",
        start: 0,
        duration,
        gait: "walk",
        to: { kind: "point", point: target },
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
    revise: { review: "The planted stride remains readable.", final: null },
    duration: 1,
  }),
  eventSamples: [],
});

const walkingContract = (): IAutoMovieDefinedShotContract => ({
  beat: "beat-1",
  durationSeconds: 1,
  participants: [{ kind: "actor", id: "knightA" }],
  opening: [],
  closing: [],
  camera: {
    intent: "Keep the grounded walker readable.",
    requiredSubjects: ["knightA"],
    maxOcclusionRatio: 0.2,
  },
  events: [],
  reviewFrames: [{ id: "middle", time: 0.5, passes: ["beauty"] }],
});

/** Compile one grounded gait shot against the shared rig. */
const compileWalk = (props: {
  id: string;
  rig: IAutoMovieSkeleton;
  stage: ReturnType<typeof makeStagingWrite>;
  target: IAutoMovieVector3;
  previous?: IAutoMovieBeatEndState;
  speed?: number;
  duration?: number | "auto";
}) => {
  const speed = props.speed ?? 1;
  const contexts = new Map<string, IAutoMovieActorContext>([
    [
      "knightA",
      {
        skeleton: props.rig.id,
        rig: props.rig,
        gaits: [WALK],
        position: props.stage.actors[0]!.position,
        speed,
        facingDeg: props.stage.actors[0]!.facingDeg,
        eyeHeight: 1.6,
        restPose: makePose([]),
      },
    ],
  ]);
  const nodes = new Map<string, IAutoMovieVector3>([
    ...props.stage.actors.map((actor) => [actor.node, actor.position] as const),
    ...props.stage.cameras.map(
      (camera) => [camera.node, camera.position] as const,
    ),
  ]);
  return compileDefinedShot({
    shot: defineShot(props.id, {
      scene: props.stage.scene.id,
      contract: walkingContract(),
      build: () =>
        walkingProgram(
          props.stage,
          props.target,
          speed,
          props.duration ?? "auto",
        ),
    }),
    context: undefined,
    runtime: {
      synthesize: makeActorSynthesizer(contexts, nodes),
      skeleton: (node) => (node === "knightA" ? props.rig : null),
      hasActorContext: (node) => node === "knightA",
      gaits: (node) => (node === "knightA" ? ["walk"] : undefined),
      frameFormat: { width: 1920, height: 1080 },
      previous: props.previous,
    },
  });
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
  const groundedStage = makeStagingWrite({
    actors: [
      {
        node: "knightA",
        position: { x: 3, y: 0, z: 4 },
        facingDeg: 90,
      },
      {
        node: "knightB",
        position: { x: 3, y: 0, z: 4.7 },
        facingDeg: 270,
      },
    ],
  });
  const first = compileWalk({
    id: "SB-PLANT-A",
    rig,
    stage: groundedStage,
    target: { x: 4, y: 0, z: 4 },
  });
  TestValidator.predicate(
    "a first gait shot produces its own ground-IK plant seed",
    first.success &&
      first.continuity.closing.actors
        .find((actor) => actor.node === "knightA")
        ?.footPlants?.some((plant) => plant.foot === "leftFoot") === true,
  );
  if (first.success === false) return;
  const firstActor = first.continuity.closing.actors.find(
    (actor) => actor.node === "knightA",
  )!;
  const firstPin = firstActor.footPlants!.find(
    (plant) => plant.foot === "leftFoot",
  )!.position;
  const second = compileWalk({
    id: "SB-PLANT-B",
    rig,
    stage: groundedStage,
    target: {
      x: firstActor.transform.translation.x + 1,
      y: firstActor.transform.translation.y,
      z: firstActor.transform.translation.z,
    },
    previous: first.continuity.closing,
  });
  TestValidator.predicate(
    "the next shot compiles from the first shot's generated plant",
    second.success,
  );
  if (second.success === false) return;
  const secondNode = second.source.scene.nodes.find(
    (node) => node.id === "knightA",
  )!;
  const secondMotion = second.source.motions.find(
    (motion) => (motion.gaitCycle ?? null) !== null,
  )!;
  const secondFoot = resolvePose(sampleMotion(secondMotion, 0).pose, rig).find(
    (bone) => bone.bone === "leftFoot",
  )!.worldPosition;
  const secondWorldFoot = Vector3.add(
    secondNode.transform.translation,
    Quaternion.rotateVector(secondNode.transform.rotation, secondFoot),
  );
  TestValidator.predicate(
    "translated and rotated handoff preserves the same world foot pin",
    vclose(secondWorldFoot, firstPin, 1e-4) &&
      second.source.motions.every(
        (motion) =>
          motion.id.length !== 0 &&
          motion.skeleton === rig.id &&
          motion.duration === 1 &&
          motion.loop === false &&
          (motion.gaitCycle ?? null) !== null,
      ),
  );

  const velocityRig = createSkeleton();
  const velocityFirst = compileWalk({
    id: "SB-VELOCITY-A",
    rig: velocityRig,
    stage: groundedStage,
    target: { x: 4, y: 0, z: 4 },
    speed: 0.25,
    duration: 1,
  });
  TestValidator.predicate(
    "a moving first shot produces incoming world velocity at its exact cut",
    velocityFirst.success &&
      vclose(
        velocityFirst.continuity.closing.actors.find(
          (actor) => actor.node === "knightA",
        )?.rootVelocity ?? { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        1e-6,
      ),
  );
  if (velocityFirst.success === false) return;
  const velocityActor = velocityFirst.continuity.closing.actors.find(
    (actor) => actor.node === "knightA",
  )!;
  const velocitySecond = compileWalk({
    id: "SB-VELOCITY-B",
    rig: velocityRig,
    stage: groundedStage,
    target: {
      x: velocityActor.transform.translation.x + 0.5,
      y: velocityActor.transform.translation.y,
      z: velocityActor.transform.translation.z,
    },
    previous: velocityFirst.continuity.closing,
    speed: 0.25,
  });
  TestValidator.predicate(
    "the next auto stride consumes that velocity instead of fallback speed",
    velocitySecond.success &&
      Vector3.length(
        sampleMotion(velocitySecond.source.motions[0]!, 1).pose.root
          ?.translation ?? { x: 0, y: 0, z: 0 },
      ) >=
        0.5 - 1e-9,
  );

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
