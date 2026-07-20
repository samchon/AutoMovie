import { reviewVisualRead } from "@automovie/engine";
import {
  IAutoMovieCamera,
  IAutoMovieClip,
  IAutoMovieInteractionEvent,
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieSceneNode,
  IAutoMovieShot,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { keyframe, makeMotion, makePose } from "../internal/fixtures";

const IDENTITY_Q = { x: 0, y: 0, z: 0, w: 1 };
const t3 = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: IDENTITY_Q,
  scale: { x: 1, y: 1, z: 1 },
});

/** A camera at the origin looking down world −Z (identity rotation). */
const camera = (over: Partial<IAutoMovieCamera> = {}): IAutoMovieCamera => ({
  id: "cam",
  transform: t3(0, 0, 0),
  fovY: 60,
  near: 0.1,
  far: 100,
  ...over,
});

const node = (id: string): IAutoMovieSceneNode => ({
  id,
  model: "m",
  transform: t3(0, 0, 0),
  motion: null,
  pose: null,
});

/** A static actor whose world root sits at (x, y, z). The node is at origin. */
const rootMotion = (
  id: string,
  x: number,
  y: number,
  z: number,
): IAutoMovieMotion => ({
  ...makeMotion(
    [
      keyframe(0, makePose([], t3(x, y, z))),
      keyframe(1, makePose([], t3(x, y, z))),
    ],
    1,
  ),
  id,
});

const scene = (cam: IAutoMovieCamera): IAutoMovieScene => ({
  id: "s",
  name: null,
  nodes: [node("hero")],
  cameras: [cam],
  lights: [],
});

const shot = (over: Partial<IAutoMovieShot> = {}): IAutoMovieShot => ({
  id: "shot",
  name: null,
  scene: "s",
  camera: "cam",
  cameraMotion: null,
  performances: [{ node: "hero", motion: "m1", startOffset: 0 }],
  objectMotions: [],
  duration: 1,
  ...over,
});

/** Run the framing metric for a single (camera, actor-position) pair. */
const framing = (
  cam: IAutoMovieCamera,
  actor: IAutoMovieMotion,
  shotOver: Partial<IAutoMovieShot> = {},
) =>
  reviewVisualRead({
    beat: "b1",
    scene: scene(cam),
    shot: shot(shotOver),
    motions: [actor],
    sampleRate: 1,
  });

const camMotion = (tracks: IAutoMovieClip["tracks"]): IAutoMovieClip => ({
  id: "cam-move",
  name: null,
  duration: 1,
  loop: false,
  tracks,
});

const hitEvent = (
  over: Partial<IAutoMovieInteractionEvent> = {},
): IAutoMovieInteractionEvent => ({
  id: "e",
  kind: "hit",
  source: "impactOutput",
  time: 0,
  actor: null,
  target: "hero",
  object: null,
  point: { x: 0, y: 0, z: 0 },
  actionIndex: null,
  reaction: null,
  ...over,
});

/** Contact metric only: an invalid camera skips framing, isolating the sweep. */
const contact = (
  actor: IAutoMovieMotion,
  events: IAutoMovieInteractionEvent[],
  contactRadius?: number,
) =>
  reviewVisualRead({
    beat: "b1",
    scene: scene(camera()),
    shot: shot({ camera: "nope", events }),
    motions: [actor],
    sampleRate: 1,
    contactRadius,
  });

/** Two performing actors "a" and "b" over the default origin camera. */
const silhouette = (
  a: IAutoMovieMotion,
  b: IAutoMovieMotion,
  silhouetteRadius?: number,
) =>
  reviewVisualRead({
    beat: "b1",
    scene: {
      id: "s",
      name: null,
      nodes: [node("a"), node("b")],
      cameras: [camera()],
      lights: [],
    },
    shot: shot({
      performances: [
        { node: "a", motion: "ma", startOffset: 0 },
        { node: "b", motion: "mb", startOffset: 0 },
      ],
    }),
    motions: [a, b],
    sampleRate: 1,
    silhouetteRadius,
  });

/**
 * `reviewVisualRead` (#1177) computes deterministic visual-read advisory notes
 * (`tier: "visual"`, D015: notes, not gates).
 *
 * Subject-in-frame scenarios:
 *
 * 1. A subject 5 m down the camera's −Z stays centered: no note; the default
 *    sample rate and an explicit aspect frame it too.
 * 2. A subject above/behind/past-far/beside the frustum each earns exactly one
 *    note naming it and the first off-frame time.
 * 3. No live camera, a non-finite/zero/too-wide FOV, and far≤near read nothing.
 * 4. A craning camera is sampled, not read as static; a move missing its rotation
 *    or translation track falls back to the static component.
 * 5. A held (null-motion) performance, a missing motion, and a missing node are
 *    skipped, not errored.
 *
 * Contact-connection scenarios (isolated with an invalid camera):
 *
 * 6. A hit landing on the target connects (no note); landing past the body radius
 *    reads as a miss; a `contact`-kind event checks the same way.
 * 7. A non-impact event (grab), a null point, a null target, a target that does
 *    not perform, and a held target are skipped; a generous contactRadius
 *    tolerates the offset.
 *
 * Silhouette-separation scenarios (two performing actors):
 *
 * 8. Actors stacked on the camera line merge into one blob; actors spread across
 *    the frame do not; a large silhouette radius merges the spread pair; an
 *    actor inside the near plane is a framing note, not a silhouette merge.
 */
export const test_film_review_visual_read = (): void => {
  TestValidator.equals(
    "a centered subject earns no note",
    framing(camera(), rootMotion("m1", 0, 0, -5)).length,
    0,
  );

  // defaults hold: omit sampleRate (→ 12) and pass an explicit aspect.
  TestValidator.equals(
    "the default sample rate and an explicit aspect still frame a centered subject",
    reviewVisualRead({
      beat: "b1",
      scene: scene(camera()),
      shot: shot(),
      motions: [rootMotion("m1", 0, 0, -5)],
      aspect: 1,
    }).length,
    0,
  );

  const above = framing(camera(), rootMotion("m1", 0, 10, -5));
  TestValidator.predicate(
    "a subject above the frame earns one visual note",
    above.length === 1 &&
      above[0]!.tier === "visual" &&
      above[0]!.beat === "b1" &&
      above[0]!.issue.includes("hero"),
  );
  TestValidator.equals(
    "a subject behind the camera earns a note",
    framing(camera(), rootMotion("m1", 0, 0, 5)).length,
    1,
  );
  TestValidator.equals(
    "a subject past the far plane earns a note",
    framing(camera(), rootMotion("m1", 0, 0, -200)).length,
    1,
  );
  TestValidator.equals(
    "a subject beside the frame earns a note",
    framing(camera(), rootMotion("m1", 20, 0, -5)).length,
    1,
  );

  // 6-10. degenerate cameras read nothing.
  TestValidator.equals(
    "no live camera reads nothing",
    framing(camera(), rootMotion("m1", 0, 10, -5), { camera: "nope" }).length,
    0,
  );
  TestValidator.equals(
    "a non-finite FOV reads nothing",
    framing(camera({ fovY: Number.NaN }), rootMotion("m1", 0, 10, -5)).length,
    0,
  );
  TestValidator.equals(
    "a zero FOV reads nothing",
    framing(camera({ fovY: 0 }), rootMotion("m1", 0, 10, -5)).length,
    0,
  );
  TestValidator.equals(
    "a >=180 FOV reads nothing",
    framing(camera({ fovY: 200 }), rootMotion("m1", 0, 10, -5)).length,
    0,
  );
  TestValidator.equals(
    "far <= near reads nothing",
    framing(camera({ near: 100, far: 1 }), rootMotion("m1", 0, 0, -5)).length,
    0,
  );

  // 11. a camera crane samples the move: a centered subject leaves frame as the
  // camera rises to y=50 by t=1.
  const crane = camMotion([
    {
      channel: { kind: "node", node: "cam", path: "translation" },
      times: [0, 1],
      values: [0, 0, 0, 0, 50, 0],
      interpolation: "linear",
    },
    {
      channel: { kind: "node", node: "cam", path: "rotation" },
      times: [0, 1],
      values: [0, 0, 0, 1, 0, 0, 0, 1],
      interpolation: "linear",
    },
  ]);
  TestValidator.equals(
    "a craning camera drops the subject out of frame",
    framing(camera(), rootMotion("m1", 0, 0, -5), { cameraMotion: crane })
      .length,
    1,
  );

  // 12. camera move with no rotation track → falls back to static rotation.
  const noRot = camMotion([
    {
      channel: { kind: "node", node: "cam", path: "translation" },
      times: [0, 1],
      values: [0, 0, 0, 0, 0, 0],
      interpolation: "linear",
    },
  ]);
  TestValidator.equals(
    "a move missing its rotation track keeps the subject framed",
    framing(camera(), rootMotion("m1", 0, 0, -5), { cameraMotion: noRot })
      .length,
    0,
  );
  // 13. camera move with no translation track → falls back to static position.
  const noPos = camMotion([
    {
      channel: { kind: "node", node: "cam", path: "rotation" },
      times: [0, 1],
      values: [0, 0, 0, 1, 0, 0, 0, 1],
      interpolation: "linear",
    },
  ]);
  TestValidator.equals(
    "a move missing its translation track keeps the subject framed",
    framing(camera(), rootMotion("m1", 0, 0, -5), { cameraMotion: noPos })
      .length,
    0,
  );

  // 14-16. skips, never errors.
  TestValidator.equals(
    "a held (null-motion) performance is skipped",
    framing(camera(), rootMotion("m1", 0, 10, -5), {
      performances: [{ node: "hero", motion: null, startOffset: 0 }],
    }).length,
    0,
  );
  TestValidator.equals(
    "a missing motion is skipped",
    framing(camera(), rootMotion("m1", 0, 10, -5), {
      performances: [{ node: "hero", motion: "ghost", startOffset: 0 }],
    }).length,
    0,
  );
  TestValidator.equals(
    "a missing node is skipped",
    framing(camera(), rootMotion("m1", 0, 10, -5), {
      performances: [{ node: "ghost", motion: "m1", startOffset: 0 }],
    }).length,
    0,
  );

  // contact-connection: a hit whose point lands on the target reads as
  // connected; landing past the body radius reads as a miss.
  const heroAtOrigin = rootMotion("m1", 0, 0, 0);
  TestValidator.equals(
    "a hit that lands on the target connects",
    contact(heroAtOrigin, [hitEvent({ point: { x: 0, y: 0, z: 0 } })]).length,
    0,
  );
  const miss = contact(heroAtOrigin, [
    hitEvent({ point: { x: 5, y: 0, z: 0 } }),
  ]);
  TestValidator.predicate(
    "a hit that lands off the body reads as a miss",
    miss.length === 1 &&
      miss[0]!.tier === "visual" &&
      miss[0]!.issue.includes("hero") &&
      miss[0]!.issue.includes("hit"),
  );
  TestValidator.equals(
    "a contact-kind event off the body also reads as a miss",
    contact(heroAtOrigin, [
      hitEvent({ kind: "contact", point: { x: 5, y: 0, z: 0 } }),
    ]).length,
    1,
  );
  TestValidator.equals(
    "a non-impact event (grab) is not a contact check",
    contact(heroAtOrigin, [
      hitEvent({ kind: "grab", point: { x: 5, y: 0, z: 0 } }),
    ]).length,
    0,
  );
  TestValidator.equals(
    "an event with no world point is skipped",
    contact(heroAtOrigin, [hitEvent({ point: null })]).length,
    0,
  );
  TestValidator.equals(
    "an event with no target is skipped",
    contact(heroAtOrigin, [
      hitEvent({ target: null, point: { x: 5, y: 0, z: 0 } }),
    ]).length,
    0,
  );
  TestValidator.equals(
    "an event whose target does not perform is skipped",
    contact(heroAtOrigin, [
      hitEvent({ target: "ghost", point: { x: 5, y: 0, z: 0 } }),
    ]).length,
    0,
  );
  TestValidator.equals(
    "an event whose target is held (null motion) is skipped",
    reviewVisualRead({
      beat: "b1",
      scene: scene(camera()),
      shot: shot({
        camera: "nope",
        performances: [{ node: "hero", motion: null, startOffset: 0 }],
        events: [hitEvent({ point: { x: 5, y: 0, z: 0 } })],
      }),
      motions: [heroAtOrigin],
      sampleRate: 1,
    }).length,
    0,
  );
  TestValidator.equals(
    "a generous contact radius tolerates the same offset",
    contact(heroAtOrigin, [hitEvent({ point: { x: 5, y: 0, z: 0 } })], 10)
      .length,
    0,
  );

  // silhouette separation: two actors nearly on the camera's line merge.
  const merged = silhouette(
    rootMotion("ma", 0, 0, -5),
    rootMotion("mb", 0.1, 0, -5),
  );
  TestValidator.predicate(
    "two actors stacked on the camera line merge in silhouette",
    merged.length === 1 &&
      merged[0]!.issue.includes("merge in silhouette") &&
      merged[0]!.issue.includes('"a"') &&
      merged[0]!.issue.includes('"b"'),
  );
  TestValidator.equals(
    "two actors spread across the frame do not merge",
    silhouette(rootMotion("ma", 0, 0, -5), rootMotion("mb", 3, 0, -5)).length,
    0,
  );
  TestValidator.equals(
    "a large silhouette radius merges the spread pair",
    silhouette(rootMotion("ma", 0, 0, -5), rootMotion("mb", 3, 0, -5), 5)
      .length,
    1,
  );
  // an actor within the near plane: framing flags it, the silhouette pair skips.
  const nearGuard = silhouette(
    rootMotion("ma", 0, 0, -0.05),
    rootMotion("mb", 0, 0, -5),
  );
  TestValidator.predicate(
    "an actor inside the near plane is a framing note, not a silhouette merge",
    nearGuard.length === 1 &&
      nearGuard[0]!.issue.includes("leaves the camera frame") &&
      !nearGuard.some((n) => n.issue.includes("silhouette")),
  );
};
