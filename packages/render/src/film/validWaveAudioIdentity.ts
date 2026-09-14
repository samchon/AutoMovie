import type { IAutoMovieProductionAudioAssetIdentity } from "./IAutoMovieProductionAudioAssetIdentity";
import { equalOrderedScalars } from "./equalOrderedScalars";

/**
 * Check one WAVE asset's declared source facts against its own rate and channels.
 *
 * The plan carries the decoder's observations, so planning refuses an identity
 * whose encoding, container precision, speaker layout, mask, sub-format or
 * downmix recipe contradicts the channel count and rate the same record states.
 */
export const validWaveAudioIdentity = (
  asset: Extract<IAutoMovieProductionAudioAssetIdentity, { kind: "wave" }>,
): boolean => {
  const source = asset.sourceFormat;
  const processing = asset.processing;
  const expectedSpeakers =
    asset.channels === 1 ? ["front-center"] : ["front-left", "front-right"];
  const expectedMatrix = asset.channels === 1 ? [[1]] : [[0.5, 0.5]];
  const outputSampleRate = 48_000;
  const resampled = outputSampleRate !== asset.sampleRate;
  const expectedKind =
    asset.channels === 1
      ? resampled
        ? "resample"
        : "copy"
      : resampled
        ? "downmix-resample"
        : "downmix";
  return (
    (asset.channels === 1 || asset.channels === 2) &&
    source.kind === "wave" &&
    source.sampleRate === asset.sampleRate &&
    source.channels === asset.channels &&
    (source.encoding === "pcm-s16le"
      ? source.containerBits === 16 && source.validBits === 16
      : source.encoding === "float-f32le" &&
        source.containerBits === 32 &&
        source.validBits === 32) &&
    source.layout.kind === (asset.channels === 1 ? "mono" : "stereo") &&
    equalOrderedScalars(source.layout.speakers, expectedSpeakers) &&
    (source.layout.source === "legacy-default"
      ? source.header === "wave-format-ex" &&
        source.layout.mask === null &&
        source.subFormatGuid === null
      : source.layout.source === "channel-mask" &&
        source.header === "wave-format-extensible" &&
        source.layout.mask === (asset.channels === 1 ? 0x4 : 0x3) &&
        source.subFormatGuid ===
          (source.encoding === "pcm-s16le"
            ? "00000001-0000-0010-8000-00aa00389b71"
            : "00000003-0000-0010-8000-00aa00389b71")) &&
    processing.kind === expectedKind &&
    processing.outputChannels === 1 &&
    processing.outputSampleRate === outputSampleRate &&
    equalOrderedScalars(processing.matrix, expectedMatrix)
  );
};
