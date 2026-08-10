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
  if (mesh.uvs !== null)
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(mesh.uvs, 2));
  if (mesh.uvs !== null)
    geo.setAttribute("uv1", new THREE.Float32BufferAttribute(mesh.uvs, 2));
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
 */
export type IAutoMovieTextureResolver = (
  binding: AutoMovieTextureBinding,
) => THREE.Texture | undefined;

/** Build a `three.js` physical PBR material from an automovie material. */
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

/** Fallback material for parts that cite no material. */
export const defaultMaterial = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.8, 0.8, 0.8),
    metalness: 0,
    roughness: 0.9,
  });
