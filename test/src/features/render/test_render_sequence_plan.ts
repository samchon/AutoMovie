import {
  IAutoMovieRenderSpec,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import { planSequenceRender } from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

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

const SHOTS = [shot("shot:a", 2), shot("shot:b", 3)];

const SEQUENCE: IAutoMovieSequence = {
  id: "seq:duel",
  name: "duel",
  fps: 24,
  shots: [
    {
      shot: "shot:a",
      trim: { start: 0.5, duration: 1 },
      transition: null,
    },
    {
      shot: "shot:b",
      trim: { start: 1, duration: 2 },
      transition: { kind: "crossDissolve", duration: 0.5 },
    },
  ],
};

const SPEC: IAutoMovieRenderSpec = {
  target: SEQUENCE.id,
  fps: 4,
  width: 640,
  height: 360,
  toneMapping: "none",
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 20,
};

/**
 * The sequence render manifest exposes the same cut arithmetic the viewer uses:
 * trim offsets, transition overlap, per-frame live shot samples, blend tails,
 * and encoder paths.
 *
 * Scenarios:
 *
 * 1. A two-shot sequence with a 0.5 s dissolve has a 2.5 s runtime and 10 frames
 *    at render fps 4.
 * 2. Shot spans preserve trim offsets; the incoming entry starts at 0.5 s because
 *    the transition overlaps the previous shot tail.
 * 3. Frames inside the dissolve carry both incoming and outgoing shot-local times
 *    plus the incoming alpha.
 * 4. Default frame/output paths sanitize the sequence id and produce pinned ffmpeg
 *    args; custom paths override those defaults.
 * 5. Target mismatch and zero-frame schedules reject before capture.
 */
export const test_render_sequence_plan = (): void => {
  const plan = planSequenceRender({
    sequence: SEQUENCE,
    shots: SHOTS,
    spec: SPEC,
  });

  // 1. runtime + frames
  TestValidator.equals("target", plan.target, {
    kind: "sequence",
    id: SEQUENCE.id,
  });
  TestValidator.equals("sequence fps", plan.sequenceFps, 24);
  TestValidator.equals("render fps", plan.renderFps, 4);
  TestValidator.predicate("duration", nclose(plan.durationSeconds, 2.5));
  TestValidator.equals("frame count", plan.frameCount, 10);
  TestValidator.predicate(
    "times ride render fps",
    plan.times.every((time, i) => nclose(time, i / 4)),
  );

  // 2. shot spans + transition span
  TestValidator.equals(
    "shot spans",
    plan.shots.map((span) => ({
      shot: span.shot,
      start: span.start,
      end: span.end,
      played: span.played,
      offset: span.offset,
      trim: span.trim,
    })),
    [
      {
        shot: "shot:a",
        start: 0,
        end: 1,
        played: 1,
        offset: 0.5,
        trim: { start: 0.5, duration: 1 },
      },
      {
        shot: "shot:b",
        start: 0.5,
        end: 2.5,
        played: 2,
        offset: 1,
        trim: { start: 1, duration: 2 },
      },
    ],
  );
  TestValidator.equals("transition span", plan.transitionSpans, [
    {
      entry: 1,
      from: "shot:a",
      to: "shot:b",
      kind: "crossDissolve",
      start: 0.5,
      end: 1,
      duration: 0.5,
    },
  ]);

  // 3. frame samples
  TestValidator.equals("first frame", plan.frames[0], {
    index: 0,
    timeSeconds: 0,
    path: "frames/seq_duel/frame_00000.png",
    shot: "shot:a",
    shotTimeSeconds: 0.5,
    blend: null,
  });
  TestValidator.equals("dissolve entry frame", plan.frames[2], {
    index: 2,
    timeSeconds: 0.5,
    path: "frames/seq_duel/frame_00002.png",
    shot: "shot:b",
    shotTimeSeconds: 1,
    blend: { shot: "shot:a", shotTimeSeconds: 1, alpha: 0 },
  });
  const midDissolve = plan.frames[3]!;
  TestValidator.predicate(
    "mid dissolve sample",
    midDissolve.shot === "shot:b" &&
      nclose(midDissolve.timeSeconds, 0.75) &&
      nclose(midDissolve.shotTimeSeconds, 1.25) &&
      midDissolve.blend !== null &&
      midDissolve.blend.shot === "shot:a" &&
      nclose(midDissolve.blend.shotTimeSeconds, 1.25) &&
      nclose(midDissolve.blend.alpha, 0.5),
  );
  TestValidator.equals("past dissolve", plan.frames[4]!.blend, null);

  // 4. paths + ffmpeg args
  TestValidator.equals(
    "first frame path",
    plan.firstFrame,
    plan.frames[0]!.path,
  );
  TestValidator.equals("last frame path", plan.lastFrame, plan.frames[9]!.path);
  TestValidator.equals(
    "input pattern",
    plan.inputPattern,
    "frames/seq_duel/frame_%05d.png",
  );
  TestValidator.equals("default output", plan.outputPath, "seq_duel.mp4");
  TestValidator.predicate(
    "ffmpeg args include manifest paths",
    plan.ffmpegArgs.includes("frames/seq_duel/frame_%05d.png") &&
      plan.ffmpegArgs.includes("seq_duel.mp4"),
  );

  const custom = planSequenceRender({
    sequence: SEQUENCE,
    shots: SHOTS,
    spec: SPEC,
    frameDir: "custom/frames",
    outputPath: "custom/out.mp4",
  });
  TestValidator.equals(
    "custom first frame",
    custom.firstFrame,
    "custom/frames/frame_00000.png",
  );
  TestValidator.equals("custom output", custom.outputPath, "custom/out.mp4");

  // 5. guards
  TestValidator.predicate(
    "target mismatch rejects",
    throwsError(
      () =>
        planSequenceRender({
          sequence: SEQUENCE,
          shots: SHOTS,
          spec: { ...SPEC, target: "shot:a" },
        }),
      ["target", "shot:a", SEQUENCE.id],
    ),
  );
  TestValidator.predicate(
    "zero-frame schedule rejects",
    throwsError(
      () =>
        planSequenceRender({
          sequence: {
            ...SEQUENCE,
            shots: [
              {
                shot: "shot:a",
                trim: { start: 0, duration: 0.01 },
                transition: null,
              },
            ],
          },
          shots: SHOTS,
          spec: { ...SPEC, fps: 1 },
        }),
      ["planSequenceRender", "at least one frame", "produced zero frames"],
    ),
  );
};
