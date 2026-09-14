import { compareCodeUnits } from "@automovie/engine";

import type { IAutoMovieProductionAudioAssetIdentity } from "./IAutoMovieProductionAudioAssetIdentity";
import { validByteFact } from "./validByteFact";
import { validWaveAudioIdentity } from "./validWaveAudioIdentity";

/**
 * Order the planned audio assets by path and refuse an invalid identity.
 *
 * Ordering is by code unit so one edit yields one plan on every host, and the
 * refusal covers duplicate ownership, a non-positive or non-integer clock, and a
 * duration that disagrees with the asset's own sample count.
 */
export const normalizeAudioAssets = (
  assets: readonly IAutoMovieProductionAudioAssetIdentity[],
): IAutoMovieProductionAudioAssetIdentity[] => {
  const paths = new Set<string>();
  const output = [...assets]
    .sort((left, right) => compareCodeUnits(left.path, right.path))
    .map((asset) => {
      if (
        asset.path.trim().length === 0 ||
        paths.has(asset.path) ||
        validByteFact({ digest: asset.digest, bytes: 1 }) === false ||
        Number.isFinite(asset.durationSeconds) === false ||
        asset.durationSeconds <= 0 ||
        Number.isSafeInteger(asset.sourceFrames) === false ||
        asset.sourceFrames <= 0 ||
        asset.durationSeconds !== asset.sourceFrames / asset.sampleRate ||
        Number.isSafeInteger(asset.sampleRate) === false ||
        asset.sampleRate <= 0 ||
        Number.isSafeInteger(asset.channels) === false ||
        asset.channels <= 0 ||
        (asset.kind !== "placeholder-audio-stem" && asset.kind !== "wave") ||
        (asset.kind === "placeholder-audio-stem" &&
          (asset.sampleRate !== 48_000 || asset.channels !== 2)) ||
        (asset.kind === "wave" && validWaveAudioIdentity(asset) === false)
      )
        throw new Error(
          `Audio asset "${asset.path}" has invalid identity, duration, sample rate, channels, or duplicate ownership.`,
        );
      paths.add(asset.path);
      return structuredClone(asset);
    });
  return output;
};
