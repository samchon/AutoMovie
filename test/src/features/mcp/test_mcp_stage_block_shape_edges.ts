import { IAutoMovieStagingApplication } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();
const script = makeScriptWrite();
const staging = makeStagingWrite();

type StageActors = IAutoMovieStagingApplication.IWrite["actors"];
type StageCameras = IAutoMovieStagingApplication.IWrite["cameras"];
type StageLights = IAutoMovieStagingApplication.IWrite["lights"];

const stageWith = (
  override: Partial<IAutoMovieStagingApplication.IWrite>,
): ReturnType<AutoMovieApplication["stage"]>["staged"] =>
  app.stage({ script, staging: { ...staging, ...override } }).staged;

/**
 * The MCP `stage` and `block` shape gates cover the mount-binding, camera-
 * target, and cast/scene-node branches the base tool tests do not: a malformed
 * mount binding, a camera `lookAt` point/unknown kind, a non-object placement,
 * and a non-object cast member / scene node all fail as field-located data
 * before the engine consumer dereferences them.
 *
 * Scenarios:
 *
 * 1. An actor mount binding with bad `parent`/`bone` fails at its `.attach.*`
 *    paths; an explicitly `null` mount binding fails at `.attach`.
 * 2. A non-object camera placement, a non-object light placement, and a non-object
 *    script cast member fail at their submitted paths.
 * 3. A camera `lookAt` of kind `point` with a non-object point, and one of an
 *    unknown kind, fail at their `lookAt` paths.
 * 4. A non-object script beat and a non-object staged scene node fail through
 *    `block` at their submitted paths.
 */
export const test_mcp_stage_block_shape_edges = (): void => {
  const badAttach = stageWith({
    actors: [
      {
        ...staging.actors[0]!,
        attach: { parent: 5, bone: 5 },
      },
      staging.actors[1]!,
    ] as unknown as StageActors,
  });
  TestValidator.predicate(
    "a mount binding with bad parent/bone fails at its attach paths",
    hasViolation(badAttach, "type", "$input.staging.actors[0].attach.parent") &&
      hasViolation(badAttach, "type", "$input.staging.actors[0].attach.bone"),
  );

  const nullAttach = stageWith({
    actors: [
      { ...staging.actors[0]!, attach: null },
      staging.actors[1]!,
    ] as unknown as StageActors,
  });
  TestValidator.predicate(
    "an explicitly null mount binding fails at its attach path",
    hasViolation(nullAttach, "type", "$input.staging.actors[0].attach"),
  );

  const nonObjectCamera = stageWith({
    cameras: [null] as unknown as StageCameras,
  });
  TestValidator.predicate(
    "a non-object camera placement fails at its path",
    hasViolation(nonObjectCamera, "type", "$input.staging.cameras[0]"),
  );

  const nonObjectLight = stageWith({
    lights: [null] as unknown as StageLights,
  });
  TestValidator.predicate(
    "a non-object light placement fails at its path",
    hasViolation(nonObjectLight, "type", "$input.staging.lights[0]"),
  );

  const nonObjectCastMember = app.stage({
    script: makeScriptWrite({
      cast: [null] as unknown as ReturnType<typeof makeScriptWrite>["cast"],
    }),
    staging,
  }).staged;
  TestValidator.predicate(
    "a non-object script cast member fails at its path",
    hasViolation(nonObjectCastMember, "type", "$input.script.cast[0]"),
  );

  const pointTarget = stageWith({
    cameras: [
      { ...staging.cameras[0]!, lookAt: { kind: "point", point: 5 } },
    ] as unknown as StageCameras,
  });
  TestValidator.predicate(
    "a camera lookAt point with a non-object point fails at its path",
    hasViolation(pointTarget, "type", "$input.staging.cameras[0].lookAt.point"),
  );

  const unknownTargetKind = stageWith({
    cameras: [
      { ...staging.cameras[0]!, lookAt: { kind: "bogus" } },
    ] as unknown as StageCameras,
  });
  TestValidator.predicate(
    "a camera lookAt of an unknown kind fails at its path",
    hasViolation(unknownTargetKind, "type", "$input.staging.cameras[0].lookAt"),
  );

  // block: a non-object script beat and a non-object staged scene node.
  const staged = app.stage({ script, staging }).staged;
  if (staged.success !== true) throw new Error("staging must succeed");
  const blocking = makeBlockingWrite();

  const nonObjectBeat = app.block({
    script: {
      ...script,
      beats: [null] as unknown as ReturnType<typeof makeScriptWrite>["beats"],
    },
    staged,
    blocking,
  }).blocked;
  TestValidator.predicate(
    "a non-object script beat fails through block at its path",
    hasViolation(nonObjectBeat, "type", "$input.script.beats[0]"),
  );

  const nonObjectSceneNode = app.block({
    script,
    staged: {
      ...staged,
      scene: {
        ...staged.scene,
        nodes: [null] as unknown as typeof staged.scene.nodes,
      },
    },
    blocking,
  }).blocked;
  TestValidator.predicate(
    "a non-object staged scene node fails through block at its path",
    hasViolation(nonObjectSceneNode, "type", "$input.staged.scene.nodes[0]"),
  );
};
