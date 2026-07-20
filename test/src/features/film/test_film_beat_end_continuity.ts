import { resolveBeatEnd, sampleMotion } from "@automovie/engine";
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
import { nclose, vclose } from "../internal/predicates";

/**
 * A looping travel clip whose root advances x = 2t over a 1-second cycle: the
 * exact hand-oracle for phase and velocity at every beat boundary.
 */
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

const shotOf = (duration: number): IAutoMovieShot => ({
  id: "shot:beat-1",
  name: null,
  scene: "scene",
  camera: "cam",
  cameraMotion: null,
  performances: [{ node: "hero", motion: "walk", startOffset: 0 }],
  objectMotions: [],
  duration,
});

const endOf = (duration: number) =>
  resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot: shotOf(duration),
    motions: [walk],
  }).actors[0]!;

/**
 * The continuity invariant behind "an hour of walking with no stutter at the
 * cuts": a beat-end state must let the next beat resume the gait exactly where
 * this beat left it. The carried gait phase re-samples to the very pose the
 * beat ended on, the folded transform is the exact world position to restage at
 * (with the pose root cleared so nothing double-applies), and the root velocity
 * matches the clip's true derivative, including at the loop seam, where a
 * naive finite difference across the wrap would report a teleport.
 *
 * Scenarios:
 *
 * 1. Mid-cycle end (2.25 s into a 1 s loop): gaitPhase = 0.25, world position
 *    folds to x = 0.5, and rootVelocity = the clip's constant 2 m/s.
 * 2. Resume equality: sampling the clip at the carried phase reproduces the end
 *    sample exactly (same joints, same root): the next beat's first frame IS
 *    this beat's last.
 * 3. Restage seam: the end pose's root is cleared, so an actor staged at the
 *    carried transform starts precisely at the end position, no double-apply.
 * 4. Exactly on the loop seam (2.0 s): phase wraps to 0 and velocity is measured
 *    on the cycle's closing stretch (clamped, not wrapped): still 2 m/s, not a
 *    backwards teleport.
 * 5. In the cycle's opening instants (phase < the finite-difference window) the
 *    window shrinks to [0, phase] and still reads 2 m/s.
 */
export const test_film_beat_end_continuity = (): void => {
  const mid = endOf(2.25);
  TestValidator.predicate("mid-cycle phase", nclose(mid.gaitPhase!, 0.25));
  TestValidator.predicate(
    "mid-cycle world position",
    vclose(mid.transform.translation, { x: 0.5, y: 0, z: 0 }),
  );
  TestValidator.predicate(
    "mid-cycle velocity",
    vclose(mid.rootVelocity!, { x: 2, y: 0, z: 0 }, 1e-9),
  );

  const resumed = sampleMotion(walk, mid.gaitPhase!).pose;
  const ended = sampleMotion(walk, 2.25).pose;
  TestValidator.equals(
    "resume reproduces joints",
    resumed.joints,
    ended.joints,
  );
  TestValidator.predicate(
    "resume reproduces root",
    vclose(resumed.root!.translation, ended.root!.translation, 1e-12),
  );

  TestValidator.equals("end pose root cleared", mid.pose!.root, null);

  const seam = endOf(2);
  TestValidator.predicate("seam phase wraps to 0", nclose(seam.gaitPhase!, 0));
  TestValidator.predicate(
    "seam velocity from the closing stretch",
    vclose(seam.rootVelocity!, { x: 2, y: 0, z: 0 }, 1e-9),
  );

  const opening = endOf(2.02);
  TestValidator.predicate(
    "opening-instants phase",
    nclose(opening.gaitPhase!, 0.02, 1e-9),
  );
  TestValidator.predicate(
    "opening-instants velocity",
    vclose(opening.rootVelocity!, { x: 2, y: 0, z: 0 }, 1e-6),
  );
};
