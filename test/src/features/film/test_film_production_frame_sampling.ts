import { sampleProductionRenderFrame } from "@automovie/engine";
import {
  IAutoMovieFilmTimeline,
  IAutoMovieFilmTimelineSegment,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const segment = (
  partial: Partial<IAutoMovieFilmTimelineSegment> &
    Pick<
      IAutoMovieFilmTimelineSegment,
      "shot" | "sourceInFrame" | "sourceOutFrame" | "startFrame" | "endFrame"
    >,
): IAutoMovieFilmTimelineSegment => ({
  headHandleFrames: 0,
  tailHandleFrames: 0,
  transitionIn: { kind: "cut" },
  transitionOut: { kind: "cut" },
  ...partial,
});

const timeline = (
  segments: IAutoMovieFilmTimelineSegment[],
  totalFrames: number,
  clock: Pick<IAutoMovieFilmTimeline, "fps" | "frameRate"> = { fps: 24 },
): IAutoMovieFilmTimeline => ({
  version: 1,
  builder: "test",
  inputFingerprint: `sha256:${"a".repeat(64)}`,
  sourceDigest: `sha256:${"b".repeat(64)}`,
  id: "film",
  ...clock,
  totalFrames,
  segments,
  omissions: [],
  tracks: { audio: [], captions: [], effects: [] },
});

/**
 * A film frame resolves to its layers from the global frame number alone.
 *
 * The browser film viewer and the headless render both call this sampler, so
 * the layer set, source frames and weights at every frame are the shared edit
 * truth. Expectations are exact integer and binary-fraction arithmetic on the
 * declared segments: a layer's source frame is its segment's source-in plus
 * the frame offset, a dissolve's outgoing frame counts back from the outgoing
 * segment's exclusive source-out, and a fade scales by offset over duration.
 *
 * Scenarios:
 *
 * 1. A fade-in opens the film at weight 0 on the first frame and reaches full
 *    weight exactly when the offset equals the fade duration.
 * 2. Inside a dissolve the later-starting segment owns the frame and the
 *    outgoing tail blends back to front at weights 1, 0.5 and 0.25; on the
 *    first frame after the dissolve one incoming layer remains.
 * 3. A fade-out ends the film at 0.25 on its last frame and is not applied
 *    before its window; a segment fading in and out takes the smaller weight.
 * 4. A hard cut hands the frame to the next segment on its start frame, with
 *    exactly one layer on either side of the cut.
 * 5. A rational clock stamps exact frame time, and every frame sampled in
 *    reverse order equals the forward schedule, so a chunk or seek order
 *    cannot change a frame.
 * 6. A negative, fractional, or end-of-film frame, a frame no segment covers,
 *    and a dissolve with no outgoing segment are refused by name, while the
 *    same first segment past its dissolve window samples normally.
 */
export const test_film_production_frame_sampling = (): void => {
  const edit = timeline(
    [
      segment({
        shot: "a",
        sourceInFrame: 10,
        sourceOutFrame: 22,
        startFrame: 0,
        endFrame: 12,
        tailHandleFrames: 4,
        transitionIn: { kind: "fade", durationFrames: 4 },
      }),
      segment({
        shot: "b",
        sourceInFrame: 5,
        sourceOutFrame: 17,
        startFrame: 8,
        endFrame: 20,
        headHandleFrames: 4,
        transitionIn: { kind: "dissolve", durationFrames: 4 },
        transitionOut: { kind: "fade", durationFrames: 4 },
      }),
    ],
    20,
  );
  const layers = (frame: number) =>
    sampleProductionRenderFrame(edit, frame).layers;

  TestValidator.equals(
    "a fade-in opens at zero and reaches full weight at its duration",
    [0, 1, 3, 4, 7].map(layers),
    [
      [{ shot: "a", sourceFrame: 10, weight: 0 }],
      [{ shot: "a", sourceFrame: 11, weight: 0.25 }],
      [{ shot: "a", sourceFrame: 13, weight: 0.75 }],
      [{ shot: "a", sourceFrame: 14, weight: 1 }],
      [{ shot: "a", sourceFrame: 17, weight: 1 }],
    ],
  );
  TestValidator.equals(
    "a dissolve blends the outgoing tail back to front",
    [8, 10, 11, 12].map(layers),
    [
      [
        { shot: "a", sourceFrame: 18, weight: 1 },
        { shot: "b", sourceFrame: 5, weight: 0 },
      ],
      [
        { shot: "a", sourceFrame: 20, weight: 0.5 },
        { shot: "b", sourceFrame: 7, weight: 0.5 },
      ],
      [
        { shot: "a", sourceFrame: 21, weight: 0.25 },
        { shot: "b", sourceFrame: 8, weight: 0.75 },
      ],
      [{ shot: "b", sourceFrame: 9, weight: 1 }],
    ],
  );
  TestValidator.equals(
    "a fade-out closes the film on its last frame",
    [15, 16, 17, 19].map(layers),
    [
      [{ shot: "b", sourceFrame: 12, weight: 1 }],
      [{ shot: "b", sourceFrame: 13, weight: 1 }],
      [{ shot: "b", sourceFrame: 14, weight: 0.75 }],
      [{ shot: "b", sourceFrame: 16, weight: 0.25 }],
    ],
  );
  const shortFade = timeline(
    [
      segment({
        shot: "e",
        sourceInFrame: 0,
        sourceOutFrame: 4,
        startFrame: 0,
        endFrame: 4,
        transitionIn: { kind: "fade", durationFrames: 4 },
        transitionOut: { kind: "fade", durationFrames: 4 },
      }),
    ],
    4,
  );
  TestValidator.equals(
    "a segment fading in and out takes the smaller weight",
    [0, 1, 2, 3].map(
      (frame) =>
        sampleProductionRenderFrame(shortFade, frame).layers[0]!.weight,
    ),
    [0, 0.25, 0.5, 0.25],
  );

  const cut = timeline(
    [
      segment({
        shot: "c",
        sourceInFrame: 3,
        sourceOutFrame: 9,
        startFrame: 0,
        endFrame: 6,
      }),
      segment({
        shot: "d",
        sourceInFrame: 0,
        sourceOutFrame: 4,
        startFrame: 6,
        endFrame: 10,
      }),
    ],
    10,
  );
  TestValidator.equals(
    "a hard cut hands the start frame to the next segment",
    [5, 6].map((frame) => sampleProductionRenderFrame(cut, frame).layers),
    [
      [{ shot: "c", sourceFrame: 8, weight: 1 }],
      [{ shot: "d", sourceFrame: 0, weight: 1 }],
    ],
  );

  const rational = timeline(
    [
      segment({
        shot: "r",
        sourceInFrame: 0,
        sourceOutFrame: 10,
        startFrame: 0,
        endFrame: 10,
      }),
    ],
    10,
    { fps: 30000 / 1001, frameRate: { numerator: 30000, denominator: 1001 } },
  );
  TestValidator.equals(
    "a rational clock stamps exact frame time on the global frame",
    sampleProductionRenderFrame(rational, 3),
    {
      globalFrame: 3,
      timelineFrame: 3,
      timeSeconds: 3003 / 30000,
      layers: [{ shot: "r", sourceFrame: 3, weight: 1 }],
    },
  );
  const forward = Array.from({ length: 20 }, (_, frame) =>
    sampleProductionRenderFrame(edit, frame),
  );
  const reverse = Array.from({ length: 20 }, (_, index) =>
    sampleProductionRenderFrame(edit, 19 - index),
  ).reverse();
  TestValidator.equals(
    "reverse sampling equals the forward schedule",
    reverse,
    forward,
  );

  const firstDissolve = timeline(
    [
      segment({
        shot: "x",
        sourceInFrame: 0,
        sourceOutFrame: 4,
        startFrame: 0,
        endFrame: 4,
        transitionIn: { kind: "dissolve", durationFrames: 2 },
      }),
    ],
    4,
  );
  const gap = timeline(
    [
      segment({
        shot: "g",
        sourceInFrame: 0,
        sourceOutFrame: 4,
        startFrame: 0,
        endFrame: 4,
      }),
    ],
    8,
  );
  TestValidator.equals(
    "frames outside the schedule or its sources are refused by name",
    {
      negative: throwsError(
        () => sampleProductionRenderFrame(edit, -1),
        "Film-global frame -1 is outside 0..19.",
      ),
      fractional: throwsError(
        () => sampleProductionRenderFrame(edit, 1.5),
        "outside 0..19",
      ),
      end: throwsError(
        () => sampleProductionRenderFrame(edit, 20),
        "outside 0..19",
      ),
      uncovered: throwsError(
        () => sampleProductionRenderFrame(gap, 5),
        "Film-global frame 5 has no builder-owned video segment.",
      ),
      orphanDissolve: throwsError(
        () => sampleProductionRenderFrame(firstDissolve, 0),
        'Segment "x" dissolves without an outgoing segment.',
      ),
      pastDissolveWindow: sampleProductionRenderFrame(firstDissolve, 2).layers,
    },
    {
      negative: true,
      fractional: true,
      end: true,
      uncovered: true,
      orphanDissolve: true,
      pastDissolveWindow: [{ shot: "x", sourceFrame: 2, weight: 1 }],
    },
  );
};
