import { playbackFrameSamples } from "@automovie/engine";
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

/**
 * Pins the frame-sampling seam a render host drives capture from: a 2-second
 * cut at 4 fps yields exactly 8 samples on the frame grid, every one resolved
 * (the last frame sits at 1.75 s, strictly inside the runtime, so the non-null
 * assertion in the sampler is safe by construction).
 *
 * Scenarios:
 *
 * 1. Two 1-second shots, hard cut, 4 fps → 8 samples; frames 0–3 play shot A at
 *    0/0.25/0.5/0.75, frames 4–7 play shot B.
 * 2. The cut lands exactly on frame 4: local time restarts at 0.
 */
export const test_film_playback_frames = (): void => {
  const sequence: IAutoMovieSequence = {
    id: "seq",
    name: null,
    fps: 4,
    shots: [
      { shot: "a", trim: null, transition: null },
      { shot: "b", trim: null, transition: null },
    ],
  };
  const samples = playbackFrameSamples(sequence, [shot("a", 1), shot("b", 1)]);
  TestValidator.equals("frame count", samples.length, 8);
  TestValidator.equals(
    "shot per frame",
    samples.map((s) => s.shot),
    ["a", "a", "a", "a", "b", "b", "b", "b"],
  );
  TestValidator.predicate(
    "local times ride the frame grid",
    samples.every((s, i) => nclose(s.time, (i % 4) / 4)),
  );
};
