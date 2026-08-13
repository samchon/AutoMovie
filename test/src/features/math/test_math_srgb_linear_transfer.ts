import { linearColorToSrgbHex, srgbHexToLinearColor } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * The repository's sRGB transfer pair is answerable to IEC 61966-2-1, not to
 * whatever a renderer happens to emit.
 *
 * Authored palette colors arrive as `#RRGGBB` swatches while materials consume
 * linear triples, and until this pair existed the compiler crossed that
 * boundary by dividing the digits by 255 and calling the result linear. That is
 * a transcription rather than a conversion and lands roughly 2.3x too bright
 * at midtones. Every expectation below is computed by hand from the standard's
 * own piecewise curve, so a future edit that quietly adopts three.js's
 * pre-divided decode constants fails here instead of being blessed by a
 * snapshot of its own output. The two agree to about `1e-11`, which is why the
 * decode assertions are held to `1e-15`.
 *
 * Scenarios:
 *
 * 1. `#000000` and `#ffffff` decode to exact `0` and `1`, the two values where
 *    an approximate curve is still allowed to look right, and they re-encode to
 *    themselves.
 * 2. `#7d828c`, the swatch that split one production's roof in two, decodes to
 *    the standard's `0.2051 / 0.2232 / 0.2623` rather than the transcribed
 *    `0.4902 / 0.5098 / 0.5490`, and `#808080` decodes to `0.2159` rather than
 *    `0.5020`.
 * 3. The decode's piecewise split is exercised on both sides: byte `10` sits
 *    below the `0.04045` breakpoint and takes the `/ 12.92` segment, byte `11`
 *    sits above it and takes the power segment, and the two agree at the
 *    breakpoint itself to within `1e-8`.
 * 4. The encode's piecewise split is exercised the same way: linear `0.001`
 *    takes the `* 12.92` segment while `0.5` takes the power segment, and the
 *    values straddling the `0.0031308` breakpoint land on one byte.
 * 5. All 256 channel values round-trip exactly through decode and encode, so a
 *    `hex` label derived from a triple can be decoded back to that triple.
 * 6. The decoded `hex` is re-derived from the decoded triple rather than copied,
 *    which normalizes a mixed-case swatch and makes the label unable to
 *    disagree with the numbers beside it. Alpha is `1`, a six-digit swatch
 *    being opaque.
 * 7. Components outside `[0, 1]` clamp to the gamut ends because eight bits
 *    cannot state light the display cannot emit.
 * 8. A malformed swatch is refused rather than decoded: a missing `#`, five
 *    digits, eight digits, a non-hexadecimal digit, and the empty string.
 * 9. A non-finite component is refused rather than clamped, so `NaN` can never
 *    be rounded into a string that reads like a swatch.
 */
export const test_math_srgb_linear_transfer = (): void => {
  const black = srgbHexToLinearColor("#000000");
  const white = srgbHexToLinearColor("#ffffff");
  TestValidator.equals(
    "black decodes to the linear origin",
    { r: black.r, g: black.g, b: black.b },
    { r: 0, g: 0, b: 0 },
  );
  TestValidator.equals(
    "white decodes to exact unity",
    { r: white.r, g: white.g, b: white.b },
    { r: 1, g: 1, b: 1 },
  );
  TestValidator.equals(
    "the gamut ends re-encode to themselves",
    [linearColorToSrgbHex(black), linearColorToSrgbHex(white)],
    ["#000000", "#ffffff"],
  );

  // ((0x7d / 255 + 0.055) / 1.055) ** 2.4 and its two siblings, by hand.
  const slate = srgbHexToLinearColor("#7d828c");
  TestValidator.predicate(
    "the roof swatch decodes to the standard's linear triple",
    nclose(slate.r, 0.20507874, 1e-8) &&
      nclose(slate.g, 0.22322796, 1e-8) &&
      nclose(slate.b, 0.26225066, 1e-8),
  );
  TestValidator.predicate(
    "the transcribed reading is not what the swatch means",
    nclose(0x7d / 255, 0.49019608, 1e-8) &&
      nclose(slate.r, 0.49019608, 1e-8) === false,
  );
  TestValidator.predicate(
    "mid grey is linear 0.2159, not 0.5020",
    nclose(srgbHexToLinearColor("#808080").r, 0.2158605, 1e-8),
  );

  // 10 / 255 = 0.0392157 is below the 0.04045 breakpoint, 11 / 255 = 0.0431373
  // is above it, so one byte apart takes the two different segments.
  TestValidator.predicate(
    "the byte below the breakpoint takes the linear segment",
    nclose(srgbHexToLinearColor("#0a0a0a").r, 10 / 255 / 12.92, 1e-15),
  );
  TestValidator.predicate(
    "the byte above the breakpoint takes the power segment",
    nclose(
      srgbHexToLinearColor("#0b0b0b").r,
      Math.pow((11 / 255 + 0.055) / 1.055, 2.4),
      1e-15,
    ),
  );
  TestValidator.predicate(
    "the two decode segments meet at the breakpoint",
    nclose(0.04045 / 12.92, Math.pow((0.04045 + 0.055) / 1.055, 2.4), 1e-8),
  );

  const grey = (component: number) => ({
    r: component,
    g: component,
    b: component,
  });
  // 0.001 * 12.92 * 255 = 3.2946 rounds to 3; the power segment at 0.5 gives
  // 1.055 * 0.5 ** (1 / 2.4) - 0.055 = 0.735357, and * 255 = 187.5 rounds to
  // 188.
  TestValidator.equals(
    "the encode segments produce their hand-computed bytes",
    [linearColorToSrgbHex(grey(0.001)), linearColorToSrgbHex(grey(0.5))],
    ["#030303", "#bcbcbc"],
  );
  TestValidator.equals(
    "the two encode segments meet at the breakpoint",
    [
      linearColorToSrgbHex(grey(0.0031308)),
      linearColorToSrgbHex(grey(0.0031309)),
    ],
    ["#0a0a0a", "#0a0a0a"],
  );

  const digits = "0123456789abcdef";
  const byte = (value: number): string =>
    `${digits[value >> 4]}${digits[value & 0xf]}`;
  TestValidator.equals(
    "every channel value round-trips exactly",
    Array.from({ length: 256 }, (_, value) => byte(value)).filter((pair) => {
      const swatch = `#${pair}${pair}${pair}`;
      return linearColorToSrgbHex(srgbHexToLinearColor(swatch)) !== swatch;
    }),
    [],
  );

  const mixed = srgbHexToLinearColor("#7D828C");
  TestValidator.equals(
    "the label is re-derived from the triple and normalized",
    mixed.hex,
    "#7d828c",
  );
  TestValidator.equals("a six-digit swatch is opaque", mixed.a, 1);

  TestValidator.equals(
    "components outside the gamut clamp to its ends",
    linearColorToSrgbHex({ r: 2, g: -1, b: 0.5 }),
    "#ff00bc",
  );

  TestValidator.equals(
    "a malformed swatch is refused rather than decoded",
    ["7d828c", "#7d828", "#7d828cff", "#gg0000", ""].filter(
      (swatch) =>
        throwsError(
          () => srgbHexToLinearColor(swatch),
          ["is not one opaque six-digit #RRGGBB swatch"],
        ) === false,
    ),
    [],
  );
  TestValidator.equals(
    "a non-finite component is refused rather than clamped",
    [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].filter(
      (component) =>
        throwsError(
          () => linearColorToSrgbHex(grey(component)),
          ["is not a finite number"],
        ) === false,
    ),
    [],
  );
};
