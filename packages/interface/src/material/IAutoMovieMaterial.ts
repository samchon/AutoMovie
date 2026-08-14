import { IAutoMovieColor } from "../color/IAutoMovieColor";

/**
 * What one unit of a surface's texture coordinates means.
 *
 * The repository carries three coordinate sources and they are not
 * interchangeable arithmetic. An atlas-bearing procedural surface measures its
 * UV in local metres of surface distance, so a 2 m face spans two units before
 * any later mesh transform and the repeat a finish wants is `1 / tile`,
 * independent of how large the face is. A normalized authored surface, such as
 * a lattice or a module prototype, spans `[0, 1]` over the whole surface, so the
 * same finish wants `extent / tile` and the face's own size is part of the
 * answer. An imported set may instead retain arbitrary source UVs. Nothing
 * about one such unit implies a physical distance or a normalized extent; its
 * source layout or adoption receipt owns the transform.
 *
 * Nothing in an image says which of the three it will be sampled through, and
 * neither does a `transform.scale` read on its own: the metric and normalized
 * arithmetics differ by exactly the surface extent, and the imported one has no
 * general formula at all, which is why a binding authored for one and applied
 * to another reads as flat paint or as one tile smeared across a floor rather
 * than as a wrong number anything can see. Declaring the source is what makes
 * that difference a stated fact instead of a guess.
 *
 * @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale Lets a texture declare the coordinate system its scale is expressed in rather than leaving it inferred from the image.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Names the coordinate set a binding record must state alongside its coordinate transform and real scale.
 */
export type AutoMovieTextureCoordinateSource =
  | "surface-metres"
  | "normalized"
  | "source-uv";

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
   * UV set index. Generated automovie meshes that emit texture coordinates
   * provide set zero and no other.
   *
   * A second set would be a packed atlas: the promise that a named `[0, 1]`
   * island of one image belongs to one named part of one surface. That is a
   * decided exclusion rather than pending work. Packing islands is a layout
   * decision no authoring agent can state in natural language, the layout only
   * becomes useful once it leaves the engine as an artifact an image model can
   * paint into, which is the scene export the product does not have, and
   * painted-to-fit artwork is finished-look work the repaint lane owns rather
   * than blocking-pass work. It reopens when an authoring agent can drive a
   * packing rule and the product has somewhere for the layout to go.
   *
   * A set index above zero therefore addresses geometry this repository did not
   * generate: an ingested mesh that arrived carrying its own extra set.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale Exposes `texCoord` as the portable data boundary for the asset texture coordinates scale requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `texCoord` for the asset spec material texture relations system contract.
   */
  texCoord: number;
  /**
   * What one unit of the addressed UV set means. Omission preserves legacy raw
   * UV sampling without making a new claim about the set's unit or extent.
   *
   * Declare `"surface-metres"` for an atlas-bearing procedural surface, which
   * is what the geometry kernel emits and what most generated members carry;
   * omitting the field there leaves the unit unstated rather than defaulted.
   * Declare `"normalized"` for a lattice surface, a module prototype, or an
   * imported set whose selected UV layout is known to span `[0, 1]`. Declare
   * `"source-uv"` when an imported set keeps its arbitrary authored layout;
   * importing a mesh does not normalize that layout by itself.
   * `transform.scale` is read against whichever source this names, and the
   * three cannot be told apart from the material record without it.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale Declares the coordinate system this binding's real scale is expressed in, so the same input places the same way.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Supplies the coordinate set the binding record must state beside its transform and real scale.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-surface-coordinate-convention Carries the declared vocabulary the convention's three coordinate sources are named in, which is what makes the unit a binding states readable from the record alone.
   */
  coordinateSource?: AutoMovieTextureCoordinateSource;
  /**
   * How stored texels must be decoded before shading.
   *
   * @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale Exposes `colorSpace` as the portable data boundary for the asset texture coordinates scale requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-material-texture-relations Types `colorSpace` for the asset spec material texture relations system contract.
   */
  colorSpace: "srgb" | "linear";
  /**
   * Optional UV transform applied around the origin, in texture turns.
   *
   * `scale` is turns of the image per unit of the addressed coordinate source,
   * so it is `1 / tile` against `"surface-metres"` and `extent / tile` against
   * `"normalized"`. A `"source-uv"` set has no general physical-scale formula;
   * read its source layout or adoption receipt. Read {@link coordinateSource}
   * before authoring it.
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
