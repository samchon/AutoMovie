import { cutSequence, performShot, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";

/**
 * Run the whole film-pipeline spine (stage -> perform each beat -> cut) from
 * identical inputs and serialize everything it produces — the staged scene,
 * both shots, the dense per-frame motion clips, and the cut sequence. The
 * densest artifact, the compiled `motions`, is precisely where nondeterminism
 * hides: map/Set iteration order, float accumulation order, and any incidental
 * `Date`/random reach would perturb the sampled floats.
 */
const runPipeline = (): string => {
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
  if (staged.success !== true) throw new Error("staging fixture must succeed");

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
  if (charge.success !== true || aftermath.success !== true)
    throw new Error("perform fixtures must succeed");

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
  if (cut.success !== true) throw new Error("cut fixture must succeed");

  return JSON.stringify({
    scene: staged.scene,
    shots: [charge.shot, aftermath.shot],
    motions: [charge.motions, aftermath.motions],
    sequence: cut.sequence,
    runtime: cut.runtime,
  });
};

/**
 * Reproducibility is automovie's headline claim: the pipeline is deterministic
 * below the model. Per-value tests assert the numbers are right but not that
 * they are the SAME across runs — an ordering hazard (map iteration, Set order,
 * float accumulation order) can yield a valid-but-different result each run and
 * pass every value test. This pins byte identity directly.
 *
 * Scenarios:
 *
 * 1. Running the full stage -> perform -> cut spine twice from identical fixtures
 *    serializes to a byte-identical string — the whole artifact, dense motion
 *    clips included, reproduces exactly.
 * 2. The serialized output actually carries the dense float artifact (the keyframe
 *    samples), so the byte-identity check is a real determinism signal rather
 *    than a trivially-equal empty payload.
 */
export const test_film_pipeline_determinism = (): void => {
  const first = runPipeline();
  const second = runPipeline();

  TestValidator.equals(
    "the full pipeline serializes byte-identically across two runs",
    first,
    second,
  );
  TestValidator.predicate(
    "the serialized output carries dense per-frame motion samples",
    first.length > 1000 && first.includes("keyframes"),
  );
};
