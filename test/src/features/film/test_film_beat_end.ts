import { Quaternion, resolveBeatEnd } from "@automovie/engine";
import {
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  IDENTITY_TRANSFORM,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { nclose, throwsError, vclose } from "../internal/predicates";

const transform = (
  translation: IAutoMovieTransform["translation"],
  rotation = IDENTITY_TRANSFORM.rotation,
): IAutoMovieTransform => ({
  translation,
  rotation,
  scale: { x: 1, y: 1, z: 1 },
});

const rootAt = (
  translation: IAutoMovieTransform["translation"],
  yaw = 0,
): IAutoMovieTransform =>
  transform(translation, Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, yaw));

const walkingMotion: IAutoMovieMotion = {
  ...makeMotion(
    [
      keyframe(0, makePose([], rootAt({ x: 0, y: 0, z: 0 }, 0))),
      keyframe(
        1,
        makePose(
          [joint("leftLowerLeg", { flexion: 30 })],
          rootAt({ x: 2, y: 0, z: 0 }, 90),
        ),
      ),
    ],
    1,
  ),
  id: "walk",
};

const idleMotion: IAutoMovieMotion = {
  ...makeMotion(
    [
      keyframe(0, makePose([joint("head", { twist: 0 })])),
      keyframe(1, makePose([joint("head", { twist: 20 })])),
    ],
    1,
  ),
  id: "idle",
};

const scene: IAutoMovieScene = {
  id: "scene",
  name: null,
  nodes: [
    {
      id: "hero",
      model: "hero",
      transform: transform({ x: 10, y: 0, z: 0 }),
      motion: null,
      pose: null,
    },
    {
      id: "guard",
      model: "guard",
      transform: transform(
        { x: 0, y: 0, z: 2 },
        Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 180),
      ),
      motion: null,
      pose: makePose([joint("leftLowerArm", { flexion: 45 })]),
    },
    {
      id: "crowd",
      model: "crowd",
      transform: transform({ x: -3, y: 0, z: 1 }),
      motion: "idle",
      pose: null,
    },
    {
      id: "extra",
      model: "extra",
      transform: transform({ x: 4, y: 0, z: -1 }),
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
    { node: "hero", motion: "walk", startOffset: 1 },
    { node: "guard", motion: null, startOffset: 0 },
  ],
  objectMotions: [],
  duration: 2,
};

/**
 * Beat-end snapshots are the concrete forward-state behind `getBeatEnd`: they
 * sample performed actors at shot end, fold pose root motion into world-space
 * transforms, preserve held actors, and fail loudly when a referenced clip was
 * not provided.
 */
export const test_film_beat_end = (): void => {
  const end = resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot,
    motions: [walkingMotion, idleMotion],
  });
  TestValidator.equals("beat id", end.beat, "beat-1");
  TestValidator.equals("shot id", end.shot, "shot:beat-1");
  TestValidator.equals(
    "actors stay in scene order",
    end.actors.map((a) => a.node),
    ["hero", "guard", "crowd", "extra"],
  );

  const hero = end.actors[0]!;
  TestValidator.equals("hero motion id", hero.motion, "walk");
  TestValidator.predicate("hero local time", nclose(hero.localTime, 1));
  TestValidator.predicate(
    "hero root folded into world position",
    vclose(hero.transform.translation, { x: 12, y: 0, z: 0 }),
  );
  TestValidator.predicate(
    "hero facing follows sampled root yaw",
    vclose(hero.facing, { x: 1, y: 0, z: 0 }, 1e-6),
  );
  TestValidator.equals("hero pose root is cleared", hero.pose?.root, null);
  TestValidator.equals(
    "hero articulation remains",
    hero.pose?.joints[0]?.bone,
    "leftLowerLeg",
  );

  const guard = end.actors[1]!;
  TestValidator.equals("guard is held", guard.motion, null);
  TestValidator.predicate(
    "guard stays at staged position",
    vclose(guard.transform.translation, { x: 0, y: 0, z: 2 }),
  );
  TestValidator.equals("guard held pose remains", guard.pose?.joints.length, 1);

  const crowd = end.actors[2]!;
  TestValidator.equals("scene-level motion is sampled", crowd.motion, "idle");
  TestValidator.predicate("crowd local time", nclose(crowd.localTime, 2));
  TestValidator.equals(
    "crowd clip clamps to last pose",
    crowd.pose?.joints[0],
    {
      bone: "head",
      flexion: null,
      abduction: null,
      twist: 20,
    },
  );

  const extra = end.actors[3]!;
  TestValidator.equals(
    "unperformed rest actor keeps no motion",
    extra.motion,
    null,
  );
  TestValidator.equals(
    "unperformed rest actor keeps no pose",
    extra.pose,
    null,
  );

  TestValidator.predicate(
    "missing motion throws",
    throwsError(
      () =>
        resolveBeatEnd({ beat: "beat-1", scene, shot, motions: [idleMotion] }),
      'motion "walk" was not provided',
    ),
  );
};
