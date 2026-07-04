import { gaitMotion, validateMotion } from "@automovie/engine";
import { AutoMovieHumanoidBone, IAutoMovieGait } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton } from "../internal/fixtures";
import { hasViolation, nclose } from "../internal/predicates";

const GAIT: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [
    { bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 30 },
    { bone: "rightUpperLeg", phase: 0.5, duty: 0.5, amplitude: 30 },
  ],
};

const flexionSeq = (
  motion: ReturnType<typeof gaitMotion>,
  bone: AutoMovieHumanoidBone,
): number[] =>
  motion.keyframes.map(
    (k) => k.pose.joints.find((j) => j.bone === bone)!.flexion!,
  );

/**
 * `gaitMotion` — synthesise a declarative {@link IAutoMovieGait} into a looping
 * clip. The difference between a creature's gaits lives entirely in the
 * per-limb phase / duty / amplitude data, not the code.
 *
 * Scenarios (period 1, duty 0.5, amplitude 30, sampled at 4 even steps):
 *
 * 1. The clip is a one-period seamless loop: 5 keyframes (the closing one
 *    repeating t=0), duration = period, loop = true.
 * 2. A phase-0 limb sweeps the stance→swing sawtooth +30 → 0 → −30 → 0 → +30
 *    (planted push, then recovery), the closing frame matching the first.
 * 3. A phase-0.5 limb runs exactly half a cycle out of step — the per-limb phase
 *    offset that makes one gait a walk and another a trot.
 * 4. `neutral` centers the swing: a knee swung symmetrically about zero crosses
 *    into hyperextension and the ROM validator rejects it, while the same swing
 *    centered on `neutral: 25` stays inside `[0, 150]°` and passes.
 * 5. A limb can target `abduction` instead of the default `flexion`.
 * 6. Multiple rows for one bone fold into a single multi-axis joint pose.
 * 7. Stance and swing can use different named easing curves while keeping the same
 *    endpoints.
 * 8. `cubicBezier` stance/swing phases use their own control points instead of
 *    falling back to linear.
 * 9. `rootBob` adds a vertical identity-TRS root curve while plain gaits keep
 *    `root: null`.
 * 10. Duplicate same-bone/same-axis rows are rejected instead of silently
 *     overwriting earlier profile data.
 */
export const test_motion_gait = (): void => {
  const motion = gaitMotion("g", "sk", GAIT, 4);

  // 1. loop shape
  TestValidator.equals(
    "five keyframes (closing repeat)",
    motion.keyframes.length,
    5,
  );
  TestValidator.predicate("duration is the period", nclose(motion.duration, 1));
  TestValidator.equals("clip loops", motion.loop, true);
  TestValidator.equals("skeleton stamped", motion.skeleton, "sk");
  TestValidator.predicate(
    "plain gait keeps root unset",
    motion.keyframes.every((k) => k.pose.root === null),
  );

  // 2. phase-0 limb: the stance→swing sawtooth, ends where it began
  const left = flexionSeq(motion, "leftUpperLeg");
  TestValidator.predicate(
    "phase-0 sweeps +30 → 0 → −30 → 0 → +30",
    [30, 0, -30, 0, 30].every((v, i) => nclose(left[i]!, v)),
  );

  // 3. phase-0.5 limb is the half-cycle inverse at every frame
  const right = flexionSeq(motion, "rightUpperLeg");
  TestValidator.predicate(
    "phase-0.5 limb is half a cycle out of step",
    right.every((v, i) => nclose(v, -left[i]!)),
  );

  // 4. neutral centers the swing — the knee's negative twin
  const sk = createSkeleton();
  const kneeGait = (neutral: number | undefined): IAutoMovieGait => ({
    name: "step",
    period: 1,
    limbs: [
      { bone: "leftLowerLeg", phase: 0, duty: 0.5, amplitude: 22, neutral },
    ],
  });
  const hyperextended = validateMotion({
    motion: gaitMotion("bare", sk.id, kneeGait(undefined), 4),
    skeleton: sk,
  });
  TestValidator.predicate(
    "a knee swung about zero hyperextends (ROM rejects it)",
    hasViolation(hyperextended, "rom", "leftLowerLeg") ||
      hasViolation(hyperextended, "rom", "flexion"),
  );
  const centered = validateMotion({
    motion: gaitMotion("bent", sk.id, kneeGait(25), 4),
    skeleton: sk,
  });
  TestValidator.equals(
    "the same swing centered on neutral 25 stays in ROM",
    centered.success,
    true,
  );
  const knee = flexionSeq(
    gaitMotion("bent", sk.id, kneeGait(25), 4),
    "leftLowerLeg",
  );
  TestValidator.predicate(
    "the centered swing is 25 ± 22 (every sample positive)",
    knee.every((v) => v >= 0) && nclose(Math.max(...knee), 47),
  );

  // 5. non-flexion axis target
  const sideGait = gaitMotion(
    "side",
    sk.id,
    {
      name: "side",
      period: 1,
      limbs: [
        {
          bone: "leftUpperArm",
          axis: "abduction",
          phase: 0,
          duty: 0.5,
          amplitude: 12,
        },
      ],
    },
    4,
  );
  const sideSeq = sideGait.keyframes.map((k) => k.pose.joints[0]!.abduction!);
  TestValidator.predicate(
    "abduction limb writes the sawtooth to abduction",
    [12, 0, -12, 0, 12].every((v, i) => nclose(sideSeq[i]!, v)),
  );
  TestValidator.predicate(
    "abduction limb leaves the other axes unset",
    sideGait.keyframes.every((k) => {
      const joint = k.pose.joints[0]!;
      return joint.flexion === null && joint.twist === null;
    }),
  );
  TestValidator.equals(
    "abduction gait validates against the skeleton",
    validateMotion({ motion: sideGait, skeleton: sk }).success,
    true,
  );

  // 6. same-bone limb rows fold into one multi-axis joint
  const multiAxis = gaitMotion(
    "multi",
    sk.id,
    {
      name: "multi",
      period: 1,
      limbs: [
        { bone: "leftUpperArm", phase: 0, duty: 0.5, amplitude: 10 },
        {
          bone: "leftUpperArm",
          axis: "abduction",
          phase: 0,
          duty: 0.5,
          amplitude: 12,
        },
      ],
    },
    4,
  );
  TestValidator.predicate(
    "same-bone gait rows emit one joint per keyframe",
    multiAxis.keyframes.every((k) => k.pose.joints.length === 1),
  );
  TestValidator.predicate(
    "multi-axis joint carries both flexion and abduction",
    multiAxis.keyframes.every((k, i) => {
      const joint = k.pose.joints[0]!;
      const flexion = [10, 0, -10, 0, 10][i]!;
      const abduction = [12, 0, -12, 0, 12][i]!;
      return (
        nclose(joint.flexion!, flexion) && nclose(joint.abduction!, abduction)
      );
    }),
  );
  TestValidator.equals(
    "multi-axis gait validates against the skeleton",
    validateMotion({ motion: multiAxis, skeleton: sk }).success,
    true,
  );

  // 7. per-phase named easing curves
  const eased = flexionSeq(
    gaitMotion(
      "eased",
      sk.id,
      {
        name: "eased",
        period: 1,
        limbs: [
          {
            bone: "leftUpperLeg",
            phase: 0,
            duty: 0.5,
            amplitude: 30,
            stanceEasing: "easeIn",
            swingEasing: "easeOut",
          },
        ],
      },
      8,
    ),
    "leftUpperLeg",
  );
  TestValidator.predicate(
    "easeIn stance and easeOut swing shape the sawtooth",
    [30, 26.25, 15, -3.75, -30, -3.75, 15, 26.25, 30].every((v, i) =>
      nclose(eased[i]!, v),
    ),
  );

  // 8. cubic-bezier phase controls
  const bezier = flexionSeq(
    gaitMotion(
      "bezier",
      sk.id,
      {
        name: "bezier",
        period: 1,
        limbs: [
          {
            bone: "leftUpperLeg",
            phase: 0,
            duty: 0.5,
            amplitude: 30,
            stanceEasing: "cubicBezier",
            stanceBezier: [0.42, 0, 1, 1],
            swingEasing: "cubicBezier",
            swingBezier: [0, 0, 0.58, 1],
          },
        ],
      },
      8,
    ),
    "leftUpperLeg",
  );
  TestValidator.predicate(
    "cubicBezier stance and swing use phase control points",
    [30, 24.392, 11.079, -7.312, -30, -7.312, 11.079, 24.392, 30].every(
      (v, i) => nclose(bezier[i]!, v, 1e-3),
    ),
  );

  // 9. optional vertical root bob
  const bobbing = gaitMotion(
    "bob",
    sk.id,
    {
      name: "bob",
      period: 1,
      rootBob: { amplitude: 0.08, phase: 0, center: 1 },
      limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 20 }],
    },
    4,
  );
  const rootY = bobbing.keyframes.map((k) => k.pose.root!.translation.y);
  TestValidator.predicate(
    "root bob follows the gait sine",
    [1, 1.08, 1, 0.92, 1].every((v, i) => nclose(rootY[i]!, v)),
  );
  TestValidator.predicate(
    "root bob is identity TRS except vertical translation",
    bobbing.keyframes.every((k) => {
      const root = k.pose.root!;
      return (
        nclose(root.translation.x, 0) &&
        nclose(root.translation.z, 0) &&
        nclose(root.rotation.x, 0) &&
        nclose(root.rotation.y, 0) &&
        nclose(root.rotation.z, 0) &&
        nclose(root.rotation.w, 1) &&
        nclose(root.scale.x, 1) &&
        nclose(root.scale.y, 1) &&
        nclose(root.scale.z, 1)
      );
    }),
  );
  TestValidator.equals(
    "root bob still validates against the skeleton",
    validateMotion({ motion: bobbing, skeleton: sk }).success,
    true,
  );

  // 10. duplicate same-bone/same-axis rows are an authoring error
  TestValidator.error("duplicate gait rows for one bone axis throw", () =>
    gaitMotion(
      "duplicate",
      sk.id,
      {
        name: "duplicate",
        period: 1,
        limbs: [
          { bone: "leftUpperArm", phase: 0, duty: 0.5, amplitude: 10 },
          {
            bone: "leftUpperArm",
            axis: "flexion",
            phase: 0.25,
            duty: 0.5,
            amplitude: 12,
          },
        ],
      },
      4,
    ),
  );
};
