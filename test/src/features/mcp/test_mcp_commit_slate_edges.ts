import {
  IAutoMovieBeatEndState,
  IAutoMovieRenderSpec,
  IAutoMovieScript,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();

const script: IAutoMovieScript = {
  logline: "a beat end without a stage",
  theme: "prematurity",
  cast: [],
  beats: [
    { id: "beat-1", name: "the beat", summary: "one beat", durationHint: 1 },
  ],
};

const slate = (
  over: Partial<IAutoMovieMcpWritableSlate>,
): IAutoMovieMcpWritableSlate => ({
  script,
  scene: null,
  shots: [],
  beatEnds: [],
  notes: [],
  film: null,
  ...over,
});

const beatEnd: IAutoMovieBeatEndState = {
  beat: "beat-1",
  shot: "shot:beat-1",
  actors: [],
};

const spec = (over: Partial<IAutoMovieRenderSpec>): IAutoMovieRenderSpec => ({
  target: "seq-1",
  fps: 24,
  width: 640,
  height: 360,
  toneMapping: "none",
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 20,
  ...over,
});

/**
 * Explicit-slate cross-slice preconditions and render-spec pins that only the
 * resident path exercised before (#1040): the explicit slate bypasses the
 * prerequisite THROW, so each precondition must surface as a located violation
 * instead.
 *
 * Scenarios:
 *
 * 1. `commitBeatEnd` on a slate whose scene is null violates at
 *    `$input.slate.scene` ("a scene must be committed before a beat end").
 * 2. `planCaptions` on a slate whose script is null violates at
 *    `$input.slate.script`.
 * 3. `planRender` on a slate whose shots slice is malformed (not an array)
 *    violates at `$input.slate.shots`.
 * 4. Render-spec pins: a codec other than "h264" and a pixelFormat other than
 *    "yuv420p" are each located violations.
 */
export const test_mcp_commit_slate_edges = (): void => {
  // 1. a beat end needs a committed scene
  const sceneless = app.commitBeatEnd({
    slate: slate({ shots: [] }),
    beatEnd,
  });
  TestValidator.equals(
    "sceneless beat end refused",
    sceneless.committed,
    false,
  );
  TestValidator.predicate(
    "the missing scene is located on the slate",
    hasViolation(sceneless.validation, "type", "$input.slate.scene"),
  );

  // 2. captions need a committed script
  const scriptless = app.planCaptions({
    slate: slate({ script: null }),
    fps: 10,
  });
  TestValidator.predicate(
    "scriptless captions locate the slate script",
    scriptless.sidecar === null &&
      hasViolation(scriptless.validation, "type", "$input.slate.script"),
  );

  // 3. a malformed shots slice is located, not a TypeError
  const malformedShots = app.planRender({
    slate: slate({
      shots: "NOT_ARRAY" as unknown as IAutoMovieMcpWritableSlate["shots"],
    }),
    spec: spec({}),
  });
  TestValidator.predicate(
    "malformed slate shots locate the slice",
    malformedShots.plan === null &&
      hasViolation(malformedShots.validation, "type", "$input.slate.shots"),
  );

  // 4. codec / pixelFormat pins
  const badCodec = app.planRender({
    slate: slate({}),
    spec: spec({ codec: "vp9" as never }),
  });
  TestValidator.predicate(
    "a non-h264 codec is a located violation",
    badCodec.plan === null &&
      hasViolation(badCodec.validation, "type", "$input.spec.codec"),
  );
  const badPixelFormat = app.planRender({
    slate: slate({}),
    spec: spec({ pixelFormat: "rgb24" as never }),
  });
  TestValidator.predicate(
    "a non-yuv420p pixelFormat is a located violation",
    badPixelFormat.plan === null &&
      hasViolation(
        badPixelFormat.validation,
        "type",
        "$input.spec.pixelFormat",
      ),
  );
};
