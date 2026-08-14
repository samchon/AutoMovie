import type { IAutoMovieColor } from "@automovie/interface";

/**
 * The exact `#RRGGBB` swatch form every authored palette string is written in.
 *
 * Three separate capture groups rather than one six-digit run, so a channel is
 * read as a channel instead of a number that happens to be twenty-four bits
 * wide: shifting a parsed integer would put the decode one bug away from the
 * transcription this whole module exists to remove.
 */
const SRGB_HEX_SWATCH = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/**
 * Decode one sRGB `#RRGGBB` swatch into the linear color materials are typed
 * in.
 *
 * A hex swatch is display-encoded: its digits are what a monitor is asked to
 * emit, not the energy a shader integrates. Dividing them by 255 and calling
 * the result linear is a transcription, not a conversion, and it lands roughly
 * 2.3x too bright at midtones: `#808080` reads as linear `0.502` when the
 * swatch means linear `0.216`. That transcription is exactly how one production
 * ended up covering a single roof in two colors, because instanced slots decode
 * their palette while a material carrying the same digits did not.
 *
 * The returned `hex` is re-encoded from the decoded triple rather than copied
 * from the argument, so the label a caller stores can never disagree with the
 * numbers beside it. The round trip is exact for all 256 channel values, and a
 * mixed-case argument comes back normalized.
 *
 * Alpha is `1`: a six-digit swatch is opaque by definition, and a slot where
 * opacity is irrelevant states that by overwriting `a` with `null`.
 *
 * @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-working-color-space Keeps encoded display RGB from being computed as scene-linear energy by giving the repository the decode that separates them.
 * @evidence specifications/camera-light-and-visibility/light-transport-color-and-budget.md#clv-color-effective-ownership Implements the input-encoding stage of the ordered color pipeline, recording an authored swatch's transform into the scene-linear working space.
 * @author Samchon
 */
export const srgbHexToLinearColor = (hex: string): IAutoMovieColor => {
  const channels = SRGB_HEX_SWATCH.exec(hex);
  if (channels === null)
    throw new Error(
      `sRGB color "${hex}" is not one opaque six-digit #RRGGBB swatch.`,
    );
  const decoded = {
    r: srgbChannelToLinear(Number.parseInt(channels[1]!, 16) / 255),
    g: srgbChannelToLinear(Number.parseInt(channels[2]!, 16) / 255),
    b: srgbChannelToLinear(Number.parseInt(channels[3]!, 16) / 255),
  };
  return {
    ...decoded,
    a: 1,
    hex: linearColorToSrgbHex(decoded),
  };
};

/**
 * Encode a linear color as the `#RRGGBB` swatch that displays it.
 *
 * The quantized inverse of {@link srgbHexToLinearColor}, and the shared way to
 * write an `IAutoMovieColor.hex` label or a bare sRGB palette entry from a
 * triple. Without it the contract's promise that `hex` is derived from the
 * linear components is an obligation with nothing behind it, which is what left
 * every label in the product hand-typed and unchecked.
 *
 * Components outside `[0, 1]` are clamped, because a swatch cannot represent
 * light the display cannot emit and the eight-bit form is the gamut. A
 * non-finite component is refused instead: it names no color at any exposure,
 * and rounding it would write `NaN` into a string that reads like a swatch.
 *
 * @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-working-color-space Derives the display-encoded label from the scene-linear value instead of letting the two be typed independently.
 * @evidence specifications/camera-light-and-visibility/light-transport-color-and-budget.md#clv-color-effective-ownership Implements the display-encoding stage of the ordered color pipeline as the recorded inverse of the input decode.
 * @author Samchon
 */
export const linearColorToSrgbHex = (
  color: Pick<IAutoMovieColor, "r" | "g" | "b">,
): string =>
  `#${srgbHexChannel(color.r)}${srgbHexChannel(color.g)}${srgbHexChannel(color.b)}`;

/**
 * One linear component as its two lowercase hexadecimal display digits.
 */
const srgbHexChannel = (component: number): string => {
  if (Number.isFinite(component) === false)
    throw new Error(
      `Linear color component ${component} is not a finite number.`,
    );
  return Math.round(
    linearChannelToSrgb(Math.min(1, Math.max(0, component))) * 255,
  )
    .toString(16)
    .padStart(2, "0");
};

/**
 * The sRGB electro-optical transfer function of IEC 61966-2-1.
 *
 * Written with the standard's own constants rather than three.js's pre-divided
 * approximations, so the repository's decode is answerable to the specification
 * instead of to a renderer's rounding. The two agree to every bit a 32-bit
 * instance color attribute can hold across all 256 channel values, which is why
 * adopting this one changes no frame the viewer already drew.
 */
const srgbChannelToLinear = (component: number): number =>
  component <= 0.04045
    ? component / 12.92
    : Math.pow((component + 0.055) / 1.055, 2.4);

/**
 * The inverse of {@link srgbChannelToLinear}, with the exact `1 / 2.4`
 * exponent rather than the truncated one three.js encodes with.
 */
const linearChannelToSrgb = (component: number): number =>
  component <= 0.0031308
    ? component * 12.92
    : 1.055 * Math.pow(component, 1 / 2.4) - 0.055;
