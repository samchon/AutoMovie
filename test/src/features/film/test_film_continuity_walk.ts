import { validateFilmContinuity } from "@automovie/engine";
import {
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieShot,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  IDENTITY_TRANSFORM,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { hasViolation, hasWarning, warningCount } from "../internal/predicates";

/** A looping travel clip whose root advances x = 2t over a 1 s cycle. */
const walk: IAutoMovieMotion = {
  ...makeMotion(
    [
      keyframe(
        0,
        makePose([joint("leftLowerLeg", { flexion: 0 })], {
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        }),
      ),
      keyframe(
        1,
        makePose([joint("leftLowerLeg", { flexion: 40 })], {
          translation: { x: 2, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        }),
      ),
    ],
    1,
    true,
  ),
  id: "walk",
};

/**
 * A beat whose hero is staged at `stagedX` and walks for `duration` seconds. A
 * 0.5 s beat advances the hero one metre (x = 2t), so its END is `stagedX + 1`
 * and its OPENING is `stagedX`.
 */
const beatProps = (beat: string, stagedX: number, duration: number) => {
  const scene: IAutoMovieScene = {
    id: "scene",
    name: null,
    nodes: [
      {
        id: "hero",
        model: "hero",
        transform: {
          ...IDENTITY_TRANSFORM,
          translation: { x: stagedX, y: 0, z: 0 },
        },
        motion: null,
        pose: null,
      },
    ],
    cameras: [],
    lights: [],
  };
  const shot: IAutoMovieShot = {
    id: `shot:${beat}`,
    name: null,
    scene: "scene",
    camera: "cam",
    cameraMotion: null,
    performances: [{ node: "hero", motion: "walk", startOffset: 0 }],
    objectMotions: [],
    duration,
  };
  return { beat, scene, shot, motions: [walk] };
};

/**
 * The whole-film continuity linter (#1172): walk the film in playback order and
 * compare each beat's opening against the previous beat's end. Continuity is
 * MANUAL in the pipeline (nothing seeds the next beat from the prior end), so a
 * hero staged back at the origin instead of where it walked to is exactly the
 * uncaught "characters drift" bug this surfaces — as advisory warnings, never a
 * gate.
 *
 * Scenarios:
 *
 * 1. An empty film and a single-beat film have no cut to lint and pass with no
 *    warnings (the pairwise loop never runs).
 * 2. Two beats where the second is staged where the first ended (x = 1) resume
 *    cleanly — no drift warning.
 * 3. Two beats where the second restarts at the origin drift one metre; the linter
 *    warns at that cut's opening translation path, keyed by beat index.
 * 4. A nonsensical tolerance is a range error that short-circuits before any
 *    snapshot is compared.
 */
export const test_film_continuity_walk = (): void => {
  TestValidator.equals(
    "an empty film passes",
    validateFilmContinuity({ beats: [] }),
    { success: true },
  );
  TestValidator.equals(
    "a single-beat film has no cut",
    validateFilmContinuity({ beats: [beatProps("b1", 0, 0.5)] }),
    { success: true },
  );

  const resumed = validateFilmContinuity({
    beats: [beatProps("b1", 0, 0.5), beatProps("b2", 1, 0.5)],
  });
  TestValidator.equals("a resumed cut has no drift", warningCount(resumed), 0);

  const drifted = validateFilmContinuity({
    beats: [beatProps("b1", 0, 0.5), beatProps("b2", 0, 0.5)],
  });
  TestValidator.predicate(
    "a cut back to the origin warns, keyed by beat index",
    hasWarning(
      drifted,
      "physics",
      "$input.beats[1].opening.actors[node=hero].transform.translation",
    ),
  );

  const bad = validateFilmContinuity({
    beats: [beatProps("b1", 0, 0.5), beatProps("b2", 0, 0.5)],
    positionTolerance: Number.NaN,
  });
  TestValidator.predicate(
    "a non-finite tolerance is a range error",
    hasViolation(bad, "range", "$input.positionTolerance"),
  );
};
