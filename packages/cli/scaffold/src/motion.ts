import type { IAutoMovieMotion } from "@automovie/interface";

/**
 * A clip authored the way a coding agent authors motion: **computed**, not
 * hand-keyed. Here a simple sine arc sweeps the left arm up and back down over
 * one second (`flexion(t) = peak · sin(π·t)`, sampled at a handful of
 * keyframes), but the same seam holds for parametric curves, phase-composed
 * gaits, or a sampled physics solver. The engine then enforces (ROM) and plays
 * (sampling) whatever you compute.
 *
 * Raise `peakDeg` past the shoulder's range and `main.ts` will show the engine
 * REFUSING the clip. That is the point of the split: you create, the engine
 * is the arbiter of physical truth.
 */
export const buildWaveClip = (
  skeletonId: string,
  peakDeg = 90,
  samples = 8,
): IAutoMovieMotion => ({
  id: "wave",
  skeleton: skeletonId,
  duration: 1,
  loop: false,
  keyframes: Array.from({ length: samples + 1 }, (_, i) => {
    const time = i / samples;
    const swing = Math.sin(Math.PI * time);
    return {
      time,
      pose: {
        skeleton: skeletonId,
        root: null,
        joints: [
          {
            bone: "leftUpperArm",
            flexion: peakDeg * swing,
            abduction: null,
            twist: null,
          },
          {
            bone: "leftLowerArm",
            flexion: (peakDeg / 2) * swing,
            abduction: null,
            twist: null,
          },
        ],
      },
      expression: null,
      easing: "linear",
      bezier: null,
    };
  }),
});
