import { reviewVisualRead } from "@automovie/engine";
import {
  IAutoMovieCamera,
  IAutoMovieClip,
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieSceneNode,
  IAutoMovieShot,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { keyframe, makeMotion, makePose } from "../internal/fixtures";

const IDENTITY_Q = { x: 0, y: 0, z: 0, w: 1 };
const t3 = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: IDENTITY_Q,
  scale: { x: 1, y: 1, z: 1 },
});

/** A camera at the origin looking down world −Z (identity rotation). */
const camera = (over: Partial<IAutoMovieCamera> = {}): IAutoMovieCamera => ({
  id: "cam",
  transform: t3(0, 0, 0),
  fovY: 60,
  near: 0.1,
  far: 100,
  ...over,
});

const node = (id: string): IAutoMovieSceneNode => ({
  id,
  model: "m",
  transform: t3(0, 0, 0),
  motion: null,
  pose: null,
});

/** A static actor whose world root sits at (x, y, z) — the node is at origin. */
const rootMotion = (
  id: string,
  x: number,
  y: number,
  z: number,
): IAutoMovieMotion => ({
  ...makeMotion(
    [
      keyframe(0, makePose([], t3(x, y, z))),
      keyframe(1, makePose([], t3(x, y, z))),
    ],
    1,
  ),
  id,
});

const scene = (cam: IAutoMovieCamera): IAutoMovieScene => ({
  id: "s",
  name: null,
  nodes: [node("hero")],
  cameras: [cam],
  lights: [],
});

const shot = (over: Partial<IAutoMovieShot> = {}): IAutoMovieShot => ({
  id: "shot",
  name: null,
  scene: "s",
  camera: "cam",
  cameraMotion: null,
  performances: [{ node: "hero", motion: "m1", startOffset: 0 }],
  objectMotions: [],
  duration: 1,
  ...over,
});

/** Run the framing metric for a single (camera, actor-position) pair. */
const framing = (
  cam: IAutoMovieCamera,
  actor: IAutoMovieMotion,
  shotOver: Partial<IAutoMovieShot> = {},
) =>
  reviewVisualRead({
    beat: "b1",
    scene: scene(cam),
    shot: shot(shotOver),
    motions: [actor],
    sampleRate: 1,
  });

const camMotion = (tracks: IAutoMovieClip["tracks"]): IAutoMovieClip => ({
  id: "cam-move",
  name: null,
  duration: 1,
  loop: false,
  tracks,
});

/**
 * `reviewVisualRead` (#1177) computes deterministic visual-read advisory notes.
 * v1 metric — subject in frame: a performed actor's world root, sampled over
 * the shot, must stay inside the live camera's frustum, else a `tier: "visual"`
 * note names the beat, actor, and when it first leaves frame. Advisory (D015):
 * notes, not gates.
 *
 * Scenarios:
 *
 * 1. A subject 5 m down the camera's −Z stays centered — no note. 2-5. A subject
 *    above/behind/too-far/beside the frustum each earns exactly one visual note
 *    naming it and the first off-frame time. 6-10. No live camera, a
 *    non-finite/zero/too-wide FOV, and far≤near all leave nothing to read — no
 *    notes.
 * 2. A camera that cranes up over the shot pushes a grounded subject out of frame
 *    — the moving camera is sampled, not read as static. 12-13. A camera move
 *    missing its rotation (or translation) track falls back to the camera's
 *    static component rather than crashing. 14-16. A held (null-motion)
 *    performance, a missing motion, and a missing node are skipped, not
 *    errored.
 */
export const test_film_review_visual_read = (): void => {
  TestValidator.equals(
    "a centered subject earns no note",
    framing(camera(), rootMotion("m1", 0, 0, -5)).length,
    0,
  );

  // defaults hold: omit sampleRate (→ 12) and pass an explicit aspect.
  TestValidator.equals(
    "the default sample rate and an explicit aspect still frame a centered subject",
    reviewVisualRead({
      beat: "b1",
      scene: scene(camera()),
      shot: shot(),
      motions: [rootMotion("m1", 0, 0, -5)],
      aspect: 1,
    }).length,
    0,
  );

  const above = framing(camera(), rootMotion("m1", 0, 10, -5));
  TestValidator.predicate(
    "a subject above the frame earns one visual note",
    above.length === 1 &&
      above[0]!.tier === "visual" &&
      above[0]!.beat === "b1" &&
      above[0]!.issue.includes("hero"),
  );
  TestValidator.equals(
    "a subject behind the camera earns a note",
    framing(camera(), rootMotion("m1", 0, 0, 5)).length,
    1,
  );
  TestValidator.equals(
    "a subject past the far plane earns a note",
    framing(camera(), rootMotion("m1", 0, 0, -200)).length,
    1,
  );
  TestValidator.equals(
    "a subject beside the frame earns a note",
    framing(camera(), rootMotion("m1", 20, 0, -5)).length,
    1,
  );

  // 6-10. degenerate cameras read nothing.
  TestValidator.equals(
    "no live camera reads nothing",
    framing(camera(), rootMotion("m1", 0, 10, -5), { camera: "nope" }).length,
    0,
  );
  TestValidator.equals(
    "a non-finite FOV reads nothing",
    framing(camera({ fovY: Number.NaN }), rootMotion("m1", 0, 10, -5)).length,
    0,
  );
  TestValidator.equals(
    "a zero FOV reads nothing",
    framing(camera({ fovY: 0 }), rootMotion("m1", 0, 10, -5)).length,
    0,
  );
  TestValidator.equals(
    "a >=180 FOV reads nothing",
    framing(camera({ fovY: 200 }), rootMotion("m1", 0, 10, -5)).length,
    0,
  );
  TestValidator.equals(
    "far <= near reads nothing",
    framing(camera({ near: 100, far: 1 }), rootMotion("m1", 0, 0, -5)).length,
    0,
  );

  // 11. a camera crane samples the move: a centered subject leaves frame as the
  // camera rises to y=50 by t=1.
  const crane = camMotion([
    {
      channel: { kind: "node", node: "cam", path: "translation" },
      times: [0, 1],
      values: [0, 0, 0, 0, 50, 0],
      interpolation: "linear",
    },
    {
      channel: { kind: "node", node: "cam", path: "rotation" },
      times: [0, 1],
      values: [0, 0, 0, 1, 0, 0, 0, 1],
      interpolation: "linear",
    },
  ]);
  TestValidator.equals(
    "a craning camera drops the subject out of frame",
    framing(camera(), rootMotion("m1", 0, 0, -5), { cameraMotion: crane })
      .length,
    1,
  );

  // 12. camera move with no rotation track → falls back to static rotation.
  const noRot = camMotion([
    {
      channel: { kind: "node", node: "cam", path: "translation" },
      times: [0, 1],
      values: [0, 0, 0, 0, 0, 0],
      interpolation: "linear",
    },
  ]);
  TestValidator.equals(
    "a move missing its rotation track keeps the subject framed",
    framing(camera(), rootMotion("m1", 0, 0, -5), { cameraMotion: noRot })
      .length,
    0,
  );
  // 13. camera move with no translation track → falls back to static position.
  const noPos = camMotion([
    {
      channel: { kind: "node", node: "cam", path: "rotation" },
      times: [0, 1],
      values: [0, 0, 0, 1, 0, 0, 0, 1],
      interpolation: "linear",
    },
  ]);
  TestValidator.equals(
    "a move missing its translation track keeps the subject framed",
    framing(camera(), rootMotion("m1", 0, 0, -5), { cameraMotion: noPos })
      .length,
    0,
  );

  // 14-16. skips, never errors.
  TestValidator.equals(
    "a held (null-motion) performance is skipped",
    framing(camera(), rootMotion("m1", 0, 10, -5), {
      performances: [{ node: "hero", motion: null, startOffset: 0 }],
    }).length,
    0,
  );
  TestValidator.equals(
    "a missing motion is skipped",
    framing(camera(), rootMotion("m1", 0, 10, -5), {
      performances: [{ node: "hero", motion: "ghost", startOffset: 0 }],
    }).length,
    0,
  );
  TestValidator.equals(
    "a missing node is skipped",
    framing(camera(), rootMotion("m1", 0, 10, -5), {
      performances: [{ node: "ghost", motion: "m1", startOffset: 0 }],
    }).length,
    0,
  );
};
