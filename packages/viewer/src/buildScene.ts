import { IAutoMovieSectionPlane } from "@automovie/engine";
import {
  IAutoMovieCamera,
  IAutoMovieFog,
  IAutoMovieLight,
  IAutoMovieScene,
} from "@automovie/interface";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

import { applyLightState } from "./applyLightMotion";
import { applyPose } from "./applyPose";
import { IAutoMovieModelObject, applyTransform } from "./buildModel";
import { buildSpaceObject } from "./buildSpace";
import { applySceneEnvironment } from "./sceneEnvironment";

/**
 * Result of building a scene: the `three.js` scene, its cameras (first is
 * default), and its lights indexed by id.
 *
 * @evidence requirements/staging/scope-and-source-of-truth.md#staging-resolved-scene-state Materializes this surface from the resolved scene state only.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Implements the boundary from resolved staging state to the viewer scene.
 * @author Samchon
 */
export interface IAutoMovieSceneObject {
  /**
   * @evidence requirements/staging/scope-and-source-of-truth.md#staging-resolved-scene-state Materializes this surface from the resolved scene state only.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Implements the boundary from resolved staging state to the viewer scene.
   */
  scene: THREE.Scene;
  /**
   * @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Materializes the resolved vertical field of view as the perspective-camera basis.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Implements that authored field-of-view basis in the runtime camera.
   * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Materializes the resolved ordered near and far clipping distances.
   * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Implements those clipping distances, and only those, on the runtime camera used for evaluation; an authored camera declares no section plane, which `applyAutoMovieSectionPlanes` applies to materials for inspection instead.
   */
  cameras: THREE.PerspectiveCamera[];

  /**
   * Built lights keyed by their {@link IAutoMovieLight.id}, the index
   * {@link applyLightMotion} resolves a shot's `lightMotions` against. Keyed by
   * id rather than handed back positionally: the scene's own child order is
   * load-bearing for the mask palette, so a light must never be found by
   * counting.
   *
   * @evidence requirements/lighting/sources-and-photometry.md#lighting-source-distribution Materializes each resolved light kind, direction, cone, and range.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-source-distribution-color Implements the runtime source distribution and color mapping.
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
 * **The first `scene.nodes.length` top-level children ARE the designed nodes,
 * in design order.** Both mask passes read that: the legacy ramp colours the
 * Nth child with the Nth colour, and the stable semantic palette resolves a
 * designed node to `root.children[index]` (see
 * {@link applyAutoMovieSemanticMask}). Anything this function adds of its own
 * goes after them, and a host that prepends a child of its own breaks the
 * second one exactly as it always broke the first.
 *
 * A scene carrying a `space` also gets its ground drawn (#1173): the standable
 * surfaces become real meshes under one `SPACE_GROUP_NAME` group (see
 * {@link buildSpaceObject}), so the structural guide passes describe a world
 * instead of actors floating in a void. The group is added LAST, after the
 * nodes and lights, for that reason, and so the whole ground reads as one
 * colour rather than one per surface.
 *
 * @evidence requirements/staging/scope-and-source-of-truth.md#staging-resolved-scene-state Materializes this surface from the resolved scene state only.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Implements the boundary from resolved staging state to the viewer scene.
 * @author Samchon
 */
export const buildScene = (
  scene: IAutoMovieScene,
  getModelObject: (modelId: string) => IAutoMovieModelObject | undefined,
  environmentTexture?: THREE.Texture,
): IAutoMovieSceneObject => {
  const root = new THREE.Scene();

  for (const node of scene.nodes) {
    const built = getModelObject(node.model);
    // Caller data that cannot resolve is an error, not a skip (#1051): both
    // mask passes read a designed node off its top-level child INDEX, so a
    // silently dropped node would shift every later node one place over and a
    // mask consumer would attribute pixels to the wrong node.
    if (built === undefined)
      throw new Error(
        `scene node "${node.id}" references model "${node.model}", which getModelObject could not resolve`,
      );
    const nodeGroup = new THREE.Group();
    // Named, so a consumer can find a node's group by its scene id instead of
    // by position among `root.children`. The two agree today only because this
    // loop appends in design order, which a host that prepends anything of its
    // own silently breaks.
    nodeGroup.name = node.id;
    applyTransform(nodeGroup, node.transform);
    nodeGroup.add(built.object);
    // Static posing (node.pose) is done by the caller via applyPose, since it
    // needs the model's skeleton, which buildScene does not resolve here.
    root.add(nodeGroup);
  }

  // Lights stay top-level children, after the nodes, so the designed nodes keep
  // the leading run of `root.children` that both mask passes read them off. The
  // id map is built alongside so a shot's `lightMotions` can find one without
  // depending on where it landed.
  const lights = new Map<string, THREE.Light>();
  for (const light of scene.lights) {
    const object = buildLight(light);
    root.add(object);
    lights.set(light.id, object);
  }

  const space = scene.space ?? null;
  if (space !== null) root.add(buildSpaceObject(space));

  // The atmosphere is a scene property, not an object: it takes no top-level
  // child, so the mask palette's child indices are untouched by declaring it.
  applySceneFog(root, scene.fog);
  applySceneEnvironment(root, scene.environment, environmentTexture);

  const cameras = scene.cameras.map(buildCamera);
  return { scene: root, cameras, lights };
};

/**
 * Put the scene's declared atmosphere on a `three.js` scene, or clear it when
 * nothing is declared.
 *
 * `FogExp2` is the exact law {@link IAutoMovieFog} documents and
 * {@link sceneFogTransmittance} reproduces on the CPU: the shader's `1 -
 * exp(-(density * depth)^2)` mix toward `color`. Nothing is converted on the
 * way in. `density` is handed over verbatim, and the color is written with
 * `setRGB` on the working (linear) color space, the same call
 * {@link applyLightState} makes for a light, because `IAutoMovieColor` is linear
 * by contract and a second convention here would make the fog and the key light
 * disagree about what `0.5` means.
 *
 * Exported, and separate from {@link buildScene}, for the reason `buildLight`
 * is: a host that assembles its own scene graph (the playground's film page,
 * which is what the offline renderer captures) must apply the FILM's atmosphere
 * through this one call rather than decorating its page with fog of its own. A
 * page that fogs itself proves nothing about the production.
 *
 * Absent or `null` clears `scene.fog`, which is `three.js`'s own "no fog":
 * every material compiles without `USE_FOG` and the frame is byte-identical to
 * one rendered before the field existed.
 *
 * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-time-sampling Applies the resolved fog state sampled with the scene's light, material, and camera state.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-sampling-claims Materializes that sampled environment attenuation without inventing weather or atmosphere state.
 */
export const applySceneFog = (
  scene: THREE.Scene,
  fog: IAutoMovieFog | null | undefined,
): void => {
  if (fog === null || fog === undefined) {
    scene.fog = null;
    return;
  }
  const built = new THREE.FogExp2(0x000000, fog.density);
  built.color.setRGB(fog.color.r, fog.color.g, fog.color.b);
  scene.fog = built;
};

const buildCamera = (cam: IAutoMovieCamera): THREE.PerspectiveCamera => {
  const camera = new THREE.PerspectiveCamera(cam.fovY, 1, cam.near, cam.far);
  applyTransform(camera, cam.transform);
  return camera;
};

/**
 * Build the `three.js` light one staged light plays on, aimed the way the
 * artifact says. The kind decides the class; every value INCLUDING the
 * placement is written by {@link applyLightState}, the same call a shot's
 * `lightMotions` uses each frame, so placing a light and animating it cannot
 * map `range`, `coneAngle` or the transform two different ways; the two aimed
 * kinds then get their target ({@link aimLight}), which is the half of a light's
 * placement `three.js` does not read off a quaternion.
 *
 * The placement is deliberately NOT applied a second time here. It used to be,
 * back when `applyLightState` wrote everything except the transform; now that
 * one writer owns the whole light, repeating the call would be a second
 * statement of the same fact, and the kind of duplicate that survives right up
 * until the two copies disagree.
 *
 * Exported because a host that assembles its own scene graph (the playground's
 * film page) must light it from `scene.lights` rather than from a hardcoded
 * source of its own: a page that lights itself proves nothing about the film's
 * lighting, which is how the aim defect in #1356 survived every capture.
 *
 * @evidence requirements/lighting/sources-and-photometry.md#lighting-source-distribution Materializes each resolved light kind, direction, cone, and range.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-source-distribution-color Implements the runtime source distribution and color mapping.
 * @evidence requirements/lighting/shadows-reflections-and-transmission.md#lighting-shadow-identity Materializes the declared shadow source, map, bias, and clipping identity.
 * @evidence specifications/camera-light-and-visibility/light-transport-color-and-budget.md#clv-shadow-state-sampling Implements that shadow state on the runtime light.
 */
export const buildLight = (light: IAutoMovieLight): THREE.Light => {
  if (light.type === "point") {
    const built = new THREE.PointLight();
    applyLightState(built, light);
    applyShadow(built, light);
    return built;
  }
  if (light.type === "area") {
    // A `RectAreaLight` shades through a lookup texture pair the core bundle
    // does not install, and an uninitialized one lights nothing at all. The
    // install is global renderer state, so it happens once, here, where the
    // first panel is built: a host that stages no area light pays nothing, and
    // one that stages ten cannot forget.
    initRectAreaLightUniforms();
    const built = new THREE.RectAreaLight(
      undefined,
      undefined,
      light.width,
      light.height,
    );
    applyLightState(built, light);
    // No `aimLight`: a `RectAreaLight` has no target object and emits from the
    // face its own local −Z points at, which is already the forward axis
    // `stageScene` rotated onto the authored direction.
    return built;
  }
  const built =
    light.type === "directional"
      ? new THREE.DirectionalLight()
      : new THREE.SpotLight();
  applyLightState(built, light);
  applyShadow(built, light);
  return aimLight(built);
};

let rectAreaLightUniformsInstalled = false;

/** Install the `RectAreaLight` BRDF lookup tables exactly once per process. */
const initRectAreaLightUniforms = (): void => {
  if (rectAreaLightUniformsInstalled) return;
  rectAreaLightUniformsInstalled = true;
  RectAreaLightUniformsLib.init();
};

const applyShadow = (built: THREE.Light, light: IAutoMovieLight): void => {
  built.castShadow = light.castShadow ?? false;
  if (light.shadow === undefined || !("shadow" in built)) return;
  const shadow = (
    built as THREE.PointLight | THREE.SpotLight | THREE.DirectionalLight
  ).shadow;
  shadow.mapSize.set(light.shadow.mapSize, light.shadow.mapSize);
  shadow.bias = light.shadow.bias;
  shadow.normalBias = light.shadow.normalBias;
  shadow.camera.near = light.shadow.near;
  shadow.camera.far = light.shadow.far;
  shadow.camera.updateProjectionMatrix();
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

/**
 * Re-export for the same reason, one rung further in: a scene carrying props is
 * only half built when its node groups exist, because a prop's declared joints
 * are objects of the scene rather than of any one model, and the clip that
 * turns them names them by the id this builds them under.
 */
export { buildPropArticulation } from "./propArticulation";
export type { IAutoMovieBuiltPropArticulation } from "./propArticulation";

/**
 * The renderer state a section needs: `three.js`'s per-material clipping
 * switch, which makes every declared plane inert while it is false.
 *
 * Structural rather than `THREE.WebGLRenderer`, because local clipping is one
 * flag and demanding the whole renderer would put a live WebGL context between
 * this rule and any check of it. The real renderer satisfies it as it stands.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Names the single renderer switch an inspection-owned cut turns on, without widening it into an authored camera setting.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Types the runtime enable under which the specified optional clipping planes take effect.
 */
export interface IAutoMovieSectionRenderer {
  /**
   * Whether per-material clipping planes are in force.
   *
   * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Carries whether the declared cut is currently applied.
   * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Carries the runtime enable the specified plane set depends on.
   */
  localClippingEnabled: boolean;
}

/**
 * Put an inspection-owned section on an already-built scene, and hand back the
 * exact world-space planes the materials were given.
 *
 * The scene is not edited: no mesh is removed, no material is replaced, no
 * geometry is rebuilt. Every material in the subtree receives the same plane
 * set and the renderer's local clipping is switched on, so what changes is
 * which fragments survive. That is what makes a cut a way of LOOKING at a
 * production rather than a second version of it — the difference between
 * reviewing the building that was authored and reviewing one with a wall
 * deleted from its source.
 *
 * One convention is converted here and nowhere else.
 * {@link IAutoMovieSectionPlane.normal} points at the half-space to REMOVE,
 * while `three.js` keeps the side its own plane normal points at and discards
 * only a negative signed distance, so the runtime plane is built from the
 * negated normal through the same coplanar point. A vertex lying exactly on the
 * cut therefore reads as distance zero on both sides of that translation and is
 * drawn, which is the boundary rule
 * {@link autoMovieSectionPlaneDistance} states: the floor a section is taken at
 * survives its own cut.
 *
 * `clipIntersection` is written false rather than left at its default, so a
 * fragment is dropped when ANY plane removes it and the set intersects the way
 * {@link autoMovieSectionPlanesKeepPoint} evaluates it. A material arriving with
 * a union already set would otherwise let a second plane restore what the first
 * cut away.
 *
 * An empty plane list releases the section: every material returns to `null`
 * clipping planes and local clipping is switched off, so a scene that was never
 * cut and a scene whose cut was released render identically.
 *
 * Materials are recompiled (`needsUpdate`) only when their plane COUNT changes.
 * `three.js` bakes that count into the shader program while reading the plane
 * values every frame, so sliding a cut costs nothing and taking or releasing
 * one costs a single compile.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Realizes the declared cut as a viewing state over an unmodified resolved scene and keeps geometry lying exactly on the plane.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Applies the optional clipping planes at the runtime boundary as the same intersection of kept half-spaces the evaluation measures.
 */
export const applyAutoMovieSectionPlanes = (props: {
  renderer: IAutoMovieSectionRenderer;
  root: THREE.Object3D;
  planes: readonly IAutoMovieSectionPlane[];
}): THREE.Plane[] => {
  const built = props.planes.map((plane) =>
    new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(
        -plane.normal.x,
        -plane.normal.y,
        -plane.normal.z,
      ).normalize(),
      new THREE.Vector3(plane.point.x, plane.point.y, plane.point.z),
    ),
  );
  props.renderer.localClippingEnabled = built.length !== 0;
  const assigned = built.length === 0 ? null : built;
  props.root.traverse((object) => {
    const holder = object as { material?: THREE.Material | THREE.Material[] };
    if (holder.material === undefined) return;
    for (const material of Array.isArray(holder.material)
      ? holder.material
      : [holder.material]) {
      if ((material.clippingPlanes?.length ?? 0) !== built.length)
        material.needsUpdate = true;
      material.clippingPlanes = assigned;
      material.clipIntersection = false;
    }
  });
  return built;
};
