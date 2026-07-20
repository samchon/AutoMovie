import {
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieValidation,
} from "@automovie/interface";
import { AutoMovieApplication, IAutoMovieMcpMotion } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  IDENTITY_TRANSFORM,
  createModel,
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { hasWarning, warningCount } from "../internal/predicates";

const app = new AutoMovieApplication();
const skeleton = createSkeleton();
const model = createModel(skeleton);

const rootAt = (x: number) => ({
  translation: { x, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const toMcp = (motion: IAutoMovieMotion): IAutoMovieMcpMotion => ({
  ...motion,
  keyframes: motion.keyframes.map((kf) => ({ ...kf, bezier: null })),
});

/** A clip whose root never leaves the origin, end sits where it opened. */
const still: IAutoMovieMcpMotion = toMcp({
  ...makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })], rootAt(0))),
      keyframe(
        1,
        makePose([joint("leftLowerArm", { flexion: 90 })], rootAt(0)),
      ),
    ],
    1,
    false,
  ),
  id: "still",
});

/** A clip whose root travels +2 m in x over the shot, end is 2 m from open. */
const move: IAutoMovieMcpMotion = toMcp({
  ...makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerLeg", { flexion: 0 })], rootAt(0))),
      keyframe(
        1,
        makePose([joint("leftLowerLeg", { flexion: 20 })], rootAt(2)),
      ),
    ],
    1,
    false,
  ),
  id: "move",
});

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "hero",
      model: model.id,
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
  ],
  cameras: [
    { id: "cam", transform: IDENTITY_TRANSFORM, fovY: 45, near: 0.1, far: 100 },
  ],
  lights: [],
};

const shotFor = (beat: string, motion: string): IAutoMovieShot => ({
  id: `shot:${beat}`,
  name: null,
  scene: "scene-1",
  camera: "cam",
  cameraMotion: null,
  performances: [{ node: "hero", motion, startOffset: 0 }],
  objectMotions: [],
  duration: 1,
});

const beatFor = (beat: string, clip: IAutoMovieMcpMotion) => ({
  beat,
  shot: shotFor(beat, clip.id),
  motions: { [clip.id]: clip },
});

const failsAt = (validation: IAutoMovieValidation, path: string): boolean =>
  validation.success === false &&
  validation.violations.some((v) => v.path.includes(path));

/**
 * The `lintContinuity` tool exposes the whole-film continuity linter (#1172):
 * each beat's opening compared against the previous beat's end. With one shared
 * staged scene, a beat opens where it is staged, so a still clip resumes
 * cleanly while a travelling clip leaves the next beat 2 m behind. Every beat's
 * shot is validated first, so malformed input returns violations, never a bogus
 * lint or a thrown resolve-time invariant.
 *
 * Scenarios:
 *
 * 1. Two beats performing a still clip resume with no drift warning.
 * 2. Two beats performing a travelling clip drift 2 m; the linter warns at the
 *    second cut's opening translation path.
 * 3. A negative position tolerance is a range error that short-circuits.
 * 4. A non-object request, a non-array `beats`, a non-object beat, and an empty
 *    beat id each return violations rather than throwing.
 * 5. A structurally invalid shot surfaces its violations under the beat's shot
 *    path, not a continuity result.
 * 6. Duplicate motion ids in one beat's registry, and an unperformed scene node's
 *    ambient motion the registry omits, are each caught before the engine
 *    walker would throw.
 */
export const test_mcp_lint_continuity = (): void => {
  // 1. still clip, clean resume.
  const resumed = app.lintContinuity({
    scene,
    beats: [beatFor("b1", still), beatFor("b2", still)],
  }).validation;
  TestValidator.equals("a still film has no drift", warningCount(resumed), 0);

  // 2. travelling clip, the second beat opens 2 m behind where the first ended.
  const drifted = app.lintContinuity({
    scene,
    beats: [beatFor("b1", move), beatFor("b2", move)],
  }).validation;
  TestValidator.predicate(
    "a travelling film drifts at the cut",
    hasWarning(
      drifted,
      "physics",
      "$input.beats[1].opening.actors[node=hero].transform.translation",
    ),
  );

  // 3. nonsensical tolerance short-circuits as a range error.
  const badTolerance = app.lintContinuity({
    scene,
    beats: [beatFor("b1", move), beatFor("b2", move)],
    positionTolerance: -1,
  }).validation;
  TestValidator.predicate(
    "negative tolerance is a range error",
    failsAt(badTolerance, "$input.positionTolerance"),
  );

  // 4. malformed request shapes return violations, never a throw.
  TestValidator.predicate(
    "non-object request fails at the root",
    failsAt(app.lintContinuity(null as never).validation, "$input"),
  );
  TestValidator.predicate(
    "non-array beats fails at beats",
    failsAt(
      app.lintContinuity({ scene, beats: null as never }).validation,
      "$input.beats",
    ),
  );
  TestValidator.predicate(
    "non-object beat fails at that beat",
    failsAt(
      app.lintContinuity({ scene, beats: [null as never] }).validation,
      "$input.beats[0]",
    ),
  );
  TestValidator.predicate(
    "empty beat id fails at the beat id",
    failsAt(
      app.lintContinuity({
        scene,
        beats: [{ beat: "", shot: shotFor("b1", "still"), motions: { still } }],
      }).validation,
      "$input.beats[0].beat",
    ),
  );

  // 5. an invalid shot surfaces under the beat's shot path.
  TestValidator.predicate(
    "invalid shot surfaces under the shot path",
    failsAt(
      app.lintContinuity({
        scene,
        beats: [
          {
            beat: "b1",
            shot: { ...shotFor("b1", "still"), camera: "missing" },
            motions: { still },
          },
        ],
      }).validation,
      "$input.beats[0].shot.camera",
    ),
  );

  // 6. residual resolve-time invariants caught before the walker throws.
  TestValidator.predicate(
    "duplicate motion ids are caught",
    failsAt(
      app.lintContinuity({
        scene,
        beats: [
          {
            beat: "b1",
            shot: shotFor("b1", "still"),
            motions: { still, alias: { ...still } },
          },
        ],
      }).validation,
      "$input.beats[0].motions",
    ),
  );
  const sceneWithProp: IAutoMovieScene = {
    ...scene,
    nodes: [
      ...scene.nodes,
      {
        id: "prop",
        model: model.id,
        transform: IDENTITY_TRANSFORM,
        motion: "ghost",
        pose: null,
      },
    ],
  };
  TestValidator.predicate(
    "an unperformed node's missing ambient motion is caught",
    failsAt(
      app.lintContinuity({
        scene: sceneWithProp,
        beats: [beatFor("b1", still)],
      }).validation,
      "$input.beats[0].motions",
    ),
  );

  // 7. a beat whose shot performs nothing (so the hero is held with a null
  // ambient motion) and omits its motions registry passes cleanly, the held
  // null-motion node needs no clip, and an empty registry is valid.
  const held = app.lintContinuity({
    scene,
    beats: [
      { beat: "solo", shot: { ...shotFor("solo", "still"), performances: [] } },
    ],
  }).validation;
  TestValidator.equals("a held beat with no motions passes", held, {
    success: true,
  });
};
