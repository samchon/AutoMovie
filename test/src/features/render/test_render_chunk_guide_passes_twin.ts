import {
  IAutoMovieRenderSpec,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import {
  planChunkedSequenceRender,
  planSequenceRender,
} from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

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

const SHOTS = [shot("shot:a", 2)];

const SEQUENCE: IAutoMovieSequence = {
  id: "seq:solo",
  name: "solo",
  fps: 24,
  shots: [{ shot: "shot:a", trim: null, transition: null }],
};

const SPEC: IAutoMovieRenderSpec = {
  target: SEQUENCE.id,
  frameFormat: { fps: 4, width: 640, height: 360 },
  toneMapping: "none",
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 20,
};

/**
 * Requesting no guide passes changes nothing: the chunk plan without a `passes`
 * argument is byte-identical to the pre-#644 shape: the pass fields are not
 * merely empty, they are absent.
 *
 * Scenarios:
 *
 * 1. Plans built with and without `passes: undefined` deep-equal each other.
 * 2. Neither the chunks nor the plan carry the pass keys at all (`in` checks):
 *    absence, not emptiness, so pre-#644 consumers see the exact same object
 *    shape.
 */
export const test_render_chunk_guide_passes_twin = (): void => {
  const whole = planSequenceRender({
    sequence: SEQUENCE,
    shots: SHOTS,
    spec: SPEC,
  });
  const bare = planChunkedSequenceRender({
    plan: whole,
    spec: SPEC,
    chunkFrames: 3,
  });
  const explicit = planChunkedSequenceRender({
    plan: whole,
    spec: SPEC,
    chunkFrames: 3,
    passes: undefined,
  });

  TestValidator.equals(
    "undefined passes deep-equals the bare plan",
    explicit,
    bare,
  );
  TestValidator.equals(
    "no chunk carries the passOutputs key",
    bare.chunks.every((chunk) => !("passOutputs" in chunk)),
    true,
  );
  TestValidator.equals(
    "the plan carries no passManifests key",
    "passManifests" in bare,
    false,
  );
};
