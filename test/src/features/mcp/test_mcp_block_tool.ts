import {
  IAutoMovieBlockingApplication,
  IAutoMovieScriptApplication,
} from "@automovie/interface";
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
const staged = app.stage({ script, staging: makeStagingWrite() }).staged;
if (staged.success !== true) throw new Error("stage fixture must succeed");
const blocking = makeBlockingWrite();

/**
 * MCP `block` is a tool boundary, so malformed direct payload shapes fail as
 * blocking violations before the engine block consumer iterates or dereferences
 * them.
 */
export const test_mcp_block_tool = (): void => {
  const blocked = app.block({ script, staged, blocking }).blocked;
  TestValidator.equals("valid block succeeds", blocked.success, true);

  const malformedRequest = app.block(null as never).blocked;
  TestValidator.predicate(
    "malformed request root returns violations",
    malformedRequest.success === false &&
      hasViolation(malformedRequest, "type", "$input"),
  );

  const malformedBeats = app.block({
    script: {
      ...script,
      beats: null as unknown as IAutoMovieScriptApplication.IWrite["beats"],
    },
    staged,
    blocking,
  }).blocked;
  TestValidator.predicate(
    "malformed script beats return violations",
    malformedBeats.success === false &&
      hasViolation(malformedBeats, "type", "$input.script.beats"),
  );

  const malformedSceneNodes = app.block({
    script,
    staged: {
      ...staged,
      scene: {
        ...staged.scene,
        nodes: null as unknown as typeof staged.scene.nodes,
      },
    },
    blocking,
  }).blocked;
  TestValidator.predicate(
    "malformed staged scene nodes return violations",
    malformedSceneNodes.success === false &&
      hasViolation(malformedSceneNodes, "type", "$input.staged.scene.nodes"),
  );

  const malformedActors = app.block({
    script,
    staged,
    blocking: {
      ...blocking,
      actors: null as unknown as IAutoMovieBlockingApplication.IWrite["actors"],
    },
  }).blocked;
  TestValidator.predicate(
    "malformed blocking actors return violations",
    malformedActors.success === false &&
      hasViolation(malformedActors, "type", "$input.blocking.actors"),
  );

  const malformedActorEntry = app.block({
    script,
    staged,
    blocking: {
      ...blocking,
      actors: [
        null as unknown as IAutoMovieBlockingApplication.IWrite["actors"][number],
      ],
    },
  }).blocked;
  TestValidator.predicate(
    "malformed actor intent returns violations",
    malformedActorEntry.success === false &&
      hasViolation(malformedActorEntry, "type", "$input.blocking.actors[0]"),
  );

  const malformedAnchors = app.block({
    script,
    staged,
    blocking: {
      ...blocking,
      actors: [
        {
          ...blocking.actors[0]!,
          anchors:
            {} as unknown as IAutoMovieBlockingApplication.IWrite["actors"][number]["anchors"],
        },
      ],
    },
  }).blocked;
  TestValidator.predicate(
    "malformed actor anchors return violations",
    malformedAnchors.success === false &&
      hasViolation(
        malformedAnchors,
        "type",
        "$input.blocking.actors[0].anchors",
      ),
  );

  const malformedCamera = app.block({
    script,
    staged,
    blocking: {
      ...blocking,
      camera: null as unknown as IAutoMovieBlockingApplication.IWrite["camera"],
    },
  }).blocked;
  TestValidator.predicate(
    "malformed blocking camera returns violations",
    malformedCamera.success === false &&
      hasViolation(malformedCamera, "type", "$input.blocking.camera"),
  );

  const malformedCameraTarget = app.block({
    script,
    staged,
    blocking: {
      ...blocking,
      camera: {
        ...blocking.camera,
        on: null as unknown as IAutoMovieBlockingApplication.IWrite["camera"]["on"],
      },
    },
  }).blocked;
  TestValidator.predicate(
    "malformed camera target returns violations",
    malformedCameraTarget.success === false &&
      hasViolation(malformedCameraTarget, "type", "$input.blocking.camera.on"),
  );

  const duplicateScript = app.block({
    script: makeScriptWrite({
      beats: [
        script.beats[0]!,
        {
          ...script.beats[0]!,
          name: "the duplicate charge",
          summary: "a second planned beat sharing the same id",
        },
      ],
    }),
    staged,
    blocking,
  }).blocked;
  TestValidator.predicate(
    "semantic duplicate script beat returns wrapper path",
    duplicateScript.success === false &&
      hasViolation(duplicateScript, "type", "$input.script.beats[1].id"),
  );

  const unknownBeat = app.block({
    script,
    staged,
    blocking: { ...blocking, beat: "ghost-beat" },
  }).blocked;
  TestValidator.predicate(
    "semantic blocking beat returns wrapper path",
    unknownBeat.success === false &&
      hasViolation(unknownBeat, "type", "$input.blocking.beat"),
  );
};
