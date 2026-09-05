import { equalProductionFrameRates } from "@automovie/engine";
import type {
  IAutoMovieProductionAudioProbe,
  IAutoMovieProductionFrameRate,
  IAutoMovieProductionMediaProbe,
  IAutoMovieProductionOpusDescription,
  IAutoMovieProductionVideoProbe,
} from "@automovie/interface";

/** Current fieldwise Opus-in-MP4 profile written by the deterministic encoder. */
export const AUTOMOVIE_PRODUCTION_OPUS_PROFILE = {
  kind: "opus",
  version: 0,
  outputChannelCount: 2,
  inputSampleRate: 48_000,
  outputGainQ7_8: 0,
  channelMapping: {
    family: 0,
    streamCount: null,
    coupledCount: null,
    mapping: [],
    channelOrder: ["front-left", "front-right"],
  },
} as const;

/**
 * Parse and structurally validate one Opus `dOps` sample description.
 *
 * Family zero has no serialized tail. Nonzero families preserve their ordered
 * mapping, and family 255 intentionally carries no inferred channel order.
 *
 * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-channel-layout Preserves channel order and mapping instead of treating channel count as the complete layout.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Reads exact sample-description facts from the final container.
 */
export const productionOpusDescription = (props: {
  boxes: readonly unknown[] | undefined;
  codec: string;
  trackChannels: number;
  trackSampleRate: number;
}): IAutoMovieProductionOpusDescription => {
  if (/^opus(?:\.|$)/i.test(props.codec) === false)
    throw new Error(
      `unsupported-audio-profile.sampleEntry: expected Opus, observed "${props.codec}".`,
    );
  const boxes = (props.boxes ?? []).filter(
    (box): box is Record<string, unknown> =>
      box !== null &&
      typeof box === "object" &&
      (box as { type?: unknown }).type === "dOps",
  );
  if (boxes.length !== 1)
    throw new Error(
      `malformed-dOps: expected one Opus description, observed ${boxes.length}.`,
    );
  const box = boxes[0]!;
  const integer = (key: string, minimum: number, maximum: number): number => {
    const value = box[key];
    if (
      Number.isSafeInteger(value) === false ||
      (value as number) < minimum ||
      (value as number) > maximum
    )
      throw new Error(`malformed-dOps.${key}: observed ${String(value)}.`);
    return value as number;
  };
  const version = integer("Version", 0, 255);
  const outputChannelCount = integer("OutputChannelCount", 1, 255);
  const preSkip = integer("PreSkip", 0, 65_535);
  const inputSampleRate = integer("InputSampleRate", 1, 0xffff_ffff);
  const outputGainQ7_8 = integer("OutputGain", -32_768, 32_767);
  const family = integer("ChannelMappingFamily", 0, 255);
  const rawMapping = box.ChannelMapping;
  if (rawMapping === undefined && family === 0) {
    // Family zero has no serialized stream-count or channel-map tail.
  } else if (Array.isArray(rawMapping) === false)
    throw new Error(
      "malformed-dOps.ChannelMapping: expected an ordered array.",
    );
  const mapping = (rawMapping ?? []).map((value, index) => {
    if (Number.isSafeInteger(value) === false || value < 0 || value > 255)
      throw new Error(
        `malformed-dOps.ChannelMapping[${index}]: observed ${String(value)}.`,
      );
    return value;
  });
  if (
    outputChannelCount !== props.trackChannels ||
    inputSampleRate !== props.trackSampleRate
  )
    throw new Error(
      "malformed-dOps: sample description and track audio facts disagree.",
    );
  if (family === 0) {
    if (outputChannelCount > 2 || mapping.length !== 0)
      throw new Error(
        "malformed-dOps.ChannelMappingFamily: family 0 supports mono or stereo and serializes no mapping table.",
      );
    return {
      kind: "opus",
      version,
      outputChannelCount,
      preSkip,
      inputSampleRate,
      outputGainQ7_8,
      channelMapping: {
        family,
        streamCount: null,
        coupledCount: null,
        mapping: [],
        channelOrder:
          outputChannelCount === 2 ? ["front-left", "front-right"] : ["mono"],
      },
    };
  }
  if (family !== 1 && family !== 255)
    throw new Error(
      `malformed-dOps.ChannelMappingFamily: reserved family ${family} is unsupported.`,
    );
  const streamCount = integer("StreamCount", 1, 255);
  const coupledCount = integer("CoupledCount", 0, 255);
  if (
    coupledCount > streamCount ||
    outputChannelCount !== streamCount + coupledCount ||
    mapping.length !== outputChannelCount ||
    mapping.some(
      (value) => value !== 255 && value >= streamCount + coupledCount,
    )
  )
    throw new Error(
      "malformed-dOps.ChannelMapping: stream, coupled, channel, and mapping counts disagree.",
    );
  return {
    kind: "opus",
    version,
    outputChannelCount,
    preSkip,
    inputSampleRate,
    outputGainQ7_8,
    channelMapping: {
      family,
      streamCount,
      coupledCount,
      mapping,
      channelOrder: null,
    },
  };
};

/**
 * Refuse every difference from the current deterministic Opus profile.
 *
 * @evidence requirements/sound/validation-and-delivery.md#sound-final-media-probe Reopens final encoded bytes and compares the complete sample-entry profile.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Enforces exact channel, clock, gain, mapping, and presentation identity.
 */
export const assertProductionOpusProfile = (
  actual: IAutoMovieProductionAudioProbe,
): void => {
  const description = actual.sampleEntry;
  const edit = actual.timebase.edits[0];
  const clockTerms = [
    actual.timebase.movieTimescale,
    actual.timebase.mediaTimescale,
    actual.timebase.movieDuration,
    actual.timebase.mediaDuration,
  ];
  const clocksSafe = clockTerms.every((value) => positiveSafeInteger(value));
  const presentationNumerator = clocksSafe
    ? BigInt(actual.timebase.movieDuration) *
      BigInt(actual.timebase.mediaTimescale)
    : 0n;
  const presentationDenominator = clocksSafe
    ? BigInt(actual.timebase.movieTimescale)
    : 1n;
  const presentationQuotient = presentationNumerator / presentationDenominator;
  const presentationSamplesSafe =
    clocksSafe &&
    presentationNumerator % presentationDenominator === 0n &&
    presentationQuotient <= BigInt(Number.MAX_SAFE_INTEGER);
  const presentationSamples = Number(presentationQuotient);
  const comparisons: Array<[string, unknown, unknown]> = [
    ["codec", "opus", actual.codec.split(".")[0]!.toLowerCase()],
    ["channels", 2, actual.channels],
    ["sampleRate", 48_000, actual.sampleRate],
    ["sampleCount", true, actual.sampleCount > 0],
    ["dOps.version", 0, description.version],
    ["dOps.outputChannelCount", 2, description.outputChannelCount],
    ["dOps.inputSampleRate", 48_000, description.inputSampleRate],
    ["dOps.outputGainQ7_8", 0, description.outputGainQ7_8],
    ["dOps.channelMappingFamily", 0, description.channelMapping.family],
    ["dOps.streamCount", null, description.channelMapping.streamCount],
    ["dOps.coupledCount", null, description.channelMapping.coupledCount],
    ["dOps.mapping", "[]", JSON.stringify(description.channelMapping.mapping)],
    [
      "dOps.channelOrder",
      '["front-left","front-right"]',
      JSON.stringify(description.channelMapping.channelOrder),
    ],
    ["dOps.preSkip", actual.primingSamples, description.preSkip],
    [
      "timebase.movieTimescale",
      true,
      positiveSafeInteger(actual.timebase.movieTimescale),
    ],
    ["timebase.mediaTimescale", 48_000, actual.timebase.mediaTimescale],
    [
      "timebase.movieDuration",
      true,
      positiveSafeInteger(actual.timebase.movieDuration),
    ],
    [
      "timebase.mediaDuration",
      true,
      positiveSafeInteger(actual.timebase.mediaDuration),
    ],
    ["timebase.edits.length", 1, actual.timebase.edits.length],
    [
      "timebase.edit.segmentDuration",
      actual.timebase.movieDuration,
      edit?.segmentDuration,
    ],
    ["timebase.edit.mediaTime", description.preSkip, edit?.mediaTime],
    ["timebase.edit.mediaRateInteger", 1, edit?.mediaRateInteger],
    ["timebase.edit.mediaRateFraction", 0, edit?.mediaRateFraction],
    ["timebase.presentationSamples", true, presentationSamplesSafe],
    [
      "timebase.codedCoverage",
      true,
      presentationSamplesSafe &&
        actual.timebase.mediaDuration >=
          description.preSkip + presentationSamples,
    ],
    [
      "runtimeSeconds",
      actual.timebase.movieDuration / actual.timebase.movieTimescale,
      actual.runtimeSeconds,
    ],
  ];
  const mismatch = comparisons.find(
    ([, expected, observed]) => expected !== observed,
  );
  if (mismatch !== undefined)
    throw new Error(
      `unsupported-audio-profile.${mismatch[0]}: expected ${String(mismatch[1])}, observed ${String(mismatch[2])}.`,
    );
};

/** Exact current H.264/MP4 delivery profile resolved from authored inputs. */
export interface IAutoMovieProductionVideoProfile {
  /** Coded picture width in pixels. */
  width: number;
  /** Coded picture height in pixels. */
  height: number;
  /** Exact rational picture rate of the track. */
  frameRate: IAutoMovieProductionFrameRate;
  /** Major brand and the compatible brands the file must declare. */
  brands: { major: "isom"; requiredCompatible: readonly string[] };
  /** Identity track matrix the writer emits. */
  trackMatrix: IAutoMovieProductionVideoProbe["trackMatrix"];
  /** Pixel aspect; the profile admits square pixels only. */
  pixelAspect: "square";
  /** Color primaries, transfer, matrix and range the track declares. */
  color: { primaries: 1; transfer: 13; matrix: 1; fullRange: true };
}

/**
 * Resolve authored raster and exact clock to the current MP4 picture profile.
 *
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-container-metadata Keeps expected delivery facts separate from parser-observed bytes.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Defines the current neutral presentation and explicit sRGB container tuple.
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-supported-combinations Fixes the supported container, codec, raster and color combination of each tier as one profile instead of accepting whatever a muxer produced.
 */
export const resolveProductionVideoProfile = (props: {
  width: number;
  height: number;
  frameRate: IAutoMovieProductionFrameRate;
}): IAutoMovieProductionVideoProfile => ({
  width: props.width,
  height: props.height,
  frameRate: props.frameRate,
  brands: { major: "isom", requiredCompatible: ["isom"] },
  trackMatrix: [65_536, 0, 0, 0, 65_536, 0, 0, 0, 1_073_741_824],
  pixelAspect: "square",
  color: { primaries: 1, transfer: 13, matrix: 1, fullRange: true },
});

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
    ["samples.duration", true, actual.samples.duration > 0],
    ["samples.timescale", true, actual.samples.timescale > 0],
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
  comparisons.push([
    "frameRate",
    true,
    equalProductionFrameRates(expected.frameRate, actualRate) &&
      equalProductionFrameRates(actual.frameRate, actualRate),
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

/**
 * Enforce the kind-discriminated scalar tuple of one render-manifest row.
 *
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-container-metadata Prevents a text, still, audio, or video output from claiming facts its media class cannot possess.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Makes the parsed probe the only authority for non-null runtime, frame, and codec facts.
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-stream-duration-interleave Checks each delivered row's duration and timebase facts against the plan so a stream cannot drift from its declared presentation extent.
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-media-fact-refusal Refuses a planned-versus-actual media fact mismatch by the field and row that disagree.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#audio-visual-duration-and-timebase-join Compares each delivered stream's duration facts against the plan's rational mapping so picture and sound are joined by one exact clock.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-sync-refusal-contract Refuses an audio-visual duration mismatch by row instead of trimming or padding a stream into agreement.
 */
export const assertProductionRenderedDeliverableFacts = (props: {
  kind: "feature" | "guide-pass" | "preview" | "captions" | "audio-mix";
  runtimeSeconds: number | null;
  frameCount: number | null;
  codec: string | null;
  expectedCaptionRuntimeSeconds: number | null;
  probe: IAutoMovieProductionMediaProbe;
}): void => {
  const video =
    props.kind === "feature" && props.probe.kind === "feature"
      ? props.probe.video
      : props.kind === "guide-pass" && props.probe.kind === "video"
        ? props.probe
        : null;
  const audio =
    props.kind === "audio-mix" && props.probe.kind === "audio"
      ? props.probe
      : null;
  const associationValid =
    video !== null ||
    audio !== null ||
    (props.kind === "audio-mix" && props.probe.kind === "sound-evidence") ||
    (props.kind === "preview" && props.probe.kind === "png") ||
    (props.kind === "captions" && props.probe.kind === "webvtt");
  if (associationValid === false)
    throw new Error(
      `Render manifest ${props.kind} cannot carry parser facts of kind ${props.probe.kind}.`,
    );
  const expected =
    video !== null
      ? {
          runtimeSeconds: video.runtimeSeconds,
          frameCount: video.frameCount,
          codec: video.codec,
        }
      : audio !== null
        ? {
            runtimeSeconds: audio.runtimeSeconds,
            frameCount: null,
            codec: audio.codec,
          }
        : props.kind === "captions"
          ? {
              runtimeSeconds: props.expectedCaptionRuntimeSeconds,
              frameCount: null,
              codec: null,
            }
          : { runtimeSeconds: null, frameCount: null, codec: null };
  const comparisons: Array<[string, unknown, unknown]> = [
    ["runtimeSeconds", expected.runtimeSeconds, props.runtimeSeconds],
    ["frameCount", expected.frameCount, props.frameCount],
    ["codec", expected.codec, props.codec],
  ];
  const mismatch = comparisons.find(
    ([, wanted, observed]) => wanted !== observed,
  );
  if (mismatch !== undefined)
    throw new Error(
      `Render manifest ${props.kind}.${mismatch[0]} must equal its parser-derived media fact: expected ${String(mismatch[1])}, observed ${String(mismatch[2])}.`,
    );
};

const positiveSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;
