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

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

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
  TestValidator.equals(
    "duplicate performance node names both entries",
    namedFacts([
      ["thrownInstanceof", () => thrown instanceof Error],
      [
        "thrownMessage",
        () =>
          thrown instanceof Error &&
          thrown.message.includes('performance for node "hero" is duplicated'),
      ],
      [
        "thrownMessage2",
        () =>
          thrown instanceof Error &&
          thrown.message.includes(
            'performance for node "hero" is duplicated',
          ) &&
          thrown.message.includes("props.shot.performances[0].node"),
      ],
      [
        "thrownMessage3",
        () =>
          thrown instanceof Error &&
          thrown.message.includes(
            'performance for node "hero" is duplicated',
          ) &&
          thrown.message.includes("props.shot.performances[0].node") &&
          thrown.message.includes("props.shot.performances[1].node"),
      ],
    ]),
    {
      thrownInstanceof: true,
      thrownMessage: true,
      thrownMessage2: true,
      thrownMessage3: true,
    },
  );
};
