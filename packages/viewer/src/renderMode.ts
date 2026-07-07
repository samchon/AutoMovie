import { AutoMovieGuidePass } from "@automovie/interface";
import * as THREE from "three";

/**
 * A reversible render-mode override. `restore()` puts every touched material,
 * visibility flag, background, and overlay back exactly as it was, so the same
 * built scene can be captured pass after pass without rebuilding — the
 * deterministic engine result is never mutated, only its projection.
 */
export interface IAutoMovieRenderModeHandle {
  /** The pass this override draws. */
  mode: AutoMovieGuidePass;

  /** Undo the override completely. */
  restore: () => void;
}

/**
 * Apply one diffusion-guide render mode to a built scene, returning the restore
 * handle. The override is applied at snapshot time and reversed right after, so
 * the viewer stays a thin projection of the engine result:
 *
 * - `beauty` — no override (the ordinary shaded render).
 * - `depth` — every mesh swapped to `MeshDepthMaterial` (near bright, far dark
 *   within the camera range).
 * - `mask` — each top-level scene child gets its own flat unlit color
 *   (deterministic golden-angle palette by child index) on a black background:
 *   the per-node segmentation pass.
 * - `outline` — every mesh swapped to `MeshNormalMaterial`: the normal-based edge
 *   source (line extraction is a cheap host post-process; a true vector outline
 *   pass is a later refinement).
 * - `pose` — meshes hidden, and a line-segment overlay of every bone→child bone
 *   connection drawn over a black background: the skeleton pose pass.
 *
 * An unknown mode is a caller bug and throws.
 *
 * @author Samchon
 */
export const applyRenderMode = (
  scene: THREE.Scene,
  mode: AutoMovieGuidePass,
): IAutoMovieRenderModeHandle => {
  switch (mode) {
    case "beauty":
      return { mode, restore: () => {} };
    case "depth":
      return overrideMaterials(
        scene,
        mode,
        () => new THREE.MeshDepthMaterial(),
      );
    case "outline":
      return overrideMaterials(
        scene,
        mode,
        () => new THREE.MeshNormalMaterial(),
      );
    case "mask":
      return applyMaskMode(scene);
    case "pose":
      return applyPoseMode(scene);
    default:
      throw new Error(`unknown render mode "${String(mode)}"`);
  }
};

/**
 * The deterministic flat color of mask index `i`: golden-angle hue stepping,
 * full saturation, mid lightness — adjacent nodes land far apart on the hue
 * wheel, and the same scene always gets the same colors.
 */
export const maskColor = (index: number): THREE.Color =>
  new THREE.Color().setHSL(((index * 137.508) % 360) / 360, 1, 0.5);

type MeshLike = THREE.Mesh & {
  material: THREE.Material | THREE.Material[];
};

const isMeshLike = (object: THREE.Object3D): object is MeshLike =>
  (object as THREE.Mesh).isMesh === true;

/** Swap every mesh material for `make()`'s, restoring the originals. */
const overrideMaterials = (
  scene: THREE.Scene,
  mode: AutoMovieGuidePass,
  make: () => THREE.Material,
): IAutoMovieRenderModeHandle => {
  const originals = collectMeshes(scene).map((mesh) => {
    const material = mesh.material;
    mesh.material = make();
    return { mesh, material };
  });
  return {
    mode,
    restore: () => {
      for (const { mesh, material } of originals) mesh.material = material;
    },
  };
};

/** Per-top-level-node flat colors on a black background. */
const applyMaskMode = (scene: THREE.Scene): IAutoMovieRenderModeHandle => {
  const background = scene.background;
  scene.background = new THREE.Color(0x000000);
  const originals: Array<{
    mesh: MeshLike;
    material: THREE.Material | THREE.Material[];
  }> = [];
  scene.children.forEach((child, index) => {
    const material = new THREE.MeshBasicMaterial({ color: maskColor(index) });
    for (const mesh of collectMeshes(child)) {
      originals.push({ mesh, material: mesh.material });
      mesh.material = material;
    }
  });
  return {
    mode: "mask",
    restore: () => {
      for (const { mesh, material } of originals) mesh.material = material;
      scene.background = background;
    },
  };
};

/** Name of the transient overlay group the pose pass adds to the scene. */
export const POSE_OVERLAY_NAME = "__automovie_pose_overlay";

/** Hide meshes and draw bone→child-bone segments over a black background. */
const applyPoseMode = (scene: THREE.Scene): IAutoMovieRenderModeHandle => {
  const background = scene.background;
  scene.background = new THREE.Color(0x000000);
  const hidden = collectMeshes(scene).map((mesh) => {
    const visible = mesh.visible;
    mesh.visible = false;
    return { mesh, visible };
  });

  scene.updateWorldMatrix(true, true);
  const overlay = new THREE.Group();
  overlay.name = POSE_OVERLAY_NAME;
  const material = new THREE.LineBasicMaterial({ color: 0xffffff });
  scene.traverse((object) => {
    const bone = object as THREE.Bone;
    if (bone.isBone !== true) return;
    const parent = bone.parent as THREE.Bone | null;
    if (parent === null || parent.isBone !== true) return;
    const from = new THREE.Vector3().setFromMatrixPosition(parent.matrixWorld);
    const to = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    overlay.add(new THREE.Line(geometry, material));
  });
  scene.add(overlay);

  return {
    mode: "pose",
    restore: () => {
      scene.remove(overlay);
      for (const { mesh, visible } of hidden) mesh.visible = visible;
      scene.background = background;
    },
  };
};

const collectMeshes = (root: THREE.Object3D): MeshLike[] => {
  const meshes: MeshLike[] = [];
  root.traverse((object) => {
    if (isMeshLike(object)) meshes.push(object);
  });
  return meshes;
};
