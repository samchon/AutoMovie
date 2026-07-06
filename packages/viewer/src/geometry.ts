import { tessellate } from "@automovie/engine";
import { IAutoMovieGeometry, IAutoMovieMaterial } from "@automovie/interface";
import * as THREE from "three";

/**
 * Build a `three.js` geometry from a automovie geometry node — tessellating a
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

/** Build a `three.js` standard (PBR) material from a automovie material. */
export const buildMaterial = (
  material: IAutoMovieMaterial,
): THREE.MeshStandardMaterial => {
  const c = material.baseColor;
  const std = new THREE.MeshStandardMaterial({
    color: new THREE.Color(c.r, c.g, c.b),
    metalness: material.metallic,
    roughness: material.roughness,
    transparent: material.opacity < 1,
    opacity: material.opacity,
  });
  if (material.emissive !== null)
    std.emissive = new THREE.Color(
      material.emissive.r,
      material.emissive.g,
      material.emissive.b,
    );
  return std;
};

/** Fallback material for parts that cite no material. */
export const defaultMaterial = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.8, 0.8, 0.8),
    metalness: 0,
    roughness: 0.9,
  });
