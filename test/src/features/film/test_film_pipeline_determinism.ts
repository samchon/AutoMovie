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
 * identical inputs and serialize everything it produces: the staged scene,
 * both shots, the dense per-frame motion clips, and the cut sequence. The
 * densest artifact, the compiled `motions`, is where a residual non-purity
 * would show up in the sampled floats.
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
 * below the model. This runs the whole spine twice in ONE process and compares
 * the serialized artifacts byte-for-byte.
 *
 * What that gates and what it does NOT: two runs of a pure function are
 * byte-identical by construction, and Map/Set iteration order, `JSON.stringify`
 * key order, and float accumulation order are all per-process deterministic,
 * so this cannot fail on those ordering hazards; only an incidental IMPURITY
 * leaking between the two runs (a `Date.now()`/`Math.random()` reach, mutable
 * module state) makes them differ, and that is exactly what a same-process
 * double-run catches. The ordering hazards are covered where they can be: by
 * the oracle- derived per-value tests (which pin the numbers themselves) and,
 * for the cross-host ordering the determinism mandate is really about, by
 * `compareCodeUnits` replacing locale collation at every ordering site (#1225).
 * A committed golden digest would gate cross-process reproducibility too, but
 * it is a snapshot of the code's own output, the anti-oracle the coverage
 * skill warns against, so it is deliberately not used here.
 *
 * Scenarios:
 *
 * 1. Running the full stage -> perform -> cut spine twice from identical fixtures
 *    serializes byte-identically: no residual clock/RNG/global-state
 *    impurity.
 * 2. The serialized output actually carries the dense float artifact (the keyframe
 *    samples), so the check is a real signal, not a trivially-equal empty
 *    payload.
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
