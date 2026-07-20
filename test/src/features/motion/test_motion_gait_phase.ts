import { gaitMotion } from "@automovie/engine";
import { IAutoMovieGait } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const GAIT: IAutoMovieGait = {
  name: "walk",
  period: 1,
  rootBob: { amplitude: 0.02, phase: 0, center: 0.01 },
  limbs: [
    { bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 30 },
    { bone: "rightUpperLeg", phase: 0.5, duty: 0.5, amplitude: 30 },
  ],
};

/**
 * `gaitMotion`'s phase offset (#1176): the clip's keyframe at local time `t`
 * samples the gait at `t + phase`, so a beat that opens mid-stride resumes the
 * previous beat's recorded cycle phase instead of restarting the walk.
 *
 * Scenarios (period 1, sampled at 4 even steps → times 0, .25, .5, .75, 1):
 *
 * 1. A quarter-period phase rotates the cycle: the phased clip's pose at keyframe
 *    `i` equals the unphased clip's pose at keyframe `i+1` (root bob included),
 *    while the keyframe TIMES stay the local clock.
 * 2. The offset preserves the seamless loop: the phased closing keyframe's pose
 *    equals its own first.
 * 3. Omitting the phase is the zero phase: byte-identical clips.
 * 4. A whole-period phase wraps back to the unphased cycle.
 * 5. A non-finite phase throws.
 */
export const test_motion_gait_phase = (): void => {
  const plain = gaitMotion("g", "sk", GAIT, 4);
  const phased = gaitMotion("g", "sk", GAIT, 4, 0.25);

  // 1. rotation by one sample step.
  for (let i = 0; i + 1 < plain.keyframes.length; ++i) {
    TestValidator.equals(
      `phased keyframe ${i} pose equals unphased keyframe ${i + 1}`,
      phased.keyframes[i]!.pose,
      plain.keyframes[i + 1]!.pose,
    );
    TestValidator.equals(
      `phased keyframe ${i} keeps its local time`,
      phased.keyframes[i]!.time,
      plain.keyframes[i]!.time,
    );
  }

  // 1b. the cycle meta records the seed so the NEXT beat's end-state computes
  // the true stride position: phase(t) = (phaseAt + t) % period.
  TestValidator.equals(
    "the phased clip stamps its phase into gaitCycle.phaseAt",
    phased.gaitCycle,
    { period: 1, phaseAt: 0.25 },
  );

  // 2. still a seamless loop.
  TestValidator.equals(
    "the phased closing keyframe repeats its first",
    phased.keyframes[phased.keyframes.length - 1]!.pose,
    phased.keyframes[0]!.pose,
  );

  // 3. omitted phase is the zero phase.
  TestValidator.equals(
    "an omitted phase is the zero phase",
    gaitMotion("g", "sk", GAIT, 4),
    gaitMotion("g", "sk", GAIT, 4, 0),
  );

  // 4. a whole period wraps around.
  TestValidator.equals(
    "a whole-period phase wraps to the unphased cycle",
    gaitMotion("g", "sk", GAIT, 4, GAIT.period),
    plain,
  );

  // 5. refusal.
  TestValidator.predicate(
    "a non-finite phase throws",
    throwsError(
      () => gaitMotion("g", "sk", GAIT, 4, Number.NaN),
      ["gait phase must be finite"],
    ),
  );
};
