import {
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieTransform,
} from "@automovie/interface";
import {
  planPoseKeypointSidecar,
  renderPoseKeypointSidecar,
} from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

import {
  createSkeleton,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { nclose, throwsError } from "../internal/predicates";

const IDENTITY_Q = { x: 0, y: 0, z: 0, w: 1 };
const t3 = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: IDENTITY_Q,
  scale: { x: 1, y: 1, z: 1 },
});

const skeleton = createSkeleton();

/** A 1 s clip whose root travels from (x0,0,−5) to (x1,0,−5). */
const travel = (x0: number, x1: number): IAutoMovieMotion => ({
  ...makeMotion(
    [
      keyframe(0, makePose([], t3(x0, 0, -5))),
      keyframe(1, makePose([], t3(x1, 0, -5))),
    ],
    1,
  ),
  id: "m1",
});

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "hero",
      model: "m",
      transform: t3(0, 0, 0),
      motion: null,
      pose: null,
    },
  ],
  cameras: [
    { id: "cam", transform: t3(0, 0, 0), fovY: 60, near: 0.1, far: 100 },
  ],
  lights: [],
};

const shot = (over: Partial<IAutoMovieShot> = {}): IAutoMovieShot => ({
  id: "shot:b1",
  name: null,
  scene: "scene-1",
  camera: "cam",
  cameraMotion: null,
  performances: [{ node: "hero", motion: "m1", startOffset: 0 }],
  objectMotions: [],
  duration: 1,
  ...over,
});

const sequence: IAutoMovieSequence = {
  id: "seq-1",
  name: null,
  fps: 24,
  shots: [{ shot: "shot:b1", trim: null, transition: null }],
};

const plan = (over: {
  shots?: IAutoMovieShot[];
  motion?: IAutoMovieMotion;
  scenes?: IAutoMovieScene[];
  skeletons?: (typeof skeleton)[];
  fps?: number;
  sequence?: IAutoMovieSequence;
}) =>
  planPoseKeypointSidecar({
    sequence: over.sequence ?? sequence,
    shots: over.shots ?? [shot()],
    scenes: over.scenes ?? [scene],
    motions: [over.motion ?? travel(0, 0)],
    skeletons: over.skeletons ?? [skeleton],
    fps: over.fps ?? 2,
  });

const hipsX = (frames: ReturnType<typeof plan>["frames"], frame: number) =>
  frames[frame]!.actors[0]!.keypoints.find((k) => k.bone === "hips")!.x;

/**
 * `planPoseKeypointSidecar` (#1168): the per-frame OpenPose-style sidecar. The
 * cut lands on the same frame-atomic output clock as the render/caption plans,
 * each frame resolves its live shot, and every performing actor's named joints
 * project through the shot's camera. Genuinely per-frame (poses change every
 * frame), unlike the caption sidecar's run-length spans.
 *
 * Scenarios (camera at origin looking down −Z, fovY 60; fps 2, 1 s → 2 frames):
 *
 * 1. A still actor 5 m down −Z yields 2 frames of beat "b1", one actor "hero",
 *    hips centered (x = 0.5) on both frames.
 * 2. A travelling actor (root x 0→2) moves BETWEEN frames: frame 0 centered, frame
 *    1 right of center: the sidecar is per-frame, not per-shot.
 * 3. `startOffset` delays the clip: with offset 0.5 the travelling actor is still
 *    centered on frame 1 (its clip has only just started).
 * 4. A missing scene or camera yields empty actors; a held (null-motion)
 *    performance, a missing motion, a missing node, and a missing skeleton are
 *    each skipped: never a throw.
 * 5. An unprefixed shot id passes through as the beat id.
 * 6. Serialization is deterministic bytes and round-trips via JSON.parse.
 * 7. Zero/non-finite fps and a zero-frame runtime throw, aligned with the
 *    render/caption planners.
 */
export const test_render_pose_keypoint_sidecar = (): void => {
  // 1. still actor.
  const still = plan({});
  TestValidator.equals("frame count 2", still.frameCount, 2);
  TestValidator.equals(
    "both frames name beat b1 with one actor",
    still.frames.map((f) => [f.frame, f.beat, f.actors.length]),
    [
      [0, "b1", 1],
      [1, "b1", 1],
    ],
  );
  TestValidator.equals(
    "the actor is hero",
    still.frames[0]!.actors[0]!.node,
    "hero",
  );
  TestValidator.predicate(
    "a still hips stays centered on both frames",
    nclose(hipsX(still.frames, 0), 0.5) && nclose(hipsX(still.frames, 1), 0.5),
  );

  // 2. travelling actor moves between frames.
  const moving = plan({ motion: travel(0, 2) });
  TestValidator.predicate(
    "a travelling hips is centered on frame 0 and right of center on frame 1",
    nclose(hipsX(moving.frames, 0), 0.5) && hipsX(moving.frames, 1) > 0.55,
  );

  // 3. startOffset delays the clip.
  const delayed = plan({
    motion: travel(0, 2),
    shots: [
      shot({
        performances: [{ node: "hero", motion: "m1", startOffset: 0.5 }],
      }),
    ],
  });
  TestValidator.predicate(
    "startOffset keeps the delayed actor centered on frame 1",
    nclose(hipsX(delayed.frames, 1), 0.5),
  );

  // 4. skips, never throws.
  TestValidator.equals(
    "a missing scene yields empty actors",
    plan({ shots: [shot({ scene: "ghost" })] }).frames[0]!.actors.length,
    0,
  );
  TestValidator.equals(
    "a missing camera yields empty actors",
    plan({ shots: [shot({ camera: "ghost" })] }).frames[0]!.actors.length,
    0,
  );
  TestValidator.equals(
    "a held (null-motion) performance is skipped",
    plan({
      shots: [
        shot({
          performances: [{ node: "hero", motion: null, startOffset: 0 }],
        }),
      ],
    }).frames[0]!.actors.length,
    0,
  );
  TestValidator.equals(
    "a missing motion is skipped",
    plan({
      shots: [
        shot({
          performances: [{ node: "hero", motion: "ghost", startOffset: 0 }],
        }),
      ],
    }).frames[0]!.actors.length,
    0,
  );
  TestValidator.equals(
    "a missing node is skipped",
    plan({
      shots: [
        shot({
          performances: [{ node: "ghost", motion: "m1", startOffset: 0 }],
        }),
      ],
    }).frames[0]!.actors.length,
    0,
  );
  TestValidator.equals(
    "a missing skeleton is skipped",
    plan({ skeletons: [] }).frames[0]!.actors.length,
    0,
  );

  // 5. unprefixed shot id passes through as the beat id.
  const bare = plan({
    sequence: {
      ...sequence,
      shots: [{ shot: "raw-id", trim: null, transition: null }],
    },
    shots: [shot({ id: "raw-id" })],
  });
  TestValidator.equals("unprefixed beat id", bare.frames[0]!.beat, "raw-id");

  // 6. deterministic serialization round-trips.
  const text = renderPoseKeypointSidecar(still);
  TestValidator.equals(
    "serialization deterministic",
    renderPoseKeypointSidecar(still),
    text,
  );
  TestValidator.equals("serialization round-trips", JSON.parse(text), still);

  // 7. guard throws, aligned with the render/caption planners.
  TestValidator.predicate(
    "zero fps throws",
    throwsError(() => plan({ fps: 0 }), "fps"),
  );
  TestValidator.predicate(
    "non-finite fps throws",
    throwsError(() => plan({ fps: Number.NaN }), "fps"),
  );
  TestValidator.predicate(
    "zero output frames throws",
    throwsError(
      () =>
        plan({
          sequence: {
            ...sequence,
            shots: [
              {
                shot: "shot:b1",
                trim: { start: 0, duration: 0.1 },
                transition: null,
              },
            ],
          },
        }),
      "at least one frame",
    ),
  );
};
