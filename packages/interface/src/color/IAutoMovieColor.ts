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
 * Instance palettes are the exception. An entry of
 * `IAutoMovieInstanceVariation.palette` is a bare `#RRGGBB` string with no
 * triple beside it, so the viewer decodes it from sRGB instead of reading it as
 * a label. The two paths land on the same color only when this type's triple
 * was actually derived from its swatch: `hex` is never checked against `r`,
 * `g`, `b`, so an author who transcribes `7d` as `125 / 255` gets a material at
 * linear `0.49` beside the same palette entry `#7d828c` at linear `0.20`, and
 * nothing refuses the pair.
 *
 * Keeping color as a numeric triple (rather than a free string) lets an
 * authoring agent adjust it numerically and lets the engine range-check it.
 *
 * Reference: glTF 2.0 `pbrMetallicRoughness.baseColorFactor` (linear), CSS
 * Color Module Level 4.
 *
 * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-scene-display-color Defines the portable linear scene-color boundary used by material and light contracts.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Types the linear material-color state required by the rendering contract.
 * @author Samchon
 */
export interface IAutoMovieColor {
  /**
   * Linear red, `[0, 1]`.
   *
   * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-scene-display-color Exposes `r` as the portable data boundary for the rendering scene display color requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Types `r` for the spec render material color system contract.
   */
  r: number;

  /**
   * Linear green, `[0, 1]`.
   *
   * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-scene-display-color Exposes `g` as the portable data boundary for the rendering scene display color requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Types `g` for the spec render material color system contract.
   */
  g: number;

  /**
   * Linear blue, `[0, 1]`.
   *
   * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-scene-display-color Exposes `b` as the portable data boundary for the rendering scene display color requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Types `b` for the spec render material color system contract.
   */
  b: number;

  /**
   * Linear alpha, `[0, 1]`. `1` = fully opaque. Null when the color is used in
   * an opacity-irrelevant slot (e.g. light color, emissive), distinct from `0`
   * (fully transparent).
   *
   * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-scene-display-color Exposes `a` as the portable data boundary for the rendering scene display color requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Types `a` for the spec render material color system contract.
   */
  a: number | null;

  /**
   * Optional sRGB `#RRGGBB` convenience form for human / LLM readability and
   * viewer swatches. Derived from the linear triple; the linear components are
   * authoritative when both are present.
   *
   * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-scene-display-color Exposes `hex` as the portable data boundary for the rendering scene display color requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Types `hex` for the spec render material color system contract.
   */
  hex: string | null;
}
