import {
  deriveProductionSoundPlan,
  productionSoundSpectrogram,
  productionSoundWaveform,
  renderProductionSound,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  productionSoundCompiled,
  productionSoundContract,
  productionSoundRefused,
  productionSoundTimeline,
} from "./productionSoundFixtures";

/** Mixed sound becomes deterministic review rasters, or is refused by shape. */
export const test_film_production_sound_raster = (): void => {
  const source = productionSoundCompiled();
  const plan = deriveProductionSoundPlan({
    timeline: productionSoundTimeline(),
    contracts: new Map([["sound-shot", productionSoundContract()]]),
    compiled: new Map([["sound-shot", source]]),
  });
  const mixed = renderProductionSound({
    plan,
    dialogue: new Map([["line", Float32Array.from([0.5])]]),
  });
  const waveform = productionSoundWaveform(mixed.pcm, 32, 16);
  const spectrogram = productionSoundSpectrogram(mixed.pcm, 8, 8);
  TestValidator.equals(
    "waveform and spectrogram expose deterministic opaque RGBA rasters",
    namedFacts([
      ["waveformRgba", () => waveform.rgba.length === 32 * 16 * 4],
      ["spectrogramRgba", () => spectrogram.rgba.length === 8 * 8 * 4],
      [
        "waveformRgbaValue",
        () =>
          waveform.rgba.every(
            (value, index) => index % 4 !== 3 || value === 255,
          ),
      ],
      [
        "spectrogramRgbaValue",
        () =>
          spectrogram.rgba.every(
            (value, index) => index % 4 !== 3 || value === 255,
          ),
      ],
    ]),
    {
      waveformRgba: true,
      spectrogramRgba: true,
      waveformRgbaValue: true,
      spectrogramRgbaValue: true,
    },
  );
  TestValidator.equals(
    "sound rasters reject malformed dimensions and PCM",
    namedFacts([
      [
        "refusedProductionSoundWaveformFirst",
        () =>
          productionSoundRefused(
            () => productionSoundWaveform(mixed.pcm, 0, 10),
            "positive integers",
          ),
      ],
      [
        "refusedProductionSoundWaveformNew",
        () =>
          productionSoundRefused(
            () => productionSoundWaveform(new Float32Array(1), 10, 10),
            "interleaved stereo",
          ),
      ],
      [
        "refusedProductionSoundSpectrogramFirst",
        () =>
          productionSoundRefused(
            () => productionSoundSpectrogram(mixed.pcm, 1.5, 10),
            "positive integers",
          ),
      ],
      [
        "refusedProductionSoundSpectrogramNew",
        () =>
          productionSoundRefused(
            () => productionSoundSpectrogram(new Float32Array(1), 10, 10),
            "interleaved stereo",
          ),
      ],
    ]),
    {
      refusedProductionSoundWaveformFirst: true,
      refusedProductionSoundWaveformNew: true,
      refusedProductionSoundSpectrogramFirst: true,
      refusedProductionSoundSpectrogramNew: true,
    },
  );
};
