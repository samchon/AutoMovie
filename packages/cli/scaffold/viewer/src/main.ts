import type {
  AutoMovieGuidePass,
  IAutoMovieCompiledShotSource,
} from "@automovie/interface";
import {
  AutoMoviePlayer,
  applyLightMotion,
  applyObjectMotion,
  applyObjectMotions,
  applyPose,
  applyRenderMode,
  buildModel,
  buildScene,
  mountViewer,
} from "@automovie/viewer";

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
const nodeObjects = new Map(
  compiled.scene.nodes.map((node, index) => {
    const object = scene.scene.children[index];
    if (object === undefined)
      throw new Error(`Scene node "${node.id}" has no built wrapper.`);
    return [node.id, object] as const;
  }),
);
const stagedNodeTransforms = new Map(
  [...nodeObjects].map(([id, object]) => [
    id,
    {
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
      scale: object.scale.clone(),
    },
  ]),
);

const performanceByNode = new Map(
  compiled.shot.performances.map((performance) => [
    performance.node,
    performance,
  ]),
);
const players = compiled.scene.nodes.flatMap((node) => {
  const performance = performanceByNode.get(node.id);
  const motionId = performance === undefined ? node.motion : performance.motion;
  if (motionId === null) return [];
  const target = built.find((item) => item.node.id === node.id);
  const motion = compiled.motions.find((item) => item.id === motionId);
  if (target === undefined || motion === undefined)
    throw new Error(`Motion for scene node "${node.id}" cannot be resolved.`);
  const skeleton = target.model.skeleton;
  if (skeleton === null)
    throw new Error(`Animated model "${target.model.id}" has no skeleton.`);
  return [
    {
      startOffset: performance?.startOffset ?? 0,
      player: new AutoMoviePlayer(target.object, skeleton, motion),
    },
  ];
});

const cameraIndex = compiled.scene.cameras.findIndex(
  (item) => item.id === compiled.shot.camera,
);
const camera = scene.cameras[cameraIndex < 0 ? 0 : cameraIndex];
if (camera === undefined) throw new Error("Compiled scene has no camera.");
const stagedCamera = {
  position: camera.position.clone(),
  quaternion: camera.quaternion.clone(),
  scale: camera.scale.clone(),
};
const mounted = mountViewer(canvas, scene.scene, camera, () => true, {
  antialias: false,
  pixelRatio: 1,
  preserveDrawingBuffer: true,
});
const renderer = mounted.renderer;
renderer.setClearColor(0x11151b, 1);

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
  for (const [id, transform] of stagedNodeTransforms) {
    const object = nodeObjects.get(id)!;
    object.position.copy(transform.position);
    object.quaternion.copy(transform.quaternion);
    object.scale.copy(transform.scale);
  }
  camera.position.copy(stagedCamera.position);
  camera.quaternion.copy(stagedCamera.quaternion);
  camera.scale.copy(stagedCamera.scale);
  for (const item of built)
    if (item.node.pose !== null && item.model.skeleton !== null)
      applyPose(item.object, item.node.pose, item.model.skeleton);
  for (const item of players)
    item.player.update(Math.max(0, time - item.startOffset));
  applyObjectMotions(compiled.shot.objectMotions, time, (node) =>
    nodeObjects.get(node),
  );
  if (compiled.shot.cameraMotion !== null)
    applyObjectMotion(compiled.shot.cameraMotion, time, (node) =>
      node === compiled.shot.camera ? camera : undefined,
    );
  applyLightMotion(
    compiled.scene.lights,
    compiled.shot.lightMotions ?? [],
    time,
    (light) => scene.lights.get(light),
  );
  const handle = applyRenderMode(scene.scene, pass);
  renderer.render(scene.scene, camera);
  handle.restore();
  status.textContent = `${compiled.shot.id}  t=${time.toFixed(3)}s  ${pass}`;
};

window.__automovieCapture = { ready: true, seek };
seek(0, "beauty");
