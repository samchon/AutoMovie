import type { IAutoMovieProductionAudioProbe } from "@automovie/interface";

import { AUTOMOVIE_PRODUCTION_OPUS_PROFILE } from "./AUTOMOVIE_PRODUCTION_OPUS_PROFILE";

/**
 * Refuse every difference from the current deterministic Opus profile.
 *
 * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-sample-boundary Verifies the delivered sample boundary against the encoded bytes: the coded priming equals the declared pre-skip, the edit list starts at that pre-skip, the presentation sample count divides exactly on the movie and media clocks, and the coded duration covers priming plus presentation.
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
    [
      "codec",
      AUTOMOVIE_PRODUCTION_OPUS_PROFILE.kind,
      actual.codec.split(".")[0]!.toLowerCase(),
    ],
    [
      "channels",
      AUTOMOVIE_PRODUCTION_OPUS_PROFILE.outputChannelCount,
      actual.channels,
    ],
    [
      "sampleRate",
      AUTOMOVIE_PRODUCTION_OPUS_PROFILE.inputSampleRate,
      actual.sampleRate,
    ],
    ["sampleCount", true, actual.sampleCount > 0],
    [
      "dOps.version",
      AUTOMOVIE_PRODUCTION_OPUS_PROFILE.version,
      description.version,
    ],
    [
      "dOps.outputChannelCount",
      AUTOMOVIE_PRODUCTION_OPUS_PROFILE.outputChannelCount,
      description.outputChannelCount,
    ],
    [
      "dOps.inputSampleRate",
      AUTOMOVIE_PRODUCTION_OPUS_PROFILE.inputSampleRate,
      description.inputSampleRate,
    ],
    [
      "dOps.outputGainQ7_8",
      AUTOMOVIE_PRODUCTION_OPUS_PROFILE.outputGainQ7_8,
      description.outputGainQ7_8,
    ],
    [
      "dOps.channelMappingFamily",
      AUTOMOVIE_PRODUCTION_OPUS_PROFILE.channelMapping.family,
      description.channelMapping.family,
    ],
    [
      "dOps.streamCount",
      AUTOMOVIE_PRODUCTION_OPUS_PROFILE.channelMapping.streamCount,
      description.channelMapping.streamCount,
    ],
    [
      "dOps.coupledCount",
      AUTOMOVIE_PRODUCTION_OPUS_PROFILE.channelMapping.coupledCount,
      description.channelMapping.coupledCount,
    ],
    [
      "dOps.mapping",
      JSON.stringify(AUTOMOVIE_PRODUCTION_OPUS_PROFILE.channelMapping.mapping),
      JSON.stringify(description.channelMapping.mapping),
    ],
    [
      "dOps.channelOrder",
      JSON.stringify(
        AUTOMOVIE_PRODUCTION_OPUS_PROFILE.channelMapping.channelOrder,
      ),
      JSON.stringify(description.channelMapping.channelOrder),
    ],
    ["dOps.preSkip", actual.primingSamples, description.preSkip],
    [
      "timebase.movieTimescale",
      true,
      positiveSafeInteger(actual.timebase.movieTimescale),
    ],
    [
      "timebase.mediaTimescale",
      AUTOMOVIE_PRODUCTION_OPUS_PROFILE.inputSampleRate,
      actual.timebase.mediaTimescale,
    ],
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

const positiveSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;
