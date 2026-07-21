import { IAutoMovieStagedSet } from "@automovie/engine";
import {
  IAutoMovieScriptApplication,
  IAutoMovieStagingApplication,
} from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";

const app = new AutoMovieApplication();
const script: IAutoMovieScriptApplication.IWrite = makeScriptWrite();

/** Stage through the MCP tool with `lights` replaced. */
const stage = (lights: unknown[]): IAutoMovieStagedSet =>
  app.stage({
    script,
    staging: makeStagingWrite({
      lights: lights as IAutoMovieStagingApplication.ILightPlacement[],
    }),
  }).staged;

const refusedAt = (staged: IAutoMovieStagedSet, path: string): boolean =>
  staged.success === false &&
  staged.violations.some((entry) => entry.path === path);

/**
 * The MCP boundary's structural floor for a light placement must not pre-empt
 * the engine's per-kind contract (#1341).
 *
 * The floor used to require `direction` on every placement, which was correct
 * while every staged light was directional and became a bug the moment a point
 * light became expressible: a candle with no aim was refused as a MALFORMED
 * payload ("light direction must be a JSON object") instead of being accepted,
 * and a spot with a malformed `position` had no floor at all. The division of
 * labour is the fix: the boundary checks the SHAPE of what is present, and
 * `stageScene` decides which parameters each kind requires.
 *
 * This drives the tool rather than the engine directly, because the floor only
 * exists on the tool side.
 *
 * Scenarios:
 *
 * 1. A point light with no `direction` reaches the engine and stages, so the floor
 *    no longer refuses a legitimate placement.
 * 2. A directional light with a `direction` still stages, the unchanged half.
 * 3. A malformed `direction` that IS present is still caught at the floor, with
 *    its structural message, so relaxing the presence requirement did not relax
 *    the shape check.
 * 4. `position` gains the same floor: present and malformed is caught at its own
 *    path.
 * 5. A directional light with no `position` reaches the engine, which is the
 *    absent-and-fine arm of the same branch.
 */
export const test_mcp_stage_light_shape = (): void => {
  // 1. absent direction, and the engine accepts it
  const point = stage([
    {
      node: "flame",
      type: "point",
      position: { x: 0, y: 1, z: 0 },
      intensity: 1.2,
    },
  ]);
  TestValidator.equals(
    "a point light with no direction stages",
    point.success,
    true,
  );

  // 2. present direction, the unchanged half
  const directional = stage([
    { node: "sun", direction: { x: -1, y: -1, z: 0 }, intensity: 1 },
  ]);
  TestValidator.equals(
    "a directional light with a direction still stages",
    directional.success,
    true,
  );

  // 3. present but malformed direction is still a floor fault
  TestValidator.predicate(
    "a malformed direction is still caught at the boundary",
    refusedAt(
      stage([{ node: "sun", direction: "east", intensity: 1 }]),
      "$input.staging.lights[0].direction",
    ),
  );

  // 4. position gains the same floor
  TestValidator.predicate(
    "a malformed position is caught at its own path",
    refusedAt(
      stage([{ node: "flame", type: "point", position: 3, intensity: 1 }]),
      "$input.staging.lights[0].position",
    ),
  );

  // 5. absent position, the other side of the same branch
  TestValidator.equals(
    "a directional light with no position stages",
    stage([{ node: "sun", direction: { x: 0, y: -1, z: 0 }, intensity: 1 }])
      .success,
    true,
  );
};
