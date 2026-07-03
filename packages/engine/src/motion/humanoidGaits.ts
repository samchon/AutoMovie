import { IAutoFilmGait } from "@autofilm/interface";

/**
 * The five canonical humanoid gaits — the locomotion the `locomote` verb's
 * `gait` enum names (`walk`/`run`/`sprint`/`sneak`/`march`), as ready
 * {@link IAutoFilmGait} data a host drops into an actor context. Same role as
 * the engine's other canonical humanoid tables (ROM, joint axes): the shapes
 * are fixed, a body is what varies.
 *
 * Every gait is tuned to sit inside the humanoid ROM, which is the whole reason
 * `neutral` exists. Knees (flexion `[0, 150]°`, no hyperextension) swing about
 * a bent center; and the faster gaits carry the hips forward too — a sprint's
 * `±amplitude` swing would cross the hip's `−30°` floor without a forward
 * `neutral`. Slower is calmer: `sneak` crouches (a high knee center, quiet
 * arms) and holds the ground longer (high `duty`); `march` throws the knees
 * high; `sprint` is all reach and little contact (low `duty`).
 *
 * Left/right limbs are a half-cycle out of phase; arms lead their opposite leg
 * (contralateral swing). Feet are left to the (future) ground-IK pass, so these
 * drive hips, knees, and arms only.
 *
 * @author Samchon
 */
export const HUMANOID_GAITS: Record<
  "walk" | "run" | "sprint" | "sneak" | "march",
  IAutoFilmGait
> = {
  walk: {
    name: "walk",
    period: 0.95,
    limbs: [
      { bone: "leftUpperLeg", phase: 0, duty: 0.55, amplitude: 30 },
      { bone: "rightUpperLeg", phase: 0.5, duty: 0.55, amplitude: 30 },
      {
        bone: "leftLowerLeg",
        phase: 0.25,
        duty: 0.5,
        amplitude: 18,
        neutral: 22,
      },
      {
        bone: "rightLowerLeg",
        phase: 0.75,
        duty: 0.5,
        amplitude: 18,
        neutral: 22,
      },
      { bone: "leftUpperArm", phase: 0.5, duty: 0.5, amplitude: 18 },
      { bone: "rightUpperArm", phase: 0, duty: 0.5, amplitude: 18 },
    ],
  },
  run: {
    name: "run",
    period: 0.62,
    limbs: [
      {
        bone: "leftUpperLeg",
        phase: 0,
        duty: 0.42,
        amplitude: 42,
        neutral: 12,
      },
      {
        bone: "rightUpperLeg",
        phase: 0.5,
        duty: 0.42,
        amplitude: 42,
        neutral: 12,
      },
      {
        bone: "leftLowerLeg",
        phase: 0.3,
        duty: 0.5,
        amplitude: 32,
        neutral: 38,
      },
      {
        bone: "rightLowerLeg",
        phase: 0.8,
        duty: 0.5,
        amplitude: 32,
        neutral: 38,
      },
      { bone: "leftUpperArm", phase: 0.5, duty: 0.5, amplitude: 40 },
      { bone: "rightUpperArm", phase: 0, duty: 0.5, amplitude: 40 },
    ],
  },
  sprint: {
    name: "sprint",
    period: 0.48,
    limbs: [
      {
        bone: "leftUpperLeg",
        phase: 0,
        duty: 0.36,
        amplitude: 46,
        neutral: 18,
      },
      {
        bone: "rightUpperLeg",
        phase: 0.5,
        duty: 0.36,
        amplitude: 46,
        neutral: 18,
      },
      {
        bone: "leftLowerLeg",
        phase: 0.32,
        duty: 0.5,
        amplitude: 40,
        neutral: 45,
      },
      {
        bone: "rightLowerLeg",
        phase: 0.82,
        duty: 0.5,
        amplitude: 40,
        neutral: 45,
      },
      { bone: "leftUpperArm", phase: 0.5, duty: 0.5, amplitude: 52 },
      { bone: "rightUpperArm", phase: 0, duty: 0.5, amplitude: 52 },
    ],
  },
  sneak: {
    name: "sneak",
    period: 1.5,
    limbs: [
      { bone: "leftUpperLeg", phase: 0, duty: 0.62, amplitude: 20, neutral: 6 },
      {
        bone: "rightUpperLeg",
        phase: 0.5,
        duty: 0.62,
        amplitude: 20,
        neutral: 6,
      },
      {
        bone: "leftLowerLeg",
        phase: 0.25,
        duty: 0.5,
        amplitude: 15,
        neutral: 38,
      },
      {
        bone: "rightLowerLeg",
        phase: 0.75,
        duty: 0.5,
        amplitude: 15,
        neutral: 38,
      },
      { bone: "leftUpperArm", phase: 0.5, duty: 0.5, amplitude: 8 },
      { bone: "rightUpperArm", phase: 0, duty: 0.5, amplitude: 8 },
    ],
  },
  march: {
    name: "march",
    period: 0.82,
    limbs: [
      { bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 42, neutral: 12 },
      {
        bone: "rightUpperLeg",
        phase: 0.5,
        duty: 0.5,
        amplitude: 42,
        neutral: 12,
      },
      {
        bone: "leftLowerLeg",
        phase: 0.2,
        duty: 0.5,
        amplitude: 38,
        neutral: 42,
      },
      {
        bone: "rightLowerLeg",
        phase: 0.7,
        duty: 0.5,
        amplitude: 38,
        neutral: 42,
      },
      { bone: "leftUpperArm", phase: 0.5, duty: 0.5, amplitude: 30 },
      { bone: "rightUpperArm", phase: 0, duty: 0.5, amplitude: 30 },
    ],
  },
};
