import { AutoMovieGuidePass } from "@automovie/interface";
import * as THREE from "three";

/**
 * A reversible render-mode override. `restore()` puts every touched material,
 * visibility flag, background, and overlay back exactly as it was, so the same
 * built scene can be captured pass after pass without rebuilding — the
 * deterministic engine result is never mutated, only its projection.
 *
 * `restore()` also **disposes every resource the override created** (override
 * materials, the pose overlay's line geometries and material) — a guide-pass
 * render applies and restores once per frame per pass, so an hour of film would
 * otherwise leak tens of thousands of WebGL materials. Borrowed originals are
 * never disposed; they belong to the scene. Restoring twice is safe: the second
 * call is a no-op, so nothing double-disposes.
 */
export interface IAutoMovieRenderModeHandle {
  /** The pass this override draws. */
  mode: AutoMovieGuidePass;

  /** Undo the override completely. Idempotent. */
  restore: () => void;
}

/** Run `fn` on the first call only — the restore idempotence guard. */
const once = (fn: () => void): (() => void) => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    fn();
  };
};

/** A renderable that is NOT a mesh: a line/grid/helper, points, or a sprite. */
const isNonMeshRenderable = (object: THREE.Object3D): boolean =>
  (object as THREE.Line).isLine === true ||
  (object as THREE.Points).isPoints === true ||
  (object as THREE.Sprite).isSprite === true;

/**
 * Hide every currently-visible non-mesh renderable in the scene (grids and
 * other `LineSegments`/`Line` helpers, `Points`, `Sprite`s) and return a
 * restore that makes them visible again. A structural guide pass segments only
 * the subject MESH geometry, so any non-mesh renderable left visible would draw
 * its live beauty material over the pass's black background — a grid reading as
 * "very close" in the depth pass, a non-palette color in the mask, a stray line
 * beside the skeleton in the pose pass (#1226). Hidden BEFORE a pass builds its
 * own overlay (the pose skeleton is itself `LineSegments`), so that overlay,
 * added afterward, stays visible.
 */
const hideNonMeshRenderables = (scene: THREE.Scene): (() => void) => {
  const hidden: THREE.Object3D[] = [];
  scene.traverse((object) => {
    if (isNonMeshRenderable(object) && object.visible) {
      object.visible = false;
      hidden.push(object);
    }
  });
  return () => {
    for (const object of hidden) object.visible = true;
  };
};

/**
 * Apply one diffusion-guide render mode to a built scene, returning the restore
 * handle. The override is applied at snapshot time and reversed right after, so
 * the viewer stays a thin projection of the engine result:
 *
 * - `beauty` — no override (the ordinary shaded render).
 * - `depth` — every mesh swapped to a normalized-metric depth shader (#1167):
 *   grays linear in camera-space distance over a scene-stable range
 *   ({@link DEPTH_NORMALIZATION_RANGE}, overridable) instead of the camera's
 *   near/far clip planes, so the same world depth reads the same gray across
 *   shots, cuts, and chunks; black background = infinitely far.
 * - `mask` — each top-level scene child gets its own flat unlit color
 *   (deterministic golden-angle palette by child index) on a black background:
 *   the per-node segmentation pass.
 * - `normal` — every mesh swapped to `MeshNormalMaterial`: the unlit
 *   surface-normal conditioning pass (#1166).
 * - `outline` — REAL silhouette edges (#1166): black fills plus inverted-hull
 *   back-face shells offset {@link EDGE_WIDTH} meters along their normals,
 *   leaving white contour lines on a black background — no host
 *   post-processing.
 * - `pose` — meshes hidden, and a line-segment overlay of every bone→child bone
 *   connection drawn over a black background: the skeleton pose pass.
 *
 * An unknown mode is a caller bug and throws.
 *
 * `options` (`depthRange`, `edgeWidth`) is an escape hatch for a direct embedder
 * tuning the passes to an unusual scene. The bundled capture path (`__afPass`)
 * deliberately omits it: a screenshot pass reads the same world depth as the same
 * gray only when the normalization range is a scene-stable constant, so the
 * capture side is fixed to the defaults on purpose (#1167). A scene whose depth
 * of interest exceeds {@link DEPTH_NORMALIZATION_RANGE} would clamp to black past
 * that range in the bundled capture — override via a direct call, not the hook.
 *
 * @author Samchon
 */
export const applyRenderMode = (
  scene: THREE.Scene,
  mode: AutoMovieGuidePass,
  options?: {
    /**
     * Metric range (m) the depth pass normalizes onto. Defaults to
     * {@link DEPTH_NORMALIZATION_RANGE} (20). Direct callers only — the capture
     * path keeps the scene-stable default (see above).
     */
    depthRange?: number;

    /**
     * Silhouette edge width (m) of the outline pass. Defaults to
     * {@link EDGE_WIDTH} (0.02). Direct callers only — the capture path keeps the
     * default.
     */
    edgeWidth?: number;
  },
): IAutoMovieRenderModeHandle => {
  if (mode === "beauty") return { mode, restore: () => {} };
  // Resolve (and validate) the structural pass builder BEFORE touching the
  // scene, so an unknown mode throws without leaving anything hidden.
  const build = ((): (() => IAutoMovieRenderModeHandle) => {
    switch (mode) {
      case "depth":
        return () =>
          applyDepthMode(
            scene,
            options?.depthRange ?? DEPTH_NORMALIZATION_RANGE,
          );
      case "normal":
        return () =>
          overrideMaterials(scene, mode, () => new THREE.MeshNormalMaterial());
      case "outline":
        return () => applyEdgeMode(scene, options?.edgeWidth ?? EDGE_WIDTH);
      case "mask":
        return () => applyMaskMode(scene);
      case "pose":
        return () => applyPoseMode(scene);
      default:
        throw new Error(`unknown render mode "${String(mode)}"`);
    }
  })();
  // A structural pass renders only the subject mesh geometry: hide every
  // non-mesh renderable first (#1226), then build the pass (whose own overlay,
  // if any, is added afterward and stays visible). Restore reverses both.
  const restoreRenderables = hideNonMeshRenderables(scene);
  const handle = build();
  return {
    mode,
    restore: once(() => {
      handle.restore();
      restoreRenderables();
    }),
  };
};

/**
 * The deterministic flat color of mask index `i`: golden-angle hue stepping,
 * full saturation, mid lightness — adjacent nodes land far apart on the hue
 * wheel, and the same scene always gets the same colors.
 */
export const maskColor = (index: number): THREE.Color =>
  new THREE.Color().setHSL(((index * 137.508) % 360) / 360, 1, 0.5);

/**
 * Metric range (meters) the depth pass normalizes onto (#1167). Depth grays are
 * LINEAR in camera-space distance over `[0, range]` — white at the lens, black
 * at `range` and beyond — and deliberately decoupled from the camera's near/far
 * clip planes, so the same world depth maps to the same gray across shots,
 * cuts, and chunks (per-camera clip planes vary; this range does not).
 */
export const DEPTH_NORMALIZATION_RANGE = 20;

/**
 * A depth material normalized on a scene-stable metric range instead of the
 * camera's clip planes. The vertex stage includes three's skinning chunks (a
 * plain rigid mesh compiles them out; a `SkinnedMesh` deforms correctly), so
 * the depth of a posed skinned character is the deformed surface's, not the
 * bind pose's.
 */
const makeNormalizedDepthMaterial = (range: number): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    uniforms: { depthRange: { value: range } },
    vertexShader: `
      #include <common>
      #include <skinning_pars_vertex>
      varying float vViewZ;
      void main() {
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vViewZ = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: `
      uniform float depthRange;
      varying float vViewZ;
      void main() {
        float gray = clamp(1.0 - vViewZ / depthRange, 0.0, 1.0);
        gl_FragColor = vec4(vec3(gray), 1.0);
      }`,
  });

/**
 * Depth pass: every mesh renders its normalized metric depth over a black
 * (infinitely far) background.
 */
const applyDepthMode = (
  scene: THREE.Scene,
  range: number,
): IAutoMovieRenderModeHandle => {
  const background = scene.background;
  scene.background = new THREE.Color(0x000000);
  const materials = overrideMaterials(scene, "depth", () =>
    makeNormalizedDepthMaterial(range),
  );
  return {
    mode: "depth",
    restore: once(() => {
      materials.restore();
      scene.background = background;
    }),
  };
};

/**
 * Metric silhouette edge width (meters) of the outline pass (#1166) — the
 * inverted-hull shell's normal offset. Metric (not a scale factor) so a thin
 * limb and a broad torso draw the same line weight.
 */
export const EDGE_WIDTH = 0.02;

/** Name of the transient shell group the outline pass adds to the scene. */
export const EDGE_SHELL_NAME = "__automovie_edge_shells";

/**
 * The inverted-hull shell material: geometry pushed outward along its normals
 * by `edgeWidth` meters and drawn back-face-only in white, so wherever the
 * front-facing black fill does not cover it, a contour line remains. The vertex
 * stage includes three's skinning chunks, so a posed `SkinnedMesh` outlines its
 * deformed surface.
 */
const makeEdgeShellMaterial = (edgeWidth: number): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { edgeWidth: { value: edgeWidth } },
    vertexShader: `
      #include <common>
      #include <skinning_pars_vertex>
      uniform float edgeWidth;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        transformed += normalize(objectNormal) * edgeWidth;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }`,
    fragmentShader: `
      void main() {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      }`,
  });

/**
 * Outline pass (#1166): REAL silhouette edges, white on black, no host
 * post-processing. Classic inverted hull — every mesh gets a back-face shell
 * expanded `edgeWidth` meters along its normals, the mesh itself fills black,
 * and the black background swallows everything else, leaving white contour
 * lines where the shell peeks past the fill.
 */
const applyEdgeMode = (
  scene: THREE.Scene,
  edgeWidth: number,
): IAutoMovieRenderModeHandle => {
  const background = scene.background;
  scene.background = new THREE.Color(0x000000);
  const shellMaterial = makeEdgeShellMaterial(edgeWidth);
  const fill = overrideMaterials(
    scene,
    "outline",
    () => new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  // Shells clone each mesh shallowly (same geometry, same local transform —
  // a SkinnedMesh clone shares its skeleton, so the shell follows the pose)
  // under the mesh's own parent, grouped by name for a recognizable scene.
  const shells: THREE.Object3D[] = [];
  for (const mesh of collectMeshes(scene)) {
    const shell = mesh.clone(false) as MeshLike;
    shell.name = EDGE_SHELL_NAME;
    shell.material = shellMaterial;
    mesh.parent!.add(shell);
    shells.push(shell);
  }
  return {
    mode: "outline",
    restore: once(() => {
      for (const shell of shells) shell.parent!.remove(shell);
      shellMaterial.dispose();
      fill.restore();
      scene.background = background;
    }),
  };
};

type MeshLike = THREE.Mesh & {
  material: THREE.Material | THREE.Material[];
};

const isMeshLike = (object: THREE.Object3D): object is MeshLike =>
  (object as THREE.Mesh).isMesh === true;

/**
 * Swap every mesh material for `make()`'s, restoring the originals and
 * disposing the created overrides.
 */
const overrideMaterials = (
  scene: THREE.Scene,
  mode: AutoMovieGuidePass,
  make: () => THREE.Material,
): IAutoMovieRenderModeHandle => {
  const swaps = collectMeshes(scene).map((mesh) => {
    const original = mesh.material;
    const override = make();
    mesh.material = override;
    return { mesh, original, override };
  });
  return {
    mode,
    restore: once(() => {
      for (const { mesh, original, override } of swaps) {
        mesh.material = original;
        override.dispose();
      }
    }),
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
  const created: THREE.Material[] = [];
  scene.children.forEach((child, index) => {
    const meshes = collectMeshes(child);
    // Create only for mesh-bearing children (a camera/light child would leak
    // an unassigned material); the palette index stays the CHILD index, so the
    // deterministic node→color mapping is unchanged.
    if (meshes.length === 0) return;
    const material = new THREE.MeshBasicMaterial({ color: maskColor(index) });
    created.push(material);
    for (const mesh of meshes) {
      originals.push({ mesh, material: mesh.material });
      mesh.material = material;
    }
  });
  return {
    mode: "mask",
    restore: once(() => {
      for (const { mesh, material } of originals) mesh.material = material;
      for (const material of created) material.dispose();
      scene.background = background;
    }),
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
    restore: once(() => {
      scene.remove(overlay);
      for (const child of overlay.children)
        (child as THREE.Line).geometry.dispose();
      material.dispose();
      for (const { mesh, visible } of hidden) mesh.visible = visible;
      scene.background = background;
    }),
  };
};

const collectMeshes = (root: THREE.Object3D): MeshLike[] => {
  const meshes: MeshLike[] = [];
  root.traverse((object) => {
    if (isMeshLike(object)) meshes.push(object);
  });
  return meshes;
};
