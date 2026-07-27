import type {
  AutoMovieGuidePass,
  IAutoMovieCompiledShotSource,
} from "@automovie/interface";
import {
  AutoMoviePlayer,
  applyRenderMode,
  buildModel,
  buildScene,
} from "@automovie/viewer";
import * as THREE from "three";

interface IAutoMovieCaptureHook {
  ready: boolean;
  seek: (time: number, pass: AutoMovieGuidePass) => void;
}

declare global {
  interface Window {
    __automovieCapture?: IAutoMovieCaptureHook;
  }
}

const canvas = document.querySelector<HTMLCanvasElement>("#view");
const status = document.querySelector<HTMLDivElement>("#status");
if (canvas === null || status === null)
  throw new Error("The viewer document is missing #view or #status.");

const parameters = new URLSearchParams(window.location.search);
const shotId = parameters.get("shot") ?? "opening";
const response = await fetch(
  `/__automovie/shots/${encodeURIComponent(shotId)}.json`,
);
if (response.ok === false)
  throw new Error(
    `Compiled shot "${shotId}" is unavailable (${response.status}). Run pnpm compile.`,
  );
const compiled = (await response.json()) as IAutoMovieCompiledShotSource;
const models = new Map(compiled.models.map((model) => [model.id, model]));
const built = compiled.scene.nodes.map((node) => {
  const model = models.get(node.model);
  if (model === undefined)
    throw new Error(`Scene node "${node.id}" references "${node.model}".`);
  return { node, model, object: buildModel(model) };
});
let cursor = 0;
const scene = buildScene(compiled.scene, (modelId) => {
  const candidate = built[cursor++];
  if (candidate?.model.id !== modelId)
    throw new Error(`Scene build order disagrees at model "${modelId}".`);
  return candidate.object;
});
scene.scene.background = new THREE.Color(0x11151b);

const players = compiled.shot.performances.flatMap((performance) => {
  if (performance.motion === null) return [];
  const target = built.find((item) => item.node.id === performance.node);
  const motion = compiled.motions.find(
    (item) => item.id === performance.motion,
  );
  if (target === undefined || motion === undefined)
    throw new Error(`Performance "${performance.node}" cannot be resolved.`);
  const skeleton = target.model.skeleton;
  if (skeleton === null)
    throw new Error(`Animated model "${target.model.id}" has no skeleton.`);
  return [
    {
      startOffset: performance.startOffset,
      player: new AutoMoviePlayer(target.object, skeleton, motion),
    },
  ];
});

const cameraIndex = compiled.scene.cameras.findIndex(
  (item) => item.id === compiled.shot.camera,
);
const camera = scene.cameras[cameraIndex < 0 ? 0 : cameraIndex];
if (camera === undefined) throw new Error("Compiled scene has no camera.");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;

const resize = (): void => {
  const width = Math.max(1, Math.round(window.innerWidth));
  const height = Math.max(1, Math.round(window.innerHeight));
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
};
resize();
window.addEventListener("resize", resize);

const seek = (time: number, pass: AutoMovieGuidePass): void => {
  for (const item of players)
    item.player.update(Math.max(0, time - item.startOffset));
  const handle = applyRenderMode(scene.scene, pass);
  renderer.render(scene.scene, camera);
  handle.restore();
  status.textContent = `${compiled.shot.id}  t=${time.toFixed(3)}s  ${pass}`;
};

window.__automovieCapture = { ready: true, seek };
seek(0, "beauty");
