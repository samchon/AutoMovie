import { equalProductionFrameRates } from "@automovie/engine";
import type { IAutoMovieProductionVideoProbe } from "@automovie/interface";

import type { IAutoMovieProductionVideoProfile } from "./IAutoMovieProductionVideoProfile";

/**
 * Refuse every final-video presentation or color fact outside the current profile.
 *
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-refusal Rejects transformed, stretched, ambiguously timed, or color-unidentified video bytes.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Implements one fieldwise verdict shared by feature, guide, repaint, and reopen paths.
 */
export const assertProductionVideoProfile = (props: {
  expected: IAutoMovieProductionVideoProfile;
  actual: IAutoMovieProductionVideoProbe;
}): void => {
  const { expected, actual } = props;
  // The sample clock is judged by name before any rate is derived from it, so
  // a zero duration or timescale is refused as that field rather than as a
  // frame-rate arithmetic failure.
  const positiveClock = (value: number): boolean =>
    Number.isSafeInteger(value) && value > 0;
  const clockValid =
    positiveClock(actual.samples.timescale) &&
    positiveClock(actual.samples.duration);
  const actualRate = {
    numerator: actual.samples.timescale,
    denominator: actual.samples.duration,
  };
  const comparisons: Array<[string, unknown, unknown]> = [
    ["container", "mp4", actual.container],
    ["codec", "h264", actual.codec],
    ["brands.major", expected.brands.major, actual.brands.major],
    ["width", expected.width, actual.width],
    ["height", expected.height, actual.height],
    ["coded.width", expected.width, actual.coded.width],
    ["coded.height", expected.height, actual.coded.height],
    [
      "trackDisplay.width16_16",
      expected.width * 65_536,
      actual.trackDisplay.width16_16,
    ],
    [
      "trackDisplay.height16_16",
      expected.height * 65_536,
      actual.trackDisplay.height16_16,
    ],
    [
      "trackMatrix",
      JSON.stringify(expected.trackMatrix),
      JSON.stringify(actual.trackMatrix),
    ],
    ["samples.count", actual.frameCount, actual.samples.count],
    ["samples.duration", true, positiveClock(actual.samples.duration)],
    ["samples.timescale", true, positiveClock(actual.samples.timescale)],
    [
      "frameRate",
      true,
      clockValid &&
        equalProductionFrameRates(expected.frameRate, actualRate) &&
        equalProductionFrameRates(actual.frameRate, actualRate),
    ],
    ["samples.firstDts", 0, actual.samples.firstDts],
    [
      "samples.lastDts",
      (actual.samples.count - 1) * actual.samples.duration,
      actual.samples.lastDts,
    ],
    ["samples.firstCts", 0, actual.samples.firstCts],
    [
      "samples.lastCts",
      (actual.samples.count - 1) * actual.samples.duration,
      actual.samples.lastCts,
    ],
    [
      "presentation.movieTimescale",
      true,
      actual.presentation.movieTimescale > 0,
    ],
    [
      "presentation.mediaTimescale",
      actual.samples.timescale,
      actual.presentation.mediaTimescale,
    ],
    [
      "presentation.mediaDuration",
      actual.samples.count * actual.samples.duration,
      actual.presentation.mediaDuration,
    ],
    [
      "runtimeSeconds.media",
      actual.presentation.mediaDuration / actual.presentation.mediaTimescale,
      actual.runtimeSeconds,
    ],
    [
      "runtimeSeconds.movie",
      actual.presentation.movieDuration / actual.presentation.movieTimescale,
      actual.runtimeSeconds,
    ],
    ["color.container.kind", "nclx", actual.color.container.kind],
    ["color.resolved.kind", "srgb", actual.color.resolved.kind],
  ];
  for (const brand of expected.brands.requiredCompatible)
    comparisons.push([
      `brands.compatible.${brand}`,
      true,
      actual.brands.compatible.includes(brand),
    ]);
  if (actual.pixelAspect.kind === "explicit")
    comparisons.push([
      "pixelAspect",
      actual.pixelAspect.hSpacing,
      actual.pixelAspect.vSpacing,
    ]);
  if (actual.color.container.kind === "nclx") {
    comparisons.push(
      [
        "color.primaries",
        expected.color.primaries,
        actual.color.container.primaries,
      ],
      [
        "color.transfer",
        expected.color.transfer,
        actual.color.container.transfer,
      ],
      ["color.matrix", expected.color.matrix, actual.color.container.matrix],
      [
        "color.fullRange",
        expected.color.fullRange,
        actual.color.container.fullRange,
      ],
    );
  }
  const edits = actual.presentation.edits;
  if (
    edits.length !== 0 &&
    !(
      edits.length === 1 &&
      edits[0]!.mediaTime === 0 &&
      edits[0]!.mediaRateInteger === 1 &&
      edits[0]!.mediaRateFraction === 0 &&
      edits[0]!.segmentDuration === actual.presentation.movieDuration
    )
  )
    comparisons.push([
      "presentation.edits",
      "none or one full zero-start edit",
      JSON.stringify(edits),
    ]);
  const mismatch = comparisons.find(
    ([, wanted, observed]) => wanted !== observed,
  );
  if (mismatch !== undefined)
    throw new Error(
      `unsupported-video-profile.${mismatch[0]}: expected ${String(mismatch[1])}, observed ${String(mismatch[2])}.`,
    );
};
