import { Vector3, compileCameraMove } from "@automovie/engine";
import { IAutoMovieCamera, IAutoMovieCameraAction } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

const CAMERA: IAutoMovieCamera = {
  id: "cam",
  transform: {
    translation: { x: 0, y: 1, z: 4 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  fovY: 90,
  near: 0.1,
  far: 1000,
};

const frame = (
  move: IAutoMovieCameraAction["move"],
  start = 0,
  duration: number | "auto" = "auto",
): IAutoMovieCameraAction => ({
  verb: "frame",
  actor: "cam",
  start,
  duration,
  framing: "full",
  move,
  on: { kind: "point", point: { x: 0, y: 0, z: 0 } },
});

/**
 * Pins the moving paths and the compiler's edge branches. Subject height 2 at
 * the origin, `full` framing (1.15×, aim at half height y = 1), 90° FOV →
 * framed distance `d = 1.15`.
 *
 * Scenarios:
 *
 * 1. `orbit` → 9 keys sweeping 45°, every position at distance `d` from the aim,
 *    the last bearing swung off the initial +Z, and the swept angle **eased**
 *    in and out (the mid-arc segments turn faster than the end ones).
 * 2. `follow` with an animated base marching down +X → 5 keys over one second (4
 *    Hz + endpoints) whose X tracks the subject.
 * 3. `follow` with a static subject (`at: null`) degenerates to one static key.
 * 4. Two moves abutting on the same instant → the later framing replaces the
 *    earlier key instead of minting a zero-width span.
 * 5. A camera staged exactly on the aim point falls back to the +Z bearing.
 * 6. No entries → no clip (`null`).
 */
export const test_film_camera_move_paths = (): void => {
  const subject = { base: { x: 0, y: 0, z: 0 }, height: 2, at: null };
  const orbit = compileCameraMove({
    clipId: "clip",
    camera: CAMERA,
    entries: [{ action: frame("orbit"), subject }],
    shotDuration: 2,
  })!;
  TestValidator.equals("orbit keys", orbit.tracks[0]!.times.length, 9);
  const aim = { x: 0, y: 1, z: 0 };
  for (let k = 0; k < 9; ++k) {
    const pos = {
      x: orbit.tracks[0]!.values[k * 3]!,
      y: orbit.tracks[0]!.values[k * 3 + 1]!,
      z: orbit.tracks[0]!.values[k * 3 + 2]!,
    };
    TestValidator.predicate(
      `orbit key ${k} keeps the framed distance`,
      nclose(Vector3.length(Vector3.subtract(pos, aim)), 1.15, 1e-6),
    );
  }
  TestValidator.predicate(
    "orbit swings off the initial bearing",
    Math.abs(orbit.tracks[0]!.values[24]!) > 0.5,
  );

  // the swept angle eases in/out: consecutive keys turn slowly at the ends and
  // faster through the mid-arc (a reveal orbit, not a constant-rate turntable).
  const ang = (k: number): number =>
    Math.atan2(
      orbit.tracks[0]!.values[k * 3]! - aim.x,
      orbit.tracks[0]!.values[k * 3 + 2]! - aim.z,
    );
  const step = (a: number, b: number): number => Math.abs(ang(b) - ang(a));
  TestValidator.predicate(
    "orbit eases: the mid-arc turns faster than either end",
    step(3, 4) > step(0, 1) + 1e-6 && step(3, 4) > step(7, 8) + 1e-6,
  );

  const marching = {
    base: { x: 0, y: 0, z: 0 },
    height: 2,
    at: (t: number) => ({ x: t, y: 0, z: 0 }),
  };
  const follow = compileCameraMove({
    clipId: "clip",
    camera: CAMERA,
    entries: [{ action: frame("follow", 0, 1), subject: marching }],
    shotDuration: 2,
  })!;
  TestValidator.equals("follow keys", follow.tracks[0]!.times.length, 5);
  TestValidator.predicate(
    "follow starts on the subject",
    nclose(follow.tracks[0]!.values[0]!, 0),
  );
  TestValidator.predicate(
    "follow ends on the subject",
    nclose(follow.tracks[0]!.values[12]!, 1),
  );

  const held = compileCameraMove({
    clipId: "clip",
    camera: CAMERA,
    entries: [{ action: frame("follow"), subject }],
    shotDuration: 2,
  })!;
  TestValidator.equals(
    "static-subject follow holds",
    held.tracks[0]!.times,
    [0],
  );

  const abutted = compileCameraMove({
    clipId: "clip",
    camera: CAMERA,
    entries: [
      { action: frame("static", 0, "auto"), subject },
      {
        action: frame("static", 0, "auto"),
        subject: { ...subject, height: 1 },
      },
    ],
    shotDuration: 2,
  })!;
  TestValidator.equals(
    "same-instant keys collapse to the later framing",
    abutted.tracks[0]!.times,
    [0],
  );
  TestValidator.predicate(
    // Height-2 framing sits at y = 1; the height-1 framing aims at y = 0.5
    // with a slight upward bearing (staged camera at y = 1), landing ≈ 0.57.
    "the later (height 1) framing won",
    abutted.tracks[0]!.values[1]! < 0.8,
  );

  const onAim = compileCameraMove({
    clipId: "clip",
    camera: {
      ...CAMERA,
      transform: { ...CAMERA.transform, translation: { x: 0, y: 1, z: 0 } },
    },
    entries: [{ action: frame("static"), subject }],
    shotDuration: 2,
  })!;
  TestValidator.predicate(
    "degenerate bearing falls back to +Z",
    vclose(
      {
        x: onAim.tracks[0]!.values[0]!,
        y: onAim.tracks[0]!.values[1]!,
        z: onAim.tracks[0]!.values[2]!,
      },
      { x: 0, y: 1, z: 1.15 },
    ),
  );

  TestValidator.equals(
    "no entries, no clip",
    compileCameraMove({
      clipId: "clip",
      camera: CAMERA,
      entries: [],
      shotDuration: 2,
    }),
    null,
  );
};
