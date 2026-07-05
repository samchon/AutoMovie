import { performShot, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Performance consumes script and staged objects directly. Matching blank ids
 * can satisfy existence checks while still producing unusable shot, actor,
 * camera, and target references for downstream assembly/rendering.
 *
 * Scenario: blank beat, gesture actor, frame camera, and frame node target
 * references fail at their own fields.
 */
export const test_film_perform_shot_nonempty_refs = (): void => {
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
      cameras: [{ ...baseStaged.scene.cameras[0]!, id: "\t" }],
    },
  };

  const performed = performShot({
    script,
    staged,
    performance: makePerformanceWrite({
      beat: " ",
      draft: [
        {
          verb: "gesture",
          actor: " ",
          start: 0,
          duration: 1,
          kind: "wave",
        },
        {
          verb: "frame",
          actor: "\t",
          start: 0,
          duration: "auto",
          framing: "medium",
          move: "static",
          on: { kind: "node", node: " " },
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });

  TestValidator.equals("blank performance refs fail", performed.success, false);
  TestValidator.predicate(
    "beat id violation",
    performed.success === false &&
      hasViolation(performed, "type", "$input.beat"),
  );
  TestValidator.predicate(
    "action actor violation",
    performed.success === false &&
      hasViolation(performed, "type", "$input.draft[0].actor"),
  );
  TestValidator.predicate(
    "frame camera actor violation",
    performed.success === false &&
      hasViolation(performed, "type", "$input.draft[1].actor"),
  );
  TestValidator.predicate(
    "frame node target violation",
    performed.success === false &&
      hasViolation(performed, "type", "$input.draft[1].on.node"),
  );
};
