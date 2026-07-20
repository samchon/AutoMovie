import { Quaternion, followPathMotion } from "@automovie/engine";
import {
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, qclose, vclose } from "../internal/predicates";

const kf = (time: number): IAutoMovieKeyframe => ({
  time,
  pose: { skeleton: "s", root: null, joints: [] },
  expression: null,
  easing: "linear",
  bezier: null,
});

/** A seamless 1 s in-place cycle keyed at quarter steps. */
const gait: IAutoMovieMotion = {
  id: "cycle",
  skeleton: "s",
  duration: 1,
  loop: true,
  keyframes: [kf(0), kf(0.25), kf(0.5), kf(0.75), kf(1)],
};

/** An L: 2 m along +X, then 2 m along +Z. Total arc length 4. */
const L_PATH: IAutoMovieVector3[] = [
  { x: 0, y: 0, z: 0 },
  { x: 2, y: 0, z: 0 },
  { x: 2, y: 0, z: 2 },
];

const rootAt = (motion: IAutoMovieMotion, time: number) =>
  motion.keyframes.find((k) => nclose(k.time, time))!.pose.root!;

/**
 * FollowPathMotion bakes a gait along a waypoint polyline: the root follows arc
 * length at the snapped speed, passes exactly through each waypoint, and faces
 * the path tangent, blending linearly across a corner window instead of
 * snapping, unless the window is zero.
 *
 * Scenarios (L-path, speed 1 → 4 whole cycles, effective speed 1):
 *
 * 1. Arc-length oracle: the root sits at (1,0,0) at t=1 (mid first stretch), at
 *    the corner waypoint (2,0,0) at t=2, at (2,0,1) at t=3, and ends exactly on
 *    the final waypoint (2,0,2) at t=4.
 * 2. Facing oracle (turnWindow 1 → blend s∈[1.5, 2.5]): yaw 90° mid first stretch
 *    (outside the window), 45° exactly at the corner (half-blended), 22.5° at
 *    s=2.25 (three-quarters through), 0° once past the window, and the root
 *    rotation quaternion equals the yaw about +Y (base root is null, so facing
 *    composes onto identity).
 * 3. The frames sidecar mirrors the bake: one frame per keyframe carrying the path
 *    point, the blended yaw, and the matching unit tangent.
 * 4. TurnWindow 0 snaps: still 90° at the corner boundary (boundaries belong to
 *    the earlier stretch), already 0° just past it.
 * 5. The report is exact: length 4, cycles 4, effective speed 1, and the
 *    non-looping clip spans 4 s with the seam keyframes deduplicated.
 */
export const test_motion_path_locomotion = (): void => {
  const path = followPathMotion({
    id: "walk-L",
    gait,
    waypoints: L_PATH,
    speed: 1,
    turnWindow: 1,
  });

  TestValidator.predicate(
    "mid first stretch at t=1",
    vclose(rootAt(path.motion, 1).translation, { x: 1, y: 0, z: 0 }),
  );
  TestValidator.predicate(
    "corner waypoint at t=2",
    vclose(rootAt(path.motion, 2).translation, { x: 2, y: 0, z: 0 }),
  );
  TestValidator.predicate(
    "mid second stretch at t=3",
    vclose(rootAt(path.motion, 3).translation, { x: 2, y: 0, z: 1 }),
  );
  TestValidator.predicate(
    "ends on the final waypoint",
    vclose(rootAt(path.motion, 4).translation, { x: 2, y: 0, z: 2 }),
  );

  const yawOf = (time: number) =>
    path.frames.find((f) => nclose(f.time, time))!.yawDeg;
  TestValidator.predicate("yaw 90 mid stretch", nclose(yawOf(1), 90));
  TestValidator.predicate("yaw 45 at the corner", nclose(yawOf(2), 45));
  TestValidator.predicate("yaw 22.5 at s=2.25", nclose(yawOf(2.25), 22.5));
  TestValidator.predicate("yaw 0 past the window", nclose(yawOf(3), 0));
  TestValidator.predicate(
    "root rotation equals the blended yaw",
    qclose(
      rootAt(path.motion, 2).rotation,
      Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 45),
    ),
  );

  const corner = path.frames.find((f) => nclose(f.time, 2))!;
  TestValidator.predicate(
    "frame carries the path point",
    vclose(corner.position, { x: 2, y: 0, z: 0 }),
  );
  TestValidator.predicate(
    "frame tangent matches its yaw",
    vclose(corner.tangent, {
      x: Math.sin(Math.PI / 4),
      y: 0,
      z: Math.cos(Math.PI / 4),
    }),
  );
  TestValidator.equals(
    "one frame per keyframe",
    path.frames.length,
    path.motion.keyframes.length,
  );

  const snap = followPathMotion({
    id: "walk-snap",
    gait,
    waypoints: L_PATH,
    speed: 1,
    turnWindow: 0,
  });
  const snapYaw = (time: number) =>
    snap.frames.find((f) => nclose(f.time, time))!.yawDeg;
  TestValidator.predicate(
    "snap keeps 90 at the boundary",
    nclose(snapYaw(2), 90),
  );
  TestValidator.predicate("snap is 0 just past it", nclose(snapYaw(2.5), 0));

  TestValidator.predicate("length 4", nclose(path.length, 4));
  TestValidator.equals("four cycles", path.cycles, 4);
  TestValidator.predicate("effective speed 1", nclose(path.speed, 1));
  TestValidator.equals("clip does not loop", path.motion.loop, false);
  TestValidator.predicate("duration 4", nclose(path.motion.duration, 4));
  TestValidator.equals(
    "seam keyframes deduplicated",
    path.motion.keyframes.length,
    17,
  );

  // 6. a model-frame lateral sway rotates with the path facing, and the seam
  //    keyframe carries the incoming cycle's first-segment easing
  const swayRoot = {
    translation: { x: 0.1, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  };
  const sway: IAutoMovieMotion = {
    id: "sway",
    skeleton: "s",
    duration: 1,
    loop: true,
    keyframes: [
      {
        ...kf(0),
        easing: "easeIn",
        pose: { skeleton: "s", root: swayRoot, joints: [] },
      },
      {
        ...kf(1),
        easing: "step",
        pose: { skeleton: "s", root: swayRoot, joints: [] },
      },
    ],
  };
  const straight = followPathMotion({
    id: "sway-straight",
    gait: sway,
    waypoints: [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ],
    speed: 1,
    turnWindow: 0,
  });
  // heading +X is yaw 90°, which maps the model's +X sway to world −Z
  TestValidator.predicate(
    "model sway rotates with the path facing (X sway → −Z world)",
    nclose(rootAt(straight.motion, 1).translation.z, -0.1) &&
      nclose(rootAt(straight.motion, 1).translation.x, 1),
  );
  TestValidator.equals(
    "path seam carries the incoming cycle's easing",
    straight.motion.keyframes.find((k) => nclose(k.time, 1))!.easing,
    "easeIn",
  );
};
