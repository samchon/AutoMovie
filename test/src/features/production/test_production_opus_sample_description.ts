import type { IAutoMovieProductionAudioProbe } from "@automovie/interface";
import {
  assertProductionOpusProfile,
  productionOpusDescription,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const box = () => ({
  type: "dOps",
  Version: 0,
  OutputChannelCount: 2,
  PreSkip: 312,
  InputSampleRate: 48_000,
  OutputGain: 0,
  ChannelMappingFamily: 0,
  StreamCount: 1,
  CoupledCount: 1,
  ChannelMapping: [] as number[],
});

const audio = (): IAutoMovieProductionAudioProbe => ({
  kind: "audio",
  container: "mp4",
  codec: "opus",
  runtimeSeconds: 1,
  channels: 2,
  sampleRate: 48_000,
  sampleCount: 50,
  primingSamples: 312,
  timebase: {
    movieTimescale: 48_000,
    mediaTimescale: 48_000,
    movieDuration: 48_000,
    mediaDuration: 48_312,
    edits: [
      {
        segmentDuration: 48_000,
        mediaTime: 312,
        mediaRateInteger: 1,
        mediaRateFraction: 0,
      },
    ],
  },
  sampleEntry: productionOpusDescription({
    boxes: [box()],
    codec: "Opus",
    trackChannels: 2,
    trackSampleRate: 48_000,
  }),
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
 * Validate exact Opus sample-description structure and current profile facts.
 *
 * Scenarios:
 * 1. Family zero normalizes its absent tail and resolves mono/stereo order,
 *    while nonzero families preserve their exact stream and mapping facts.
 * 2. Missing, duplicate, malformed, cross-record-inconsistent, and structurally
 *    impossible `dOps` fields fail before profile comparison.
 * 3. Every current-profile field, including signed gain and presentation clocks,
 *    has a one-field negative twin that cannot pass through codec abbreviation.
 */
export const test_production_opus_sample_description = (): void => {
  const current = audio();
  assertProductionOpusProfile(current);
  const absentFamilyZeroTail = box();
  delete (absentFamilyZeroTail as Partial<ReturnType<typeof box>>)
    .ChannelMapping;
  const mono = productionOpusDescription({
    boxes: [{ ...absentFamilyZeroTail, OutputChannelCount: 1 }],
    codec: "opus.0",
    trackChannels: 1,
    trackSampleRate: 48_000,
  });
  const familyOne = productionOpusDescription({
    boxes: [
      {
        ...box(),
        ChannelMappingFamily: 1,
        StreamCount: 1,
        CoupledCount: 1,
        ChannelMapping: [0, 1],
      },
    ],
    codec: "Opus",
    trackChannels: 2,
    trackSampleRate: 48_000,
  });
  TestValidator.equals(
    "the parser preserves normalized family-zero and ordered nonzero mappings",
    {
      stereo: current.sampleEntry.channelMapping,
      mono: mono.channelMapping,
      familyOne: familyOne.channelMapping,
    },
    {
      stereo: {
        family: 0,
        streamCount: null,
        coupledCount: null,
        mapping: [],
        channelOrder: ["front-left", "front-right"],
      },
      mono: {
        family: 0,
        streamCount: null,
        coupledCount: null,
        mapping: [],
        channelOrder: ["mono"],
      },
      familyOne: {
        family: 1,
        streamCount: 1,
        coupledCount: 1,
        mapping: [0, 1],
        channelOrder: null,
      },
    },
  );
  const malformed = (mutate: (value: ReturnType<typeof box>) => void) => {
    const value = box();
    mutate(value);
    return refused(
      () =>
        productionOpusDescription({
          boxes: [value],
          codec: "opus",
          trackChannels: 2,
          trackSampleRate: 48_000,
        }),
      "malformed-dOps",
    );
  };
  TestValidator.equals(
    "invalid sample descriptions fail structurally and by exact relation",
    {
      codec: refused(
        () =>
          productionOpusDescription({
            boxes: [box()],
            codec: "mp4a",
            trackChannels: 2,
            trackSampleRate: 48_000,
          }),
        "sampleEntry",
      ),
      missing: refused(
        () =>
          productionOpusDescription({
            boxes: undefined,
            codec: "opus",
            trackChannels: 2,
            trackSampleRate: 48_000,
          }),
        "observed 0",
      ),
      duplicate: refused(
        () =>
          productionOpusDescription({
            boxes: [box(), box()],
            codec: "opus",
            trackChannels: 2,
            trackSampleRate: 48_000,
          }),
        "observed 2",
      ),
      version: malformed((value) => (value.Version = 256)),
      channelCount: malformed((value) => (value.OutputChannelCount = 0)),
      preSkip: malformed((value) => (value.PreSkip = -1)),
      sampleRate: malformed((value) => (value.InputSampleRate = 0)),
      gain: malformed((value) => (value.OutputGain = 32_768)),
      family: malformed((value) => (value.ChannelMappingFamily = 256)),
      reservedFamily: malformed((value) => {
        value.ChannelMappingFamily = 2;
      }),
      mappingArray: malformed(
        (value) => (value.ChannelMapping = null as unknown as number[]),
      ),
      mappingValue: malformed((value) => (value.ChannelMapping = [-1])),
      trackMismatch: malformed((value) => (value.OutputChannelCount = 1)),
      familyZeroCount: refused(
        () =>
          productionOpusDescription({
            boxes: [{ ...box(), OutputChannelCount: 3 }],
            codec: "opus",
            trackChannels: 3,
            trackSampleRate: 48_000,
          }),
        "family 0 supports mono or stereo",
      ),
      familyZeroMap: malformed((value) => (value.ChannelMapping = [0, 1])),
      streamCount: malformed((value) => {
        value.ChannelMappingFamily = 1;
        value.StreamCount = 0;
      }),
      coupledCount: malformed((value) => {
        value.ChannelMappingFamily = 1;
        value.CoupledCount = -1;
      }),
      impossibleCounts: malformed((value) => {
        value.ChannelMappingFamily = 1;
        value.StreamCount = 1;
        value.CoupledCount = 2;
        value.ChannelMapping = [0, 1];
      }),
      wrongMapLength: malformed((value) => {
        value.ChannelMappingFamily = 1;
        value.ChannelMapping = [0];
      }),
      outOfRangeMap: malformed((value) => {
        value.ChannelMappingFamily = 1;
        value.ChannelMapping = [0, 2];
      }),
    },
    {
      codec: true,
      missing: true,
      duplicate: true,
      version: true,
      channelCount: true,
      preSkip: true,
      sampleRate: true,
      gain: true,
      family: true,
      reservedFamily: true,
      mappingArray: true,
      mappingValue: true,
      trackMismatch: true,
      familyZeroCount: true,
      familyZeroMap: true,
      streamCount: true,
      coupledCount: true,
      impossibleCounts: true,
      wrongMapLength: true,
      outOfRangeMap: true,
    },
  );
  const substitutions: Array<
    [string, (value: IAutoMovieProductionAudioProbe) => void]
  > = [
    ["codec", (value) => (value.codec = "mp4a")],
    ["channels", (value) => (value.channels = 1)],
    ["sampleRate", (value) => (value.sampleRate = 44_100)],
    ["sampleCount", (value) => (value.sampleCount = 0)],
    ["dOps.version", (value) => (value.sampleEntry.version = 1)],
    [
      "dOps.outputChannelCount",
      (value) => (value.sampleEntry.outputChannelCount = 1),
    ],
    [
      "dOps.inputSampleRate",
      (value) => (value.sampleEntry.inputSampleRate = 44_100),
    ],
    [
      "dOps.outputGainQ7_8",
      (value) => (value.sampleEntry.outputGainQ7_8 = 256),
    ],
    [
      "dOps.channelMappingFamily",
      (value) => (value.sampleEntry.channelMapping.family = 255),
    ],
    [
      "dOps.streamCount",
      (value) => (value.sampleEntry.channelMapping.streamCount = 1),
    ],
    [
      "dOps.coupledCount",
      (value) => (value.sampleEntry.channelMapping.coupledCount = 1),
    ],
    [
      "dOps.mapping",
      (value) => (value.sampleEntry.channelMapping.mapping = [0, 1]),
    ],
    [
      "dOps.channelOrder",
      (value) =>
        (value.sampleEntry.channelMapping.channelOrder = [
          "front-right",
          "front-left",
        ]),
    ],
    ["dOps.preSkip", (value) => (value.sampleEntry.preSkip = 0)],
    ["timebase.movieTimescale", (value) => (value.timebase.movieTimescale = 0)],
    [
      "timebase.mediaTimescale",
      (value) => (value.timebase.mediaTimescale = 44_100),
    ],
    ["timebase.movieDuration", (value) => (value.timebase.movieDuration = 0)],
    ["timebase.mediaDuration", (value) => (value.timebase.mediaDuration = 0)],
    ["timebase.edits.length", (value) => (value.timebase.edits = [])],
    [
      "timebase.edit.segmentDuration",
      (value) => (value.timebase.edits[0]!.segmentDuration -= 1),
    ],
    [
      "timebase.edit.mediaTime",
      (value) => (value.timebase.edits[0]!.mediaTime = 0),
    ],
    [
      "timebase.edit.mediaRateInteger",
      (value) => (value.timebase.edits[0]!.mediaRateInteger = 0),
    ],
    [
      "timebase.edit.mediaRateFraction",
      (value) => (value.timebase.edits[0]!.mediaRateFraction = 1),
    ],
    [
      "timebase.presentationSamples",
      (value) => (value.timebase.movieTimescale = 47_999),
    ],
    [
      "timebase.codedCoverage",
      (value) => (value.timebase.mediaDuration = 48_311),
    ],
    ["runtimeSeconds", (value) => (value.runtimeSeconds = 2)],
  ];
  TestValidator.predicate(
    "every profile field has a one-field refusing twin",
    substitutions.every(([field, mutate]) => {
      const value = structuredClone(current);
      mutate(value);
      return refused(() => assertProductionOpusProfile(value), field);
    }),
  );
};
