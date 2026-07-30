import type { AutoMovieGuidePass, IAutoMovieModel } from "@automovie/interface";
import { applyRenderMode, buildModel, mountViewer } from "@automovie/viewer";
import * as THREE from "three";

import { viewerDocument } from "./viewerDocument";

const { canvas, status } = viewerDocument();
const parameters = new URLSearchParams(window.location.search);
const assetId = parameters.get("asset");
if (assetId === null || assetId.trim().length === 0)
  throw new Error("The isolated asset route requires ?asset=<model-id>.");
const response = await fetch(
  `/__automovie/models/${encodeURIComponent(assetId)}.json`,
);
if (response.ok === false)
  throw new Error(
    `Compiled model "${assetId}" is unavailable (${response.status}). Run pnpm compile.`,
  );
const model = (await response.json()) as IAutoMovieModel;
const built = buildModel(model);
const pose = parameters.get("pose") ?? "rest";
if (pose !== "rest" && pose !== "rom-extremes")
  throw new Error('?pose must be "rest" or "rom-extremes".');
if (pose === "rom-extremes") {
  if (model.skeleton === null)
    throw new Error(
      `Compiled model "${assetId}" has no skeleton for a ROM-extremes view.`,
    );
  applyRomExtremes(built.bones);
}
const scene = new THREE.Scene();
scene.add(built.object);
scene.add(new THREE.HemisphereLight(0xdce8ff, 0x26303c, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(4, 6, 5);
scene.add(key);
const bounds = new THREE.Box3().setFromObject(built.object);
if (bounds.isEmpty()) throw new Error(`Compiled model "${assetId}" is empty.`);
const center = bounds.getCenter(new THREE.Vector3());
const size = bounds.getSize(new THREE.Vector3());
const radius = Math.max(size.length() / 2, 0.1);
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, radius * 20 + 100);
const mounted = mountViewer(canvas, scene, camera, () => true, {
  antialias: false,
  pixelRatio: 1,
  preserveDrawingBuffer: true,
});
mounted.renderer.setClearColor(0x11151b, 1);

const queryAngle = finiteParameter("angle");
const elevation = finiteParameter("elevation") ?? 15;
const seek = (time: number, pass: AutoMovieGuidePass): void => {
  const angle = queryAngle ?? time * 30;
  const azimuth = THREE.MathUtils.degToRad(angle);
  const altitude = THREE.MathUtils.degToRad(
    Math.max(-85, Math.min(85, elevation)),
  );
  const distance = radius / Math.tan(THREE.MathUtils.degToRad(35 / 2)) + radius;
  camera.position.set(
    center.x + Math.sin(azimuth) * Math.cos(altitude) * distance,
    center.y + Math.sin(altitude) * distance,
    center.z + Math.cos(azimuth) * Math.cos(altitude) * distance,
  );
  camera.lookAt(center);
  const handle = applyRenderMode(scene, pass);
  mounted.renderer.render(scene, camera);
  handle.restore();
  status.textContent = `${model.id}  angle=${angle.toFixed(1)}° elevation=${elevation.toFixed(1)}°  ${pass}`;
};
window.__automovieCapture = { ready: true, seek };
seek(0, "beauty");

function finiteParameter(name: string): number | null {
  const value = parameters.get(name);
  if (value === null) return null;
  const parsed = Number(value);
  if (Number.isFinite(parsed) === false)
    throw new Error(`?${name} must be one finite number.`);
  return parsed;
}

function applyRomExtremes(
  bones: ReadonlyMap<
    import("@automovie/interface").AutoMovieHumanoidBone,
    THREE.Object3D
  >,
): void {
  bones.get("leftUpperArm")?.rotateZ(Math.PI * 0.58);
  bones.get("rightUpperArm")?.rotateZ(-Math.PI * 0.58);
  bones.get("leftLowerArm")?.rotateY(-Math.PI * 0.42);
  bones.get("rightLowerArm")?.rotateY(Math.PI * 0.42);
  bones.get("leftUpperLeg")?.rotateX(-Math.PI * 0.38);
  bones.get("rightUpperLeg")?.rotateX(Math.PI * 0.28);
  bones.get("leftLowerLeg")?.rotateX(Math.PI * 0.52);
  bones.get("rightLowerLeg")?.rotateX(Math.PI * 0.34);
  bones.get("spine")?.rotateY(Math.PI * 0.18);
  built.object.updateMatrixWorld(true);
}
