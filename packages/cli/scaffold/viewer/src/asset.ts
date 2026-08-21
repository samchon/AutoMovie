import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  clampPose,
  getConstraint,
} from "@automovie/engine";
import type { AutoMovieGuidePass, IAutoMovieModel } from "@automovie/interface";
import { applyPose, applyRenderMode, mountViewer } from "@automovie/viewer";
import * as THREE from "three";

import { PRODUCTION_BACKGROUND } from "../../src/production";
import { createShotTextureCache, loadCompiledModel } from "./loadCompiledModel";
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
    `Compiled model "${assetId}" is unavailable (${response.status}). Run npm run compile.`,
  );
const model = (await response.json()) as IAutoMovieModel;
// This page shows one model for as long as it is open, so its cache is the
// page's own: the model's maps decode once and the browser reclaims them with
// the document. A textured model reaching `buildModel` without one throws.
const built = await loadCompiledModel(model, createShotTextureCache());
const pose = parameters.get("pose") ?? "rest";
if (pose !== "rest" && pose !== "rom-extremes")
  throw new Error('?pose must be "rest" or "rom-extremes".');
if (pose === "rom-extremes") {
  if (model.skeleton === null)
    throw new Error(
      `Compiled model "${assetId}" has no skeleton for a ROM-extremes view.`,
    );
  applyRomExtremes(model, built);
}
const scene = new THREE.Scene();
scene.add(built.object);
scene.add(new THREE.HemisphereLight(0xdce8ff, 0x26303c, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(4, 6, 5);
scene.add(key);
// A part request frames that one piece instead of the whole model, which is how
// a mullion, a hinge, or a hand is looked at without exporting a model for it.
// The object is still the whole model: what narrows is the camera, so the part
// is seen in the context that gives its proportions meaning.
const partId = parameters.get("part");
const framed =
  partId === null || partId.trim().length === 0
    ? built.object
    : (built.parts.get(partId) ??
      (() => {
        throw new Error(
          `Compiled model "${assetId}" has no addressable part "${partId}".`,
        );
      })());
const bounds = new THREE.Box3().setFromObject(framed);
if (bounds.isEmpty())
  throw new Error(
    partId === null
      ? `Compiled model "${assetId}" is empty.`
      : `Part "${partId}" of compiled model "${assetId}" is empty.`,
  );
const center = bounds.getCenter(new THREE.Vector3());
const size = bounds.getSize(new THREE.Vector3());
const radius = Math.max(size.length() / 2, 0.1);
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, radius * 20 + 100);
const mounted = mountViewer(canvas, scene, camera, () => true, {
  antialias: false,
  pixelRatio: 1,
  preserveDrawingBuffer: true,
});
mounted.renderer.setClearColor(PRODUCTION_BACKGROUND, 1);

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
// An asset turntable stages no compiled shot, so it has no palette to paint a
// mask with and no compiled inventory to hold a live one against. Both answer
// null rather than a shape that would read as evidence about a production.
window.__automovieCapture = {
  ready: true,
  seek,
  observe: () => null,
  sidecar: () => null,
};
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
  source: IAutoMovieModel,
  target: Awaited<ReturnType<typeof loadCompiledModel>>,
): void {
  if (source.skeleton === null)
    throw new Error(`Compiled model "${source.id}" has no skeleton.`);
  const pose = clampPose(
    {
      skeleton: source.skeleton.id,
      root: null,
      joints: source.skeleton.bones.flatMap((bone) => {
        const constraint = getConstraint(bone.bone, bone.constraint);
        return constraint === null
          ? []
          : [
              {
                bone: bone.bone,
                flexion: constraint.flexion?.max ?? null,
                abduction: constraint.abduction?.max ?? null,
                twist: constraint.twist?.max ?? null,
              },
            ];
      }),
    },
    source.skeleton,
  );
  const skipped = applyPose(
    target,
    pose,
    source.skeleton,
    HUMANOID_JOINT_AXES,
    HUMANOID_REST_FRAME,
  );
  const missingRequired = skipped.filter((bone) =>
    REQUIRED_HUMANOID_BONES.has(bone),
  );
  if (missingRequired.length !== 0)
    throw new Error(
      `Imported model "${source.id}" did not map required ROM bones: ${missingRequired.join(", ")}.`,
    );
  target.object.updateMatrixWorld(true);
}

const REQUIRED_HUMANOID_BONES = new Set([
  "hips",
  "spine",
  "chest",
  "head",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
]);
