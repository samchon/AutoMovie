import type { IAutoMovieShotSource } from "@automovie/interface";

const transform = (
  x: number,
  y: number,
  z: number,
  rotation = { x: 0, y: 0, z: 0, w: 1 },
): {
  translation: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  scale: { x: number; y: number; z: number };
} => ({
  translation: { x, y, z },
  rotation,
  scale: { x: 1, y: 1, z: 1 },
});

const horizontal = (x: number): ReturnType<typeof transform> =>
  transform(x, 0, 0, {
    x: 0,
    y: 0,
    z: x < 0 ? Math.SQRT1_2 : -Math.SQRT1_2,
    w: Math.SQRT1_2,
  });

/** Starter source: ordinary TypeScript returning deterministic derived data. */
export const opening: IAutoMovieShotSource = {
  build: (context) => {
    const skeleton = {
      id: "sentinel-rig",
      bones: [
        {
          bone: "hips" as const,
          parent: null,
          rest: transform(0, 0.9, 0),
          constraint: null,
        },
        {
          bone: "spine" as const,
          parent: "hips" as const,
          rest: transform(0, 0.35, 0),
          constraint: null,
        },
        {
          bone: "head" as const,
          parent: "spine" as const,
          rest: transform(0, 0.45, 0),
          constraint: null,
        },
        {
          bone: "leftUpperArm" as const,
          parent: "spine" as const,
          rest: transform(0.225, 0.3, 0),
          constraint: null,
        },
        {
          bone: "leftLowerArm" as const,
          parent: "leftUpperArm" as const,
          rest: transform(0.3, 0, 0),
          constraint: null,
        },
        {
          bone: "leftHand" as const,
          parent: "leftLowerArm" as const,
          rest: transform(0.28, 0, 0),
          constraint: null,
        },
        {
          bone: "rightUpperArm" as const,
          parent: "spine" as const,
          rest: transform(-0.225, 0.3, 0),
          constraint: null,
        },
        {
          bone: "rightLowerArm" as const,
          parent: "rightUpperArm" as const,
          rest: transform(-0.3, 0, 0),
          constraint: null,
        },
        {
          bone: "rightHand" as const,
          parent: "rightLowerArm" as const,
          rest: transform(-0.28, 0, 0),
          constraint: null,
        },
        {
          bone: "leftUpperLeg" as const,
          parent: "hips" as const,
          rest: transform(0.12, -0.08, 0),
          constraint: null,
        },
        {
          bone: "leftLowerLeg" as const,
          parent: "leftUpperLeg" as const,
          rest: transform(0, -0.44, 0),
          constraint: null,
        },
        {
          bone: "rightUpperLeg" as const,
          parent: "hips" as const,
          rest: transform(-0.12, -0.08, 0),
          constraint: null,
        },
        {
          bone: "rightLowerLeg" as const,
          parent: "rightUpperLeg" as const,
          rest: transform(0, -0.44, 0),
          constraint: null,
        },
      ],
    };
    const material = {
      id: "body",
      name: "warm signal figure",
      baseColor: { r: 0.68, g: 0.46, b: 0.19, a: 1, hex: "#d7b56d" },
      metallic: 0,
      roughness: 0.7,
      emissive: null,
      opacity: 1,
      baseColorTexture: null,
    };
    const part = (
      id: string,
      attachedBone:
        | "hips"
        | "spine"
        | "head"
        | "leftUpperArm"
        | "leftLowerArm"
        | "leftHand"
        | "rightUpperArm"
        | "rightLowerArm"
        | "rightHand"
        | "leftUpperLeg"
        | "leftLowerLeg"
        | "rightUpperLeg"
        | "rightLowerLeg",
      shape:
        | { type: "box"; width: number; height: number; depth: number }
        | { type: "sphere"; radius: number }
        | { type: "capsule"; radius: number; height: number },
      local: ReturnType<typeof transform> | null,
    ) => ({
      id,
      name: id,
      geometry: { type: "primitive" as const, shape },
      material: "body",
      attachedBone,
      transform: local,
    });
    const model = {
      id: "sentinel-model",
      name: "primitive signal sentinel",
      origin: "generated" as const,
      skeleton,
      body: null,
      materials: [material],
      parts: [
        part(
          "pelvis",
          "hips",
          { type: "box", width: 0.34, height: 0.22, depth: 0.2 },
          transform(0, 0, 0),
        ),
        part(
          "torso",
          "spine",
          { type: "box", width: 0.45, height: 0.65, depth: 0.22 },
          transform(0, 0.15, 0),
        ),
        part("head", "head", { type: "sphere", radius: 0.16 }, null),
        part(
          "upper-arm",
          "leftUpperArm",
          { type: "capsule", radius: 0.06, height: 0.24 },
          horizontal(0.15),
        ),
        part(
          "lower-arm",
          "leftLowerArm",
          { type: "capsule", radius: 0.05, height: 0.25 },
          horizontal(0.15),
        ),
        part("left-hand", "leftHand", { type: "sphere", radius: 0.065 }, null),
        part(
          "right-upper-arm",
          "rightUpperArm",
          { type: "capsule", radius: 0.06, height: 0.24 },
          horizontal(-0.15),
        ),
        part(
          "right-lower-arm",
          "rightLowerArm",
          { type: "capsule", radius: 0.05, height: 0.25 },
          horizontal(-0.15),
        ),
        part(
          "right-hand",
          "rightHand",
          { type: "sphere", radius: 0.065 },
          null,
        ),
        part(
          "left-thigh",
          "leftUpperLeg",
          { type: "capsule", radius: 0.07, height: 0.34 },
          transform(0, -0.21, 0),
        ),
        part(
          "left-shin",
          "leftLowerLeg",
          { type: "capsule", radius: 0.06, height: 0.34 },
          transform(0, -0.21, 0),
        ),
        part(
          "right-thigh",
          "rightUpperLeg",
          { type: "capsule", radius: 0.07, height: 0.34 },
          transform(0, -0.21, 0),
        ),
        part(
          "right-shin",
          "rightLowerLeg",
          { type: "capsule", radius: 0.06, height: 0.34 },
          transform(0, -0.21, 0),
        ),
      ],
      asset: null,
    };
    const pose = (abduction: number) => ({
      skeleton: skeleton.id,
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
      id: "raise-signal",
      skeleton: skeleton.id,
      duration: context.contract.durationSeconds,
      loop: false,
      keyframes: [
        {
          time: 0,
          pose: pose(0),
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
      contract: {
        participants: context.contract.participants.map((participant) => ({
          kind: participant.kind,
          id: participant.id,
          nodes: [participant.id],
        })),
        openingStates: context.contract.opening.map((state) => state.id),
        closingStates: context.contract.closing.map((state) => state.id),
        cameraSubjects: [...context.contract.camera.requiredSubjects],
        events: context.contract.events.map((event) => ({
          id: event.id,
          time: (event.window.from + event.window.to) / 2,
          subjects: [...event.subjects],
        })),
        models: [{ recipe: "sentinel", model: model.id }],
      },
      models: [model],
      scene: {
        id: "opening-scene",
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
      shot: {
        id: context.contract.id,
        name: "The signal",
        scene: "opening-scene",
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
  },
};
