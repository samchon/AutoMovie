import { followPathMotion } from "@automovie/engine";
import {
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const BOB = 0.05;

const kf = (time: number): IAutoMovieKeyframe => ({
  time,
  pose: {
    skeleton: "s",
    root: {
      translation: { x: 0, y: BOB, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    joints: [],
  },
  expression: null,
  easing: "linear",
  bezier: null,
});

/** A 1 s cycle whose root carries a constant vertical bob of 0.05. */
const gait: IAutoMovieMotion = {
  id: "bob",
  skeleton: "s",
  duration: 1,
  loop: true,
  keyframes: [kf(0), kf(1)],
};

/** Straight 4 m along +X — with garbage waypoint `y` that must be ignored. */
const RAMP: IAutoMovieVector3[] = [
  { x: 0, y: 7, z: 0 },
  { x: 4, y: 7, z: 0 },
];

const rootAt = (motion: IAutoMovieMotion, time: number) =>
  motion.keyframes.find((k) => nclose(k.time, time))!.pose.root!;

/**
 * Root height follows the ground source, not the waypoints: waypoint `y` is
 * ignored, the height comes from a plane scalar or an `(x, z) → y` callback,
 * and any vertical bob the gait's own root carries rides on top. The frames
 * sidecar reports the bare path point (ground height without the bob), so a
 * later pass reads the terrain, not the gait.
 *
 * Scenarios (straight 4 m path, speed 1 → 4 cycles, waypoint y = 7 everywhere):
 *
 * 1. Callback slope y = 0.5·x: root y is bob + 0.5 at x=1 and bob + 1.5 at x=3 —
 *    following the ramp, oblivious to the waypoint 7.
 * 2. The frame's path point carries the bare ground height (0.5 at x=1), the bob
 *    stays on the root only.
 * 3. Scalar plane 2: root y is bob + 2 all along.
 * 4. Default ground (omitted): root y is just the bob.
 * 5. Horizontal progress is unaffected by height: x=1 at t=1 in every case.
 */
export const test_motion_path_ground = (): void => {
  const slope = followPathMotion({
    id: "walk-slope",
    gait,
    waypoints: RAMP,
    speed: 1,
    ground: (x) => 0.5 * x,
  });
  TestValidator.predicate(
    "slope y at x=1",
    nclose(rootAt(slope.motion, 1).translation.y, BOB + 0.5),
  );
  TestValidator.predicate(
    "slope y at x=3",
    nclose(rootAt(slope.motion, 3).translation.y, BOB + 1.5),
  );
  TestValidator.predicate(
    "frame carries bare ground height",
    nclose(slope.frames.find((f) => nclose(f.time, 1))!.position.y, 0.5),
  );

  const plane = followPathMotion({
    id: "walk-plane",
    gait,
    waypoints: RAMP,
    speed: 1,
    ground: 2,
  });
  TestValidator.predicate(
    "scalar plane y",
    nclose(rootAt(plane.motion, 3).translation.y, BOB + 2),
  );

  const flat = followPathMotion({
    id: "walk-flat",
    gait,
    waypoints: RAMP,
    speed: 1,
  });
  TestValidator.predicate(
    "default ground keeps only the bob",
    nclose(rootAt(flat.motion, 3).translation.y, BOB),
  );

  TestValidator.predicate(
    "horizontal progress ignores height",
    nclose(rootAt(slope.motion, 1).translation.x, 1) &&
      nclose(rootAt(plane.motion, 1).translation.x, 1) &&
      nclose(rootAt(flat.motion, 1).translation.x, 1),
  );
};
