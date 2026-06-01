import { IMoticaCamera, IMoticaLight, IMoticaScene } from "@motica/interface";
import * as THREE from "three";

import { applyPose } from "./applyPose";
import { IMoticaModelObject, applyTransform } from "./buildModel";

/**
 * Result of building a scene: the `three.js` scene and its cameras (first is
 * default).
 */
export interface IMoticaSceneObject {
  scene: THREE.Scene;
  cameras: THREE.PerspectiveCamera[];
}

/**
 * Build a `three.js` scene from an {@link IMoticaScene}.
 *
 * `getModelObject` resolves a node's `model` id to a built
 * {@link IMoticaModelObject}. If the same model id appears in multiple nodes it
 * should return a distinct object each call (a `three.js` object can live in
 * one place only). Each node is wrapped in a group placed at its world
 * transform, so node placement and a pose's own root transform compose
 * cleanly.
 *
 * Cameras and the three punctual light kinds map onto their `three.js`
 * equivalents.
 *
 * @author Samchon
 */
export const buildScene = (
  scene: IMoticaScene,
  getModelObject: (modelId: string) => IMoticaModelObject | undefined,
): IMoticaSceneObject => {
  const root = new THREE.Scene();

  for (const node of scene.nodes) {
    const built = getModelObject(node.model);
    if (built === undefined) continue;
    const nodeGroup = new THREE.Group();
    applyTransform(nodeGroup, node.transform);
    nodeGroup.add(built.object);
    // Static posing (node.pose) is done by the caller via applyPose, since it
    // needs the model's skeleton, which buildScene does not resolve here.
    root.add(nodeGroup);
  }

  for (const light of scene.lights) root.add(buildLight(light));

  const cameras = scene.cameras.map(buildCamera);
  return { scene: root, cameras };
};

const buildCamera = (cam: IMoticaCamera): THREE.PerspectiveCamera => {
  const camera = new THREE.PerspectiveCamera(cam.fovY, 1, cam.near, cam.far);
  applyTransform(camera, cam.transform);
  return camera;
};

const buildLight = (light: IMoticaLight): THREE.Light => {
  const color = new THREE.Color(light.color.r, light.color.g, light.color.b);
  if (light.type === "directional") {
    const l = new THREE.DirectionalLight(color, light.intensity);
    applyTransform(l, light.transform);
    return l;
  }
  if (light.type === "point") {
    const l = new THREE.PointLight(color, light.intensity, light.range);
    applyTransform(l, light.transform);
    return l;
  }
  const l = new THREE.SpotLight(
    color,
    light.intensity,
    light.range,
    (light.coneAngle * Math.PI) / 180,
  );
  applyTransform(l, light.transform);
  return l;
};

/** Re-export so callers can pose static nodes after building the scene. */
export { applyPose };
