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
  performances: [
    { node: "hero", motion: "walk", startOffset: 0 },
    { node: "hero", motion: null, startOffset: 0 },
  ],
  objectMotions: [],
  duration: 1,
};

/**
 * Beat-end resolution chooses one shot performance per scene node. Duplicate
 * node entries let the later performance silently replace the earlier one, so
 * the returned end state would depend on the shot array order.
 *
 * Scenario: two shot performances target `hero`; beat-end resolution throws
 * before deciding which performance owns the node.
 */
export const test_film_beat_end_duplicate_performance_nodes = (): void => {
  let thrown: unknown = null;
  try {
    resolveBeatEnd({
      beat: "beat-1",
      scene,
      shot,
      motions: [motion],
    });
  } catch (error) {
    thrown = error;
  }

  TestValidator.predicate(
    "duplicate performance nodes throw",
    thrown instanceof Error,
  );
  TestValidator.predicate(
    "duplicate performance node names both entries",
    thrown instanceof Error &&
      thrown.message.includes('performance for node "hero" is duplicated') &&
      thrown.message.includes("props.shot.performances[0].node") &&
      thrown.message.includes("props.shot.performances[1].node"),
  );
};
