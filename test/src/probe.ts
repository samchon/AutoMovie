import { renderProductionSound } from "@automovie/engine";
import { IAutoMovieProductionSoundPlan } from "@automovie/interface";

const FPS = 24;
const totalFrames = FPS * 60 * 30;
const plan: IAutoMovieProductionSoundPlan = {
  version: 1,
  inputFingerprint: "sha256:scale",
  fps: FPS,
  totalFrames,
  sampleRate: 48_000,
  channels: 2,
  events: [],
  dialogue: [],
  cues: [
    {
      id: "bed",
      asset: "public/bed.wav",
      startFrame: 0,
      durationFrames: totalFrames,
      sourceOffsetFrame: 0,
      sourceDurationFrames: totalFrames,
      gain: 0.4,
      fadeInFrames: 24,
      fadeOutFrames: 24,
      bus: "ambience",
      seed: 3,
    },
  ],
};
const started = process.hrtime.bigint();
try {
  const out = renderProductionSound({ plan });
  const elapsed = Number(process.hrtime.bigint() - started) / 1e9;
  console.log(
    "OK samples",
    out.pcm.length,
    "seconds",
    elapsed.toFixed(1),
    "rssMiB",
    Math.round(process.memoryUsage().rss / 1024 / 1024),
  );
} catch (error) {
  console.log("FAILED", String(error).slice(0, 200));
}
