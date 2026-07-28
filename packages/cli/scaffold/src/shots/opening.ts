import type {
  IAutoMovieShotBuildContext,
  IAutoMovieShotSource,
  IAutoMovieShotSourceOutput,
} from "@automovie/interface";

const transform = (
  x: number,
  y: number,
  z: number,
  rotation = { x: 0, y: 0, z: 0, w: 1 },
) => ({
  translation: { x, y, z },
  rotation,
  scale: { x: 1, y: 1, z: 1 },
});

const buildSignal = (
  context: IAutoMovieShotBuildContext,
  openingAbduction: number,
): IAutoMovieShotSourceOutput => {
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
  return {
    eventSamples: context.contract.events.map((event) => ({
      id: event.id,
      time: (event.window.from + event.window.to) / 2,
    })),
    scene: {
      id: `${context.contract.id}-scene`,
      name: "starter signal ground",
      nodes: [
        {
          id: "sentinel",
          model: model.id,
          transform: transform(0, 0, 0),
          motion: motion.id,
          pose: null,
        },
      ],
      cameras: [
        {
          id: "camera",
          transform: transform(0, 1.35, 4.8, {
            x: -0.052336,
            y: 0,
            z: 0,
            w: 0.99863,
          }),
          fovY: 38,
          near: 0.1,
          far: 100,
        },
      ],
      lights: [
        {
          id: "sun",
          type: "directional",
          transform: transform(2, 4, 3),
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
    motions: [motion],
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
            easing: "easeInOut" as const,
          },
        ]
      : [],
    effectCues: context.world.effectZones.some(
      (zone) => zone.id === "signal-smoke",
    )
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
    shot: {
      id: context.contract.id,
      name: "The signal",
      scene: `${context.contract.id}-scene`,
      camera: "camera",
      cameraMotion: null,
      performances: [{ node: "sentinel", motion: motion.id, startOffset: 0 }],
      objectMotions: [],
      lightMotions: [],
      events: [],
      cameraIntent: [],
      coverage: [],
      duration: context.contract.durationSeconds,
    },
  };
};

/** Opening source proves a neutral-to-raised transition. */
export const opening: IAutoMovieShotSource = {
  build: (context) => buildSignal(context, 0),
};

/** Answer source begins from the raised state established by the first shot. */
export const answer: IAutoMovieShotSource = {
  build: (context) => buildSignal(context, 110),
};
