import type { IAutoMovieProductionVideoProbe } from "@automovie/interface";
import {
  assertProductionVideoProfile,
  resolveProductionVideoProfile,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const video = (): IAutoMovieProductionVideoProbe => ({
  kind: "video",
  container: "mp4",
  codec: "h264",
  width: 16,
  height: 16,
  runtimeSeconds: 1,
  frameCount: 24,
  fps: 24,
  frameRate: { numerator: 24, denominator: 1 },
  brands: { major: "isom", compatible: ["isom", "iso2", "avc1", "mp41"] },
  coded: { width: 16, height: 16 },
  trackDisplay: { width16_16: 16 * 65_536, height16_16: 16 * 65_536 },
  trackMatrix: [65_536, 0, 0, 0, 65_536, 0, 0, 0, 1_073_741_824],
  pixelAspect: { kind: "implicit-square" },
  presentation: {
    movieTimescale: 90_000,
    mediaTimescale: 90_000,
    movieDuration: 90_000,
    mediaDuration: 90_000,
    edits: [],
  },
  samples: {
    count: 24,
    duration: 3_750,
    timescale: 90_000,
    firstDts: 0,
    lastDts: 86_250,
    firstCts: 0,
    lastCts: 86_250,
  },
  color: {
    container: {
      kind: "nclx",
      primaries: 1,
      transfer: 13,
      matrix: 1,
      fullRange: true,
    },
    resolved: { kind: "srgb", source: "container" },
  },
});

const refused = (closure: () => unknown, message: string): boolean => {
  try {
    closure();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(message);
  }
};

/**
 * Validate exact MP4 presentation, timebase, brand, aspect, and color facts.
 *
 * Scenarios:
 * 1. The neutral current profile accepts implicit or explicit square pixels and
 *    either no edit or one exact full-duration zero-start edit.
 * 2. Matrix, display raster, sample clock, brands, edits, aspect, and every
 *    nclx component have one-field negative twins.
 * 3. Missing color identity and a decimal-near but rationally distinct rate
 *    refuse even when legacy raster, sample count, runtime, and fps agree.
 */
export const test_production_video_profile = (): void => {
  const expected = resolveProductionVideoProfile({
    width: 16,
    height: 16,
    frameRate: { numerator: 24, denominator: 1 },
  });
  const actual = video();
  assertProductionVideoProfile({ expected, actual });
  const explicitSquare = structuredClone(actual);
  explicitSquare.pixelAspect = { kind: "explicit", hSpacing: 1, vSpacing: 1 };
  assertProductionVideoProfile({ expected, actual: explicitSquare });
  const canonicalEdit = structuredClone(actual);
  canonicalEdit.presentation.edits = [
    {
      segmentDuration: canonicalEdit.presentation.movieDuration,
      mediaTime: 0,
      mediaRateInteger: 1,
      mediaRateFraction: 0,
    },
  ];
  assertProductionVideoProfile({ expected, actual: canonicalEdit });
  TestValidator.equals(
    "the current profile resolves exact neutral presentation and sRGB facts",
    expected,
    {
      width: 16,
      height: 16,
      frameRate: { numerator: 24, denominator: 1 },
      brands: { major: "isom", requiredCompatible: ["isom"] },
      trackMatrix: [65_536, 0, 0, 0, 65_536, 0, 0, 0, 1_073_741_824],
      pixelAspect: "square",
      color: { primaries: 1, transfer: 13, matrix: 1, fullRange: true },
    },
  );
  const substitutions: Array<
    [string, (value: IAutoMovieProductionVideoProbe) => void]
  > = [
    ["brands.major", (value) => (value.brands.major = "mp42")],
    ["brands.compatible.isom", (value) => (value.brands.compatible = ["mp42"])],
    ["width", (value) => (value.width = 15)],
    ["height", (value) => (value.height = 15)],
    ["coded.width", (value) => (value.coded.width = 15)],
    ["coded.height", (value) => (value.coded.height = 15)],
    [
      "trackDisplay.width16_16",
      (value) => (value.trackDisplay.width16_16 *= 2),
    ],
    [
      "trackDisplay.height16_16",
      (value) => (value.trackDisplay.height16_16 *= 2),
    ],
    [
      "trackMatrix",
      (value) =>
        (value.trackMatrix = [
          0, 65_536, 0, -65_536, 0, 0, 0, 0, 1_073_741_824,
        ]),
    ],
    ["samples.count", (value) => (value.samples.count = 23)],
    ["samples.duration", (value) => (value.samples.duration = 0)],
    ["samples.timescale", (value) => (value.samples.timescale = 0)],
    ["samples.firstDts", (value) => (value.samples.firstDts = 1)],
    ["samples.lastDts", (value) => (value.samples.lastDts -= 1)],
    ["samples.firstCts", (value) => (value.samples.firstCts = 1)],
    ["samples.lastCts", (value) => (value.samples.lastCts -= 1)],
    [
      "presentation.movieTimescale",
      (value) => (value.presentation.movieTimescale = 0),
    ],
    [
      "presentation.mediaTimescale",
      (value) => (value.presentation.mediaTimescale = 48_000),
    ],
    [
      "presentation.mediaDuration",
      (value) => (value.presentation.mediaDuration -= 1),
    ],
    ["runtimeSeconds.media", (value) => (value.runtimeSeconds -= 0.1)],
    [
      "runtimeSeconds.movie",
      (value) => (value.presentation.movieDuration -= 1),
    ],
    [
      "color.container.kind",
      (value) => {
        value.color.container = { kind: "absent" };
        value.color.resolved = { kind: "absent" };
      },
    ],
    [
      "color.resolved.kind",
      (value) => (value.color.resolved = { kind: "absent" }),
    ],
    ["frameRate", (value) => (value.frameRate.denominator = 2)],
    ["frameRate", (value) => (value.samples.duration = 3_754)],
    [
      "pixelAspect",
      (value) =>
        (value.pixelAspect = { kind: "explicit", hSpacing: 2, vSpacing: 1 }),
    ],
    [
      "color.primaries",
      (value) => {
        if (value.color.container.kind === "nclx")
          value.color.container.primaries = 9;
      },
    ],
    [
      "color.transfer",
      (value) => {
        if (value.color.container.kind === "nclx")
          value.color.container.transfer = 1;
      },
    ],
    [
      "color.matrix",
      (value) => {
        if (value.color.container.kind === "nclx")
          value.color.container.matrix = 9;
      },
    ],
    [
      "color.fullRange",
      (value) => {
        if (value.color.container.kind === "nclx")
          value.color.container.fullRange = false;
      },
    ],
    [
      "presentation.edits",
      (value) => {
        value.presentation.edits = [
          {
            segmentDuration: 1,
            mediaTime: -1,
            mediaRateInteger: 1,
            mediaRateFraction: 0,
          },
        ];
      },
    ],
  ];
  TestValidator.predicate(
    "every omitted presentation and color fact has a refusing twin",
    substitutions.every(([field, mutate]) => {
      const value = structuredClone(actual);
      mutate(value);
      return refused(
        () => assertProductionVideoProfile({ expected, actual: value }),
        field,
      );
    }),
  );
};
