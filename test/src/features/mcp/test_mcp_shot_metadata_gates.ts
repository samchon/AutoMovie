import {
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieValidation,
} from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  IDENTITY_TRANSFORM,
  createModel,
  createSkeleton,
} from "../internal/fixtures";

const app = new AutoMovieApplication();
const model = createModel(createSkeleton());

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "actor",
      model: model.id,
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
  ],
  cameras: [
    {
      id: "hero",
      transform: IDENTITY_TRANSFORM,
      fovY: 45,
      near: 0.1,
      far: 100,
    },
    {
      id: "side",
      transform: IDENTITY_TRANSFORM,
      fovY: 45,
      near: 0.1,
      far: 100,
    },
    {
      id: "wide",
      transform: IDENTITY_TRANSFORM,
      fovY: 60,
      near: 0.1,
      far: 100,
    },
  ],
  lights: [],
};

const base: IAutoMovieShot = {
  id: "shot-1",
  name: null,
  scene: scene.id,
  camera: "hero",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 2,
};

const clip = (id: string, times: number[] = [0, 1]) => ({
  id,
  name: null,
  duration: 2,
  loop: false,
  tracks: [
    {
      channel: { kind: "node", node: "side", path: "translation" },
      times,
      values: times.flatMap(() => [0, 0, 0]),
      interpolation: "linear",
    },
  ],
});

const intent = (over: Record<string, unknown> = {}) => ({
  start: 0,
  framing: "medium",
  move: "static",
  focus: null,
  focalLength: null,
  ...over,
});

const event = (over: Record<string, unknown> = {}) => ({
  id: "hit:pebble:actor:0000",
  kind: "hit",
  source: "impactOutput",
  time: 1,
  actor: null,
  target: "actor",
  object: "pebble",
  point: { x: 0, y: 1, z: 0 },
  actionIndex: 0,
  reaction: "actor",
  ...over,
});

const bad = <T>(value: unknown): T => value as T;

const shotWith = (over: Record<string, unknown>): IAutoMovieShot =>
  bad({ ...base, ...over });

const validate = (over: Record<string, unknown>): IAutoMovieValidation =>
  app.validateShot({ shot: shotWith(over), scene }).validation;

const says = (
  validation: IAutoMovieValidation,
  path: string,
  expected: string,
): boolean =>
  validation.success === false &&
  validation.violations.some(
    (violation) =>
      violation.path === path && violation.expected.includes(expected),
  );

/**
 * The shot artifact validator gates every field the shot declares, `events`,
 * `cameraIntent`, and `coverage` included.
 *
 * `validateShot` exists so an agent can prove a shot is well formed before
 * committing it, and `commitShot` runs the same validator as a precondition, so
 * "a commit can never accept what validation would reject" is the stated
 * contract. It was not true for the three fields nothing inspected: `events`,
 * which `playbackEvents` and `reviewVisualRead` iterate (a non-iterable value
 * throws with no path at all), and the two #1187 guide-metadata fields a
 * render/diffusion host reads beside `cameraMotion`.
 *
 * All three are optional and documented as "absent means legacy", so absence
 * must stay valid; only a PRESENT value is inspected.
 *
 * Scenarios:
 *
 * 1. A shot carrying all three fields, well formed, validates clean, and so do the
 *    empty-array and wholly-absent forms: the positive floor the negatives are
 *    measured against.
 * 2. `events`: a non-array, a time outside the shot, a kind outside the closed
 *    union, a source outside its union, a non-finite contact point, and a
 *    non-integer action index each locate their own path.
 * 3. `cameraIntent`: a non-array, a framing and a move outside the closed unions
 *    `performShot` gates a frame action by, a start past the shot, and a
 *    non-positive focal length. `focus: null` and `focalLength: null` stay
 *    legal, which is the negative twin for the last two.
 * 4. `coverage`: a camera that is not a scene camera, a camera equal to the shot's
 *    live camera (coverage plays ANOTHER angle), a duplicated camera, and a
 *    coverage clip whose track times do not increase, proving the alternate
 *    take goes through the same clip validation the hero take does.
 * 5. `coverage[i].cameraMotion: null` is legal (a locked-off covering camera), and
 *    its `cameraIntent` is gated with the same rules as the hero one.
 */
export const test_mcp_shot_metadata_gates = (): void => {
  // 1. the positive floor.
  TestValidator.equals(
    "a fully populated shot validates clean",
    validate({
      events: [event()],
      cameraIntent: [intent()],
      coverage: [
        {
          camera: "side",
          cameraMotion: clip("cam:beat-1:side"),
          cameraIntent: [intent({ focalLength: 35 })],
        },
      ],
    }).success,
    true,
  );
  TestValidator.equals(
    "the empty and absent forms validate clean",
    [
      validate({ events: [], cameraIntent: [], coverage: [] }).success,
      app.validateShot({ shot: base, scene }).validation.success,
    ],
    [true, true],
  );

  // 2. events.
  TestValidator.predicate(
    "a malformed event list is refused field by field",
    says(
      validate({ events: bad("not-a-list") }),
      "$input.events",
      "must be an array",
    ) &&
      says(
        validate({ events: [event({ time: 5 })] }),
        "$input.events[0].time",
        "shot event time",
      ) &&
      says(
        validate({ events: [event({ kind: "explode" })] }),
        "$input.events[0].kind",
        "shot event kind must be one of",
      ) &&
      says(
        validate({ events: [event({ source: "vibes" })] }),
        "$input.events[0].source",
        "shot event source must be one of",
      ) &&
      says(
        validate({ events: [event({ point: { x: 0, y: NaN, z: 0 } })] }),
        "$input.events[0].point.y",
        "must be finite",
      ) &&
      says(
        validate({ events: [event({ actionIndex: 1.5 })] }),
        "$input.events[0].actionIndex",
        "must be null or an integer",
      ),
  );

  // 3. cameraIntent.
  TestValidator.predicate(
    "a malformed intent span is refused field by field",
    says(
      validate({ cameraIntent: bad(7) }),
      "$input.cameraIntent",
      "must be an array",
    ) &&
      says(
        validate({ cameraIntent: [intent({ framing: "enormous" })] }),
        "$input.cameraIntent[0].framing",
        "camera intent framing must be one of",
      ) &&
      says(
        validate({ cameraIntent: [intent({ move: "swoop" })] }),
        "$input.cameraIntent[0].move",
        "camera intent move must be one of",
      ) &&
      says(
        validate({ cameraIntent: [intent({ start: 3 })] }),
        "$input.cameraIntent[0].start",
        "camera intent start",
      ) &&
      says(
        validate({ cameraIntent: [intent({ focalLength: 0 })] }),
        "$input.cameraIntent[0].focalLength",
        "camera intent focal length",
      ) &&
      says(
        validate({ cameraIntent: [intent({ focus: { x: 0, y: 0 } })] }),
        "$input.cameraIntent[0].focus.z",
        "must be finite",
      ),
  );

  // 4. coverage.
  const take = (over: Record<string, unknown> = {}) => ({
    camera: "side",
    cameraMotion: null,
    cameraIntent: [intent()],
    ...over,
  });
  TestValidator.predicate(
    "a malformed coverage list is refused field by field",
    says(
      validate({ coverage: [take({ camera: "ghost-cam" })] }),
      "$input.coverage[0].camera",
      "must reference a scene camera",
    ) &&
      says(
        validate({ coverage: [take({ camera: "hero" })] }),
        "$input.coverage[0].camera",
        "already this shot's live camera",
      ) &&
      says(
        validate({ coverage: [take(), take()] }),
        "$input.coverage[1].camera",
        "is duplicated",
      ) &&
      says(
        validate({
          coverage: [take({ cameraMotion: clip("cam:dup", [1, 1]) })],
        }),
        "$input.coverage[0].cameraMotion.tracks[0].times[1]",
        "must strictly increase",
      ) &&
      says(
        validate({ coverage: [take({ cameraIntent: bad(null) })] }),
        "$input.coverage[0].cameraIntent",
        "must be an array",
      ),
  );

  // 5. the legal boundaries inside a coverage take.
  TestValidator.equals(
    "a locked-off covering camera with distinct angles validates clean",
    validate({
      coverage: [take(), take({ camera: "wide" })],
    }).success,
    true,
  );
  TestValidator.predicate(
    "a coverage intent is gated by the hero intent's rules",
    says(
      validate({
        coverage: [take({ cameraIntent: [intent({ move: "swoop" })] })],
      }),
      "$input.coverage[0].cameraIntent[0].move",
      "camera intent move must be one of",
    ),
  );
};
