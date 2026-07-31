import { defineShot } from "@automovie/engine";
import type {
  IAutoMovieDefinedShotContract,
  IAutoMovieProductionShotProgram,
  IAutoMovieShotBuildContext,
} from "@automovie/interface";

const OPENING_CONTRACT: IAutoMovieDefinedShotContract = {
  beat: "signal",
  evidence: [
    {
      reason: "This shot realizes the screenplay's visible signal action.",
      scene: "SCN-001",
      claim: "signal-arm-readable",
    },
  ],
  durationSeconds: 6,
  participants: [
    { kind: "actor", id: "sentinel" },
    { kind: "formation", id: "army" },
  ],
  opening: [
    {
      id: "arm-lowered",
      description: "The sentinel begins in a readable neutral stance.",
      predicates: [
        {
          kind: "joint-angle",
          actor: "sentinel",
          bone: "leftUpperArm",
          axis: "abduction",
          operator: "==",
          value: 0,
          tolerance: 0.001,
        },
      ],
    },
  ],
  closing: [
    {
      id: "signal-held",
      description: "The raised arm holds the signal at the final frame.",
      predicates: [
        {
          kind: "joint-angle",
          actor: "sentinel",
          bone: "leftUpperArm",
          axis: "abduction",
          operator: ">=",
          value: 100,
          tolerance: 0.001,
        },
      ],
    },
  ],
  camera: {
    intent:
      "A full-body three-quarter view proves silhouette and pose-pass wiring.",
    requiredSubjects: ["sentinel"],
    maxOcclusionRatio: 0.05,
  },
  events: [
    {
      id: "signal-raised",
      kind: "reveal",
      window: { from: 1.5, to: 3 },
      subjects: ["sentinel"],
      predicates: [
        {
          kind: "joint-angle",
          actor: "sentinel",
          bone: "leftUpperArm",
          axis: "abduction",
          operator: ">=",
          value: 100,
          tolerance: 0.001,
        },
      ],
    },
  ],
  reviewFrames: [
    {
      id: "signal-apex",
      time: 2,
      passes: ["beauty", "mask", "pose"],
    },
  ],
};

const ANSWER_CONTRACT: IAutoMovieDefinedShotContract = {
  beat: "answer",
  evidence: [
    {
      reason: "This shot realizes the screenplay's answering gesture.",
      scene: "SCN-002",
    },
  ],
  durationSeconds: 6,
  participants: [{ kind: "actor", id: "sentinel" }],
  opening: [
    {
      id: "signal-seen",
      description:
        "The answering shot begins from the established raised signal.",
      predicates: [
        {
          kind: "joint-angle",
          actor: "sentinel",
          bone: "leftUpperArm",
          axis: "abduction",
          operator: ">=",
          value: 100,
          tolerance: 0.001,
        },
      ],
    },
  ],
  closing: [
    {
      id: "answer-held",
      description: "The signal remains legible through the second shot.",
      predicates: [
        {
          kind: "joint-angle",
          actor: "sentinel",
          bone: "leftUpperArm",
          axis: "abduction",
          operator: ">=",
          value: 100,
          tolerance: 0.001,
        },
      ],
    },
  ],
  camera: {
    intent:
      "A second full-body view proves that film rendering and review cannot stop after the opening shot.",
    requiredSubjects: ["sentinel"],
    maxOcclusionRatio: 0.05,
  },
  events: [
    {
      id: "signal-answered",
      kind: "reveal",
      window: { from: 3, to: 5 },
      subjects: ["sentinel"],
      predicates: [
        {
          kind: "joint-angle",
          actor: "sentinel",
          bone: "leftUpperArm",
          axis: "abduction",
          operator: ">=",
          value: 100,
          tolerance: 0.001,
        },
      ],
    },
  ],
  reviewFrames: [
    {
      id: "signal-answer",
      time: 4,
      passes: ["beauty", "mask", "pose"],
    },
  ],
};

const buildSignal = (
  context: IAutoMovieShotBuildContext,
  openingAbduction: number,
): IAutoMovieProductionShotProgram => {
  const model = context.runtimeModels.sentinel;
  if (model === undefined || model.skeleton === null)
    throw new Error(
      'The compiler-owned "sentinel" stickman model must provide a skeleton.',
    );
  const pose = (abduction: number) => ({
    skeleton: model.skeleton!.id,
    root: null,
    joints: [
      {
        bone: "leftUpperArm" as const,
        flexion: null,
        abduction,
        twist: null,
      },
      {
        bone: "leftLowerArm" as const,
        flexion: 25,
        abduction: null,
        twist: null,
      },
    ],
  });
  const motion = {
    id: `${context.contract.id}-signal`,
    skeleton: model.skeleton.id,
    duration: context.contract.durationSeconds,
    loop: false,
    keyframes:
      openingAbduction >= 100
        ? [
            {
              time: 0,
              pose: pose(openingAbduction),
              expression: null,
              easing: "linear" as const,
              bezier: null,
            },
            {
              time: context.contract.durationSeconds,
              pose: pose(openingAbduction),
              expression: null,
              easing: "linear" as const,
              bezier: null,
            },
          ]
        : [
            {
              time: 0,
              pose: pose(openingAbduction),
              expression: null,
              easing: "easeInOut" as const,
              bezier: null,
            },
            {
              time: 2,
              pose: pose(110),
              expression: null,
              easing: "linear" as const,
              bezier: null,
            },
            {
              time: context.contract.durationSeconds,
              pose: pose(110),
              expression: null,
              easing: "linear" as const,
              bezier: null,
            },
          ],
    gaitCycle: null,
  };
  const sceneId = `${context.contract.id}-scene`;
  return {
    actors: [
      {
        node: "sentinel",
        model: "sentinel",
        speed: 1.2,
        eyeHeight: 1.62,
      },
    ],
    script: {
      logline: "A lone sentinel raises a signal and the field answers.",
      theme: "one readable gesture changes the field",
      cast: [
        {
          node: "sentinel",
          character: "the sentinel",
          modelRef: "sentinel",
        },
      ],
      beats: [
        {
          id: context.contract.beat,
          name: context.contract.beat,
          summary: "the sentinel holds the authored signal",
          durationHint: context.contract.durationSeconds,
        },
      ],
    },
    stage: {
      scene: { id: sceneId, name: "starter signal ground" },
      plan: "The sentinel stands centered while a fixed camera reads the arm.",
      actors: [
        {
          node: "sentinel",
          position: { x: 0, y: 0, z: 0 },
          facingDeg: 0,
        },
      ],
      cameras: [
        {
          node: "camera",
          position: { x: 0, y: 1.35, z: 4.8 },
          lookAt: { kind: "node", node: "sentinel" },
          fovDeg: 38,
        },
      ],
      lights: [
        {
          node: "sun",
          role: "sun",
          direction: { x: -0.4, y: -1, z: -0.6 },
          color: { r: 1, g: 0.92, b: 0.8, a: null, hex: "#fff5df" },
          intensity: 2.5,
        },
      ],
      space: {
        id: "ground-space",
        surfaces: [
          {
            id: "ground",
            kind: "floor",
            polygon: [
              { x: -8, y: 0, z: -8 },
              { x: 8, y: 0, z: -8 },
              { x: 8, y: 0, z: 8 },
              { x: -8, y: 0, z: 8 },
            ],
            anchor: { x: 0, y: 0, z: 0 },
            rampTo: null,
          },
        ],
        walkable: ["ground"],
      },
    },
    blocking: {
      beat: context.contract.beat,
      analysis: "The signal arm and whole silhouette must remain readable.",
      rationale: "One fixed full-body view proves the authored pose.",
      actors: [{ node: "sentinel", beats: "raises and holds the signal arm" }],
      camera: {
        framing: "full",
        move: "static",
        on: { kind: "node", node: "sentinel" },
      },
      duration: context.contract.durationSeconds,
    },
    performance: {
      beat: context.contract.beat,
      plan: "Execute the source-computed signal clip under engine ROM gates.",
      draft: [
        {
          verb: "enact",
          actor: "sentinel",
          start: 0,
          duration: context.contract.durationSeconds,
          clip: motion.id,
        },
        {
          verb: "frame",
          actor: "camera",
          start: 0,
          duration: "auto",
          framing: "full",
          move: "static",
          on: { kind: "node", node: "sentinel" },
        },
      ],
      revise: {
        review: "The signal is readable and remains held at the final frame.",
        final: null,
      },
      duration: context.contract.durationSeconds,
    },
    eventSamples: context.contract.events.map((event) => ({
      id: event.id,
      time: (event.window.from + event.window.to) / 2,
    })),
    clips: [motion],
    formationMotions: context.contract.participants.some(
      (participant) =>
        participant.kind === "formation" && participant.id === "army",
    )
      ? [
          {
            id: `${context.contract.id}-army-advance`,
            formation: "army",
            action: "advance",
            start: 0,
            end: context.contract.durationSeconds,
            from: {
              translation: { x: 0, y: 0, z: 0 },
              facingOffsetDeg: 0,
              spacingScale: { lateral: 1, depth: 1 },
            },
            to: {
              translation: { x: 0, y: 0, z: -2 },
              facingOffsetDeg: 4,
              spacingScale: { lateral: 1.05, depth: 0.95 },
            },
            easing: "easeInOut",
          },
        ]
      : [],
    effectCues:
      context.world.effectZones.some((zone) => zone.id === "signal-smoke") &&
      context.contract.events.some((event) => event.id === "signal-raised")
        ? [
            {
              id: `${context.contract.id}-signal-smoke`,
              zone: "signal-smoke",
              start: 1,
              end: 4,
              intensity: { from: 0.35, to: 0.8 },
              event: "signal-raised",
            },
          ]
        : [],
  };
};

/** Opening source proves a neutral-to-raised transition. */
export const opening = defineShot("opening", {
  scene: "opening-scene",
  contract: OPENING_CONTRACT,
  build: (context: IAutoMovieShotBuildContext) => buildSignal(context, 0),
});

/** Answer source begins from the raised state established by the first shot. */
export const answer = defineShot("answer", {
  scene: "answer-scene",
  contract: ANSWER_CONTRACT,
  build: (context: IAutoMovieShotBuildContext) => buildSignal(context, 110),
});
