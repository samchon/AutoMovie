import { blockBeat, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Blocking consumes already-staged scene ids, but it is still a public boundary
 * for beat and node references. Matching blank ids can satisfy existence checks
 * while remaining unusable references for the performance stage.
 *
 * Scenario: blank beat, actor node, and node-target camera references fail at
 * their own fields.
 */
export const test_film_block_beat_nonempty_refs = (): void => {
  const baseScript = makeScriptWrite();
  const baseStaged = stageScene(baseScript, makeStagingWrite());
  if (baseStaged.success !== true) throw new Error("staging must succeed");

  const script = makeScriptWrite({
    beats: [{ ...baseScript.beats[0]!, id: " " }],
  });
  const staged = {
    ...baseStaged,
    scene: {
      ...baseStaged.scene,
      nodes: [{ ...baseStaged.scene.nodes[0]!, id: " " }],
    },
  };

  const blocked = blockBeat(
    script,
    staged,
    makeBlockingWrite({
      beat: " ",
      actors: [{ node: " ", beats: "acts under a blank scene id" }],
      camera: {
        framing: "medium",
        move: "static",
        on: { kind: "node", node: " " },
      },
    }),
  );

  TestValidator.equals("blank blocking refs fail", blocked.success, false);
  TestValidator.predicate(
    "beat id violation",
    blocked.success === false && hasViolation(blocked, "type", "$input.beat"),
  );
  TestValidator.predicate(
    "actor node violation",
    blocked.success === false &&
      hasViolation(blocked, "type", "$input.actors[0].node"),
  );
  TestValidator.predicate(
    "camera node violation",
    blocked.success === false &&
      hasViolation(blocked, "type", "$input.camera.on.node"),
  );
};
