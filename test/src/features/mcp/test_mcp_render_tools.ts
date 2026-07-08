import {
  IAutoMovieRenderSpec,
  IAutoMovieScene,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieValidation,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const app = new AutoMovieApplication();

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [],
  cameras: [
    {
      id: "camera",
      transform: IDENTITY_TRANSFORM,
      fovY: 45,
      near: 0.1,
      far: 100,
    },
  ],
  lights: [],
};

const shotA: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: scene.id,
  camera: "camera",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
};

const shotB: IAutoMovieShot = {
  ...shotA,
  id: "shot:beat-2",
  duration: 2,
};

const sequence: IAutoMovieSequence = {
  id: "seq-duel",
  name: "duel",
  fps: 24,
  shots: [
    { shot: shotA.id, trim: null, transition: null },
    {
      shot: shotB.id,
      trim: null,
      transition: { kind: "fade", duration: 0.5 },
    },
  ],
};

const slate: IAutoMovieMcpWritableSlate = {
  script: null,
  scene,
  shots: [shotA, shotB],
  beatEnds: [],
  notes: [],
  film: sequence,
};

const spec: IAutoMovieRenderSpec = {
  target: shotA.id,
  fps: 10,
  width: 640,
  height: 360,
  toneMapping: "none",
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 20,
};

const hasPath = (validation: IAutoMovieValidation, path: string): boolean =>
  validation.success === false &&
  validation.violations.some((violation) => violation.path.includes(path));

/**
 * MCP render tools plan deterministic renders and preview frames without doing
 * host I/O; without an injected capture adapter `seeFrame` reports the honest
 * `no-capture-adapter` status instead of pixels.
 *
 * Scenarios:
 *
 * 1. `planRender` resolves committed shot and sequence targets into frame
 *    schedules, frame paths, per-pass guide outputs, and ffmpeg args — beauty
 *    only by default, pass-tagged paths when more passes are requested, and an
 *    unknown or malformed pass list is a violation.
 * 2. Invalid or malformed render specs, malformed slate target slices, missing
 *    targets, duplicate shots, invalid sequence targets, and zero-frame plans
 *    return field-located diagnostics.
 * 3. `seeFrame` resolves a preview frame by index or time, rejects conflicts and
 *    unknown passes, and reports `no-capture-adapter` on this adapterless
 *    application.
 */
export const test_mcp_render_tools = async (): Promise<void> => {
  const shotPlan = app.planRender({ slate, spec }).plan;
  if (shotPlan === null) throw new Error("shot render plan must succeed");
  TestValidator.equals("shot render target", shotPlan.target, {
    kind: "shot",
    id: shotA.id,
  });
  TestValidator.equals("shot frame count", shotPlan.frameCount, 10);
  TestValidator.equals(
    "default sanitized first frame",
    shotPlan.firstFrame,
    "frames/shot_beat-1/frame_00000.png",
  );
  TestValidator.equals(
    "default sanitized output",
    shotPlan.outputPath,
    "shot_beat-1.mp4",
  );
  TestValidator.predicate(
    "ffmpeg args use generated pattern",
    shotPlan.ffmpegArgs.includes("frames/shot_beat-1/frame_%05d.png") &&
      shotPlan.ffmpegArgs.includes("shot_beat-1.mp4"),
  );
  TestValidator.equals(
    "default plan carries the beauty pass only",
    shotPlan.passes.map((p) => p.pass),
    ["beauty"],
  );

  const passPlan = app.planRender({
    slate,
    spec,
    passes: ["beauty", "depth", "pose", "depth"],
  }).plan;
  if (passPlan === null) throw new Error("pass render plan must succeed");
  TestValidator.equals(
    "requested passes fold duplicates in order",
    passPlan.passes.map((p) => p.pass),
    ["beauty", "depth", "pose"],
  );
  TestValidator.equals(
    "depth pass path is pass-tagged",
    passPlan.passes[1]!.firstFrame,
    "frames/shot_beat-1/frame_00000.depth.png",
  );
  TestValidator.predicate(
    "unknown pass name is a violation",
    hasPath(
      app.planRender({ slate, spec, passes: ["beauty", "sketch"] }).validation,
      "$input.passes[1]",
    ),
  );
  const malformedPasses = app.planRender({
    slate,
    spec,
    passes: null as unknown as string[],
  });
  TestValidator.predicate(
    "malformed pass list is a violation",
    malformedPasses.plan === null &&
      hasPath(malformedPasses.validation, "$input.passes"),
  );

  const sequencePlan = app.planRender({
    slate,
    spec: { ...spec, target: sequence.id },
    frameDir: "frames/seq",
    outputPath: "out/seq.mp4",
  }).plan;
  if (sequencePlan === null)
    throw new Error("sequence render plan must succeed");
  TestValidator.equals("sequence target", sequencePlan.target, {
    kind: "sequence",
    id: sequence.id,
  });
  TestValidator.predicate(
    "sequence runtime subtracts transition overlap",
    nclose(sequencePlan.duration, 2.5),
  );
  TestValidator.equals("sequence frame count", sequencePlan.frameCount, 25);
  TestValidator.equals(
    "custom input pattern",
    sequencePlan.inputPattern,
    "frames/seq/frame_%05d.png",
  );

  TestValidator.predicate(
    "invalid render spec paths",
    (() => {
      const output = app.planRender({
        slate,
        spec: {
          ...spec,
          target: "",
          fps: 0,
          width: 0,
          height: Number.POSITIVE_INFINITY,
          crf: 52,
          codec: "vp9" as never,
          pixelFormat: "rgba" as never,
        },
      });
      return (
        output.plan === null &&
        hasPath(output.validation, "$input.spec.target") &&
        hasPath(output.validation, "$input.spec.fps") &&
        hasPath(output.validation, "$input.spec.width") &&
        hasPath(output.validation, "$input.spec.height") &&
        hasPath(output.validation, "$input.spec.crf") &&
        hasPath(output.validation, "$input.spec.codec") &&
        hasPath(output.validation, "$input.spec.pixelFormat")
      );
    })(),
  );
  const malformedSpec = app.planRender({
    slate,
    spec: null as unknown as IAutoMovieRenderSpec,
  });
  TestValidator.predicate(
    "malformed render spec path",
    malformedSpec.plan === null &&
      hasPath(malformedSpec.validation, "$input.spec"),
  );
  TestValidator.predicate(
    "missing target path",
    hasPath(
      app.planRender({ slate, spec: { ...spec, target: "missing" } })
        .validation,
      "$input.spec.target",
    ),
  );
  TestValidator.predicate(
    "duplicate shot target path",
    hasPath(
      app.planRender({
        slate: { ...slate, shots: [shotA, shotA] },
        spec,
      }).validation,
      "$slate.shots[1].id",
    ),
  );
  const malformedShots = app.planRender({
    slate: {
      ...slate,
      shots: null as unknown as IAutoMovieShot[],
    },
    spec,
  });
  TestValidator.predicate(
    "malformed slate shots path",
    malformedShots.plan === null &&
      hasPath(malformedShots.validation, "$slate.shots"),
  );
  const malformedFilm = app.planRender({
    slate: {
      ...slate,
      film: undefined as unknown as IAutoMovieSequence,
    },
    spec: { ...spec, target: sequence.id },
  });
  TestValidator.predicate(
    "malformed slate film path",
    malformedFilm.plan === null &&
      hasPath(malformedFilm.validation, "$slate.film"),
  );
  TestValidator.predicate(
    "zero-frame plan path",
    hasPath(
      app.planRender({
        slate: { ...slate, shots: [{ ...shotA, duration: 0.01 }, shotB] },
        spec: { ...spec, fps: 1 },
      }).validation,
      "$input.spec.fps",
    ),
  );
  TestValidator.predicate(
    "invalid sequence path",
    hasPath(
      app.planRender({
        slate: {
          ...slate,
          film: {
            ...sequence,
            shots: [
              {
                shot: shotA.id,
                trim: { start: 0.8, duration: 0.4 },
                transition: null,
              },
            ],
          },
        },
        spec: { ...spec, target: sequence.id },
      }).validation,
      "$input.shots[0].trim",
    ),
  );

  const defaultPreview = (await app.seeFrame({ slate, spec })).preview;
  if (defaultPreview === null) throw new Error("default preview must succeed");
  TestValidator.equals("default preview frame", defaultPreview.frame, 0);
  TestValidator.equals("default preview pass", defaultPreview.pass, "beauty");
  TestValidator.equals(
    "default preview path",
    defaultPreview.framePath,
    "frames/shot_beat-1/frame_00000.png",
  );
  TestValidator.equals(
    "adapterless status is honest",
    defaultPreview.status,
    "no-capture-adapter",
  );
  TestValidator.equals("adapterless image", defaultPreview.image, null);

  const depthPreview = (await app.seeFrame({ slate, spec, pass: "depth" }))
    .preview;
  if (depthPreview === null) throw new Error("depth preview must succeed");
  TestValidator.equals(
    "pass-tagged preview path",
    depthPreview.framePath,
    "frames/shot_beat-1/frame_00000.depth.png",
  );

  const indexedPreview = (await app.seeFrame({ slate, spec, frame: 3 }))
    .preview;
  if (indexedPreview === null) throw new Error("indexed preview must succeed");
  TestValidator.predicate(
    "indexed preview time",
    nclose(indexedPreview.time, 0.3),
  );

  const timedPreview = (await app.seeFrame({ slate, spec, time: 0.5 })).preview;
  if (timedPreview === null) throw new Error("timed preview must succeed");
  TestValidator.equals("timed preview frame", timedPreview.frame, 5);

  TestValidator.predicate(
    "frame/time conflict path",
    hasPath(
      (await app.seeFrame({ slate, spec, frame: 1, time: 0.5 })).validation,
      "$input.time",
    ),
  );
  TestValidator.predicate(
    "invalid frame path",
    hasPath(
      (await app.seeFrame({ slate, spec, frame: 10 })).validation,
      "$input.frame",
    ),
  );
  TestValidator.predicate(
    "invalid time path",
    hasPath(
      (await app.seeFrame({ slate, spec, time: Number.POSITIVE_INFINITY }))
        .validation,
      "$input.time",
    ),
  );
  TestValidator.predicate(
    "unknown pass path",
    hasPath(
      (await app.seeFrame({ slate, spec, pass: "sketch" })).validation,
      "$input.pass",
    ),
  );
  const malformedPreviewSpec = await app.seeFrame({
    slate,
    spec: null as unknown as IAutoMovieRenderSpec,
  });
  TestValidator.predicate(
    "malformed preview render spec path",
    malformedPreviewSpec.preview === null &&
      hasPath(malformedPreviewSpec.validation, "$input.spec"),
  );
  TestValidator.equals(
    "missing preview target",
    (await app.seeFrame({ slate, spec: { ...spec, target: "missing" } }))
      .preview,
    null,
  );
};
