import { followPathMotion } from "@automovie/engine";
import { IAutoMovieKeyframe, IAutoMovieMotion } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const kf = (time: number): IAutoMovieKeyframe => ({
  time,
  pose: { skeleton: "s", root: null, joints: [] },
  expression: null,
  easing: "linear",
  bezier: null,
});

const gait: IAutoMovieMotion = {
  id: "cycle",
  skeleton: "s",
  duration: 1,
  loop: true,
  keyframes: [kf(0), kf(1)],
};

const LINE = [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
];

/**
 * FollowPathMotion rejects degenerate input up front: rough types make these
 * runtime guards, and each has a passing twin so a guard never fires on valid
 * input.
 *
 * Scenarios:
 *
 * 1. Fewer than two waypoints is rejected; two distinct ones pass.
 * 2. Consecutive waypoints that coincide in XZ are rejected (a zero-length stretch
 *    has no direction); differing only in y still coincides, since waypoint y
 *    is ignored.
 * 3. Non-finite waypoint x / z are rejected by index.
 * 4. Zero, negative, and non-finite speed are rejected.
 * 5. A non-positive or non-finite gait duration is rejected.
 * 6. A negative or non-finite turn window is rejected.
 * 7. A non-finite scalar ground is rejected up front; a callback returning a
 *    non-finite height is rejected at evaluation.
 * 8. The passing twin: a huge requested speed still bakes at least one full cycle,
 *    with the effective speed snapped to the path.
 */
export const test_motion_path_guards = (): void => {
  TestValidator.predicate(
    "one waypoint rejected",
    throwsError(
      () =>
        followPathMotion({
          id: "p",
          gait,
          waypoints: [{ x: 0, y: 0, z: 0 }],
          speed: 1,
        }),
      "at least two waypoints",
    ),
  );
  TestValidator.predicate(
    "coincident waypoints rejected even when y differs",
    throwsError(
      () =>
        followPathMotion({
          id: "p",
          gait,
          waypoints: [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 5, z: 0 },
          ],
          speed: 1,
        }),
      "coincide in XZ",
    ),
  );
  TestValidator.predicate(
    "non-finite waypoint x rejected by index",
    throwsError(
      () =>
        followPathMotion({
          id: "p",
          gait,
          waypoints: [
            { x: 0, y: 0, z: 0 },
            { x: Number.NaN, y: 0, z: 0 },
          ],
          speed: 1,
        }),
      "waypoint[1].x",
    ),
  );
  TestValidator.predicate(
    "non-finite waypoint z rejected by index",
    throwsError(
      () =>
        followPathMotion({
          id: "p",
          gait,
          waypoints: [
            { x: 0, y: 0, z: Number.POSITIVE_INFINITY },
            { x: 1, y: 0, z: 0 },
          ],
          speed: 1,
        }),
      "waypoint[0].z",
    ),
  );
  for (const speed of [0, -1, Number.NaN])
    TestValidator.predicate(
      `speed ${speed} rejected`,
      throwsError(
        () => followPathMotion({ id: "p", gait, waypoints: LINE, speed }),
        "path speed",
      ),
    );
  TestValidator.predicate(
    "non-positive gait duration rejected",
    throwsError(
      () =>
        followPathMotion({
          id: "p",
          gait: { ...gait, duration: 0 },
          waypoints: LINE,
          speed: 1,
        }),
      "path gait duration",
    ),
  );
  for (const turnWindow of [-1, Number.NaN])
    TestValidator.predicate(
      `turn window ${turnWindow} rejected`,
      throwsError(
        () =>
          followPathMotion({
            id: "p",
            gait,
            waypoints: LINE,
            speed: 1,
            turnWindow,
          }),
        "path turn window",
      ),
    );
  TestValidator.predicate(
    "non-finite scalar ground rejected up front",
    throwsError(
      () =>
        followPathMotion({
          id: "p",
          gait,
          waypoints: LINE,
          speed: 1,
          ground: Number.NaN,
        }),
      "path ground height must be finite",
    ),
  );
  TestValidator.predicate(
    "non-finite callback ground rejected at evaluation",
    throwsError(
      () =>
        followPathMotion({
          id: "p",
          gait,
          waypoints: LINE,
          speed: 1,
          ground: () => Number.NaN,
        }),
      "ground height at",
    ),
  );

  const sprint = followPathMotion({
    id: "p",
    gait,
    waypoints: LINE,
    speed: 100,
  });
  TestValidator.equals("at least one cycle", sprint.cycles, 1);
  TestValidator.equals("effective speed snapped to the path", sprint.speed, 1);
};
