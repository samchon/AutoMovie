import type { IAutoMovieRenderObservation } from "@automovie/interface";
import * as THREE from "three";

/**
 * Read what a built scene draws right now.
 *
 * This is the live half of the evidence pair. The compiled report states an
 * upper bound before a renderer exists; this states what the scene graph in
 * front of you actually submits. The render package owns the pure comparison
 * that holds this observation against that report.
 *
 * Observation alone does not claim that the viewer and capture agree. The
 * production capture path passes this record to the render-owned audit beside
 * the preflight report; that comparison records breaches and unchecked metrics
 * without turning this traversal into budget authority.
 *
 * Only DRAWN geometry counts. An object hidden by its own flag or by any
 * ancestor's submits nothing, and counting it would make a culled crowd look
 * like a budget breach; a chunked instance set starts every chunk hidden and
 * turns on what the frustum keeps, which is precisely the case that must not be
 * miscounted.
 *
 * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Counts the actual per-frame submissions this viewer can observe.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Supplies the observed side of the render-owned budget comparison.
 * @author Samchon
 */
export const observeAutoMovieSceneRender = (
  scene: THREE.Scene,
): IAutoMovieRenderObservation => {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const observation: IAutoMovieRenderObservation = {
    meshes: 0,
    drawCalls: 0,
    triangles: 0,
    materials: 0,
    textures: 0,
    lights: 0,
    shadowMaps: 0,
    instanceSlots: 0,
  };
  scene.traverse((object) => {
    if (!drawn(object)) return;
    const light = object as THREE.Light;
    if (light.isLight === true) {
      ++observation.lights;
      if (light.castShadow === true) ++observation.shadowMaps;
      return;
    }
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    ++observation.meshes;
    const bound = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of bound) {
      materials.add(material);
      for (const texture of texturesOf(material)) textures.add(texture);
    }
    const instanced = mesh as THREE.InstancedMesh;
    const copies = instanced.isInstancedMesh === true ? instanced.count : 1;
    if (instanced.isInstancedMesh === true)
      observation.instanceSlots += instanced.count;
    observation.drawCalls += bound.length;
    observation.triangles += triangleCount(mesh.geometry) * copies;
  });
  observation.materials = materials.size;
  observation.textures = textures.size;
  return observation;
};

/** Whether an object and every ancestor above it is visible. */
const drawn = (object: THREE.Object3D): boolean => {
  let current: THREE.Object3D | null = object;
  while (current !== null) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
};

const triangleCount = (geometry: THREE.BufferGeometry): number => {
  const index = geometry.getIndex();
  if (index !== null) return index.count / 3;
  const position = geometry.getAttribute("position");
  return position === undefined ? 0 : position.count / 3;
};

/** Every texture object one material binds. */
const texturesOf = (material: THREE.Material): THREE.Texture[] => {
  const found: THREE.Texture[] = [];
  for (const value of Object.values(
    material as unknown as Record<string, unknown>,
  )) {
    const texture = value as THREE.Texture | null;
    if (
      texture !== null &&
      (texture as THREE.Texture | undefined)?.isTexture === true
    )
      found.push(texture);
  }
  return found;
};
