import * as THREE from "three";

/**
 * Prepare the decoded static face for the preview's shadowed lighting.
 * Transmissive optics pass light while opaque anatomy casts its silhouette;
 * both receive lighting. Groups and other non-mesh nodes remain untouched.
 * Resident textures use the supplied device anisotropy limit, capped at 16.
 * Zero denotes an unsupported device and falls back to isotropic filtering.
 * This preview sampler policy does not change exported texture or model bytes.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-editor Keeps the inspected face readable under orbiting view and shadowed material display.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-editor-view Applies device-bounded texture sampling and shadow policy without changing the saved anatomical document.
 */
export function prepareHumanPreview(
  group: THREE.Group,
  maxAnisotropy: number = 1,
): void {
  if (!Number.isFinite(maxAnisotropy) || maxAnisotropy < 0)
    throw new Error("Preview anisotropy limit must be finite and nonnegative.");
  const anisotropy = Math.max(1, Math.min(16, maxAnisotropy));
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    // Loader and consumer may resolve different Three.js module instances.
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      material.alphaToCoverage = material.alphaTest > 0;
      for (const value of Object.values(material))
        if (value?.isTexture === true) textures.add(value);
    }
    mesh.castShadow = !materials.some(
      (material) =>
        (material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial ===
          true && (material as THREE.MeshPhysicalMaterial).transmission > 0,
    );
    mesh.receiveShadow = true;
  });
  for (const texture of textures)
    if (texture.anisotropy !== anisotropy) {
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    }
}

/**
 * Release the geometry and finishes owned by one discarded decoded preview.
 * The scene owner removes a published group before releasing it; stale decoded
 * groups can be released without ever entering the visible scene.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-editor-state Releases renderer assets displaced by a successful edit or discarded after supersession.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-editor Keeps obsolete decoded resources from accumulating across editor transactions.
 */
export function disposeHumanPreview(group: THREE.Group): void {
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) {
      for (const value of Object.values(material))
        if (value?.isTexture === true) textures.add(value);
      material.dispose();
    }
  });
  for (const texture of textures) texture.dispose();
}

/**
 * Own camera presets and fitting independently from face identity and GPU IO.
 * The model getter supplies the currently displayed nonempty static group.
 * A sphere enclosing all three dimensions stays inside both perspective cones
 * at every orbit angle. Optical zoom, orbit limits and clipping planes follow
 * that same fit, including hair extending behind the cranial surface.
 * A collapsed viewport retains a finite projection until it becomes visible.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-editor Provides anatomical front, side and oblique camera positions and fits the current face without editing it.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-editor-view Separates orbit distance and viewport projection from the replay document and its expression.
 */
export function createHumanPreviewCamera(props: {
  camera: THREE.PerspectiveCamera;
  orbit: {
    target: THREE.Vector3;
    maxDistance?: number;
    update: () => unknown;
  };
  model: () => THREE.Group | undefined;
  setSize: (width: number, height: number) => void;
}) {
  const { camera, orbit } = props;
  let distance = 0.65;
  const cameraView = (degrees: number): void => {
    const radians = (degrees * Math.PI) / 180;
    camera.position.set(
      orbit.target.x + Math.sin(radians) * distance,
      orbit.target.y + 0.02,
      orbit.target.z + Math.cos(radians) * distance,
    );
    orbit.update();
  };
  const fitView = (): void => {
    const model = props.model();
    if (model === undefined) return;
    const bounds = new THREE.Box3().setFromObject(model);
    bounds.getCenter(orbit.target);
    const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
    const vertical = THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2);
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    distance = (1.1 * radius) / Math.sin(Math.min(vertical, horizontal));
    // OrbitControls clamps even an explicitly positioned camera during update.
    // An old zoom-out cap must not undo the fit before its first frame.
    orbit.maxDistance = Math.max(
      orbit.maxDistance ?? Infinity,
      Math.hypot(distance, 0.02),
    );
    camera.near = Math.min(0.01, (distance - radius) / 2);
    camera.far = Math.max(10, 2 * (distance + radius));
    camera.updateProjectionMatrix();
    cameraView(0);
  };
  const resize = (width: number, height: number): void => {
    props.setSize(width, height);
    camera.aspect = Math.max(1, width) / Math.max(1, height);
    camera.updateProjectionMatrix();
  };
  return { cameraView, fitView, resize };
}
