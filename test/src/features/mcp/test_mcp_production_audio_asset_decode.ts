import { decodeProductionAudioAsset } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";
import { productionWav } from "./productionMediaFixtures";

/** The finished-film sound plan's own rate, which every decode targets. */
const PLAN_RATE = 48_000;

const decode = (bytes: Uint8Array, sampleRate = PLAN_RATE) =>
  decodeProductionAudioAsset({
    path: "public/audio/bed.wav",
    bytes,
    sampleRate,
  });

/**
 * A declared audio asset becomes the mono samples the mix plays.
 *
 * `renderProductionSound` accepts decoded mono samples per asset and nothing in
 * the repository produced them, so a production could declare a sound, plan it,
 * cut it, and still render the bus stand-in: every authored cue was expressible
 * and none of it was the sound the author chose. This pins the decode that
 * closes that gap -- what it reads out of a container, and what it reports the
 * container to be.
 *
 * The two are kept apart on purpose. The `source*` facts are the file's own,
 * before the downmix and before any resampling, because a render plan records
 * them as the asset's identity; the samples are what the mix consumes. A
 * decoder that reported its output as the source would make a resampled asset
 * claim the plan's rate and hide every duration disagreement the plan exists to
 * catch.
 *
 * Expected values are hand-derived from the WAV specification rather than read
 * back from the decoder: `16384 / 32768` is `0.5`, and the interpolated samples
 * are the midpoints of a ramp.
 *
 * Scenarios:
 *
 * 1. 16-bit PCM mono at the plan's rate: the container's facts are reported as its
 *    own, codes scale to unit floats, and full-scale negative is exactly -1.
 * 2. At the plan's own rate nothing is resampled, so the output holds exactly as
 *    many samples as the file has frames.
 * 3. A metadata chunk ahead of the format chunk changes nothing: the walk finds
 *    chunks by id rather than by offset.
 * 4. Stereo folds to the average of its channels, so an opposed pair cancels
 *    instead of surviving as the left channel.
 * 5. 32-bit IEEE float samples decode as written.
 * 6. `WAVE_FORMAT_EXTENSIBLE` decodes as the sub-format it names, so an ordinary
 *    stem is not refused for how its header spells PCM.
 * 7. A file at another rate is resampled to the plan's rate: the buffer stretches
 *    by the rate ratio, interpolates between source samples, holds the last
 *    sample past the end, and still reports the file's own rate and runtime.
 */
export const test_mcp_production_audio_asset_decode = (): void => {
  const monoPcm = decode(
    productionWav({
      channels: [[0, 16_384, -32_768, 8_192]],
      metadata: false,
    }),
  );
  const withMetadata = decode(
    productionWav({
      channels: [[0, 16_384, -32_768, 8_192]],
      metadata: true,
    }),
  );
  const stereoPcm = decode(
    productionWav({
      channels: [
        [16_384, -16_384],
        [16_384, 16_384],
      ],
    }),
  );
  const float = decode(
    productionWav({
      formatTag: 3,
      bitsPerSample: 32,
      channels: [[0.25, -0.75, 1]],
    }),
  );
  const extensible = decode(
    productionWav({
      formatTag: 0xfffe,
      subFormatTag: 1,
      channels: [[0, 16_384, -32_768, 8_192]],
    }),
  );
  const resampled = decode(
    productionWav({
      sampleRate: 24_000,
      channels: [[0, 8_192, 16_384, 24_576]],
    }),
  );

  TestValidator.equals(
    "a declared WAV asset decodes to mono samples at the plan's rate",
    namedFacts([
      ["itReadsTheDeclaredRate", () => monoPcm.sourceSampleRate === PLAN_RATE],
      ["itReadsTheDeclaredChannelCount", () => monoPcm.sourceChannels === 1],
      ["itCountsTheSourceFrames", () => monoPcm.sourceFrames === 4],
      [
        "itDerivesTheRuntimeFromThoseFrames",
        () => nclose(monoPcm.durationSeconds, 4 / PLAN_RATE, 1e-12),
      ],
      [
        "itScalesSixteenBitCodesToUnitFloats",
        () => nclose(monoPcm.samples[1]!, 0.5, 1e-9),
      ],
      [
        "andFullScaleNegativeIsExactlyMinusOne",
        () => nclose(monoPcm.samples[2]!, -1, 1e-9),
      ],
      // At the plan's own rate the buffer is copied rather than interpolated, so
      // an asset already in the right shape carries no conversion error at all.
      [
        "aFileAlreadyAtThePlanRateIsNotResampled",
        () => monoPcm.samples.length === monoPcm.sourceFrames,
      ],
      // Found by id, not by offset: a writer that puts a LIST first must not
      // shift what the decoder believes the format chunk is.
      [
        "aMetadataChunkAheadOfTheFormatChangesNothing",
        () =>
          [...withMetadata.samples].every((sample, index) =>
            nclose(sample, monoPcm.samples[index]!, 1e-9),
          ),
      ],
      [
        "stereoFoldsToTheAverageOfItsChannels",
        () => nclose(stereoPcm.samples[0]!, 0.5, 1e-9),
      ],
      // Taking the left channel, or summing without dividing, both read 0.5
      // above and -0.5 here. Only the average cancels.
      ["soAnOpposedPairCancels", () => nclose(stereoPcm.samples[1]!, 0, 1e-9)],
      [
        "thirtyTwoBitFloatSamplesDecodeAsWritten",
        () => nclose(float.samples[1]!, -0.75, 1e-9),
      ],
      [
        "anExtensibleHeaderDecodesAsItsSubFormat",
        () =>
          [...extensible.samples].every((sample, index) =>
            nclose(sample, monoPcm.samples[index]!, 1e-9),
          ),
      ],
      [
        "aFileAtAnotherRateStretchesByTheRateRatio",
        () => resampled.samples.length === 8,
      ],
      [
        "andInterpolatesBetweenItsSourceSamples",
        () => nclose(resampled.samples[1]!, 0.125, 1e-9),
      ],
      // Past the last source sample the interpolation holds it rather than
      // reading off the end of the buffer.
      [
        "andHoldsTheLastSamplePastTheEnd",
        () => nclose(resampled.samples[7]!, 0.75, 1e-9),
      ],
      // The plan records the asset's identity from these, so they must stay the
      // file's own facts and not the mix's.
      [
        "whileTheReportedRateStaysTheFilesOwn",
        () => resampled.sourceSampleRate === 24_000,
      ],
      [
        "andTheReportedRuntimeStaysTheFilesOwn",
        () => nclose(resampled.durationSeconds, 4 / 24_000, 1e-12),
      ],
    ]),
    {
      itReadsTheDeclaredRate: true,
      itReadsTheDeclaredChannelCount: true,
      itCountsTheSourceFrames: true,
      itDerivesTheRuntimeFromThoseFrames: true,
      itScalesSixteenBitCodesToUnitFloats: true,
      andFullScaleNegativeIsExactlyMinusOne: true,
      aFileAlreadyAtThePlanRateIsNotResampled: true,
      aMetadataChunkAheadOfTheFormatChangesNothing: true,
      stereoFoldsToTheAverageOfItsChannels: true,
      soAnOpposedPairCancels: true,
      thirtyTwoBitFloatSamplesDecodeAsWritten: true,
      anExtensibleHeaderDecodesAsItsSubFormat: true,
      aFileAtAnotherRateStretchesByTheRateRatio: true,
      andInterpolatesBetweenItsSourceSamples: true,
      andHoldsTheLastSamplePastTheEnd: true,
      whileTheReportedRateStaysTheFilesOwn: true,
      andTheReportedRuntimeStaysTheFilesOwn: true,
    },
  );
};
