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
};
