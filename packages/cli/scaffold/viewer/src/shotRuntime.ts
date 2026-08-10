import {
  lowerPlantingInstallation,
  lowerSoftFurnishing,
  lowerWaterFeature,
} from "@automovie/engine";
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
  applyRendererEnvironment,
  buildFluidSprayObject,
  buildFluidSurfaceObject,
  buildInstancedEffect,
  buildInstancedFormation,
  buildInstancedInstanceSet,
  buildPlantingObject,
  buildPropArticulation,
  buildScene,
  buildSoftBodyObject,
} from "@automovie/viewer";
import type * as THREE from "three";

import { createShotTextureCache, loadCompiledModel } from "./loadCompiledModel";

export interface IAutoMovieCompiledShotRuntime {
  id: string;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  render: (
    renderer: THREE.WebGLRenderer,
    time: number,
    pass: AutoMovieGuidePass,
  ) => string;
  /** Release every texture this shot decoded, exactly once. */
  dispose: () => Promise<void>;
}

export const createCompiledShotRuntime = async (
  compiled: IAutoMovieCompiledShotSource,
  /**
   * Tone mapping the delivery asks for, when the page was opened for one.
   *
   * The render spec owns this and the scene's own environment owns the rest, so
   * a page opened without a delivery leaves the renderer exactly as the scene
   * describes it rather than guessing a curve nobody asked for.
   */
  delivery?: "none" | "acesFilmic",
): Promise<IAutoMovieCompiledShotRuntime> => {
  const models = new Map(compiled.models.map((model) => [model.id, model]));
  const textures = createShotTextureCache();
  const built = await Promise.all(
    compiled.scene.nodes.map(async (node) => {
      const model = models.get(node.model);
      if (model === undefined)
        throw new Error(`Scene node "${node.id}" references "${node.model}".`);
      return { node, model, object: await loadCompiledModel(model, textures) };
    }),
  );
  // The environment image goes through the same cache as the material maps, so
  // a shot lighting itself from an image it also samples decodes that image
  // once and frees it with everything else.
  const environmentImage = compiled.scene.environment?.image ?? null;
  let environmentTexture: THREE.Texture | undefined;
  if (environmentImage !== null) {
    await textures.prime([environmentImage]);
    environmentTexture = textures.resolve(environmentImage);
  }
  let cursor = 0;
  const scene = buildScene(
    compiled.scene,
    (modelId) => {
      const candidate = built[cursor++];
      if (candidate?.model.id !== modelId)
        throw new Error(`Scene build order disagrees at model "${modelId}".`);
      return candidate.object;
    },
    environmentTexture,
  );
  const nodeObjects = new Map(
    compiled.scene.nodes.map((node, index) => {
      const object = scene.scene.children[index];
      if (object === undefined)
        throw new Error(`Scene node "${node.id}" has no built wrapper.`);
      return [node.id, object] as const;
    }),
  );
  const nodeVisualObjects = new Map(
    built.map((item) => [item.node.id, item.object.object] as const),
  );
  // A prop's moving parts are nodes the scene never declared: the engine names
  // them from the placement that carries them, and the same names are what a
  // shot's object motions address. Building them here is what lets a compiled
  // door actually turn instead of standing open in a still frame.
  const articulation = buildPropArticulation({
    scene: compiled.scene,
    props: compiled.props ?? [],
    nodeObjects,
    modelObjects: new Map(built.map((item) => [item.node.id, item.object])),
  });
  const formationObjects = compiled.formations.map((formation) =>
    buildInstancedFormation({
      formation,
      models,
      motions: compiled.formationMotions,
      slotMotions: compiled.formationSlotMotions,
      heroObjects: nodeObjects,
      heroVisualObjects: nodeVisualObjects,
    }),
  );
  for (const formation of formationObjects) scene.scene.add(formation.object);
  const instancePrototypeModelIds = new Set(
    compiled.instanceSets.flatMap((instanceSet) =>
      (
        instanceSet.prototypes ?? [
          {
            lod: instanceSet.lod,
          },
        ]
      ).flatMap((prototype) => prototype.lod.map((lod) => lod.model)),
    ),
  );
  const instancePrototypeObjects = new Map(
    await Promise.all(
      [...instancePrototypeModelIds].map(async (modelId) => {
        const model = models.get(modelId);
        if (model === undefined)
          throw new Error(
            `Instance prototype references missing runtime model "${modelId}".`,
          );
        return [modelId, await loadCompiledModel(model, textures)] as const;
      }),
    ),
  );
  const instanceSetObjects = compiled.instanceSets.map((instanceSet) =>
    buildInstancedInstanceSet({
      instanceSet,
      models,
      prototypeObjects: instancePrototypeObjects,
    }),
  );
  for (const instanceSet of instanceSetObjects)
    scene.scene.add(instanceSet.object);
  const effectObjects = compiled.effects.map(buildInstancedEffect);
  for (const effect of effectObjects) scene.scene.add(effect.object);
  // Water, cloth and planting are independent domains a building binds rather
  // than scene nodes, so nothing in the node list builds them. Each binding is
  // lowered through the same engine call the compiler validated it with, and
  // the result goes to the viewer's own builder: the runtime derives no
  // geometry of its own, exactly as it derives none for a model.
  const fluidDomains = new Map(
    (compiled.fluidDomains ?? []).map((domain) => [domain.id, domain] as const),
  );
  const softBodyDomains = new Map(
    (compiled.softBodyDomains ?? []).map(
      (domain) => [domain.id, domain] as const,
    ),
  );
  const plantingDomains = new Map(
    (compiled.plantingDomains ?? []).map(
      (domain) => [domain.id, domain] as const,
    ),
  );
  const plantingClusters = new Map(
    (compiled.plantingClusters ?? []).map(
      (cluster) => [cluster.id, cluster] as const,
    ),
  );
  const waterObjects = (compiled.waterFeatures ?? []).map((feature) => {
    const domain = fluidDomains.get(feature.domain);
    if (domain === undefined)
      throw new Error(
        `Water feature "${feature.id}" draws fluid domain "${feature.domain}", which this shot does not carry.`,
      );
    const lowered = lowerWaterFeature({ feature, domain, time: 0 });
    return {
      feature,
      domain,
      // A static feature is solved once and never re-solved, which is what
      // "static" means; only a flowing one is stepped by the shot clock.
      still: feature.mode === "static",
      surface: buildFluidSurfaceObject({
        surface: lowered.surface,
        mode: feature.mode,
      }),
      spray: buildFluidSprayObject({ sample: lowered.spray }),
    };
  });
  for (const water of waterObjects) {
    scene.scene.add(water.surface.object);
    scene.scene.add(water.spray.object);
  }
  const softObjects = (compiled.softFurnishings ?? []).flatMap((furnishing) => {
    const domain = softBodyDomains.get(furnishing.domain);
    if (domain === undefined)
      throw new Error(
        `Soft furnishing "${furnishing.id}" hangs soft body "${furnishing.domain}", which this shot does not carry.`,
      );
    const lowered = lowerSoftFurnishing({ furnishing, domain, time: 0 });
    // A panel the engine refused to solve has no surface to draw. The refusal
    // is already on the analysis it returned, so drawing a still rectangle
    // instead would be the one thing this fold refuses: a curtain nobody can
    // tell apart from a solved one.
    if (lowered.surface === null) return [];
    return [
      {
        furnishing,
        domain,
        object: buildSoftBodyObject({
          surface: lowered.surface,
          status: lowered.analysis.status,
        }),
      },
    ];
  });
  for (const soft of softObjects) scene.scene.add(soft.object.object);
  const plantingObjects = (compiled.plantingInstallations ?? []).flatMap(
    (installation) => {
      // The installation names its cluster and the cluster names the recipe it
      // grows, so the recipe is reached through the cluster rather than named
      // twice in two places that could disagree.
      const cluster = plantingClusters.get(installation.cluster);
      const domain =
        cluster === undefined ? undefined : plantingDomains.get(cluster.domain);
      if (cluster === undefined || domain === undefined)
        throw new Error(
          `Planting installation "${installation.id}" plants cluster "${installation.cluster}", whose cluster or recipe this shot does not carry.`,
        );
      const lowered = lowerPlantingInstallation({
        installation,
        cluster,
        domain,
      });
      // Planting is grown from the recipe rather than stepped by the clock, so
      // a refusal here is final for the shot rather than for one second.
      if (lowered.plant === null || lowered.arrangement === null) return [];
      return [
        buildPlantingObject({
          plant: lowered.plant,
          arrangement: lowered.arrangement,
        }),
      ];
    },
  );
  for (const planting of plantingObjects) scene.scene.add(planting.object);
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
    const motionId =
      performance === undefined ? node.motion : performance.motion;
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
  const render = (
    renderer: THREE.WebGLRenderer,
    time: number,
    pass: AutoMovieGuidePass,
  ): string => {
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
    articulation.restore();
    applyObjectMotions(
      compiled.shot.objectMotions,
      time,
      (node) => nodeObjects.get(node) ?? articulation.joints.get(node),
    );
    // A flowing feature and a hung panel are solved at the second being drawn,
    // so a seek backwards shows what that second held rather than what the last
    // draw happened to leave behind.
    for (const water of waterObjects) {
      if (water.still) continue;
      const lowered = lowerWaterFeature({
        feature: water.feature,
        domain: water.domain,
        time,
      });
      water.surface.update(lowered.surface);
      water.spray.update(lowered.spray);
    }
    for (const soft of softObjects) {
      const lowered = lowerSoftFurnishing({
        furnishing: soft.furnishing,
        domain: soft.domain,
        time,
      });
      if (lowered.surface === null) continue;
      soft.object.update({
        surface: lowered.surface,
        status: lowered.analysis.status,
      });
    }
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
    const heroSources = new Map(
      [...nodeObjects].map(
        ([id, object]) =>
          [
            id,
            {
              translation: {
                x: object.position.x,
                y: object.position.y,
                z: object.position.z,
              },
              rotation: {
                x: object.quaternion.x,
                y: object.quaternion.y,
                z: object.quaternion.z,
                w: object.quaternion.w,
              },
              scale: {
                x: object.scale.x,
                y: object.scale.y,
                z: object.scale.z,
              },
            },
          ] as const,
      ),
    );
    for (const formation of formationObjects)
      formation.update(
        camera,
        Math.max(1, renderer.domElement.height),
        time,
        heroSources,
      );
    for (const instanceSet of instanceSetObjects)
      instanceSet.update(camera, Math.max(1, renderer.domElement.height));
    for (const effect of effectObjects) effect.update(camera, time);
    formationObjects.forEach(({ stats }, index) => {
      const runtime = compiled.formations[index]!;
      if (
        stats.visible.near +
          stats.visible.far +
          stats.culled +
          stats.removed !==
          runtime.anonymousCount ||
        stats.heroes !== runtime.heroes.length
      )
        throw new Error(
          `Formation viewer inventory diverged for "${runtime.id}".`,
        );
    });
    effectObjects.forEach(({ stats }, index) => {
      const runtime = compiled.effects[index]!;
      const expectedActive = time >= runtime.start && time < runtime.end;
      if (
        stats.active !== expectedActive ||
        stats.particles < 0 ||
        stats.particles > stats.cap
      )
        throw new Error(
          `Effect viewer inventory diverged for "${runtime.id}".`,
        );
    });
    instanceSetObjects.forEach(({ stats }, index) => {
      const runtime = compiled.instanceSets[index]!;
      if (
        stats.visible.hero +
          stats.visible.near +
          stats.visible.far +
          stats.culled !==
        runtime.count
      )
        throw new Error(
          `Instance-set viewer inventory diverged for "${runtime.id}".`,
        );
    });
    const rendererEnvironment = applyRendererEnvironment(
      renderer,
      compiled.scene.environment,
      pass,
      delivery,
    );
    const handle = applyRenderMode(scene.scene, pass);
    try {
      renderer.render(scene.scene, camera);
    } finally {
      handle.restore();
      rendererEnvironment.restore();
    }
    const formationStatus = formationObjects
      .map(
        ({ stats }) =>
          `H${stats.heroes}/N${stats.visible.near}/F${stats.visible.far}/C${stats.culled}/X${stats.removed}`,
      )
      .join(" ");
    const effectStatus = effectObjects
      .map(
        ({ stats }) =>
          `E${stats.active ? 1 : 0}/${stats.particles}/${stats.cap}`,
      )
      .join(" ");
    const instanceStatus = instanceSetObjects
      .map(
        ({ stats }) =>
          `I${stats.visible.hero + stats.visible.near + stats.visible.far}/C${stats.culled}`,
      )
      .join(" ");
    const runtimeStatus = [formationStatus, instanceStatus, effectStatus]
      .filter((value) => value.length !== 0)
      .join(" ");
    return (
      `${compiled.shot.id}  t=${time.toFixed(3)}s  ${pass}` +
      (runtimeStatus.length === 0 ? "" : `  ${runtimeStatus}`)
    );
  };

  return {
    id: compiled.shot.id,
    scene: scene.scene,
    camera,
    render,
    dispose: async () => {
      for (const water of waterObjects) {
        water.surface.dispose();
        water.spray.dispose();
      }
      for (const soft of softObjects) soft.object.dispose();
      for (const planting of plantingObjects) planting.dispose();
      await textures.dispose();
    },
  };
};
