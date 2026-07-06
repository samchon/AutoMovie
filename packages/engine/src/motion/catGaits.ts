import { IAutoMovieGait, IAutoMovieProfile } from "@automovie/interface";

const pairedUpper = (
  bone: "leftUpperArm" | "rightUpperArm" | "leftUpperLeg" | "rightUpperLeg",
  phase: number,
  amplitude: number,
  duty: number,
): IAutoMovieGait["limbs"][number] => ({
  bone,
  phase,
  duty,
  amplitude,
  swingEasing: "easeOut",
  stanceEasing: "easeInOut",
});

const pairedLower = (
  bone: "leftLowerArm" | "rightLowerArm" | "leftLowerLeg" | "rightLowerLeg",
  phase: number,
  neutral: number,
  amplitude: number,
  duty: number,
): IAutoMovieGait["limbs"][number] => ({
  bone,
  phase,
  duty,
  neutral,
  amplitude,
  swingEasing: "easeOut",
  stanceEasing: "easeInOut",
});

const tail = (
  bone: "leftLittleProximal" | "leftLittleIntermediate" | "leftLittleDistal",
  phase: number,
  neutral: number,
  amplitude: number,
): IAutoMovieGait["limbs"][number][] => [
  {
    bone,
    axis: "abduction",
    phase,
    duty: 0.5,
    neutral: 0,
    amplitude,
    swingEasing: "easeInOut",
    stanceEasing: "easeInOut",
  },
  {
    bone,
    phase: 0,
    duty: 0.5,
    neutral,
    amplitude: Math.max(1, amplitude * 0.15),
    swingEasing: "easeInOut",
    stanceEasing: "easeInOut",
  },
];

/**
 * The canonical cat gait library: walk/leap/stalk as reusable profile data for
 * a quadruped rig whose arm bones are front legs and leg bones are hind legs.
 *
 * @author Samchon
 */
export const CAT_GAITS: Record<"walk" | "leap" | "stalk", IAutoMovieGait> = {
  walk: {
    name: "walk",
    period: 0.8,
    rootBob: { amplitude: 0.004, phase: 0.5, center: -0.004 },
    style: { weight: 0.12, springiness: 0.18, strideScale: 0.78 },
    limbs: [
      pairedUpper("leftUpperArm", 0.5, 24, 0.56),
      pairedUpper("rightUpperArm", 0, 24, 0.56),
      pairedUpper("leftUpperLeg", 0, 24, 0.56),
      pairedUpper("rightUpperLeg", 0.5, 24, 0.56),
      pairedLower("leftLowerArm", 0, 25, 11, 0.56),
      pairedLower("rightLowerArm", 0.5, 25, 11, 0.56),
      pairedLower("leftLowerLeg", 0.5, 31, 13, 0.56),
      pairedLower("rightLowerLeg", 0, 31, 13, 0.56),
      ...tail("leftLittleProximal", 0, -18, 11),
      ...tail("leftLittleIntermediate", 0, -14, 13),
      ...tail("leftLittleDistal", 0, -10, 15),
      { bone: "head", phase: 0, duty: 0.5, neutral: -4, amplitude: 1 },
    ],
  },
  leap: {
    name: "leap",
    period: 1,
    rootBob: { amplitude: 0.185, phase: 0.8, center: 0.055 },
    style: { crouch: 0.55, weight: 0.08, springiness: 0.88, strideScale: 1.45 },
    limbs: [
      {
        bone: "leftUpperArm",
        phase: 0,
        duty: 0.36,
        neutral: -17,
        amplitude: 17,
        swingEasing: "easeOut",
        stanceEasing: "easeInOut",
      },
      {
        bone: "rightUpperArm",
        phase: 0,
        duty: 0.36,
        neutral: -17,
        amplitude: 17,
        swingEasing: "easeOut",
        stanceEasing: "easeInOut",
      },
      pairedLower("leftLowerArm", 0.45, 47, 5, 0.36),
      pairedLower("rightLowerArm", 0.45, 47, 5, 0.36),
      {
        bone: "leftUpperLeg",
        phase: 0,
        duty: 0.36,
        neutral: -2,
        amplitude: 36,
        swingEasing: "easeOut",
        stanceEasing: "easeInOut",
      },
      {
        bone: "rightUpperLeg",
        phase: 0,
        duty: 0.36,
        neutral: -2,
        amplitude: 36,
        swingEasing: "easeOut",
        stanceEasing: "easeInOut",
      },
      pairedLower("leftLowerLeg", 0, 75, 17, 0.36),
      pairedLower("rightLowerLeg", 0, 75, 17, 0.36),
      { bone: "neck", phase: 0, duty: 0.5, neutral: 5, amplitude: 17 },
      { bone: "head", phase: 0, duty: 0.5, neutral: 9, amplitude: 9 },
      ...tail("leftLittleProximal", 0.25, -18, 8),
      ...tail("leftLittleIntermediate", 0.25, -14, 9),
      ...tail("leftLittleDistal", 0.25, -10, 10),
    ],
  },
  stalk: {
    name: "stalk",
    period: 1.2,
    rootBob: { amplitude: 0.01, phase: 0.5, center: -0.04 },
    style: { crouch: 0.5, weight: 0.18, springiness: 0.08, strideScale: 0.62 },
    limbs: [
      pairedUpper("leftUpperArm", 0.5, 16, 0.68),
      pairedUpper("rightUpperArm", 0, 16, 0.68),
      pairedUpper("leftUpperLeg", 0, 16, 0.68),
      pairedUpper("rightUpperLeg", 0.5, 16, 0.68),
      pairedLower("leftLowerArm", 0, 22, 8, 0.68),
      pairedLower("rightLowerArm", 0.5, 22, 8, 0.68),
      pairedLower("leftLowerLeg", 0.5, 27, 10, 0.68),
      pairedLower("rightLowerLeg", 0, 27, 10, 0.68),
      { bone: "spine", phase: 0, duty: 0.5, neutral: 12, amplitude: 4 },
      { bone: "chest", phase: 0.08, duty: 0.5, neutral: 8, amplitude: 3 },
      { bone: "neck", phase: 0, duty: 0.5, neutral: 8, amplitude: 4 },
      { bone: "head", phase: 0, duty: 0.5, neutral: -7, amplitude: 2 },
      ...tail("leftLittleProximal", 0.5, -18, 6),
      ...tail("leftLittleIntermediate", 0.5, -14, 7),
      ...tail("leftLittleDistal", 0.5, -10, 8),
    ],
  },
};

/**
 * The reusable cat profile fixture. It packages the cat's core named movement
 * vocabulary so a host can bind it onto cat-like quadruped skeletons without
 * importing playground TypeScript clips.
 *
 * @author Samchon
 */
export const CAT_PROFILE: IAutoMovieProfile = {
  id: "cat",
  name: "cat",
  controls: [],
  drivers: [],
  limits: [],
  gaits: Object.values(CAT_GAITS),
};
