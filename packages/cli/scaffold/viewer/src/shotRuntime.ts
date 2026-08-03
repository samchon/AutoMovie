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
  buildInstancedEffect,
  buildInstancedFormation,
  buildInstancedInstanceSet,
  buildScene,
} from "@automovie/viewer";
import type * as THREE from "three";

import { loadCompiledModel } from "./loadCompiledModel";

export interface IAutoMovieCompiledShotRuntime {
  id: string;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  render: (
    renderer: THREE.WebGLRenderer,
    time: number,
    pass: AutoMovieGuidePass,
  ) => string;
}

export const createCompiledShotRuntime = async (
  compiled: IAutoMovieCompiledShotSource,
): Promise<IAutoMovieCompiledShotRuntime> => {
  const models = new Map(compiled.models.map((model) => [model.id, model]));
  const built = await Promise.all(
    compiled.scene.nodes.map(async (node) => {
      const model = models.get(node.model);
      if (model === undefined)
        throw new Error(`Scene node "${node.id}" references "${node.model}".`);
      return { node, model, object: await loadCompiledModel(model) };
    }),
  );
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
  const nodeVisualObjects = new Map(
    built.map((item) => [item.node.id, item.object.object] as const),
  );
  const formationObjects = compiled.formations.map((formation) =>
    buildInstancedFormation({
      formation,
      models,
      motions: compiled.formationMotions,
      heroObjects: nodeObjects,
      heroVisualObjects: nodeVisualObjects,
    }),
  );
  for (const formation of formationObjects) scene.scene.add(formation.object);
  const instanceSetObjects = compiled.instanceSets.map((instanceSet) =>
    buildInstancedInstanceSet({ instanceSet, models }),
  );
  for (const instanceSet of instanceSetObjects)
    scene.scene.add(instanceSet.object);
  const effectObjects = compiled.effects.map(buildInstancedEffect);
  for (const effect of effectObjects) scene.scene.add(effect.object);
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
        stats.visible.near + stats.visible.far + stats.culled !==
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
    const handle = applyRenderMode(scene.scene, pass);
    renderer.render(scene.scene, camera);
    handle.restore();
    const formationStatus = formationObjects
      .map(
        ({ stats }) =>
          `H${stats.heroes}/N${stats.visible.near}/F${stats.visible.far}/C${stats.culled}`,
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
  };
};
