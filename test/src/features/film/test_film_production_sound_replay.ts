import { renderProductionSound } from "@automovie/engine";
import type { IAutoMovieProductionSoundPlan } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

/**
 * PCM replay and cue source phase need only a short isolated sound plan.
 * Scenarios:
 * 1. A 120ms plan with one 80ms cue repeats byte-for-byte without changing input.
 * 2. Advancing the cue's source offset by 20ms changes its waveform while
 *    preserving film extent and exact silence before the cue starts at 20ms.
 */
export const test_film_production_sound_replay = (): void => {
  const plan: IAutoMovieProductionSoundPlan = {
    version: 1,
    inputFingerprint: "sha256:replay",
    fps: 1000,
    totalFrames: 120,
    sampleRate: 48_000,
    channels: 2,
    events: [],
    dialogue: [],
    cues: [
      {
        id: "music",
        asset: "public/music.json",
        bus: "music",
        seed: 7,
        sourceDurationFrames: 100,
        sourceOffsetFrame: 0,
        startFrame: 20,
        durationFrames: 80,
        gain: 0.25,
        fadeInFrames: 0,
        fadeOutFrames: 0,
      },
    ],
  };
  const original = structuredClone(plan);
  const first = renderProductionSound({ plan }).pcm;
  const second = renderProductionSound({ plan }).pcm;
  TestValidator.predicate(
    "byte-identical replay",
    Buffer.from(first.buffer).equals(Buffer.from(second.buffer)),
  );
  TestValidator.equals("input is immutable", plan, original);
  const shifted = renderProductionSound({
    plan: { ...plan, cues: [{ ...plan.cues[0], sourceOffsetFrame: 20 }] },
  }).pcm;
  TestValidator.predicate(
    "source clock changes the waveform",
    !Buffer.from(first.buffer).equals(Buffer.from(shifted.buffer)),
  );
  TestValidator.equals("120ms interleaved stereo", first.length, 5760 * 2);
  TestValidator.equals(
    "source shift keeps film duration",
    shifted.length,
    first.length,
  );
  for (const pcm of [first, shifted]) {
    TestValidator.predicate(
      "20ms leading silence",
      pcm.subarray(0, 960 * 2).every((v) => v === 0),
    );
    TestValidator.predicate(
      "the cue is audible",
      pcm.subarray(960 * 2, 4800 * 2).some((v) => v !== 0),
    );
  }
};
