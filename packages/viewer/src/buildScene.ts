import {
  IAutoMovieCamera,
  IAutoMovieLight,
  IAutoMovieScene,
} from "@automovie/interface";
import * as THREE from "three";

import { applyPose } from "./applyPose";
import { IAutoMovieModelObject, applyTransform } from "./buildModel";
import { buildSpaceObject } from "./buildSpace";

/**
 * Result of building a scene: the `three.js` scene and its cameras (first is
 * default).
 */
export interface IAutoMovieSceneObject {
  scene: THREE.Scene;
  cameras: THREE.PerspectiveCamera[];
}

/**
 * Build a `three.js` scene from an {@link IAutoMovieScene}.
 *
 * `getModelObject` resolves a node's `model` id to a built
 * {@link IAutoMovieModelObject}. If the same model id appears in multiple nodes
 * it should return a distinct object each call (a `three.js` object can live in
 * one place only). Each node is wrapped in a group placed at its world
 * transform, so node placement and a pose's own root transform compose
 * cleanly.
 *
 * Cameras and the three punctual light kinds map onto their `three.js`
 * equivalents.
 *
 * A scene carrying a `space` also gets its ground drawn (#1173): the standable
 * surfaces become real meshes under one `SPACE_GROUP_NAME` group (see
 * {@link buildSpaceObject}), so the structural guide passes describe a world
 * instead of actors floating in a void. The group is added LAST, after the
 * nodes and lights, because the mask palette is keyed by top-level child index:
 * appending leaves every node's segmentation color exactly where it was, and
 * the whole ground reads as one further color rather than one per surface.
 *
 * @author Samchon
 */
export const buildScene = (
  scene: IAutoMovieScene,
  getModelObject: (modelId: string) => IAutoMovieModelObject | undefined,
): IAutoMovieSceneObject => {
  const root = new THREE.Scene();

  for (const node of scene.nodes) {
    const built = getModelObject(node.model);
    // Caller data that cannot resolve is an error, not a skip (#1051): the
    // segmentation mask palette is keyed by top-level child INDEX, so a
    // silently dropped node would shift every later node one color over and
    // a mask consumer would attribute pixels to the wrong node.
    if (built === undefined)
      throw new Error(
        `scene node "${node.id}" references model "${node.model}", which getModelObject could not resolve`,
      );
    const nodeGroup = new THREE.Group();
    applyTransform(nodeGroup, node.transform);
    nodeGroup.add(built.object);
    // Static posing (node.pose) is done by the caller via applyPose, since it
    // needs the model's skeleton, which buildScene does not resolve here.
    root.add(nodeGroup);
  }

  for (const light of scene.lights) root.add(buildLight(light));

  const space = scene.space ?? null;
  if (space !== null) root.add(buildSpaceObject(space));

  const cameras = scene.cameras.map(buildCamera);
  return { scene: root, cameras };
};

const buildCamera = (cam: IAutoMovieCamera): THREE.PerspectiveCamera => {
  const camera = new THREE.PerspectiveCamera(cam.fovY, 1, cam.near, cam.far);
  applyTransform(camera, cam.transform);
  return camera;
};

const buildLight = (light: IAutoMovieLight): THREE.Light => {
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
