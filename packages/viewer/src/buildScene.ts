import {
  IAutoMovieCamera,
  IAutoMovieLight,
  IAutoMovieScene,
} from "@automovie/interface";
import * as THREE from "three";

import { applyLightState } from "./applyLightMotion";
import { applyPose } from "./applyPose";
import { IAutoMovieModelObject, applyTransform } from "./buildModel";
import { buildSpaceObject } from "./buildSpace";

/**
 * Result of building a scene: the `three.js` scene, its cameras (first is
 * default), and its lights indexed by id.
 */
export interface IAutoMovieSceneObject {
  scene: THREE.Scene;
  cameras: THREE.PerspectiveCamera[];

  /**
   * Built lights keyed by their {@link IAutoMovieLight.id}, the index
   * {@link applyLightMotion} resolves a shot's `lightMotions` against. Keyed by
   * id rather than handed back positionally: the scene's own child order is
   * load-bearing for the mask palette, so a light must never be found by
   * counting.
   */
  lights: Map<string, THREE.Light>;
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

  // Lights stay top-level children in staging order: the mask palette is keyed
  // by that index. The id map is built alongside so a shot's `lightMotions` can
  // find one without depending on where it landed.
  const lights = new Map<string, THREE.Light>();
  for (const light of scene.lights) {
    const object = buildLight(light);
    root.add(object);
    lights.set(light.id, object);
  }

  const space = scene.space ?? null;
  if (space !== null) root.add(buildSpaceObject(space));

  const cameras = scene.cameras.map(buildCamera);
  return { scene: root, cameras, lights };
};

const buildCamera = (cam: IAutoMovieCamera): THREE.PerspectiveCamera => {
  const camera = new THREE.PerspectiveCamera(cam.fovY, 1, cam.near, cam.far);
  applyTransform(camera, cam.transform);
  return camera;
};

/**
 * Build the `three.js` light one staged light plays on, aimed the way the
 * artifact says. The kind decides the class; every value is written by
 * {@link applyLightState}, the same call a shot's `lightMotions` uses each
 * frame, so placing a light and animating it cannot map `range` or `coneAngle`
 * two different ways; the two aimed kinds then get their target
 * ({@link aimLight}), which is the half of a light's placement `three.js` does
 * not read off a quaternion.
 *
 * Exported because a host that assembles its own scene graph (the playground's
 * film page) must light it from `scene.lights` rather than from a hardcoded
 * source of its own: a page that lights itself proves nothing about the film's
 * lighting, which is how the aim defect in #1356 survived every capture.
 */
export const buildLight = (light: IAutoMovieLight): THREE.Light => {
  if (light.type === "point") {
    const built = new THREE.PointLight();
    applyLightState(built, light);
    applyTransform(built, light.transform);
    return built;
  }
  const built =
    light.type === "directional"
      ? new THREE.DirectionalLight()
      : new THREE.SpotLight();
  applyLightState(built, light);
  applyTransform(built, light.transform);
  return aimLight(built);
};

/**
 * Point an aimed light along the direction its transform carries.
 *
 * `stage` requires a `direction` for the aimed kinds and lowers it into the
 * scene light's `transform.rotation` ({@link IAutoMovieLight}: "for directional
 * light only the orientation matters"), but `three.js` does not shine a
 * `DirectionalLight`/`SpotLight` along its quaternion: it shines from its
 * position toward its `target`, which defaults to a fresh object at the world
 * origin. Writing the transform alone therefore threw the whole authored
 * direction away, and a staged directional light (whose lowering puts it at the
 * origin, since only its orientation means anything) came out shining along the
 * ZERO vector while a spot silently aimed at the origin from wherever it stood
 * (#1356).
 *
 * Parenting the target to the light is what keeps one source of truth: the
 * target sits one meter down the light's local −Z, the same forward axis
 * `stageScene` aimed, so the rendered direction IS the artifact's rotation and
 * no second field can drift from it. `three.js` only reads a target that is in
 * the scene graph, and a child of the light always is.
 */
const aimLight = <Light extends THREE.DirectionalLight | THREE.SpotLight>(
  light: Light,
): Light => {
  light.target.position.set(0, 0, -1);
  light.add(light.target);
  return light;
};

/** Re-export so callers can pose static nodes after building the scene. */
export { applyPose };
