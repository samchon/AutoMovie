import {
  AutoFilmHumanoidBone,
  IAutoFilmBone,
  IAutoFilmExpression,
  IAutoFilmFace,
  IAutoFilmJointPose,
  IAutoFilmKeyframe,
  IAutoFilmModel,
  IAutoFilmMotion,
  IAutoFilmPose,
  IAutoFilmSkeleton,
  IAutoFilmTransform,
} from "@autofilm/interface";

export const IDENTITY_TRANSFORM: IAutoFilmTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

const restAt = (x: number, y: number, z: number): IAutoFilmTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const bone = (
  name: AutoFilmHumanoidBone,
  parent: AutoFilmHumanoidBone | null,
  rest: IAutoFilmTransform,
): IAutoFilmBone => ({ bone: name, parent, rest, constraint: null });

/**
 * A small but realistic humanoid: a hips→spine→chest→neck→head spine plus
 * left/right limb chains. Rest translations are local offsets; all rest
 * rotations are identity. Every `constraint` is null, so validation falls back
 * to the engine's default ROM table.
 */
export const createSkeleton = (): IAutoFilmSkeleton => ({
  id: "skeleton-1",
  bones: [
    bone("hips", null, restAt(0, 1, 0)),
    bone("spine", "hips", restAt(0, 0.2, 0)),
    bone("chest", "spine", restAt(0, 0.2, 0)),
    bone("neck", "chest", restAt(0, 0.2, 0)),
    bone("head", "neck", restAt(0, 0.1, 0)),
    bone("leftUpperArm", "chest", restAt(0.2, 0, 0)),
    bone("leftLowerArm", "leftUpperArm", restAt(0.3, 0, 0)),
    bone("leftHand", "leftLowerArm", restAt(0.25, 0, 0)),
    bone("rightUpperArm", "chest", restAt(-0.2, 0, 0)),
    bone("rightLowerArm", "rightUpperArm", restAt(-0.3, 0, 0)),
    bone("leftUpperLeg", "hips", restAt(0.1, -0.1, 0)),
    bone("leftLowerLeg", "leftUpperLeg", restAt(0, -0.4, 0)),
  ],
});

export const joint = (
  name: AutoFilmHumanoidBone,
  axes: Partial<
    Pick<IAutoFilmJointPose, "flexion" | "abduction" | "twist">
  > = {},
): IAutoFilmJointPose => ({
  bone: name,
  flexion: axes.flexion ?? null,
  abduction: axes.abduction ?? null,
  twist: axes.twist ?? null,
});

export const makePose = (
  joints: IAutoFilmJointPose[],
  root: IAutoFilmTransform | null = null,
): IAutoFilmPose => ({ skeleton: "skeleton-1", root, joints });

/** A pose whose every articulated joint sits well inside its ROM. */
export const createValidPose = (): IAutoFilmPose =>
  makePose([
    joint("leftUpperArm", { flexion: 30, abduction: 45 }),
    joint("leftLowerArm", { flexion: 90 }),
    joint("leftUpperLeg", { flexion: 40 }),
  ]);

export const makeExpression = (
  preset: IAutoFilmExpression["preset"],
  intensity: number,
  blendshapes: IAutoFilmExpression["blendshapes"] = null,
): IAutoFilmExpression => ({ preset, intensity, blendshapes });

export const keyframe = (
  time: number,
  pose: IAutoFilmPose,
  easing: IAutoFilmKeyframe["easing"] = "linear",
  expression: IAutoFilmExpression | null = null,
): IAutoFilmKeyframe => ({ time, pose, expression, easing, bezier: null });

export const makeMotion = (
  keyframes: IAutoFilmKeyframe[],
  duration: number,
  loop = false,
): IAutoFilmMotion => ({
  id: "motion-1",
  skeleton: "skeleton-1",
  duration,
  loop,
  keyframes,
});

/** A valid two-keyframe elbow flexion clip. */
export const createValidMotion = (): IAutoFilmMotion =>
  makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })])),
      keyframe(1, makePose([joint("leftLowerArm", { flexion: 120 })])),
    ],
    1,
  );

/** A valid one-part generated model with a skeleton. */
export const createModel = (
  skeleton: IAutoFilmSkeleton | null = createSkeleton(),
): IAutoFilmModel => ({
  id: "model-1",
  name: "test model",
  origin: "generated",
  skeleton,
  materials: [
    {
      id: "mat-1",
      name: "red",
      baseColor: { r: 0.8, g: 0.1, b: 0.1, a: 1, hex: null },
      metallic: 0,
      roughness: 0.6,
      emissive: null,
      opacity: 1,
      baseColorTexture: null,
    },
  ],
  parts: [
    {
      id: "part-1",
      name: "torso",
      geometry: {
        type: "primitive",
        shape: { type: "box", width: 0.4, height: 0.6, depth: 0.2 },
      },
      material: "mat-1",
      attachedBone: null,
      transform: null,
    },
  ],
  asset: null,
});

/** A face document from (parameter, weight) pairs. */
export const makeFace = (
  parameters: IAutoFilmFace["parameters"] = [],
): IAutoFilmFace => ({ parameters });
