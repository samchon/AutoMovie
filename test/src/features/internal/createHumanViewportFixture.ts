import { createHumanViewport } from "@automovie/playground/src/human/viewport";
import * as THREE from "three";

type Options = Parameters<typeof createHumanViewport>[0];
type Worker = ReturnType<Options["worker"]>;

/** Browser IO ports retain actual Three.js scene objects without allocating a GPU or worker. */
export function createHumanViewportFixture(
  options: {
    pixelRatio?: number;
    decode?: Options["decode"];
  } = {},
) {
  const events: string[] = [];
  const dimensions = { width: 640, height: 480 };
  const sizes: number[][] = [];
  const ratios: number[] = [];
  const parameters: number[] = [];
  const extensions: string[] = [];
  const decoded: ArrayBuffer[] = [];
  const workers: (Worker & { sent: string[]; terminations: number })[] = [];
  const frames: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    clay: THREE.Material | null;
  }[] = [];
  let resize!: () => void;
  let frame!: () => void;
  let camera!: THREE.PerspectiveCamera;
  const state: {
    extension: { UNMASKED_RENDERER_WEBGL: number } | null;
    group: THREE.Group;
  } = {
    extension: { UNMASKED_RENDERER_WEBGL: 37446 },
    group: new THREE.Group(),
  };
  const orbit = {
    target: new THREE.Vector3(),
    enableDamping: false,
    minDistance: 0,
    maxDistance: Infinity,
    update: () => {
      events.push("orbit");
      camera.lookAt(orbit.target);
    },
  };
  const renderer: Options["renderer"] = {
    setPixelRatio: (ratio) => {
      ratios.push(ratio);
    },
    outputColorSpace: THREE.LinearSRGBColorSpace,
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 0,
    shadowMap: { enabled: false, type: THREE.BasicShadowMap },
    setSize: (width, height, updateStyle) => {
      sizes.push([width, height, Number(updateStyle)]);
    },
    setAnimationLoop: (callback) => {
      frame = callback;
    },
    render: (scene, camera) => {
      events.push("render");
      frames.push({ scene, camera, clay: scene.overrideMaterial });
    },
    getContext: () => ({
      finish: () => {
        events.push("finish");
      },
      getExtension: (name) => {
        extensions.push(name);
        return state.extension;
      },
      getParameter: (parameter) => {
        parameters.push(parameter);
        return `renderer-${parameter}`;
      },
      RENDERER: 7937,
    }),
  };
  const viewport = createHumanViewport({
    canvas: { getBoundingClientRect: () => ({ ...dimensions }) },
    pixelRatio: options.pixelRatio ?? 3,
    renderer,
    orbit: (value) => {
      camera = value;
      return orbit;
    },
    worker: () => {
      const worker = {
        onError: (_message: string): void => {},
        onReply: (_reply: Parameters<Worker["onReply"]>[0]): void => {},
        sent: [] as string[],
        terminations: 0,
        send: (text: string) => {
          worker.sent.push(text);
        },
        terminate: () => {
          worker.terminations++;
        },
      };
      workers.push(worker);
      return worker;
    },
    decode: async (bytes) => {
      decoded.push(bytes);
      return options.decode ? options.decode(bytes) : state.group;
    },
    observeResize: (callback) => {
      resize = callback;
    },
  });
  return {
    viewport,
    renderer,
    orbit,
    state,
    events,
    frames,
    dimensions,
    sizes,
    ratios,
    parameters,
    extensions,
    decoded,
    workers,
    resize: () => resize(),
    frame: () => frame(),
    camera: () => camera,
  };
}

/** A small decoded asset exposes disposal events independently of the face builder. */
export function createHumanViewportAsset() {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.2, 0.3),
    new THREE.MeshStandardMaterial(),
  );
  group.add(mesh);
  const released = { geometry: 0, material: 0 };
  mesh.geometry.addEventListener("dispose", () => {
    released.geometry++;
  });
  mesh.material.addEventListener("dispose", () => {
    released.material++;
  });
  const glb = new Uint8Array([99, 7, 8, 99]).subarray(1, 3);
  const gltf = { json: { asset: { version: "2.0" } }, resources: {} };
  return { model: { group, glb, gltf, parts: 1 }, mesh, released };
}
