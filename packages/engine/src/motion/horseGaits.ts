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

/**
 * The canonical horse gait library: the playground mount's walk/trot/gallop
 * vocabulary, plus a compact rear beat, expressed as profile data. The arm
 * bones are front legs and the leg bones are hind legs on this quadruped rig.
 *
 * @author Samchon
 */
export const HORSE_GAITS: Record<
  "walk" | "trot" | "gallop" | "rear",
  IAutoMovieGait
> = {
  walk: {
    name: "walk",
    period: 1,
    rootBob: { amplitude: 0.01, phase: 0, center: 0.01 },
    style: { weight: 0.35, springiness: 0.08, strideScale: 0.8 },
    limbs: [
      pairedUpper("leftUpperArm", 0.5, 16, 0.58),
      pairedUpper("rightUpperArm", 0, 16, 0.58),
      pairedUpper("leftUpperLeg", 0.5, 16, 0.58),
      pairedUpper("rightUpperLeg", 0, 16, 0.58),
      pairedLower("leftLowerArm", 0, 15.4, 6.6, 0.58),
      pairedLower("rightLowerArm", 0.5, 15.4, 6.6, 0.58),
      pairedLower("leftLowerLeg", 0, 15.4, 6.6, 0.58),
      pairedLower("rightLowerLeg", 0.5, 15.4, 6.6, 0.58),
      { bone: "spine", phase: 0, duty: 0.5, neutral: 4, amplitude: 1 },
      { bone: "neck", phase: 0.08, duty: 0.5, neutral: 6, amplitude: 2 },
    ],
  },
  trot: {
    name: "trot",
    period: 0.72,
    rootBob: { amplitude: 0.04, phase: 0, center: 0.05 },
    style: { weight: 0.25, springiness: 0.28, strideScale: 1 },
    limbs: [
      pairedUpper("leftUpperArm", 0.5, 28, 0.46),
      pairedUpper("rightUpperArm", 0, 28, 0.46),
      pairedUpper("leftUpperLeg", 0.5, 28, 0.46),
      pairedUpper("rightUpperLeg", 0, 28, 0.46),
      pairedLower("leftLowerArm", 0, 28, 12, 0.46),
      pairedLower("rightLowerArm", 0.5, 28, 12, 0.46),
      pairedLower("leftLowerLeg", 0, 28, 12, 0.46),
      pairedLower("rightLowerLeg", 0.5, 28, 12, 0.46),
      { bone: "spine", phase: 0, duty: 0.5, neutral: 4, amplitude: 2 },
    ],
  },
  gallop: {
    name: "gallop",
    period: 0.6,
    rootBob: { amplitude: 0.065, phase: 0.25, center: 0.095 },
    style: { weight: 0.18, springiness: 0.72, strideScale: 1.55 },
    limbs: [
      pairedUpper("leftUpperArm", 0.56, 46, 0.38),
      pairedUpper("rightUpperArm", 0.06, 46, 0.38),
      pairedUpper("leftUpperLeg", 0.56, 46, 0.38),
      pairedUpper("rightUpperLeg", 0.06, 46, 0.38),
      pairedLower("leftLowerArm", 0, 52, 22, 0.38),
      pairedLower("rightLowerArm", 0.5, 52, 22, 0.38),
      pairedLower("leftLowerLeg", 0, 52, 22, 0.38),
      pairedLower("rightLowerLeg", 0.5, 52, 22, 0.38),
      { bone: "spine", phase: 0.08, duty: 0.5, neutral: 8, amplitude: 3 },
      { bone: "neck", phase: 0.14, duty: 0.5, neutral: 8, amplitude: 3 },
    ],
  },
  rear: {
    name: "rear",
    period: 2.6,
    rootBob: { amplitude: 0.05, phase: 0, center: 0.01 },
    style: { crouch: 0.2, weight: 0.6, springiness: 0.36, strideScale: 0.35 },
    limbs: [
      {
        bone: "leftUpperArm",
        phase: 0,
        duty: 0.42,
        neutral: -56,
        amplitude: 22,
      },
      {
        bone: "rightUpperArm",
        phase: 0,
        duty: 0.42,
        neutral: -56,
        amplitude: 22,
      },
      pairedLower("leftLowerArm", 0.05, 88, 22, 0.42),
      pairedLower("rightLowerArm", 0.95, 88, 22, 0.42),
      {
        bone: "leftUpperLeg",
        phase: 0.08,
        duty: 0.5,
        neutral: 12,
        amplitude: 6,
      },
      {
        bone: "rightUpperLeg",
        phase: 0.08,
        duty: 0.5,
        neutral: 12,
        amplitude: 6,
      },
      pairedLower("leftLowerLeg", 0.1, 33, 3, 0.5),
      pairedLower("rightLowerLeg", 0.1, 33, 3, 0.5),
      { bone: "spine", phase: 0, duty: 0.42, neutral: -18.5, amplitude: 26.5 },
      { bone: "chest", phase: 0, duty: 0.42, neutral: -11, amplitude: 17 },
      { bone: "neck", phase: 0, duty: 0.42, neutral: -19, amplitude: 33 },
      { bone: "head", phase: 0.06, duty: 0.42, neutral: -4, amplitude: 22 },
    ],
  },
};

/**
 * The reusable horse profile fixture. It packages the mount's named movement
 * vocabulary so a host can bind it onto horse-like skeletons without importing
 * playground TypeScript clips.
 *
 * @author Samchon
 */
export const HORSE_PROFILE: IAutoMovieProfile = {
  id: "horse",
  name: "horse",
  controls: [],
  drivers: [],
  limits: [],
  gaits: Object.values(HORSE_GAITS),
};
