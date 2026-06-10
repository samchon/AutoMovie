import { gaitMotion } from "@autofilm/engine";
import { AutoFilmHumanoidBone, IAutoFilmGait } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const GAIT: IAutoFilmGait = {
  name: "walk",
  period: 1,
  limbs: [
    { bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 30 },
    { bone: "rightUpperLeg", phase: 0.5, duty: 0.5, amplitude: 30 },
  ],
};

const flexionSeq = (
  motion: ReturnType<typeof gaitMotion>,
  bone: AutoFilmHumanoidBone,
): number[] =>
  motion.keyframes.map(
    (k) => k.pose.joints.find((j) => j.bone === bone)!.flexion!,
  );

/**
 * `gaitMotion` — synthesise a declarative {@link IAutoFilmGait} into a looping
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
};
