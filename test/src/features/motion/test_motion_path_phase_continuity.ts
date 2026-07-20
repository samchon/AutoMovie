import { followPathMotion, sampleMotion } from "@automovie/engine";
import { IAutoMovieKeyframe, IAutoMovieMotion } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const kf = (time: number, flexion: number): IAutoMovieKeyframe => ({
  time,
  pose: {
    skeleton: "s",
    root: null,
    joints: [{ bone: "leftLowerArm", flexion, abduction: null, twist: null }],
  },
  expression: null,
  easing: "linear",
  bezier: null,
});

/** A seamless triangle cycle: flexion 0 → 120 → 0 over 1 s. */
const gait: IAutoMovieMotion = {
  id: "swing",
  skeleton: "s",
  duration: 1,
  loop: true,
  keyframes: [kf(0, 0), kf(0.5, 120), kf(1, 0)],
};

const flexionAt = (motion: IAutoMovieMotion, time: number): number =>
  sampleMotion(motion, time).pose.joints.find((j) => j.bone === "leftLowerArm")!
    .flexion!;

/**
 * The gait phase never resets along a path: the corner only steers the root,
 * while keyframe times replicate the base cycle untouched, so the limb swing
 * sampled either side of the corner equals the base cycle at the same phase
 * (#597's continuity spirit applied to path walking).
 *
 * Scenarios (the L-path corner falls at t=2, mid-timeline):
 *
 * 1. Just before the corner (t=1.75, phase 0.75) the flexion equals the base
 *    cycle's 60°, and just after (t=2.25, phase 0.25) it is 60° again: the
 *    swing marches straight through the turn with no reset.
 * 2. At an exact keyframe past the corner (t=2.5, phase 0.5) the flexion is the
 *    base peak 120°.
 * 3. The same phase sampled in the first cycle (t=0.25) matches the phase sampled
 *    after the corner (t=2.25): cycle N and cycle N+2 agree.
 */
export const test_motion_path_phase_continuity = (): void => {
  const path = followPathMotion({
    id: "walk-swing",
    gait,
    waypoints: [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 2, y: 0, z: 2 },
    ],
    speed: 1,
    turnWindow: 1,
  });

  TestValidator.predicate(
    "phase 0.75 before the corner",
    nclose(flexionAt(path.motion, 1.75), 60),
  );
  TestValidator.predicate(
    "phase 0.25 after the corner",
    nclose(flexionAt(path.motion, 2.25), 60),
  );
  TestValidator.predicate(
    "base peak at the keyframe past the corner",
    nclose(flexionAt(path.motion, 2.5), 120),
  );
  TestValidator.predicate(
    "first cycle and post-corner cycle agree at equal phase",
    nclose(flexionAt(path.motion, 0.25), flexionAt(path.motion, 2.25)),
  );
};
