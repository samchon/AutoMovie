import { cutSequence, performShot, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/**
 * The workflow spine, end to end: one script's stage payloads flow through
 * every film-pipeline rung (stage the world, perform each beat into a shot,
 * cut the shots into a sequence) with every gate passing on the way. This is
 * the scenario the LLM harness will drive for real; here the stage payloads are
 * authored fixtures, which is exactly the point: the pipeline is deterministic
 * below the model.
 *
 * Scenarios:
 *
 * 1. A two-beat duel script stages into `scene-duel`, and each beat performs into
 *    its own shot (`shot:beat-1` with both knights moving, `shot:beat-2` with
 *    the champion celebrating): both ROM-validated against the stick
 *    skeleton.
 * 2. The cut plays beat-1 whole (2 s) then dissolves 0.5 s into a 1.5 s trim of
 *    beat-2 → a 24 fps sequence with runtime 2 + 1.5 − 0.5 = 3 s, every shot
 *    reference resolving to a built shot.
 */
export const test_film_pipeline_e2e = (): void => {
  const script = makeScriptWrite({
    beats: [
      {
        id: "beat-1",
        name: "the charge",
        summary: "knightA charges knightB",
        durationHint: 2,
      },
      {
        id: "beat-2",
        name: "the aftermath",
        summary: "knightB celebrates over the fallen challenger",
        durationHint: 2,
      },
    ],
  });

  const staged = stageScene(script, makeStagingWrite());
  TestValidator.equals("staging", staged.success, true);
  if (staged.success !== true) return;

  const charge = performShot({
    script,
    staged,
    performance: makePerformanceWrite(),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  const aftermath = performShot({
    script,
    staged,
    performance: makePerformanceWrite({
      beat: "beat-2",
      plan: "the champion raises his arms; camera holds.",
      draft: [
        {
          verb: "gesture",
          actor: "knightB",
          start: 0,
          duration: 2,
          kind: "celebrate",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("charge performed", charge.success, true);
  TestValidator.equals("aftermath performed", aftermath.success, true);
  if (charge.success !== true || aftermath.success !== true) return;
  TestValidator.equals(
    "shots thread the staged scene",
    [charge.shot.scene, aftermath.shot.scene],
    [staged.scene.id, staged.scene.id],
  );

  const cut = cutSequence(
    {
      type: "write",
      sequence: { id: "seq-duel", name: "duel at dawn" },
      fps: 24,
      entries: [
        { shot: charge.shot.id, trim: null, transition: null },
        {
          shot: aftermath.shot.id,
          trim: { start: 0, duration: 1.5 },
          transition: { kind: "crossDissolve", duration: 0.5 },
        },
      ],
      pacing: "the charge runs full; the aftermath breathes then cuts.",
      continuity: "the dissolve carries the fall into the celebration.",
    },
    [charge.shot, aftermath.shot],
  );
  TestValidator.equals("cut", cut.success, true);
  if (cut.success !== true) return;
  TestValidator.equals(
    "cut order",
    cut.sequence.shots.map((s) => s.shot),
    ["shot:beat-1", "shot:beat-2"],
  );
  TestValidator.predicate("runtime 3 s", nclose(cut.runtime, 3));
};
