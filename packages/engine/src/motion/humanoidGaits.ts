import { IAutoMovieGait, IAutoMovieProfile } from "@automovie/interface";

/**
 * The five canonical humanoid gaits, the locomotion the `locomote` verb's
 * `gait` enum names (`walk`/`run`/`sprint`/`sneak`/`march`), as ready
 * {@link IAutoMovieGait} data a host drops into an actor context. Same role as
 * the engine's other canonical humanoid tables (ROM, joint axes): the shapes
 * are fixed, a body is what varies.
 *
 * Every gait is tuned to sit inside the humanoid ROM, which is the whole reason
 * `neutral` exists. Knees (flexion `[0, 150]°`, no hyperextension) swing about
 * a bent center; and the faster gaits carry the hips forward too: a sprint's
 * `±amplitude` swing would cross the hip's `−30°` floor without a forward
 * `neutral`. Slower is calmer: `sneak` crouches (a high knee center) and holds
 * the ground longer (high `duty`); `march` throws the knees high; `sprint` is
 * all reach and little contact (low `duty`).
 *
 * Left/right limbs are a half-cycle out of phase. Feet are left to the (future)
 * ground-IK pass, so these drive **hips and knees only**, which is exactly what
 * `lowerBody` owns.
 *
 * **They used to counter-swing the arms, and that had to go (#1359).** The arms
 * are `upperBody`, `locomote`'s default region is `lowerBody`, and #1349 turned
 * masked content from a silent drop into a violation, so the engine's own
 * shipped gait was refused by the engine's own default region: every plain walk
 * failed to perform and the repository's flagship film page threw on load. Of
 * the three ways out, this is the one that costs no contract:
 *
 * - Widening `locomote`'s default to `fullBody` does NOT work on its own. The
 *   overlap gate refuses `fullBody` beside any partial region, and the film
 *   page's own beat runs `locomote` + `lookAt` on one actor, so the page still
 *   failed to mount when that was tried. The region label is a proxy for
 *   content in TWO places, the mask and that gate, and widening trips the
 *   second; making the gate content-aware is a larger change to a documented
 *   agent-facing rule than the defect warrants.
 * - Reporting the drop as advice instead of a violation reopens what #1349
 *   closed: a retargeted quadruped's front legs (which ride the ARM chains)
 *   would be frozen again with a note, and the benchmark measured the refusal
 *   as the thing that made an agent read the guide and fix its region.
 * - So the CONTENT changes instead: the table now authors only what the verb's
 *   default region carries, which is what "the shipped defaults must agree"
 *   means when the region model is the fixed half.
 *
 * The arm swing never reached a rendered performance either way (it was masked
 * before #1349 and refused after), so nothing that ever played is lost. Getting
 * it back is a real improvement and it needs the region model to carry it
 * first: a `locomote` whose region owns the arms, and an overlap gate that
 * compares authored bones rather than region names, so a walk can still layer
 * with a look.
 *
 * @author Samchon
 */
export const HUMANOID_GAITS: Record<
  "walk" | "run" | "sprint" | "sneak" | "march",
  IAutoMovieGait
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
    ],
  },
};

/**
 * The canonical humanoid profile fixture: the same locomotion vocabulary as
 * {@link HUMANOID_GAITS}, packaged as reusable profile data so a host can bind
 * it onto any humanoid skeleton without hand-authored TypeScript clips.
 *
 * @author Samchon
 */
export const HUMANOID_PROFILE: IAutoMovieProfile = {
  id: "humanoid",
  name: "humanoid",
  controls: [],
  drivers: [],
  limits: [],
  gaits: Object.values(HUMANOID_GAITS),
};
