import { resolveBeatEnd } from "@automovie/engine";
import {
  IAutoMovieBeatEndFootPlant,
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
import { throwsError, vclose } from "../internal/predicates";

/** A one-shot (non-looping) dash whose root advances x = 2t over 1 second. */
const dash: IAutoMovieMotion = {
  ...makeMotion(
    [
      keyframe(
        0,
        makePose([], {
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        }),
      ),
      keyframe(
        1,
        makePose([], {
          translation: { x: 2, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        }),
      ),
    ],
    1,
  ),
  id: "dash",
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
    {
      id: "guard",
      model: "guard",
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: makePose([joint("leftLowerArm", { flexion: 45 })]),
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
  performances: [{ node: "hero", motion: "dash", startOffset: 0 }],
  objectMotions: [],
  duration,
});

const plant = (
  foot: IAutoMovieBeatEndFootPlant["foot"],
  start: number,
  x: number,
): IAutoMovieBeatEndFootPlant => ({
  foot,
  start,
  end: start + 0.4,
  position: { x, y: 0, z: 0 },
});

/**
 * The resumable-sim fields a beat-end state derives beyond the end pose:
 * one-shot clips have no cycle to resume, an ended clip holds still, held
 * actors carry nothing, and plant/mount data pass through with their carry
 * rules (latest plant per foot at/before the end, rider-side mount binding).
 *
 * Scenarios:
 *
 * 1. A non-looping clip mid-flight (0.5 s of 1 s): gaitPhase null (no cycle),
 *    rootVelocity = the clip's true 2 m/s.
 * 2. The same clip past its end (2 s ≥ 1 s): it clamps and holds (zero velocity,
 *    still no phase).
 * 3. A held actor: gaitPhase, rootVelocity, footPlants, and mount all null.
 * 4. Plants carry the latest run per foot at/before beat end: a later left-foot
 *    run supersedes an earlier one even listed first, a not-yet-started run is
 *    filtered, and a foot's only run is kept.
 * 5. No plant entry for a node, and an entry with zero applicable runs, both
 *    yield null.
 * 6. A staged mount is carried onto its rider; unmounted actors get null.
 * 7. Duplicated plant/mount node entries throw loudly.
 * 8. A degenerate zero-duration looping clip has no cycle to resume (null phase,
 *    zero velocity) instead of dividing by its empty period.
 * 9. A performance that starts exactly at shot end (local time 0) has an empty
 *    velocity window: zero, not NaN.
 */
export const test_film_beat_end_sim_state = (): void => {
  const flight = resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot: shotOf(0.5),
    motions: [dash],
  }).actors[0]!;
  TestValidator.equals("one-shot clip has no phase", flight.gaitPhase, null);
  TestValidator.predicate(
    "one-shot velocity mid-flight",
    vclose(flight.rootVelocity!, { x: 2, y: 0, z: 0 }, 1e-9),
  );

  const ended = resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot: shotOf(2),
    motions: [dash],
  }).actors[0]!;
  TestValidator.equals("ended clip has no phase", ended.gaitPhase, null);
  TestValidator.predicate(
    "ended clip holds still",
    vclose(ended.rootVelocity!, { x: 0, y: 0, z: 0 }),
  );

  const withData = resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot: shotOf(2),
    motions: [dash],
    mounts: [{ node: "hero", binding: { parent: "horse", bone: "spine" } }],
    plants: [
      {
        node: "hero",
        plants: [
          plant("leftFoot", 1.2, 3),
          plant("leftFoot", 0.1, 1),
          plant("rightFoot", 0.6, 2),
          plant("rightFoot", 99, 9),
        ],
      },
      { node: "guard", plants: [] },
    ],
  });
  const hero = withData.actors[0]!;
  const guard = withData.actors[1]!;

  TestValidator.equals("guard is held", guard.motion, null);
  TestValidator.equals("held actor has no phase", guard.gaitPhase, null);
  TestValidator.equals("held actor has no velocity", guard.rootVelocity, null);
  TestValidator.equals("empty plant entry yields null", guard.footPlants, null);
  TestValidator.equals("unmounted actor has no mount", guard.mount, null);

  TestValidator.equals(
    "latest plant per foot carried, unstarted filtered",
    hero.footPlants,
    [plant("leftFoot", 1.2, 3), plant("rightFoot", 0.6, 2)],
  );
  TestValidator.equals("mount carried to its rider", hero.mount, {
    parent: "horse",
    bone: "spine",
  });

  const noData = resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot: shotOf(2),
    motions: [dash],
  }).actors[0]!;
  TestValidator.equals("no plant data yields null", noData.footPlants, null);
  TestValidator.equals("no mount data yields null", noData.mount, null);

  TestValidator.predicate(
    "duplicated plant node throws",
    throwsError(
      () =>
        resolveBeatEnd({
          beat: "beat-1",
          scene,
          shot: shotOf(2),
          motions: [dash],
          plants: [
            { node: "hero", plants: [] },
            { node: "hero", plants: [] },
          ],
        }),
      'plants for node "hero" are duplicated at props.plants[1].node',
    ),
  );
  TestValidator.predicate(
    "duplicated mount node throws",
    throwsError(
      () =>
        resolveBeatEnd({
          beat: "beat-1",
          scene,
          shot: shotOf(2),
          motions: [dash],
          mounts: [
            { node: "hero", binding: { parent: "horse", bone: "spine" } },
            { node: "hero", binding: { parent: "cart", bone: "hips" } },
          ],
        }),
      'mount for node "hero" is duplicated at props.mounts[1].node',
    ),
  );

  const still: IAutoMovieMotion = {
    ...makeMotion([keyframe(0, makePose([]))], 0, true),
    id: "dash",
  };
  const degenerate = resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot: shotOf(2),
    motions: [still],
  }).actors[0]!;
  TestValidator.equals(
    "zero-duration loop has no phase",
    degenerate.gaitPhase,
    null,
  );
  TestValidator.predicate(
    "zero-duration loop holds still",
    vclose(degenerate.rootVelocity!, { x: 0, y: 0, z: 0 }),
  );

  const unstarted = resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot: {
      ...shotOf(1),
      performances: [{ node: "hero", motion: "dash", startOffset: 1 }],
    },
    motions: [dash],
  }).actors[0]!;
  TestValidator.predicate(
    "a clip at local time 0 has an empty velocity window",
    vclose(unstarted.rootVelocity!, { x: 0, y: 0, z: 0 }),
  );
};
