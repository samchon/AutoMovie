import { tessellate } from "@automovie/engine";
import {
  AutoMovieTextureBinding,
  IAutoMovieGeometry,
  IAutoMovieMaterial,
  IAutoMovieTextureReference,
} from "@automovie/interface";
import * as THREE from "three";

/**
 * Build a `three.js` geometry from a automovie geometry node: tessellating a
 * parametric primitive (via the engine) or uploading raw mesh arrays.
 *
 * @author Samchon
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Lowers compiled geometry into a viewer-owned runtime buffer object.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Implements the runtime ownership side of isolated scene lowering.
 */
export const buildGeometry = (
  geometry: IAutoMovieGeometry,
): THREE.BufferGeometry => {
  const geo = new THREE.BufferGeometry();
  if (geometry.type === "primitive") {
    const t = tessellate(geometry.shape);
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(t.positions, 3),
    );
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(t.normals, 3));
    geo.setIndex(t.indices);
    return geo;
  }
  const mesh = geometry.mesh;
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(mesh.positions, 3),
  );
  if (mesh.normals !== null)
    geo.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(mesh.normals, 3),
    );
  // One UV set, deliberately. `three.js` reads a map's `channel` to pick
  // between `uv`, `uv1`, `uv2` and `uv3`, and the artifact admits `texCoord` 0
  // alone (`validateModel`), so a mirrored `uv1` would be a second copy of the
  // same buffer that no material could ever address.
  if (mesh.uvs !== null)
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(mesh.uvs, 2));
  if (mesh.indices !== null) geo.setIndex(mesh.indices);
  if (mesh.skin !== null) {
    geo.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(mesh.skin.boneIndices, 4),
    );
    geo.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(mesh.skin.weights, 4),
    );
  }
  if (mesh.normals === null) geo.computeVertexNormals();
  return geo;
};

/**
 * Resolve one binding to a material-owned texture instance.
 *
 * The host may cache decoded image bytes, but it must return a distinct texture
 * object because this layer writes the binding's UV, sampler, and color-space
 * state onto that object.
 *
 * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution Resolves this public surface into the declared render material.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Implements the material and color binding at the render boundary.
 */
export type IAutoMovieTextureResolver = (
  binding: AutoMovieTextureBinding,
) => THREE.Texture | undefined;

/**
 * The asset id a legacy or structured binding names.
 *
 * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution Resolves this public surface into the declared render material.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Implements the material and color binding at the render boundary.
 */
export const textureBindingAsset = (
  binding: AutoMovieTextureBinding,
): string => (typeof binding === "string" ? binding : binding.asset);

/**
 * Every texture binding one material declares, in slot order, nulls dropped.
 *
 * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution Resolves this public surface into the declared render material.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Implements the material and color binding at the render boundary.
 */
export const materialTextureBindings = (
  material: IAutoMovieMaterial,
): AutoMovieTextureBinding[] =>
  [
    material.baseColorTexture,
    material.metallicRoughnessTexture,
    material.normalTexture,
    material.occlusionTexture,
    material.emissiveTexture,
  ].filter(
    (value): value is AutoMovieTextureBinding =>
      value !== null && value !== undefined,
  );

/**
 * Decode one project texture asset. Host-owned: the viewer has no I/O.
 *
 * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution Resolves this public surface into the declared render material.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Implements the material and color binding at the render boundary.
 */
export type IAutoMovieTextureLoader = (asset: string) => Promise<THREE.Texture>;

/**
 * One shot's decoded texture assets: loaded once, handed out per binding, and
 * released once.
 *
 * Two facts pull in opposite directions and this class is where they meet.
 * {@link buildMaterial} writes a binding's color space, UV transform and sampler
 * ONTO the texture object it is given, so two slots that name the same image
 * must not receive the same object: a floor repeating its tile 40 times and a
 * table top repeating the same tile twice would otherwise fight over one
 * `repeat`, last writer winning. But decoding that image twice is a second
 * download and a second GPU upload of identical pixels, per model, for a
 * building whose whole point is that the same tile recurs everywhere.
 *
 * So the asset is decoded once and each binding gets `clone()` of it. A
 * `three.js` clone shares its source's `Source` object, which is what the
 * renderer keys its GPU upload on, so N clones of one asset are N cheap
 * descriptors over ONE upload while each keeps its own sampling state.
 *
 * The cache is per shot rather than per model because a shot is the lifetime a
 * host can actually end: {@link dispose} releases every clone it issued and
 * every source it decoded, exactly once however many times it is called, and a
 * cache that has been disposed refuses further work rather than quietly
 * decoding into a bucket nobody will empty.
 *
 * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution Resolves this public surface into the declared render material.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Implements the material and color binding at the render boundary.
 */
export class AutoMovieTextureCache {
  private readonly pending = new Map<string, Promise<THREE.Texture>>();
  private readonly sources = new Map<string, THREE.Texture>();
  private readonly issued: THREE.Texture[] = [];
  private disposed = false;

  /** Build a cache over one host-owned loader. */
  public constructor(private readonly load: IAutoMovieTextureLoader) {
    this.resolve = (binding) => {
      this.assertLive();
      const asset = textureBindingAsset(binding);
      const source = this.sources.get(asset);
      if (source === undefined)
        throw new Error(
          `Texture asset "${asset}" was never primed into this shot cache.`,
        );
      const clone = source.clone();
      this.issued.push(clone);
      return clone;
    };
  }

  /**
   * Decode every distinct asset the given bindings name, at most once each.
   *
   * Awaiting this is what makes {@link resolve} synchronous, which is what lets
   * {@link buildMaterial} stay a pure function of a material. A binding whose
   * asset fails to decode rejects here, naming every asset that failed, rather
   * than surfacing later as a silently untextured surface.
   *
   * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution Resolves this public surface into the declared render material.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Implements the material and color binding at the render boundary.
   */
  public async prime(
    bindings: Iterable<AutoMovieTextureBinding | null | undefined>,
  ): Promise<void> {
    this.assertLive();
    const assets = new Set<string>();
    for (const binding of bindings)
      if (binding !== null && binding !== undefined)
        assets.add(textureBindingAsset(binding));
    const settled = await Promise.allSettled(
      [...assets].map((asset) => this.decodeOnce(asset)),
    );
    const failed = [...assets].filter(
      (_asset, index) => settled[index]!.status === "rejected",
    );
    if (failed.length !== 0)
      throw new Error(
        `Texture assets could not be decoded: ${failed.join(", ")}.`,
      );
  }

  /**
   * A binding-private texture over the primed source, for {@link buildMaterial}.
   *
   * A bound field rather than a method so it can be handed straight to
   * {@link buildModel} as the resolver itself. An asset that was never primed
   * throws instead of returning `undefined`: `undefined` is the host's honest
   * "this project ships no such map", and answering it for an asset the
   * material DOES declare would render a floor with no tile and call that
   * success.
   *
   * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution Resolves this public surface into the declared render material.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Implements the material and color binding at the render boundary.
   */
  public readonly resolve: IAutoMovieTextureResolver;

  /** How many distinct assets this cache has decoded. */
  public get size(): number {
    return this.sources.size;
  }

  /**
   * Release every issued clone and every decoded source, exactly once.
   *
   * In-flight decodes are awaited before release, so a host that tears a shot
   * down mid-load frees what it started rather than leaking whatever landed
   * after the teardown.
   *
   * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution Resolves this public surface into the declared render material.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Implements the material and color binding at the render boundary.
   */
  public async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    const settled = await Promise.allSettled(this.pending.values());
    for (const clone of this.issued) clone.dispose();
    this.issued.length = 0;
    for (const result of settled)
      if (result.status === "fulfilled") result.value.dispose();
    this.pending.clear();
    this.sources.clear();
  }

  private decodeOnce(asset: string): Promise<THREE.Texture> {
    const existing = this.pending.get(asset);
    if (existing !== undefined) return existing;
    const decoding = this.load(asset).then((texture) => {
      this.sources.set(asset, texture);
      return texture;
    });
    this.pending.set(asset, decoding);
    return decoding;
  }

  private assertLive(): void {
    if (this.disposed)
      throw new Error("This shot texture cache has already been disposed.");
  }
}

/**
 * Build a `three.js` physical PBR material from an automovie material.
 *
 * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution Resolves this public surface into the declared render material.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Implements the material and color binding at the render boundary.
 */
export const buildMaterial = (
  material: IAutoMovieMaterial,
  resolveTexture?: IAutoMovieTextureResolver,
): THREE.MeshPhysicalMaterial => {
  const c = material.baseColor;
  const alphaMode =
    material.alphaMode ?? (material.opacity < 1 ? "blend" : "opaque");
  const std = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(c.r, c.g, c.b),
    metalness: material.metallic,
    roughness: material.roughness,
    transparent: alphaMode === "blend",
    depthWrite: alphaMode !== "blend",
    opacity: material.opacity,
    alphaTest: alphaMode === "mask" ? (material.alphaCutoff ?? 0.5) : 0,
    side: material.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    transmission: material.transmission ?? 0,
    ior: material.ior ?? 1.5,
    thickness: material.thickness ?? 0,
    clearcoat: material.clearcoat ?? 0,
  });
  std.map = resolveMaterialTexture(
    material.baseColorTexture,
    "srgb",
    resolveTexture,
  );
  const metallicRoughness = resolveMaterialTexture(
    material.metallicRoughnessTexture,
    "linear",
    resolveTexture,
  );
  std.metalnessMap = metallicRoughness;
  std.roughnessMap = metallicRoughness;
  std.normalMap = resolveMaterialTexture(
    material.normalTexture,
    "linear",
    resolveTexture,
  );
  if (material.normalScale !== undefined)
    std.normalScale.setScalar(material.normalScale);
  std.aoMap = resolveMaterialTexture(
    material.occlusionTexture,
    "linear",
    resolveTexture,
  );
  std.aoMapIntensity = material.occlusionStrength ?? 1;
  std.emissiveMap = resolveMaterialTexture(
    material.emissiveTexture,
    "srgb",
    resolveTexture,
  );
  if (material.emissive !== null)
    std.emissive = new THREE.Color(
      material.emissive.r,
      material.emissive.g,
      material.emissive.b,
    );
  else if (std.emissiveMap !== null) std.emissive.setRGB(1, 1, 1);
  return std;
};

const resolveMaterialTexture = (
  binding: AutoMovieTextureBinding | null | undefined,
  legacyColorSpace: "srgb" | "linear",
  resolver: IAutoMovieTextureResolver | undefined,
): THREE.Texture | null => {
  if (binding === null || binding === undefined || resolver === undefined)
    return null;
  const texture = resolver(binding);
  if (texture === undefined) return null;
  const reference: IAutoMovieTextureReference =
    typeof binding === "string"
      ? { asset: binding, texCoord: 0, colorSpace: legacyColorSpace }
      : binding;
  texture.colorSpace =
    reference.colorSpace === "srgb" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.channel = reference.texCoord;
  if (reference.transform !== undefined) {
    texture.offset.set(
      reference.transform.offset.x,
      reference.transform.offset.y,
    );
    texture.repeat.set(
      reference.transform.scale.x,
      reference.transform.scale.y,
    );
    texture.rotation = (reference.transform.rotationDeg * Math.PI) / 180;
  }
  if (reference.sampler !== undefined) {
    texture.wrapS = wrapMode(reference.sampler.wrapS);
    texture.wrapT = wrapMode(reference.sampler.wrapT);
    texture.minFilter = minFilter(reference.sampler.minFilter);
    texture.magFilter =
      reference.sampler.magFilter === "nearest"
        ? THREE.NearestFilter
        : THREE.LinearFilter;
  }
  texture.needsUpdate = true;
  return texture;
};

const wrapMode = (value: "clamp" | "repeat" | "mirror"): THREE.Wrapping =>
  value === "clamp"
    ? THREE.ClampToEdgeWrapping
    : value === "repeat"
      ? THREE.RepeatWrapping
      : THREE.MirroredRepeatWrapping;

const minFilter = (
  value: "nearest" | "linear" | "nearestMipmapLinear" | "linearMipmapLinear",
): THREE.MinificationTextureFilter => {
  switch (value) {
    case "nearest":
      return THREE.NearestFilter;
    case "linear":
      return THREE.LinearFilter;
    case "nearestMipmapLinear":
      return THREE.NearestMipmapLinearFilter;
    case "linearMipmapLinear":
      return THREE.LinearMipmapLinearFilter;
  }
};

/**
 * Fallback material for parts that cite no material.
 *
 * @evidence requirements/rendering/materials-lighting-and-color.md#rendering-material-resolution Resolves this public surface into the declared render material.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-material-color Implements the material and color binding at the render boundary.
 */
export const defaultMaterial = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.8, 0.8, 0.8),
    metalness: 0,
    roughness: 0.9,
  });
