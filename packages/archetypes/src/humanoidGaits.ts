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
 * Left/right limbs are a half-cycle out of phase, and each arm leads the
 * opposite leg for contralateral counter-swing. Feet are left to the future
 * ground-IK pass, so these drive hips, knees, and upper arms.
 *
 * `locomote` carries the authored gait as `fullBody`. Layer safety is decided
 * from the root/bones/expression the synthesized clips actually carry after
 * masking, not from the broad region names: this counter-swing can layer with a
 * head-only look, but correctly conflicts with a simultaneous arm gesture.
 *
 * @author Samchon
 * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Owns period, phase, duty, amplitude, and limb relationships as declared humanoid gait data.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Supplies the compact deterministic rule data sampled by the motion engine.
 * @evidenceExclude requirements/motion/README.md#동작-요구사항 Static gait tables implement procedural locomotion data, not the complete clip, root, contact, IK, interaction, timing, and validation family.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-general-procedural-control These tables describe locomotion gaits only; project-defined machine and object controls use their own profiles.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-procedural-variation The shipped tables contain fixed values and no seeded subject variation law.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-terrain-adaptation Gait data has no ground query, slope solve, or terrain-support decision.
 * @evidenceExclude requirements/motion/procedural-motion-and-gaits.md#motion-procedural-bound Finite table entries do not declare solver search, terrain, speed, turn, or population bounds.
 * @evidenceExclude specifications/performance-motion-and-staging/README.md#퍼포먼스-모션과-스테이징-시스템-명세 Gait data is one kinematics input and not the complete performance, formation, or staging system.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Limb duty is a waveform phase, not a world contact identity, support set, load share, or weight solve.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-gaze-expression-attention The gait table drives limbs and does not solve gaze, facial expression, or attention ownership.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Static gait samples do not create attachment, handoff, ownership, or object-interaction events.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice The tables contain no secondary-motion domain, moving boundary, solver, or bake policy.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-retarget-scale-contact Profiles are selectable data but do not compute rig mapping, scale retarget, or contact re-resolution.
 * @evidenceExclude specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-determinism-compatibility Deterministic interaction receipts and compatibility statuses belong to the sampling and interaction pipeline.
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

/**
 * The canonical humanoid profile fixture: the same locomotion vocabulary as
 * {@link HUMANOID_GAITS}, packaged as reusable profile data so a host can bind
 * it onto any humanoid skeleton without hand-authored TypeScript clips.
 *
 * @author Samchon
 * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-procedural-rule-selection Packages the named table as a host-selectable humanoid profile.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Keeps the reusable rule vocabulary in profile data rather than engine heuristics.
 */
export const HUMANOID_PROFILE: IAutoMovieProfile = {
  id: "humanoid",
  name: "humanoid",
  controls: [],
  drivers: [],
  limits: [],
  gaits: Object.values(HUMANOID_GAITS),
};
