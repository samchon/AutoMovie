import {
  blockBeat,
  cutSequence,
  forgeCast,
  performShot,
  playbackFrameSamples,
  reviewShot,
  stageScene,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  forgeEntry,
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/**
 * The whole stage ladder in one take ??every harness stage's payload flows
 * through its engine consumer with every gate passing: the script's stand-in is
 * forged, the world staged, the beat blocked, the performance realized against
 * that blocking, the shot reviewed and passed, the film cut, and the cut
 * resolved to render-ready frame samples. This is the pipeline the `agent`
 * package will drive with a real LLM; here the payloads are fixtures, which is
 * the point ??everything below the model is deterministic.
 *
 * Scenarios:
 *
 * 1. Forge ??stage: knightB's stand-in validates and its id is what the staged
 *    scene node carries.
 * 2. Block ??perform: the duel blocking validates and the performance realizes it
 *    (anchor covered, camera intent honoured) into a shot with a compiled
 *    camera clip.
 * 3. Review: the shot passes with an empty backlog.
 * 4. Cut ??playback: a 24 fps one-shot cut runs 2 s ??exactly 48 frame samples,
 *    all on `shot:beat-1` starting at its first instant.
 */
export const test_film_full_ladder_e2e = (): void => {
  const script = makeScriptWrite();

  const forged = forgeCast(script, {
    type: "write",
    entries: [forgeEntry("knightB")],
  });
  TestValidator.equals("forge", forged.success, true);
  if (forged.success !== true) return;

  const staged = stageScene(script, makeStagingWrite());
  TestValidator.equals("stage", staged.success, true);
  if (staged.success !== true) return;
  TestValidator.equals(
    "the stage wears the forged stand-in",
    staged.scene.nodes.find((n) => n.id === "knightB")!.model,
    forged.models["knightB"]!.id,
  );

  const blocked = blockBeat(script, staged, makeBlockingWrite());
  TestValidator.equals("block", blocked.success, true);
  if (blocked.success !== true) return;

  const performed = performShot({
    script,
    staged,
    performance: makePerformanceWrite(),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
    blocking: blocked.blocking,
  });
  TestValidator.equals("perform", performed.success, true);
  if (performed.success !== true) return;
  TestValidator.predicate(
    "the camera move was compiled",
    performed.shot.cameraMotion !== null,
  );

  const reviewed = reviewShot(script, {
    type: "write",
    beat: "beat-1",
    observations: "the strike lands on its anchor; the medium frame holds.",
    verdict: "pass",
    notes: [],
  });
  TestValidator.predicate(
    "review passes with an empty backlog",
    reviewed.success === true &&
      reviewed.verdict === "pass" &&
      reviewed.notes.length === 0,
  );

  const cut = cutSequence(
    {
      type: "write",
      sequence: { id: "seq-duel", name: "duel at dawn" },
      fps: 24,
      entries: [{ shot: performed.shot.id, trim: null, transition: null }],
      pacing: "one held take ??the beat is the film.",
      continuity: "n/a (single shot).",
    },
    [performed.shot],
  );
  TestValidator.equals("cut", cut.success, true);
  if (cut.success !== true) return;
  TestValidator.predicate("runtime", nclose(cut.runtime, 2));

  const samples = playbackFrameSamples(cut.sequence, [performed.shot]);
  TestValidator.equals("frame count", samples.length, 48);
  TestValidator.predicate(
    "first frame opens the shot",
    samples[0]!.shot === "shot:beat-1" && nclose(samples[0]!.time, 0),
  );
  TestValidator.predicate(
    "every frame plays the one shot, hard-cut free",
    samples.every((s) => s.shot === "shot:beat-1" && s.blend === null),
  );
};
