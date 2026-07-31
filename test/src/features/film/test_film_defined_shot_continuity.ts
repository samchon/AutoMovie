import {
  IAutoMovieActorContext,
  Quaternion,
  Vector3,
  compileDefinedShot,
  defineShot,
  makeActorSynthesizer,
  resolveBeatEnd,
  resolvePose,
  sampleMotion,
  spaceGround,
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
      phase: 0.7,
      duty: 0.7,
      amplitude: 12,
    },
    {
      bone: "leftLowerLeg",
      phase: 0.7,
      duty: 0.7,
      amplitude: 12,
      neutral: 12,
    },
  ],
};

const walkingProgram = (
  stage: ReturnType<typeof makeStagingWrite>,
  target: IAutoMovieVector3,
  speed: number,
  duration: number | "auto",
): IAutoMovieShotProgram => {
  const blocking = makeBlockingWrite({
    actors: [{ node: "knightA", beats: "continues one grounded stride" }],
    duration: 1,
  });
  blocking.camera.framing = "full";
  blocking.rationale =
    "full static keeps the required actor root readable throughout the stride.";
  return {
    actors: [{ node: "knightA", model: "knightA", speed, eyeHeight: 1.6 }],
    script: makeScriptWrite(),
    stage,
    blocking,
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
          framing: "full",
          move: "static",
          on: { kind: "node", node: "knightA" },
        },
      ],
      revise: { review: "The planted stride remains readable.", final: null },
      duration: 1,
    }),
    eventSamples: [],
  };
};

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
 *
 * Scenarios include a flat legacy ground handoff, an airborne actor that must
 * not plant merely because its model foot is at y=0, and a translated,
 * 90-degree-facing actor whose plant is measured on a non-zero ramp and reused
 * by the next shot in the same world coordinates.
 */
export const test_film_defined_shot_continuity = (): void => {
  const rig = createSkeleton();
  // Bend the fixture leg at rest and lower its foot 2 cm into the contact band.
  // Its two segment lengths now total about 1.22 m rather than the straight
  // 0.9 m hip-to-ground height, giving the ground-IK solve enough reach to hold
  // one pin through each stance and across the cut while the downhill foot
  // remains in default-tolerance contact as the root climbs the ramp.
  rig.bones.find((bone) => bone.bone === "leftLowerLeg")!.rest.translation.z =
    0.4;
  rig.bones.push({
    bone: "leftFoot",
    parent: "leftLowerLeg",
    rest: {
      translation: { x: 0, y: -0.52, z: -0.4 },
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
    target: { x: 3.25, y: 0, z: 4 },
    duration: 1,
  });
  if (first.success === false)
    throw new Error(
      `First gait shot compilation failed:\n${JSON.stringify(
        first.diagnostics,
        null,
        2,
      )}`,
    );
  const firstPlantActor = first.continuity.closing.actors.find(
    (actor) => actor.node === "knightA",
  );
  TestValidator.predicate(
    `a first gait shot produces its own ground-IK plant seed; closing actor=${JSON.stringify(
      firstPlantActor,
    )}`,
    firstPlantActor?.footPlants?.some((plant) => plant.foot === "leftFoot") ===
      true,
  );

  const airborneStage = makeStagingWrite({
    actors: groundedStage.actors.map((actor) => ({
      ...actor,
      position: { ...actor.position, y: 1 },
    })),
    space: {
      id: "flat-ground",
      surfaces: [
        {
          id: "floor",
          kind: "floor",
          polygon: [
            { x: 0, y: 0, z: 0 },
            { x: 8, y: 0, z: 0 },
            { x: 8, y: 0, z: 8 },
            { x: 0, y: 0, z: 8 },
          ],
          anchor: { x: 0, y: 0, z: 0 },
          rampTo: null,
        },
      ],
      walkable: ["floor"],
    },
  });
  const airborne = compileWalk({
    id: "SB-PLANT-AIRBORNE",
    rig,
    stage: airborneStage,
    target: { x: 4, y: 1, z: 4 },
  });
  TestValidator.predicate(
    "scene space prevents a model-plane false plant above world ground",
    airborne.success &&
      airborne.source.scene.space?.id === "flat-ground" &&
      airborne.continuity.closing.actors.find(
        (actor) => actor.node === "knightA",
      )?.footPlants === null,
  );

  const slopeSpace = {
    id: "rising-ground",
    surfaces: [
      {
        id: "ramp",
        kind: "ramp",
        polygon: [
          { x: 0, y: 0, z: 0 },
          { x: 8, y: 0, z: 0 },
          { x: 8, y: 0, z: 8 },
          { x: 0, y: 0, z: 8 },
        ],
        anchor: { x: 0, y: 0, z: 0 },
        rampTo: { x: 8, y: 0.4, z: 0 },
      },
    ],
    walkable: ["ramp"],
  } satisfies NonNullable<ReturnType<typeof makeStagingWrite>["space"]>;
  const rampGround = spaceGround(slopeSpace);
  const slopeStage = makeStagingWrite({
    actors: groundedStage.actors.map((actor) => ({
      ...actor,
      position: {
        ...actor.position,
        y: rampGround(actor.position.x, actor.position.z),
      },
    })),
    space: slopeSpace,
  });
  const slopeFirstTarget = {
    x: 3.25,
    y: rampGround(3.25, 4),
    z: 4,
  };
  const slopeFirst = compileWalk({
    id: "SB-PLANT-SLOPE-A",
    rig,
    stage: slopeStage,
    target: slopeFirstTarget,
    duration: 1,
  });
  const slopeFirstActor =
    slopeFirst.success === false
      ? null
      : slopeFirst.continuity.closing.actors.find(
          (actor) => actor.node === "knightA",
        )!;
  TestValidator.predicate(
    "a translated and rotated gait reaches its ramp target and plant",
    slopeFirst.success &&
      slopeFirstActor !== null &&
      vclose(slopeFirstActor.transform.translation, slopeFirstTarget, 1e-9) &&
      slopeFirstActor.footPlants?.some((plant) => plant.foot === "leftFoot") ===
        true,
  );
  if (slopeFirst.success === false) return;
  const slopeActor = slopeFirstActor!;
  const slopePin = slopeActor.footPlants!.find(
    (plant) => plant.foot === "leftFoot",
  )!.position;
  const slopeSecondX = slopeActor.transform.translation.x + 0.25;
  const slopeSecondTarget = {
    x: slopeSecondX,
    y: rampGround(slopeSecondX, slopeActor.transform.translation.z),
    z: slopeActor.transform.translation.z,
  };
  const slopeSecond = compileWalk({
    id: "SB-PLANT-SLOPE-B",
    rig,
    stage: slopeStage,
    target: slopeSecondTarget,
    previous: slopeFirst.continuity.closing,
    duration: 1,
  });
  const slopeSecondNode =
    slopeSecond.success === false
      ? null
      : slopeSecond.source.scene.nodes.find((node) => node.id === "knightA")!;
  const slopeSecondMotion =
    slopeSecond.success === false
      ? null
      : slopeSecond.source.motions.find(
          (motion) => (motion.gaitCycle ?? null) !== null,
        )!;
  const slopeSecondActor =
    slopeSecond.success === false
      ? null
      : slopeSecond.continuity.closing.actors.find(
          (actor) => actor.node === "knightA",
        )!;
  const slopeSecondFoot =
    slopeSecondNode === null || slopeSecondMotion === null
      ? null
      : Vector3.add(
          slopeSecondNode.transform.translation,
          Quaternion.rotateVector(
            slopeSecondNode.transform.rotation,
            resolvePose(sampleMotion(slopeSecondMotion, 0).pose, rig).find(
              (bone) => bone.bone === "leftFoot",
            )!.worldPosition,
          ),
        );
  TestValidator.predicate(
    "ramp world height and the next opening share the same plant authority",
    Math.abs(slopePin.y - rampGround(slopePin.x, slopePin.z)) <= 1e-6 &&
      slopeSecond.success &&
      slopeSecondNode !== null &&
      vclose(
        slopeSecondNode.transform.translation,
        slopeActor.transform.translation,
        1e-9,
      ) &&
      slopeSecondActor !== null &&
      vclose(slopeSecondActor.transform.translation, slopeSecondTarget, 1e-9) &&
      slopeSecondFoot !== null &&
      vclose(slopeSecondFoot, slopePin, 1e-4),
  );

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
      x: firstActor.transform.translation.x + 0.25,
      y: firstActor.transform.translation.y,
      z: firstActor.transform.translation.z,
    },
    previous: first.continuity.closing,
    duration: 1,
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

  const stalePin = {
    foot: "leftFoot" as const,
    start: 0,
    end: 0.25,
    position: { x: 100, y: 0, z: 100 },
  };
  const staleClosing = resolveBeatEnd({
    beat: "beat-1",
    scene: first.source.scene,
    shot: first.source.shot,
    motions: first.source.motions,
    plants: [{ node: "knightA", plants: [stalePin] }],
  });
  const afterStale = compileWalk({
    id: "SB-PLANT-STALE",
    rig,
    stage: groundedStage,
    target: {
      x: firstActor.transform.translation.x + 0.25,
      y: firstActor.transform.translation.y,
      z: firstActor.transform.translation.z,
    },
    previous: staleClosing,
    duration: 1,
  });
  const afterStaleNode =
    afterStale.success === false
      ? null
      : afterStale.source.scene.nodes.find((node) => node.id === "knightA")!;
  const afterStaleMotion =
    afterStale.success === false
      ? null
      : afterStale.source.motions.find(
          (motion) => (motion.gaitCycle ?? null) !== null,
        )!;
  const afterStaleFoot =
    afterStaleNode === null || afterStaleMotion === null
      ? null
      : Vector3.add(
          afterStaleNode.transform.translation,
          Quaternion.rotateVector(
            afterStaleNode.transform.rotation,
            resolvePose(sampleMotion(afterStaleMotion, 0).pose, rig).find(
              (bone) => bone.bone === "leftFoot",
            )!.worldPosition,
          ),
        );
  TestValidator.predicate(
    "a plant that ended before the cut never becomes the next opening pin",
    staleClosing.actors.find((actor) => actor.node === "knightA")
      ?.footPlants === null &&
      afterStale.success &&
      afterStaleFoot !== null &&
      vclose(afterStaleFoot, stalePin.position, 1e-4) === false,
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
  const continuityBlocking = makeBlockingWrite({
    actors: [
      { node: "knightA", beats: "continues the established walk" },
      { node: "knightB", beats: "rides the established mount" },
    ],
    duration: 2,
  });
  continuityBlocking.camera.framing = "full";
  continuityBlocking.rationale =
    "full static keeps the resumed walker root readable across the cut.";
  const program: IAutoMovieShotProgram = {
    actors: [{ node: "knightA", model: "knightA", speed: 0.5, eyeHeight: 1.6 }],
    script: makeScriptWrite(),
    stage,
    blocking: continuityBlocking,
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
          framing: "full",
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
  if (compiled.success === false)
    throw new Error(
      `Final continuity shot compilation failed:\n${JSON.stringify(
        compiled.diagnostics,
        null,
        2,
      )}`,
    );
  const openingActor = compiled.continuity.opening.actors.find(
    (actor) => actor.node === "knightA",
  );
  const closingRider = compiled.continuity.closing.actors.find(
    (actor) => actor.node === "knightB",
  );
  TestValidator.equals(
    "all prior simulation channels reach the next compiled opening",
    {
      sceneX: compiled.source.scene.nodes.find((node) => node.id === "knightA")
        ?.transform.translation.x,
      armFlexion: compiled.source.scene.nodes
        .find((node) => node.id === "knightA")
        ?.pose?.joints.some(
          (entry) => entry.bone === "leftLowerArm" && entry.flexion === 30,
        ),
      duration: compiled.source.motions[0]?.duration,
      gaitPhase: compiled.source.motions[0]?.gaitCycle?.phaseAt,
      rootVelocityZ: openingActor?.rootVelocity?.z,
      footPlantX: openingActor?.footPlants?.[0]?.position.x,
      mountParent: closingRider?.mount?.parent,
    },
    {
      sceneX: 3,
      armFlexion: true,
      duration: 2,
      gaitPhase: 0.4,
      rootVelocityZ: 2,
      footPlantX: 3.1,
      mountParent: "knightA",
    },
  );
};
