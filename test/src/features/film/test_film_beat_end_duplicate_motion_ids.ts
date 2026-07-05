import { resolveBeatEnd } from "@automovie/engine";
import {
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieShot,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  IDENTITY_TRANSFORM,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";

const motion: IAutoMovieMotion = {
  ...makeMotion([keyframe(0, makePose([])), keyframe(1, makePose([]))], 1),
  id: "walk",
};

const scene: IAutoMovieScene = {
  id: "scene",
  name: null,
  nodes: [
    {
      id: "hero",
      model: "hero",
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
  ],
  cameras: [],
  lights: [],
};

const shot: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: "scene",
  camera: "cam",
  cameraMotion: null,
  performances: [{ node: "hero", motion: "walk", startOffset: 0 }],
  objectMotions: [],
  duration: 1,
};

/**
 * Beat-end resolution samples motion clips by id. Duplicate motion ids let the
 * later array entry silently replace the earlier one, so end-state sampling
 * would depend on resolver input order instead of a unique clip identity.
 *
 * Scenario: two supplied motions share `walk`; beat-end resolution throws
 * before sampling either candidate.
 */
export const test_film_beat_end_duplicate_motion_ids = (): void => {
  let thrown: unknown = null;
  try {
    resolveBeatEnd({
      beat: "beat-1",
      scene,
      shot,
      motions: [motion, { ...motion, duration: 2 }],
    });
  } catch (error) {
    thrown = error;
  }

  TestValidator.predicate(
    "duplicate motion ids throw",
    thrown instanceof Error,
  );
  TestValidator.predicate(
    "duplicate motion id names both entries",
    thrown instanceof Error &&
      thrown.message.includes('motion "walk" is duplicated') &&
      thrown.message.includes("props.motions[0].id") &&
      thrown.message.includes("props.motions[1].id"),
  );
};
