import {
  IAutoMovieRenderFrameFormat,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieTransform,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpMotion,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  createSkeleton,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { hasViolation, nclose, throwsError } from "../internal/predicates";

const app = new AutoMovieApplication();

const IDENTITY_Q = { x: 0, y: 0, z: 0, w: 1 };
const t3 = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: IDENTITY_Q,
  scale: { x: 1, y: 1, z: 1 },
});

const skeleton = createSkeleton();

/** A 1 s clip whose root stands 5 m down the camera's −Z. */
const still: IAutoMovieMcpMotion = (() => {
  const motion = makeMotion(
    [
      keyframe(0, makePose([], t3(0, 0, -5))),
      keyframe(1, makePose([], t3(0, 0, -5))),
    ],
    1,
  );
  return {
    ...motion,
    id: "m1",
    keyframes: motion.keyframes.map((kf) => ({ ...kf, bezier: null })),
  };
})();

const script: IAutoMovieScript = {
  logline: "a keypoint film",
  theme: "pose",
  cast: [],
  beats: [{ id: "b1", name: "one", summary: "the beat", durationHint: 1 }],
};

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

const shot: IAutoMovieShot = {
  id: "shot:b1",
  name: null,
  scene: "scene-1",
  camera: "cam",
  cameraMotion: null,
  performances: [{ node: "hero", motion: "m1", startOffset: 0 }],
  objectMotions: [],
  duration: 1,
};

const film: IAutoMovieSequence = {
  id: "seq-1",
  name: null,
  fps: 24,
  shots: [{ shot: "shot:b1", trim: null, transition: null }],
};

const slate = (over: Partial<IAutoMovieMcpWritableSlate> = {}) =>
  ({
    script,
    scene,
    shots: [shot],
    beatEnds: [],
    notes: [],
    film,
    ...over,
  }) as IAutoMovieMcpWritableSlate;

// Spread-based defaults so a test can pass an explicitly-null registry (a `??`
// default would silently replace it and the malformed-input branch never runs).
const plan = (over: {
  slate?: IAutoMovieMcpWritableSlate;
  frameFormat?: IAutoMovieRenderFrameFormat;
  motions?: Record<string, IAutoMovieMcpMotion>;
  skeletons?: (typeof skeleton)[];
}) =>
  app.planPoseKeypoints({
    slate: slate(),
    frameFormat: { fps: 2, width: 1920, height: 1080 },
    motions: { m1: still },
    skeletons: [skeleton],
    ...over,
  });

/**
 * The `planPoseKeypoints` tool (#1168): the per-frame OpenPose-style keypoint
 * sidecar over the committed film. The slate supplies scene/shots/film; motions
 * are derived (never stored), so the caller passes the motion registry and
 * skeletons explicitly. Malformed input returns violations, never a throw.
 *
 * Scenarios:
 *
 * 1. Happy path: a 1 s film at fps 2 plans 2 frames; the hero's hips project to
 *    frame center on frame 0.
 * 2. A missing film, a missing scene, a zero fps, a zero-frame runtime, and a
 *    non-positive width or height each refuse with a located violation and null
 *    sidecar.
 * 3. A non-object motion registry, an empty-keyframe motion, a non-finite motion
 *    duration, a non-finite keyframe time, a non-array skeletons input, and a
 *    malformed skeleton entry each refuse with a located violation.
 * 4. Without a project, omitting the slate throws the actionable openProject
 *    prompt (the resident contract).
 */
export const test_mcp_plan_pose_keypoints = (): void => {
  // 1. happy path.
  const happy = plan({});
  TestValidator.equals("happy validation", happy.validation, { success: true });
  TestValidator.equals("two frames", happy.sidecar!.frameCount, 2);
  const hips = happy.sidecar!.frames[0]!.actors[0]!.keypoints.find(
    (k) => k.bone === "hips",
  )!;
  TestValidator.predicate(
    "hero hips project to frame center",
    nclose(hips.x, 0.5) && hips.inFrame,
  );

  // 2. request/slate/fps/width/height gates.
  TestValidator.predicate(
    "a non-object request refuses at the root",
    hasViolation(
      app.planPoseKeypoints(null as never).validation,
      "type",
      "$input",
    ),
  );
  TestValidator.predicate(
    "a non-object explicit slate refuses",
    hasViolation(
      plan({ slate: 5 as never }).validation,
      "type",
      "$input.slate",
    ),
  );
  TestValidator.predicate(
    "a non-object film refuses",
    hasViolation(
      plan({ slate: slate({ film: 5 as never }) }).validation,
      "type",
      ".film",
    ),
  );
  TestValidator.predicate(
    "a missing film refuses",
    hasViolation(
      plan({ slate: slate({ film: null }) }).validation,
      "type",
      ".film",
    ),
  );
  TestValidator.predicate(
    "a missing scene refuses",
    hasViolation(
      plan({ slate: slate({ scene: null }) }).validation,
      "type",
      ".scene",
    ),
  );
  TestValidator.predicate(
    "zero fps refuses",
    hasViolation(
      plan({ frameFormat: { fps: 0, width: 1920, height: 1080 } }).validation,
      "range",
      "$input.frameFormat.fps",
    ),
  );
  TestValidator.predicate(
    "a zero-frame runtime refuses",
    hasViolation(
      plan({ frameFormat: { fps: 0.2, width: 1920, height: 1080 } }).validation,
      "range",
      "$input.frameFormat.fps",
    ) &&
      plan({ frameFormat: { fps: 0.2, width: 1920, height: 1080 } }).sidecar ===
        null,
  );
  TestValidator.predicate(
    "a non-positive width refuses",
    hasViolation(
      plan({ frameFormat: { fps: 2, width: 0, height: 1080 } }).validation,
      "range",
      "$input.frameFormat.width",
    ),
  );
  TestValidator.predicate(
    "a non-positive height refuses",
    hasViolation(
      plan({ frameFormat: { fps: 2, width: 1920, height: 0 } }).validation,
      "range",
      "$input.frameFormat.height",
    ),
  );
  // The sidecar aspect must match a render pinned at these dims with ffmpeg `-s`,
  // and yuv420p can only encode even axes, so an odd (or fractional) dimension,
  // which no render could reproduce exactly, is refused here too (#1251).
  TestValidator.predicate(
    "an odd width refuses",
    hasViolation(
      plan({ frameFormat: { fps: 2, width: 641, height: 1080 } }).validation,
      "range",
      "$input.frameFormat.width",
    ),
  );
  TestValidator.predicate(
    "a fractional height refuses",
    hasViolation(
      plan({ frameFormat: { fps: 2, width: 1920, height: 360.5 } }).validation,
      "range",
      "$input.frameFormat.height",
    ),
  );
  TestValidator.predicate(
    "a non-object frame format refuses at the shared object",
    hasViolation(
      plan({ frameFormat: null as never }).validation,
      "type",
      "$input.frameFormat",
    ),
  );

  // 3. motion/skeleton registry gates.
  TestValidator.predicate(
    "a non-object motion registry refuses",
    hasViolation(
      plan({ motions: null as never }).validation,
      "type",
      "$input.motions",
    ),
  );
  TestValidator.predicate(
    "a non-object motion entry refuses",
    hasViolation(
      plan({ motions: { m1: null as never } }).validation,
      "type",
      "$input.motions.m1",
    ),
  );
  TestValidator.predicate(
    "an empty-keyframe motion refuses",
    hasViolation(
      plan({ motions: { m1: { ...still, keyframes: [] } } }).validation,
      "type",
      "$input.motions.m1.keyframes",
    ),
  );
  TestValidator.predicate(
    "a non-finite motion duration refuses",
    hasViolation(
      plan({ motions: { m1: { ...still, duration: Number.NaN } } }).validation,
      "range",
      "$input.motions.m1.duration",
    ),
  );
  TestValidator.predicate(
    "a non-finite keyframe time refuses",
    hasViolation(
      plan({
        motions: {
          m1: {
            ...still,
            keyframes: [{ ...still.keyframes[0]!, time: Number.NaN }],
          },
        },
      }).validation,
      "range",
      "$input.motions.m1.keyframes[0].time",
    ),
  );
  TestValidator.predicate(
    "a non-array skeletons input refuses",
    hasViolation(
      plan({ skeletons: null as never }).validation,
      "type",
      "$input.skeletons",
    ),
  );
  TestValidator.predicate(
    "a malformed skeleton entry refuses",
    hasViolation(
      plan({ skeletons: [null as never] }).validation,
      "type",
      "$input.skeletons[0]",
    ),
  );

  // 4. resident contract without a project.
  TestValidator.predicate(
    "omitting the slate without a project throws the openProject prompt",
    throwsError(
      () =>
        new AutoMovieApplication().planPoseKeypoints({
          frameFormat: { fps: 2, width: 1920, height: 1080 },
          motions: { m1: still },
          skeletons: [skeleton],
        }),
      ["openProject"],
    ),
  );
};
