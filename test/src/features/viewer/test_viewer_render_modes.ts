import {
  DEPTH_NORMALIZATION_RANGE,
  EDGE_SHELL_NAME,
  EDGE_WIDTH,
  POSE_OVERLAY_NAME,
  applyRenderMode,
  buildModel,
  buildScene,
  maskColor,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

const buildTwoNodeScene = () => {
  const objects = new Map([
    ["model-a", buildModel({ ...createModel(), id: "model-a" })],
    ["model-b", buildModel({ ...createModel(), id: "model-b" })],
  ]);
  return buildScene(
    {
      id: "scene-1",
      name: null,
      nodes: [
        {
          id: "node-a",
          model: "model-a",
          transform: IDENTITY_TRANSFORM,
          motion: null,
          pose: null,
        },
        {
          id: "node-b",
          model: "model-b",
          transform: IDENTITY_TRANSFORM,
          motion: null,
          pose: null,
        },
      ],
      cameras: [],
      lights: [],
    },
    (id) => objects.get(id),
  );
};

const meshesOf = (root: THREE.Object3D): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh === true)
      meshes.push(object as THREE.Mesh);
  });
  return meshes;
};

/**
 * Guide-pass render modes are reversible scene overrides applied at snapshot
 * time: the deterministic engine result is never mutated, only its projection —
 * `restore()` puts every touched material, visibility flag, background, and
 * overlay back exactly as it was, so the same built scene captures pass after
 * pass.
 *
 * Scenarios:
 *
 * 1. `beauty` is a no-op: materials keep their exact instances.
 * 2. `depth` swaps every mesh to the normalized-metric depth shader (#1167) —
 *    grays linear over a scene-stable range decoupled from camera near/far
 *    (default 20 m, overridable) — on a black (far) background; restore returns
 *    the original instances and background.
 * 3. `normal` swaps to `MeshNormalMaterial` (the surface-normal hint, #1166).
 * 4. `outline` is a REAL edge pass (#1166): black fills plus one inverted-hull
 *    back-face shell per mesh (metric edge width, default overridable, skinning
 *    chunks compiled in) on a black background; restore removes the shells and
 *    returns everything.
 * 5. `mask` gives each top-level scene node a distinct deterministic flat color on
 *    a black background; restore returns materials and background.
 * 6. `pose` hides meshes and adds one line per bone→child-bone connection in a
 *    named overlay; restore removes the overlay and unhides.
 * 7. An unknown mode is a caller bug and throws.
 */
export const test_viewer_render_modes = (): void => {
  const { scene } = buildTwoNodeScene();
  const meshes = meshesOf(scene);
  const originals = meshes.map((mesh) => mesh.material);

  const beauty = applyRenderMode(scene, "beauty");
  TestValidator.predicate(
    "beauty leaves material instances untouched",
    meshes.every((mesh, i) => mesh.material === originals[i]),
  );
  beauty.restore();

  const backgroundBefore = scene.background;
  const depth = applyRenderMode(scene, "depth");
  TestValidator.predicate(
    "depth swaps every mesh to the normalized-metric shader",
    meshes.every(
      (mesh) =>
        mesh.material instanceof THREE.ShaderMaterial &&
        mesh.material.uniforms.depthRange!.value ===
          DEPTH_NORMALIZATION_RANGE &&
        mesh.material.fragmentShader.includes("vViewZ / depthRange"),
    ),
  );
  TestValidator.predicate(
    "depth deforms skinned meshes (skinning chunks compiled in)",
    meshes.every(
      (mesh) =>
        mesh.material instanceof THREE.ShaderMaterial &&
        mesh.material.vertexShader.includes("skinning_vertex"),
    ),
  );
  TestValidator.predicate(
    "depth renders over a black (far) background",
    scene.background instanceof THREE.Color &&
      scene.background.getHex() === 0x000000,
  );
  depth.restore();
  TestValidator.predicate(
    "depth restore returns the original instances",
    meshes.every((mesh, i) => mesh.material === originals[i]),
  );
  TestValidator.equals(
    "depth restore returns the background",
    scene.background,
    backgroundBefore,
  );

  const customRange = applyRenderMode(scene, "depth", { depthRange: 8 });
  TestValidator.predicate(
    "an explicit depthRange overrides the default",
    meshes.every(
      (mesh) =>
        mesh.material instanceof THREE.ShaderMaterial &&
        mesh.material.uniforms.depthRange!.value === 8,
    ),
  );
  customRange.restore();

  const normal = applyRenderMode(scene, "normal");
  TestValidator.predicate(
    "normal swaps to the surface-normal material",
    meshes.every((mesh) => mesh.material instanceof THREE.MeshNormalMaterial),
  );
  normal.restore();

  const outlineBackground = scene.background;
  const outline = applyRenderMode(scene, "outline");
  TestValidator.predicate(
    "outline fills every mesh black",
    meshes.every(
      (mesh) =>
        mesh.material instanceof THREE.MeshBasicMaterial &&
        mesh.material.color.getHex() === 0x000000,
    ),
  );
  const shells = meshesOf(scene).filter((m) => m.name === EDGE_SHELL_NAME);
  TestValidator.equals(
    "outline adds one inverted-hull shell per mesh",
    shells.length,
    meshes.length,
  );
  TestValidator.predicate(
    "shells push outward by the metric edge width, back-face, skinned-aware",
    shells.every(
      (shell) =>
        shell.material instanceof THREE.ShaderMaterial &&
        shell.material.side === THREE.BackSide &&
        shell.material.uniforms.edgeWidth!.value === EDGE_WIDTH &&
        shell.material.vertexShader.includes("skinning_vertex"),
    ),
  );
  TestValidator.predicate(
    "outline renders over a black background",
    scene.background instanceof THREE.Color &&
      scene.background.getHex() === 0x000000,
  );
  outline.restore();
  TestValidator.predicate(
    "outline restore removes shells and returns materials and background",
    meshesOf(scene).every((m) => m.name !== EDGE_SHELL_NAME) &&
      meshes.every((mesh, i) => mesh.material === originals[i]) &&
      scene.background === outlineBackground,
  );

  const wideEdge = applyRenderMode(scene, "outline", { edgeWidth: 0.05 });
  TestValidator.predicate(
    "an explicit edgeWidth overrides the default",
    meshesOf(scene)
      .filter((m) => m.name === EDGE_SHELL_NAME)
      .every(
        (shell) =>
          shell.material instanceof THREE.ShaderMaterial &&
          shell.material.uniforms.edgeWidth!.value === 0.05,
      ),
  );
  wideEdge.restore();

  const background = scene.background;
  const mask = applyRenderMode(scene, "mask");
  const maskMaterials = meshes.map(
    (mesh) => mesh.material as THREE.MeshBasicMaterial,
  );
  TestValidator.predicate(
    "mask uses flat unlit materials",
    maskMaterials.every(
      (material) => material instanceof THREE.MeshBasicMaterial,
    ),
  );
  TestValidator.predicate(
    "mask colors differ between the two nodes",
    maskMaterials[0]!.color.getHex() !== maskMaterials[1]!.color.getHex(),
  );
  TestValidator.equals(
    "mask palette is deterministic by node index",
    maskMaterials[0]!.color.getHex(),
    maskColor(0).getHex(),
  );
  TestValidator.equals(
    "mask blacks out the background",
    (scene.background as THREE.Color).getHex(),
    0x000000,
  );
  mask.restore();
  TestValidator.predicate(
    "mask restore returns materials and background",
    meshes.every((mesh, i) => mesh.material === originals[i]) &&
      scene.background === background,
  );

  const pose = applyRenderMode(scene, "pose");
  TestValidator.predicate(
    "pose hides every mesh",
    meshes.every((mesh) => mesh.visible === false),
  );
  const overlay = scene.getObjectByName(POSE_OVERLAY_NAME);
  if (overlay === undefined) throw new Error("pose overlay must exist");
  TestValidator.equals(
    "one line per bone with a bone parent, per node",
    overlay.children.length,
    22,
  );
  pose.restore();
  TestValidator.predicate(
    "pose restore removes the overlay and unhides",
    scene.getObjectByName(POSE_OVERLAY_NAME) === undefined &&
      meshes.every((mesh) => mesh.visible === true),
  );

  TestValidator.predicate(
    "unknown mode throws",
    throwsError(
      () => applyRenderMode(scene, "sketch" as never),
      'unknown render mode "sketch"',
    ),
  );
};
