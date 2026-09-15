import type { JSONDocument } from "@gltf-transform/core";
import * as THREE from "three";

import { createHumanPreviewBuilder } from "./previewBuilder";
import {
  createHumanPreviewCamera,
  disposeHumanPreview,
  prepareHumanPreview,
} from "./previewScene";

type BuiltFace = {
  group: THREE.Group;
  glb: Uint8Array<ArrayBuffer>;
  gltf: JSONDocument;
  parts: number;
};
/**
 * Own the face preview scene and publication through explicit browser IO ports.
 * Geometry, lighting, camera and frame state remain ordinary in-memory objects;
 * the host alone allocates the GPU, controls, decoder, worker and resize observer.
 * A manual finish draws the same current display state as the animation loop.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-editor Presents orbitable anatomical previews and clay without changing the numerical document.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-editor-state Publishes a completed preview while releasing the previously displayed geometry.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-editor-view Owns lighting, display-only clay and camera state independently of browser allocation.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-editor Delegates worker generation isolation to the preview builder and disposes discarded decoded assets.
 */
export function createHumanViewport(props: {
  canvas: { getBoundingClientRect: () => Pick<DOMRect, "width" | "height"> };
  pixelRatio: number;
  renderer: {
    capabilities: Pick<THREE.WebGLCapabilities, "getMaxAnisotropy">;
    setPixelRatio: (ratio: number) => void;
    outputColorSpace: string;
    toneMapping: THREE.ToneMapping;
    toneMappingExposure: number;
    shadowMap: Pick<THREE.WebGLShadowMap, "enabled" | "type">;
    setSize: (width: number, height: number, updateStyle: boolean) => void;
    setAnimationLoop: (callback: () => void) => void;
    render: (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => void;
    getContext: () => {
      finish: () => void;
      getExtension: (
        name: string,
      ) => { UNMASKED_RENDERER_WEBGL: number } | null;
      getParameter: (parameter: number) => unknown;
      RENDERER: number;
    };
  };
  orbit: (camera: THREE.PerspectiveCamera) => {
    target: THREE.Vector3;
    enableDamping: boolean;
    minDistance: number;
    maxDistance: number;
    update: () => unknown;
  };
  worker: Parameters<typeof createHumanPreviewBuilder<BuiltFace>>[0]["worker"];
  decode: (bytes: ArrayBuffer) => Promise<THREE.Group>;
  observeResize: (callback: () => void) => void;
}) {
  const { renderer, canvas } = props;
  renderer.setPixelRatio(Math.min(props.pixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c252e);
  scene.add(new THREE.HemisphereLight(0xffeee2, 0x526578, 0.5));
  for (const [x, y, z, power, color] of [
    [-0.3, 0.35, 0.45, 2.3, 0xffe9d8],
    [0.35, 0.1, 0.3, 0.85, 0xdaeaff],
    [0.1, 0.3, -0.25, 1.6, 0xffffff],
  ]) {
    const light = new THREE.DirectionalLight(color, power);
    light.position.set(x, y, z);
    scene.add(light);
    if (x < 0) {
      light.castShadow = true;
      light.shadow.mapSize.set(4096, 4096);
      Object.assign(light.shadow.camera, {
        left: -0.2,
        right: 0.2,
        top: 0.2,
        bottom: -0.2,
        near: 0.01,
        far: 2,
      });
      light.shadow.normalBias = 0.0008;
      light.shadow.bias = -0.00005;
      light.shadow.camera.updateProjectionMatrix();
    }
  }
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
  const orbit = props.orbit(camera);
  orbit.target.set(0, -0.015, 0);
  orbit.enableDamping = true;
  orbit.minDistance = 0.12;
  orbit.maxDistance = 2;
  const clay = new THREE.MeshStandardMaterial({
    color: 0x999999,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });
  let active: BuiltFace | undefined;
  let clayEnabled = false;
  const dispose = disposeHumanPreview;
  const { build, cancel } = createHumanPreviewBuilder<BuiltFace>({
    worker: props.worker,
    decode: async (result) => {
      const group = await props.decode(
        result.glb.buffer.slice(
          result.glb.byteOffset,
          result.glb.byteOffset + result.glb.byteLength,
        ),
      );
      try {
        prepareHumanPreview(group, renderer.capabilities.getMaxAnisotropy());
      } catch (error) {
        disposeHumanPreview(group);
        throw error;
      }
      return { ...result, group };
    },
    dispose: (model) => dispose(model.group),
  });
  const {
    cameraView,
    fitView,
    resize: resizeCamera,
  } = createHumanPreviewCamera({
    camera,
    orbit,
    model: () => active?.group,
    setSize: (width, height) => renderer.setSize(width, height, false),
  });
  cameraView(0);
  const publish = (built: BuiltFace): void => {
    if (active !== built) {
      if (active !== undefined) {
        scene.remove(active.group);
        dispose(active.group);
      }
      active = built;
      scene.add(built.group);
    }
  };
  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    resizeCamera(rect.width, rect.height);
  };
  props.observeResize(resize);
  resize();
  const render = (): void => {
    orbit.update();
    scene.overrideMaterial = clayEnabled ? clay : null;
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(render);

  return {
    build,
    cancel,
    publish,
    dispose: (model: BuiltFace) => dispose(model.group),
    fitView,
    cameraView,
    setClay: (enabled: boolean): void => {
      clayEnabled = enabled;
    },
    finish: () => {
      render();
      renderer.getContext().finish();
    },
    renderer: () => {
      const gl = renderer.getContext(),
        extension = gl.getExtension("WEBGL_debug_renderer_info");
      return gl.getParameter(extension?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER);
    },
  };
}
