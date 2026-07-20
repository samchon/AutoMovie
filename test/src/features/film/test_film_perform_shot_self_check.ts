import { performShot, stageScene } from "@automovie/engine";
import { IAutoMovieScene } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

const script = makeScriptWrite();

const staged = (() => {
  const result = stageScene(script, makeStagingWrite());
  if (result.success !== true) throw new Error("staging fixture must succeed");
  return result;
})();

const performance = makePerformanceWrite({
  draft: [
    { verb: "gesture", actor: "knightA", start: 0, duration: 1, kind: "wave" },
  ],
  revise: { review: "unchanged.", final: null },
});

const perform = (set: typeof staged) =>
  performShot({
    script,
    staged: set,
    performance,
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });

/**
 * The producer states the contract its output satisfies.
 *
 * The shot artifact's rules used to live only beside the MCP commit gate, so
 * `performShot` could assemble a shot no consumer would accept and still report
 * success. The same failure recurred five times (#1224, #1308, #1314, #1316,
 * #1318), each closed by teaching the producer one more field, which is
 * whack-a-mole at the architecture layer. The rules now have one home, in the
 * engine, and `performShot` checks its own output against them before returning
 * (#1320).
 *
 * A failure is an ENGINE defect, not an authoring fault: every author-reachable
 * way to reach it is gated upstream and refused with a path the author can act
 * on. Reaching the self-check means a gate is missing, so it throws rather than
 * returning violations that would blame the wrong party (#1294's lesson), which
 * matches how the engine already reports precondition violations elsewhere
 * (`sampleClip`, `computeRestHeight`, `aimYawPitch` all throw).
 *
 * Scenarios:
 *
 * 1. An ordinary shot performs, so the self-check is silent on valid output. The
 *    whole rest of the film suite is this assertion repeated, since every
 *    `performShot` call now passes through the check.
 * 2. The net catches a gap no field gate covers. `staged.scene.id` is validated
 *    nowhere on this path: `stageScene` would refuse an empty one, but an
 *    EXPLICIT staged set never passes through staging, and the MCP shape gate
 *    only requires a string. So an empty scene id reaches `shot.scene`, which
 *    the artifact contract refuses. Before the self-check this returned
 *    `success: true` with an uncommittable shot, exactly like the five fixed
 *    cases; now it throws, naming the field and saying whose defect it is.
 * 3. The throw is diagnosable: it carries the violating path and says the fault is
 *    the engine's, not the author's, so the message cannot be mistaken for a
 *    correction the author should make.
 */
export const test_film_perform_shot_self_check = (): void => {
  // 1. valid output passes the check silently.
  TestValidator.equals("a valid shot performs", perform(staged).success, true);

  // 2. and 3. the gap the net catches, with the diagnosis it carries.
  const emptySceneId: typeof staged = {
    ...staged,
    scene: { ...staged.scene, id: "" } as IAutoMovieScene,
  };
  TestValidator.predicate(
    "an unguarded empty scene id is caught by the producer's self-check",
    throwsError(() => perform(emptySceneId), ["$input.scene", "engine defect"]),
  );
  TestValidator.predicate(
    "the counter-case one property away still performs",
    perform({
      ...staged,
      scene: { ...staged.scene, id: "scene-duel" } as IAutoMovieScene,
    }).success === true,
  );
};
