import { resolveSequencePlayback, sequenceTimeline } from "@automovie/engine";
import { IAutoMovieSequence, IAutoMovieShot } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const shot = (id: string, duration: number): IAutoMovieShot => ({
  id,
  name: null,
  scene: "scene-duel",
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration,
});
const SHOTS = [shot("shot:beat-1", 3), shot("shot:beat-2", 4)];

const SEQUENCE: IAutoMovieSequence = {
  id: "seq",
  name: null,
  fps: 24,
  shots: [
    { shot: "shot:beat-1", trim: null, transition: null },
    {
      shot: "shot:beat-2",
      trim: { start: 0.5, duration: 2 },
      transition: null,
    },
    {
      shot: "shot:beat-1",
      trim: null,
      transition: { kind: "crossDissolve", duration: 0.5 },
    },
  ],
};

/**
 * Pins the playback resolver against the same cut the ASSEMBLE tests use, so
 * the two arithmetics (gate-side runtime, playback-side timeline) can never
 * drift apart silently. Hand-laid timeline: entry 0 spans [0, 3), entry 1 (trim
 * [0.5, 2.5]) spans [3, 5), entry 2 dissolves in 0.5 s early, spanning [4.5,
 * 7.5) — runtime 7.5.
 *
 * Scenarios:
 *
 * 1. `sequenceTimeline` lays entries at starts 0 / 3 / 4.5 with runtime 7.5.
 * 2. T = 1 → entry 0 at local 1, hard cut (no blend).
 * 3. T = 3.2 → entry 1 at local 0.5 + 0.2 = 0.7 (the trim offsets local time), no
 *    blend.
 * 4. T = 4.7 → inside the dissolve: live entry 2 at local 0.2, blending from the
 *    outgoing entry 1 tail at local 0.5 + 1.7 = 2.2, incoming weight 0.2 / 0.5
 *    = 0.4.
 * 5. T = 4.99…+0.5 = 5.1 (past the dissolve) → entry 2 alone, no blend.
 * 6. T = −1 and T = 7.5 (the exclusive end) → null; T = 0 → entry 0 at 0.
 */
export const test_film_playback_resolver = (): void => {
  const timeline = sequenceTimeline(SEQUENCE, SHOTS);
  TestValidator.equals(
    "entry starts",
    timeline.entries.map((e) => e.start),
    [0, 3, 4.5],
  );
  TestValidator.predicate("runtime", nclose(timeline.runtime, 7.5));

  const at = (t: number) => resolveSequencePlayback(SEQUENCE, SHOTS, t);

  const t1 = at(1)!;
  TestValidator.equals("T=1 shot", t1.shot, "shot:beat-1");
  TestValidator.predicate("T=1 local", nclose(t1.time, 1));
  TestValidator.equals("T=1 hard cut", t1.blend, null);

  const t32 = at(3.2)!;
  TestValidator.equals("T=3.2 shot", t32.shot, "shot:beat-2");
  TestValidator.predicate("T=3.2 trimmed local", nclose(t32.time, 0.7));
  TestValidator.equals("T=3.2 no blend", t32.blend, null);

  const t47 = at(4.7)!;
  TestValidator.equals("T=4.7 live shot", t47.shot, "shot:beat-1");
  TestValidator.predicate("T=4.7 live local", nclose(t47.time, 0.2));
  TestValidator.predicate(
    "T=4.7 outgoing tail",
    t47.blend !== null &&
      t47.blend.shot === "shot:beat-2" &&
      nclose(t47.blend.time, 2.2) &&
      nclose(t47.blend.alpha, 0.4),
  );

  TestValidator.equals("T=5.1 past the dissolve", at(5.1)!.blend, null);

  TestValidator.equals("before the film", at(-1), null);
  TestValidator.equals("at the exclusive end", at(7.5), null);
  const t0 = at(0)!;
  TestValidator.predicate(
    "first frame",
    t0.shot === "shot:beat-1" && nclose(t0.time, 0),
  );
};
