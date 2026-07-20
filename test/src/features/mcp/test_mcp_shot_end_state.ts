import { resolveBeatEnd } from "@automovie/engine";
import { IAutoMovieScene, IAutoMovieShot } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpGeometryContext,
  IAutoMovieMcpMotion,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  IDENTITY_TRANSFORM,
  createSkeleton,
  keyframe,
  makePose,
} from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

const app = new AutoMovieApplication();
const skeleton = createSkeleton();

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "actor",
      model: "actor-model",
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
  ],
  cameras: [
    {
      id: "camera",
      transform: IDENTITY_TRANSFORM,
      fovY: 45,
      near: 0.1,
      far: 100,
    },
  ],
  lights: [],
};

const motion: IAutoMovieMcpMotion = {
  id: "walk-clip",
  skeleton: skeleton.id,
  duration: 1,
  loop: false,
  keyframes: [
    { ...keyframe(0, makePose([])), bezier: null },
    { ...keyframe(1, makePose([])), bezier: null },
  ],
};

const shot: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: scene.id,
  camera: "camera",
  cameraMotion: null,
  performances: [{ node: "actor", motion: motion.id, startOffset: 0 }],
  objectMotions: [],
  duration: 1,
};

const context: IAutoMovieMcpGeometryContext = {
  scene,
  models: [{ id: "actor-model", skeleton }],
  motions: { "walk-clip": motion },
  shot,
};

/**
 * `getShotEndState` exposes the engine's `resolveBeatEnd`, the continuity
 * ladder's derivation rung: the agent asks the engine for the beat's resumable
 * end-state instead of hand-authoring folded transforms, velocities, and gait
 * phases, then persists it with `commitBeatEnd`.
 *
 * Scenarios:
 *
 * 1. An explicit context derives exactly what the engine's `resolveBeatEnd`
 *    computes for the same inputs (oracle equality), with `reason: null`.
 * 2. A context without a shot answers a reason naming the missing beat shot, not a
 *    null payload alone or a throw.
 * 3. An engine contract fault (two registry entries carrying the same motion id)
 *    comes back as a `reason`, not a raw throw across the boundary.
 * 4. A registry clip whose keyframe times do not strictly increase, the
 *    precondition `sampleMotion` declares, rejects structurally at its own path
 *    instead of yielding a beat end derived from the wrong segment.
 * 5. Malformed request roots and blank beats reject with the structured
 *    `$input...` throw convention shared by the other geometry queries.
 */
export const test_mcp_shot_end_state = (): void => {
  const derived = app.getShotEndState({ context, beat: "beat-1" });
  TestValidator.equals("derivation succeeds", derived.reason, null);
  TestValidator.equals(
    "the tool answers the engine oracle exactly",
    derived.beatEnd,
    resolveBeatEnd({
      beat: "beat-1",
      scene,
      shot,
      motions: [
        {
          id: motion.id,
          skeleton: motion.skeleton,
          duration: motion.duration,
          loop: motion.loop,
          keyframes: motion.keyframes.map((k) => ({ ...k, bezier: null })),
        },
      ],
    }),
  );

  const shotless = app.getShotEndState({
    context: { ...context, shot: null },
    beat: "beat-1",
  });
  TestValidator.predicate(
    "a missing shot answers a diagnosing reason",
    shotless.beatEnd === null &&
      (shotless.reason ?? "").includes('no shot for beat "beat-1"'),
  );

  const duplicated = app.getShotEndState({
    context: {
      ...context,
      motions: {
        "walk-clip": motion,
        alias: { ...motion },
      },
    },
    beat: "beat-1",
  });
  TestValidator.predicate(
    "an engine contract fault comes back as a reason, not a throw",
    duplicated.beatEnd === null &&
      (duplicated.reason ?? "").includes("duplicated"),
  );

  // The registry this query samples. `getResolvedPose` gates it through
  // `findMotion`, but this method reaches `resolveBeatEnd` -> `sampleMotion`
  // without that lookup, and the context shape gate covers scene, models, and
  // shot but not motions, so the clip floor was reachable from one geometry
  // query and not the other. Out of order, the sampler's binary search picks a
  // segment that does not straddle the instant, and the derived beat end, which
  // an agent then commits, describes a pose the clip never holds. Structural, so
  // it throws rather than becoming a reason, matching the sibling query (#1328).
  TestValidator.predicate(
    "non-increasing keyframe times reject at the offending index",
    throwsError(
      () =>
        app.getShotEndState({
          context: {
            ...context,
            motions: {
              "walk-clip": {
                ...motion,
                keyframes: [
                  motion.keyframes[1]!,
                  { ...motion.keyframes[0]!, time: 0 },
                ],
              },
            },
          },
          beat: "beat-1",
        }),
      [
        "$input.context.motions.walk-clip.keyframes[1].time",
        "strictly increase",
      ],
    ),
  );

  TestValidator.predicate(
    "malformed request root rejects structurally",
    throwsError(
      () => app.getShotEndState(null as never),
      ["$input", "JSON object"],
    ),
  );
  TestValidator.predicate(
    "a blank beat rejects structurally",
    throwsError(
      () => app.getShotEndState({ context, beat: "  " }),
      ["$input.beat", "non-empty string"],
    ),
  );
};
