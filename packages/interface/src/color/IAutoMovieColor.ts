/**
 * A linear-RGB color with optional alpha, the canonical color value for
 * materials, lights, and decorative tints.
 *
 * Components are linear (not sRGB-gamma-encoded) numbers in `[0, 1]`, matching
 * how PBR shaders and glTF `baseColorFactor` consume color. `hex` is an
 * optional sRGB convenience anchor for human/LLM readability and viewer
 * display; when both are present the engine treats the linear triple as
 * authoritative and `hex` as a derived label.
 *
 * Keeping color as a numeric triple (rather than a free string) is what lets an
 * LLM reason about adjusting it ("one tone darker", "warmer") and lets the
 * engine range-check it; components are documented to `[0, 1]` and validated
 * there.
 *
 * Reference: glTF 2.0 `pbrMetallicRoughness.baseColorFactor` (linear), CSS
 * Color Module Level 4.
 *
 * @author Samchon
 */
export interface IAutoMovieColor {
  /** Linear red, `[0, 1]`. */
  r: number;

  /** Linear green, `[0, 1]`. */
  g: number;

  /** Linear blue, `[0, 1]`. */
  b: number;

  /**
   * Linear alpha, `[0, 1]`. `1` = fully opaque. Null when the color is used in
   * an opacity-irrelevant slot (e.g. light color, emissive), distinct from `0`
   * (fully transparent).
   */
  a: number | null;

  /**
   * Optional sRGB `#RRGGBB` convenience form for human / LLM readability and
   * viewer swatches. Derived from the linear triple; the linear components are
   * authoritative when both are present.
   */
  hex: string | null;
}
