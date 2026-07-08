import {
  arrangeMotion,
  followPathMotion,
  gaitMotion,
  holdMotion,
  sequenceMotion,
  travelMotion,
} from "@automovie/engine";
import { IAutoMovieGait, IAutoMovieMotion } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint, keyframe, makeMotion, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const WALK: IAutoMovieGait = {
  name: "walk",
  period: 0.8,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

/** A 1-second cycle-less one-shot (an authored swing). */
const oneShot = (): IAutoMovieMotion => ({
  ...makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })])),
      keyframe(1, makePose([joint("leftLowerArm", { flexion: 90 })])),
    ],
    1,
  ),
  skeleton: "h", // match the gait bake so sequence/arrange compose
});

/**
 * The gait-cycle provenance meta (#650): producers that bake or compose a
 * cyclic locomotion stamp `gaitCycle` so a non-looping composite still knows
 * its stride phase, and composition adjusts or honestly drops it.
 *
 * Scenarios:
 *
 * 1. `gaitMotion` stamps `{period, phaseAt: 0}` — the bake is one fresh cycle.
 * 2. `travelMotion` carries the base's cycle; a cycle-less looping base gets one
 *    stamped from its own duration (travel repeats it cyclically).
 * 3. `followPathMotion` stamps the gait's cycle (phase never resets on paths).
 * 4. `arrangeMotion` carries the LAST placement's cycle phase-shifted by its start
 *    (`(0 − 2.3) mod 0.8 = 0.1`); a cycle-less last placement (a hold after the
 *    walk) drops the clock — the actor is not striding at the end.
 * 5. `sequenceMotion` keeps the clock when every part shares the cycle over whole
 *    cycles, and drops it on a period mismatch or a partial cycle.
 * 6. `holdMotion` carries no cycle at all.
 */
export const test_motion_gait_cycle_meta = (): void => {
  const cycle = gaitMotion("walk", "h", WALK, 8);
  TestValidator.equals("gaitMotion stamps the cycle", cycle.gaitCycle, {
    period: 0.8,
    phaseAt: 0,
  });

  const travel = travelMotion("t", cycle, 3, { x: 1, y: 0, z: 0 });
  TestValidator.equals(
    "travelMotion carries the base cycle",
    travel.gaitCycle,
    { period: 0.8, phaseAt: 0 },
  );
  const bareLoop: IAutoMovieMotion = { ...oneShot(), loop: true };
  TestValidator.equals(
    "cycle-less base gets stamped from its duration",
    travelMotion("t2", bareLoop, 2, { x: 1, y: 0, z: 0 }).gaitCycle,
    { period: 1, phaseAt: 0 },
  );

  const path = followPathMotion({
    id: "p",
    gait: cycle,
    waypoints: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 2 },
    ],
    speed: 1,
  });
  TestValidator.equals(
    "followPathMotion stamps the cycle",
    path.motion.gaitCycle,
    {
      period: 0.8,
      phaseAt: 0,
    },
  );

  const arrangedWalkLast = arrangeMotion("a", [
    { start: 0, motion: oneShot() },
    { start: 2.3, motion: travel },
  ]);
  TestValidator.predicate(
    "arrange shifts the last placement's phase by its start",
    arrangedWalkLast.gaitCycle !== null &&
      arrangedWalkLast.gaitCycle !== undefined &&
      nclose(arrangedWalkLast.gaitCycle.period, 0.8) &&
      nclose(arrangedWalkLast.gaitCycle.phaseAt, ((0 - 2.3) % 0.8) + 0.8),
  );
  const arrangedHoldLast = arrangeMotion("a2", [
    { start: 0, motion: travel },
    { start: 3, motion: oneShot() },
  ]);
  TestValidator.equals(
    "a cycle-less last placement drops the clock",
    arrangedHoldLast.gaitCycle,
    null,
  );

  const repeated = sequenceMotion("s", [travel, travel]);
  TestValidator.equals(
    "whole-cycle repetition keeps the clock",
    repeated.gaitCycle,
    { period: 0.8, phaseAt: 0 },
  );
  const otherCycle: IAutoMovieMotion = {
    ...travel,
    gaitCycle: { period: 0.5, phaseAt: 0 },
  };
  TestValidator.equals(
    "a period mismatch drops the clock",
    sequenceMotion("s2", [travel, otherCycle]).gaitCycle,
    null,
  );
  const partial: IAutoMovieMotion = {
    ...travel,
    duration: 1.0, // not a whole multiple of 0.8
  };
  TestValidator.equals(
    "a partial cycle drops the clock",
    sequenceMotion("s3", [partial, partial]).gaitCycle,
    null,
  );
  TestValidator.equals(
    "a cycle-less first part drops the clock",
    sequenceMotion("s4", [oneShot(), travel]).gaitCycle,
    null,
  );
  TestValidator.equals(
    "a cycle-less LATER part drops the clock",
    sequenceMotion("s5", [travel, { ...oneShot(), duration: 0.8 }]).gaitCycle,
    null,
  );
  const shifted: IAutoMovieMotion = {
    ...travel,
    gaitCycle: { period: 0.8, phaseAt: 0.4 },
  };
  TestValidator.equals(
    "a phase mismatch drops the clock",
    sequenceMotion("s6", [travel, shifted]).gaitCycle,
    null,
  );

  TestValidator.equals(
    "holdMotion carries no cycle",
    holdMotion("h", "h", makePose([]), 1).gaitCycle,
    undefined,
  );
};
