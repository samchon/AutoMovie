import {
  IAutoMoviePerformedShot,
  performShot,
  stageScene,
} from "@automovie/engine";
import { IAutoMovieActionCall } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";

const script = makeScriptWrite();

/**
 * The duel, plus the two things the old lookup could not see: a set piece and a
 * second camera. `cam-main` frames, `cam-side` stands in as a thing to point
 * at.
 */
const staging = makeStagingWrite({
  set: [
    { node: "altar", model: "box", position: { x: 1, y: 0, z: 1 } },
    { node: "pebble", model: "sphere", position: { x: 0, y: 1.2, z: 0 } },
  ],
  cameras: [
    {
      node: "cam-main",
      position: { x: 2, y: 1.5, z: 0.35 },
      lookAt: { kind: "node", node: "knightA" },
      fovDeg: 40,
    },
    {
      node: "cam-side",
      position: { x: -2, y: 1.5, z: 0.35 },
      lookAt: { kind: "node", node: "knightB" },
      fovDeg: 40,
    },
  ],
});

/** One perform per probe, differing only in the draft under test. */
const performing = (): ((
  draft: IAutoMovieActionCall[],
) => IAutoMoviePerformedShot) => {
  const staged = stageScene(script, staging);
  if (staged.success !== true) throw new Error("staging fixture must succeed");
  return (draft) =>
    performShot({
      script,
      staged,
      performance: makePerformanceWrite({
        draft,
        revise: { review: "unchanged.", final: null },
      }),
      synthesize: validSynthesizer,
      skeleton: () => createSkeleton(),
    });
};

/** True when the refusal at `path` states every fragment. */
const says = (
  result: IAutoMoviePerformedShot,
  path: string,
  ...fragments: string[]
): boolean =>
  result.success === false &&
  result.violations.some(
    (item) =>
      item.path === path &&
      fragments.every((fragment) => item.expected.includes(fragment)),
  );

/** True when nothing was refused at `path` (the over-rejection counter-case). */
const silentAt = (result: IAutoMoviePerformedShot, path: string): boolean =>
  result.success === true ||
  result.violations.every((item) => item.path !== path);

/** One unresolved-target probe per verb that routes through the helper. */
const UNRESOLVED_BY_VERB: ReadonlyArray<
  readonly [string, IAutoMovieActionCall, string]
> = [
  [
    "lookAt",
    {
      verb: "lookAt",
      actor: "knightA",
      start: 0,
      duration: 1,
      to: { kind: "node", node: "ghost" },
    },
    "$input.draft[0].to",
  ],
  [
    "reach",
    {
      verb: "reach",
      actor: "knightA",
      start: 0,
      duration: 1,
      hand: "right",
      to: { kind: "node", node: "ghost" },
    },
    "$input.draft[0].to",
  ],
  [
    "point gesture",
    {
      verb: "gesture",
      actor: "knightA",
      start: 0,
      duration: 1,
      kind: "point",
      at: { kind: "node", node: "ghost" },
    },
    "$input.draft[0].at",
  ],
  [
    "strike gesture",
    {
      verb: "gesture",
      actor: "knightA",
      start: 0,
      duration: 1,
      kind: "strike",
      at: { kind: "node", node: "ghost" },
    },
    "$input.draft[0].at",
  ],
  [
    "launch",
    {
      verb: "launch",
      actor: "knightA",
      start: 0,
      duration: 1,
      projectile: "pebble",
      at: { kind: "node", node: "ghost" },
      speed: 20,
    },
    "$input.draft[0].at",
  ],
  [
    "frame subject",
    {
      verb: "frame",
      actor: "cam-main",
      start: 0,
      duration: "auto",
      framing: "medium",
      move: "static",
      on: { kind: "node", node: "ghost" },
    },
    "$input.draft[0].on",
  ],
  [
    "frame focus",
    {
      verb: "frame",
      actor: "cam-main",
      start: 0,
      duration: "auto",
      framing: "medium",
      move: "static",
      on: { kind: "node", node: "knightA" },
      focus: { kind: "node", node: "ghost" },
    },
    "$input.draft[0].focus",
  ],
];

/** The same probes, aimed at a staged camera instead of an unknown id. */
const CAMERA_BY_VERB: ReadonlyArray<readonly [string, IAutoMovieActionCall]> = [
  [
    "lookAt",
    {
      verb: "lookAt",
      actor: "knightA",
      start: 0,
      duration: 1,
      to: { kind: "node", node: "cam-main" },
    },
  ],
  [
    "reach",
    {
      verb: "reach",
      actor: "knightA",
      start: 0,
      duration: 1,
      hand: "right",
      to: { kind: "node", node: "cam-main" },
    },
  ],
  [
    "point gesture",
    {
      verb: "gesture",
      actor: "knightA",
      start: 0,
      duration: 1,
      kind: "point",
      at: { kind: "node", node: "cam-main" },
    },
  ],
  [
    "strike gesture",
    {
      verb: "gesture",
      actor: "knightA",
      start: 0,
      duration: 1,
      kind: "strike",
      at: { kind: "node", node: "cam-main" },
    },
  ],
  [
    "launch",
    {
      verb: "launch",
      actor: "knightA",
      start: 0,
      duration: 1,
      projectile: "pebble",
      at: { kind: "node", node: "cam-main" },
      speed: 20,
    },
  ],
  [
    "frame subject",
    {
      verb: "frame",
      actor: "cam-main",
      start: 0,
      duration: "auto",
      framing: "medium",
      move: "static",
      on: { kind: "node", node: "cam-side" },
    },
  ],
  [
    "frame focus",
    {
      verb: "frame",
      actor: "cam-main",
      start: 0,
      duration: "auto",
      framing: "medium",
      move: "static",
      on: { kind: "node", node: "knightA" },
      focus: { kind: "node", node: "cam-side" },
    },
  ],
];

/**
 * The positional-target seam of the PERFORMANCE consumer (#1294). Two rules
 * live here: a target resolves against every staged placement (actors, set
 * pieces, and cameras alike, so an actor may be directed to look down the
 * lens), and a target that fails names the id that failed rather than echoing a
 * discriminator the same sentence lists as valid.
 *
 * Scenarios:
 *
 * 1. Every verb routing through `resolvePositionalTarget` (lookAt, reach, the
 *    point and strike gesture aims, a launch aim, a frame subject, a frame
 *    focus) accepts a staged camera id: the reported repro, direct address,
 *    performs instead of being refused.
 * 2. The same verbs aimed at a genuinely unknown id are refused at their own path,
 *    and the refusal quotes that id and says it is not placed. It never reads
 *    `not "node"`, the discriminator the old message echoed while the same
 *    sentence listed `node` as legal.
 * 3. The adjacent cases one property away still pass: an actor target and a set
 *    piece target are not over-rejected by the wider table.
 * 4. A group target whose members are all unplaced names every member; an empty
 *    group says it names none.
 * 5. A `point` target carrying no point says exactly that (its kind was never the
 *    fault); a relative target (`direction`, `offscreen`) is refused as
 *    relative, the one case where the kind IS the fault; an unknown or
 *    malformed kind is refused by that kind.
 * 6. A `point` gesture with no `at` at all still refuses at `.at`, teaching the
 *    same target vocabulary.
 * 7. Camera-as-TARGET does not loosen camera-as-ACTOR: a gesture performed by a
 *    camera is still refused at `.actor`.
 */
export const test_film_perform_shot_positional_target = (): void => {
  const perform = performing();

  // 1. every positional verb accepts a staged camera.
  for (const [label, action] of CAMERA_BY_VERB) {
    const performed = perform([action]);
    TestValidator.equals(
      `${label} at a staged camera performs`,
      performed.success,
      true,
    );
  }

  // 2. an unknown id is named, per verb, at its own path.
  for (const [label, action, path] of UNRESOLVED_BY_VERB) {
    const performed = perform([action]);
    TestValidator.predicate(
      `${label} names the unresolved id, not the discriminator`,
      says(performed, path, '"ghost"', "is not placed in the staged scene") &&
        performed.success === false &&
        performed.violations.every(
          (item) => !item.expected.includes('not "node"'),
        ),
    );
  }

  // 3. the counter-cases one property away: a valid node target of either
  // placed flavour is not over-rejected.
  TestValidator.equals(
    "an actor target still performs",
    perform([
      {
        verb: "lookAt",
        actor: "knightA",
        start: 0,
        duration: 1,
        to: { kind: "node", node: "knightB" },
      },
    ]).success,
    true,
  );
  TestValidator.equals(
    "a set piece target still performs",
    perform([
      {
        verb: "lookAt",
        actor: "knightA",
        start: 0,
        duration: 1,
        to: { kind: "node", node: "altar" },
      },
    ]).success,
    true,
  );

  // 4. groups: every unplaced member is named; an empty one says so.
  const unplacedGroup = perform([
    {
      verb: "lookAt",
      actor: "knightA",
      start: 0,
      duration: 1,
      to: { kind: "group", nodes: ["ghost", "wraith"] },
    },
  ]);
  TestValidator.predicate(
    "an all-unplaced group names every member",
    says(
      unplacedGroup,
      "$input.draft[0].to",
      "none of its group members are placed",
      '"ghost"',
      '"wraith"',
    ),
  );
  TestValidator.predicate(
    "a group mixing a placed member with an unplaced one still resolves",
    perform([
      {
        verb: "lookAt",
        actor: "knightA",
        start: 0,
        duration: 1,
        to: { kind: "group", nodes: ["knightB", "ghost"] },
      },
    ]).success === true,
  );
  TestValidator.predicate(
    "an empty group says it names no members",
    says(
      perform([
        {
          verb: "lookAt",
          actor: "knightA",
          start: 0,
          duration: 1,
          to: { kind: "group", nodes: [] },
        },
      ]),
      "$input.draft[0].to",
      "its group names no members",
    ),
  );

  // 5. the kinds that genuinely have no place: a point target whose point is
  // absent, relative, unknown, malformed.
  TestValidator.predicate(
    "a point target with no point says so",
    says(
      perform([
        {
          verb: "lookAt",
          actor: "knightA",
          start: 0,
          duration: 1,
          to: { kind: "point" } as never,
        },
      ]),
      "$input.draft[0].to",
      "a point target carries no point to resolve",
    ),
  );
  TestValidator.predicate(
    "a direction target is refused as relative",
    says(
      perform([
        {
          verb: "lookAt",
          actor: "knightA",
          start: 0,
          duration: 1,
          to: { kind: "direction", headingDeg: 90 },
        },
      ]),
      "$input.draft[0].to",
      'a target of kind "direction" is relative',
    ),
  );
  TestValidator.predicate(
    "an offscreen target is refused as relative",
    says(
      perform([
        {
          verb: "lookAt",
          actor: "knightA",
          start: 0,
          duration: 1,
          to: { kind: "offscreen", edge: "left" },
        },
      ]),
      "$input.draft[0].to",
      'a target of kind "offscreen" is relative',
    ),
  );
  TestValidator.predicate(
    "an unknown kind is refused by that kind",
    says(
      perform([
        {
          verb: "lookAt",
          actor: "knightA",
          start: 0,
          duration: 1,
          to: { kind: "elsewhere" } as never,
        },
      ]),
      "$input.draft[0].to",
      '"elsewhere" is not a positional target kind',
    ),
  );
  TestValidator.predicate(
    "a malformed kind is refused as malformed",
    says(
      perform([
        {
          verb: "lookAt",
          actor: "knightA",
          start: 0,
          duration: 1,
          to: { kind: 7 } as never,
        },
      ]),
      "$input.draft[0].to",
      '"malformed" is not a positional target kind',
    ),
  );

  // 6. a point gesture with no target at all teaches the same vocabulary.
  TestValidator.predicate(
    "an untargeted point gesture states the target vocabulary",
    says(
      perform([
        {
          verb: "gesture",
          actor: "knightA",
          start: 0,
          duration: 1,
          kind: "point",
        },
      ]),
      "$input.draft[0].at",
      "placed actors, set pieces, or cameras",
      "but none was given",
    ),
  );

  // 7. a camera is a place to point at, never a performer: the actor rule the
  // wider target table must not have loosened.
  const cameraActor = perform([
    {
      verb: "gesture",
      actor: "cam-main",
      start: 0,
      duration: 1,
      kind: "wave",
    },
  ]);
  TestValidator.predicate(
    "a camera still cannot act outside frame",
    says(cameraActor, "$input.draft[0].actor", "is a camera") &&
      silentAt(cameraActor, "$input.draft[0].at"),
  );
};
