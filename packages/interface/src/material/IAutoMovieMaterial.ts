import { IAutoMovieColor } from "../color/IAutoMovieColor";

/**
 * One renderer-resolved texture and its deterministic sampling intent.
 *
 * @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale Exposes `IAutoMovieTextureReference` as the portable data boundary for the asset texture coordinates scale requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `IAutoMovieTextureReference` for the asset spec material texture relations system contract.
 */
export interface IAutoMovieTextureReference {
  /**
   * Project asset id.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale Exposes `asset` as the portable data boundary for the asset texture coordinates scale requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `asset` for the asset spec material texture relations system contract.
   */
  asset: string;
  /**
   * UV set index. Generated automovie meshes currently provide set zero.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale Exposes `texCoord` as the portable data boundary for the asset texture coordinates scale requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `texCoord` for the asset spec material texture relations system contract.
   */
  texCoord: number;
  /**
   * How stored texels must be decoded before shading.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale Exposes `colorSpace` as the portable data boundary for the asset texture coordinates scale requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `colorSpace` for the asset spec material texture relations system contract.
   */
  colorSpace: "srgb" | "linear";
  /**
   * Optional normalized UV transform applied around the origin.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale Exposes `transform` as the portable data boundary for the asset texture coordinates scale requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `transform` for the asset spec material texture relations system contract.
   */
  transform?: {
    offset: { x: number; y: number };
    scale: { x: number; y: number };
    rotationDeg: number;
  };
  /**
   * Optional texture filtering and wrap policy.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale Exposes `sampler` as the portable data boundary for the asset texture coordinates scale requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `sampler` for the asset spec material texture relations system contract.
   */
  sampler?: {
    wrapS: "clamp" | "repeat" | "mirror";
    wrapT: "clamp" | "repeat" | "mirror";
    minFilter:
      | "nearest"
      | "linear"
      | "nearestMipmapLinear"
      | "linearMipmapLinear";
    magFilter: "nearest" | "linear";
  };
}

/**
 * Legacy bare asset id or the complete texture sampling declaration.
 *
 * @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale Exposes `AutoMovieTextureBinding` as the portable data boundary for the asset texture coordinates scale requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `AutoMovieTextureBinding` for the asset spec material texture relations system contract.
 */
export type AutoMovieTextureBinding = string | IAutoMovieTextureReference;

/**
 * A physically-based (PBR) surface material: the "what it's made of and how it
 * catches light" of a character or object surface.
 *
 * Fields mirror the glTF 2.0 metallic-roughness model so a generated material
 * maps 1:1 onto `three.js` `MeshStandardMaterial`, VRM/MToon inputs, and glTF
 * export. Every coefficient is a scalar documented to `[0, 1]` or an
 * {@link IAutoMovieColor}; the whole material is a small numeric record, which
 * is exactly why an LLM can author or tweak it ("make it more metallic",
 * "rougher", "warmer base color") through structured output; the engine
 * range-checks the coefficients.
 *
 * Texture _maps_ (image-based base color / normal / roughness) are referenced
 * by id rather than embedded: the pixel payload is an asset the engine
 * resolves, not something the LLM emits.
 *
 * Reference: glTF 2.0 `pbrMetallicRoughness`
 * (https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials).
 *
 * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `IAutoMovieMaterial` as the portable data boundary for the asset material composition requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `IAutoMovieMaterial` for the asset spec material texture relations system contract.
 * @author Samchon
 */
export interface IAutoMovieMaterial {
  /**
   * Stable id so meshes / scene nodes can cite this material.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `id` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `id` for the asset spec material texture relations system contract.
   */
  id: string;

  /**
   * Human / LLM readable label (e.g. `"glossy red plastic"`). Null if unnamed.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `name` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `name` for the asset spec material texture relations system contract.
   */
  name: string | null;

  /**
   * Diffuse / albedo base color (linear).
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `baseColor` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `baseColor` for the asset spec material texture relations system contract.
   */
  baseColor: IAutoMovieColor;

  /**
   * Metalness, `[0, 1]`. `0` = dielectric, `1` = metal.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `metallic` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `metallic` for the asset spec material texture relations system contract.
   */
  metallic: number;

  /**
   * Surface roughness, `[0, 1]`. `0` = mirror-smooth, `1` = fully diffuse.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `roughness` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `roughness` for the asset spec material texture relations system contract.
   */
  roughness: number;

  /**
   * Emissive (self-illumination) color, or `null` for a non-emitting surface.
   * Distinct from a black base color: this surface _adds_ light.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `emissive` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `emissive` for the asset spec material texture relations system contract.
   */
  emissive: IAutoMovieColor | null;

  /**
   * Opacity, `[0, 1]`. `1` = opaque. Below `1` the engine enables alpha
   * blending. (Mirrors `baseColor.a`; kept explicit for the common author
   * gesture "make it 50% transparent".)
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `opacity` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `opacity` for the asset spec material texture relations system contract.
   */
  opacity: number;

  /**
   * Id of an optional base-color texture map. `null` = flat `baseColor` only.
   * The image is an engine-resolved asset, never LLM-emitted pixels.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `baseColorTexture` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `baseColorTexture` for the asset spec material texture relations system contract.
   */
  baseColorTexture: AutoMovieTextureBinding | null;

  /**
   * GlTF-style combined metallic (B) and roughness (G) texture id.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `metallicRoughnessTexture` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `metallicRoughnessTexture` for the asset spec material texture relations system contract.
   */
  metallicRoughnessTexture?: AutoMovieTextureBinding | null;

  /**
   * Tangent-space normal-map texture id.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `normalTexture` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `normalTexture` for the asset spec material texture relations system contract.
   */
  normalTexture?: AutoMovieTextureBinding | null;

  /**
   * Finite multiplier applied to the normal map's XY channels; negative flips
   * them.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `normalScale` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `normalScale` for the asset spec material texture relations system contract.
   */
  normalScale?: number;

  /**
   * Ambient-occlusion texture id.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `occlusionTexture` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `occlusionTexture` for the asset spec material texture relations system contract.
   */
  occlusionTexture?: AutoMovieTextureBinding | null;

  /**
   * Occlusion strength in `[0, 1]`.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `occlusionStrength` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `occlusionStrength` for the asset spec material texture relations system contract.
   */
  occlusionStrength?: number;

  /**
   * Emissive texture id multiplied by {@link emissive}.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `emissiveTexture` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `emissiveTexture` for the asset spec material texture relations system contract.
   */
  emissiveTexture?: AutoMovieTextureBinding | null;

  /**
   * Whether both sides of the surface are visible.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `doubleSided` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `doubleSided` for the asset spec material texture relations system contract.
   */
  doubleSided?: boolean;

  /**
   * Explicit alpha handling. Omitted derives legacy blend behavior from
   * opacity.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `alphaMode` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `alphaMode` for the asset spec material texture relations system contract.
   */
  alphaMode?: "opaque" | "mask" | "blend";

  /**
   * Alpha threshold used only by `mask`; defaults to 0.5.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `alphaCutoff` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `alphaCutoff` for the asset spec material texture relations system contract.
   */
  alphaCutoff?: number;

  /**
   * Fraction of light transmitted through a physical dielectric, `[0, 1]`.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `transmission` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `transmission` for the asset spec material texture relations system contract.
   */
  transmission?: number;

  /**
   * Index of refraction, finite and `>= 1`.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `ior` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `ior` for the asset spec material texture relations system contract.
   */
  ior?: number;

  /**
   * Non-negative transmission volume thickness in metres.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `thickness` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `thickness` for the asset spec material texture relations system contract.
   */
  thickness?: number;

  /**
   * Fractional clear-coat lobe strength, `[0, 1]`.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition Exposes `clearcoat` as the portable data boundary for the asset material composition requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `clearcoat` for the asset spec material texture relations system contract.
   */
  clearcoat?: number;
}
