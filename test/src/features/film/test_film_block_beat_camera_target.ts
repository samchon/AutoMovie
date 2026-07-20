import { blockBeat, stageScene } from "@automovie/engine";
import { IAutoMovieBlockingApplication } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

type ICameraIntent = IAutoMovieBlockingApplication.ICameraIntent;
type ICoverageIntent = IAutoMovieBlockingApplication.ICoverageIntent;

const script = makeScriptWrite();

/** The duel with a second camera, so one camera has another to favour. */
const staged = (() => {
  const result = stageScene(
    script,
    makeStagingWrite({
      set: [{ node: "altar", model: "box", position: { x: 1, y: 0, z: 1 } }],
      cameras: [
        {
          node: "cam-main",
          position: { x: 2, y: 1.5, z: 0.35 },
          lookAt: { kind: "node", node: "knightA" },
          fovDeg: 40,
        },
        {
          node: "cam-alt",
          position: { x: -2, y: 1.5, z: 0.35 },
          lookAt: { kind: "node", node: "knightB" },
          fovDeg: 40,
        },
      ],
    }),
  );
  if (result.success !== true) throw new Error("staging fixture must succeed");
  return result;
})();

const block = (
  camera: Partial<ICameraIntent> = {},
  coverage?: ICoverageIntent[],
): ReturnType<typeof blockBeat> =>
  blockBeat(
    script,
    staged,
    makeBlockingWrite({
      camera: {
        framing: "medium",
        move: "static",
        on: { kind: "node", node: "knightA" },
        ...camera,
      },
      ...(coverage === undefined ? {} : { coverage }),
    }),
  );

const coverageOf = (on: ICoverageIntent["on"]): ICoverageIntent[] => [
  { camera: "cam-alt", framing: "medium", move: "static", on },
];

/**
 * What a blocking's camera intents may favour: any staged placement, an actor,
 * a set piece, or another camera.
 *
 * The performance stage resolves a positional target against every staged
 * placement, cameras among them (#1294), and never checks the blocking's `on`
 * against its own realization, so a plan naming a camera was refused at `block`
 * while the identical subject sailed through `perform`. That made "camera A
 * frames camera B" a beat that could be performed but never blocked. One rule,
 * one table, both rungs.
 *
 * Scenarios:
 *
 * 1. The hero `camera.on` may name a staged camera; the counter-cases one property
 *    away, an actor and a set piece, still block.
 * 2. A `coverage` intent's `on` may name a staged camera too, the plural half of
 *    the same rule (#1187).
 * 3. The negative twins: an id nothing placed is still refused at
 *    `$input.camera.on.node` and at `$input.coverage[0].on.node`, and the
 *    message names every placement flavour rather than only "a placed actor".
 * 4. A coverage entry naming a camera that is not staged is still refused at
 *    `$input.coverage[0].camera`, so widening what a camera may FAVOUR did not
 *    widen which camera may COVER.
 */
export const test_film_block_beat_camera_target = (): void => {
  // 1. the hero intent.
  TestValidator.equals(
    "the hero camera may favour a staged camera",
    block({ on: { kind: "node", node: "cam-alt" } }).success,
    true,
  );
  TestValidator.equals(
    "an actor subject still blocks",
    block({ on: { kind: "node", node: "knightB" } }).success,
    true,
  );
  TestValidator.equals(
    "a set piece subject still blocks",
    block({ on: { kind: "node", node: "altar" } }).success,
    true,
  );

  // 2. the coverage intent, the plural half of the same rule.
  TestValidator.equals(
    "a coverage angle may favour a staged camera",
    block({}, coverageOf({ kind: "node", node: "cam-main" })).success,
    true,
  );

  // 3. the negative twins: an id nothing placed.
  const heroGhost = block({ on: { kind: "node", node: "nobody" } });
  TestValidator.predicate(
    "an unplaced hero subject is still refused, naming every placement flavour",
    hasViolation(heroGhost, "type", "$input.camera.on.node") &&
      heroGhost.success === false &&
      heroGhost.violations.some((item) =>
        item.expected.includes("an actor, a set piece, or another camera"),
      ),
  );
  const coverGhost = block({}, coverageOf({ kind: "node", node: "nobody" }));
  TestValidator.predicate(
    "an unplaced coverage subject is still refused the same way",
    hasViolation(coverGhost, "type", "$input.coverage[0].on.node") &&
      coverGhost.success === false &&
      coverGhost.violations.some((item) =>
        item.expected.includes("an actor, a set piece, or another camera"),
      ),
  );

  // 4. covering with a camera the staging never placed is still refused.
  TestValidator.predicate(
    "an unstaged coverage camera is still refused",
    hasViolation(
      blockBeat(
        script,
        staged,
        makeBlockingWrite({
          coverage: [
            {
              camera: "cam-ghost",
              framing: "medium",
              move: "static",
              on: { kind: "node", node: "knightB" },
            },
          ],
        }),
      ),
      "type",
      "$input.coverage[0].camera",
    ),
  );
};
