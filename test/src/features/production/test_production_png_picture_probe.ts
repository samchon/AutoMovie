import {
  assertProductionPngPicture,
  probeProductionPngPicture,
  resolveProductionPngProfile,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

const refused = (closure: () => unknown, message: string): boolean => {
  try {
    closure();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(message);
  }
};

const picture = (props: {
  width?: number;
  height?: number;
  colorType?: 0 | 2 | 4 | 6;
  gamma?: number;
}): Uint8Array => {
  const image = new PNG({
    width: props.width ?? 2,
    height: props.height ?? 1,
    colorType: props.colorType ?? 6,
    inputColorType: props.colorType ?? 6,
  });
  image.data.fill(127);
  image.gamma = props.gamma ?? 0;
  return PNG.sync.write(image, {
    colorType: props.colorType ?? 6,
    inputColorType: props.colorType ?? 6,
  });
};

/**
 * Validate complete PNG picture facts and role-specific profiles.
 *
 * Scenarios:
 * 1. An 8-bit RGBA image with the canonical sRGB gamma reports every exact
 *    IHDR, alpha, color, aspect, and orientation fact and passes its role.
 * 2. RGB, grayscale, grayscale-alpha, missing color identity, non-sRGB gamma,
 *    dimensions, and the fixed audio-picture roles remain distinguishable.
 * 3. Invalid role rasters, malformed bytes, and fieldwise profile substitutions
 *    fail without being hidden by a matching filename or digest.
 */
export const test_production_png_picture_probe = (): void => {
  const rgba = probeProductionPngPicture(picture({ gamma: 0.45455 }));
  const profile = resolveProductionPngProfile({
    role: "preview",
    width: 2,
    height: 1,
  });
  assertProductionPngPicture({ profile, actual: rgba });
  TestValidator.equals(
    "the supported PNG reports complete parser-observed picture facts",
    rgba,
    {
      width: 2,
      height: 1,
      bitDepth: 8,
      color: "rgba",
      alpha: "straight",
      interlace: "none",
      colorSpace: "srgb",
      pixelAspect: { kind: "square" },
      orientation: "upright",
    },
  );
  const rgb = probeProductionPngPicture(
    picture({ colorType: 2, gamma: 0.45455 }),
  );
  const grayscale = probeProductionPngPicture(
    picture({ colorType: 0, gamma: 0.45455 }),
  );
  const grayscaleAlpha = probeProductionPngPicture(
    picture({ colorType: 4, gamma: 0.45455 }),
  );
  const unknown = probeProductionPngPicture(picture({}));
  const otherGamma = probeProductionPngPicture(picture({ gamma: 1 }));
  TestValidator.equals(
    "channel, alpha and color identities do not collapse by raster",
    {
      rgb: [rgb.color, rgb.alpha],
      grayscale: [grayscale.color, grayscale.alpha],
      grayscaleAlpha: [grayscaleAlpha.color, grayscaleAlpha.alpha],
      unknown: unknown.colorSpace,
      otherGamma: otherGamma.colorSpace,
    },
    {
      rgb: ["rgb", "none"],
      grayscale: ["gray", "none"],
      grayscaleAlpha: ["gray-alpha", "straight"],
      unknown: "unidentified",
      otherGamma: "gamma",
    },
  );
  TestValidator.equals(
    "audio visualization roles have fixed nonexchangeable rasters",
    {
      waveform: resolveProductionPngProfile({ role: "waveform" }),
      spectrogram: resolveProductionPngProfile({ role: "spectrogram" }),
    },
    {
      waveform: { ...profile, role: "waveform", width: 960, height: 240 },
      spectrogram: {
        ...profile,
        role: "spectrogram",
        width: 512,
        height: 192,
      },
    },
  );
  TestValidator.equals(
    "invalid and substituted PNG profiles fail at the exact field",
    {
      missingRaster: refused(
        () => resolveProductionPngProfile({ role: "guide-frame" }),
        "positive safe-integer raster",
      ),
      wrongWidth: refused(
        () =>
          assertProductionPngPicture({
            profile: { ...profile, width: 3 },
            actual: rgba,
          }),
        "width",
      ),
      wrongHeight: refused(
        () =>
          assertProductionPngPicture({
            profile: { ...profile, height: 2 },
            actual: rgba,
          }),
        "height",
      ),
      rgbInsteadOfRgba: refused(
        () => assertProductionPngPicture({ profile, actual: rgb }),
        "color",
      ),
      unknownColor: refused(
        () => assertProductionPngPicture({ profile, actual: unknown }),
        "colorSpace",
      ),
      malformed: refused(
        () => probeProductionPngPicture(new Uint8Array([1, 2, 3])),
        "PNG",
      ),
    },
    {
      missingRaster: true,
      wrongWidth: true,
      wrongHeight: true,
      rgbInsteadOfRgba: true,
      unknownColor: true,
      malformed: true,
    },
  );
  const profileSubstitutions = [
    ["bitDepth", { ...rgba, bitDepth: 16 }],
    ["alpha", { ...rgba, alpha: "none" as const }],
    ["interlace", { ...rgba, interlace: "adam7" as const }],
    ["colorSpace", { ...rgba, colorSpace: "icc" as const }],
    [
      "pixelAspect",
      {
        ...rgba,
        pixelAspect: {
          kind: "explicit" as const,
          x: 2,
          y: 1,
          unit: 0 as const,
        },
      },
    ],
    ["orientation", { ...rgba, orientation: "metadata-present" as const }],
  ] as const;
  TestValidator.predicate(
    "every planned picture fact has an independent refusing twin",
    profileSubstitutions.every(([field, actual]) =>
      refused(() => assertProductionPngPicture({ profile, actual }), field),
    ),
  );
};
