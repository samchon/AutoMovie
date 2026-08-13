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
 * Derive the label, do not type it. `linearColorToSrgbHex` writes `hex` from
 * the triple, `srgbHexToLinearColor` writes the triple from a swatch, and the
 * two round-trip exactly for every eight-bit channel value. Bare `#RRGGBB`
 * fields carry the color rather than label one, so they are sRGB inputs: the
 * compiler and instance viewer share `srgbHexToLinearColor` for recipe and
 * instance palettes, while the effect viewer applies three.js's equivalent
 * decode to particle colors.
 *
 * A swatch pasted into `r`, `g`, `b` unconverted lands about 2.3x too bright at
 * midtones: `#808080` becomes linear `0.502` where the swatch means `0.216`.
 * The compiler used to make exactly that substitution when it turned a model
 * recipe palette into `baseColor`, which is how one production covered a single
 * roof in two colors, its instanced slates decoding their palette correctly
 * while the cut slates beside them carried a material that had not been
 * decoded at all.
 *
 * Nothing compares `hex` against `r`, `g`, `b`. A label typed by hand can still
 * contradict the numbers it sits beside, and the engine will render the numbers
 * without saying so. That refusal is deferred rather than declined: it belongs
 * with the model validators, and the conversion it needs now exists.
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
   * viewer swatches. Write it with `linearColorToSrgbHex` rather than by hand;
   * the linear components are authoritative when both are present, and nothing
   * refuses a label that disagrees with them.
   *
   * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-scene-display-color Exposes `hex` as the portable data boundary for the rendering scene display color requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Types `hex` for the spec render material color system contract.
   */
  hex: string | null;
}
