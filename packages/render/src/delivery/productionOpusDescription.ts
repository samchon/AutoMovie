import type { IAutoMovieProductionOpusDescription } from "@automovie/interface";

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
