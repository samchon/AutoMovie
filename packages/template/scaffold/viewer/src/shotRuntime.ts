import {
  type IAutoMovieDialogueExpressionLayers,
  type IAutoMovieDialogueVisemeTimeline,
  type IAutoMovieResolvedBone,
  type IAutoMovieWearableSoftFrame,
  lowerPlantingInstallation,
  lowerSoftFurnishing,
  lowerWaterFeature,
  productionFrameBoundaryToSeconds,
  sampleAutoMovieDialogueExpression,
  sampleMotion,
  simulateAutoMovieWearableSoftBody,
  softBodyStepAt,
  softBodySurfaceGeometry,
  validateAutoMovieSoftFurnishingDomainOwnership,
} from "@automovie/engine";
import type {
  AutoMovieExpressionPreset,
  AutoMovieGuidePass,
  IAutoMovieCompiledFilmEffect,
  IAutoMovieCompiledShotSource,
  IAutoMovieDeliveryCrop,
  IAutoMovieExpression,
  IAutoMovieSoftBodyDomain,
  IAutoMovieTransform,
} from "@automovie/interface";
import {
  type IAutoMovieFilmEffectCurrentIdentity,
  sampleProductionFilmEffects,
} from "@automovie/production";
import {
  AutoMoviePlayer,
  type IAutoMovieModelObject,
  applyAutoMovieDeliveryCrop,
  applyLightMotion,
  applyObjectMotion,
  applyObjectMotions,
  applyPose,
  applyRenderMode,
  applyRendererEnvironment,
  assertAutoMovieViewerCameraDepthPrecision,
  buildAutoMovieMaterialLibrary,
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
import * as THREE from "three";

import { selectProductionLiveWearableSoftBodies } from "../../scripts/productionConfiguration";
import type { IAutoMovieProductionDialogueRuntime } from "../../scripts/productionRuntimeState";
import { createShotTextureCache, loadCompiledModel } from "./loadCompiledModel";

const MOUTH_PRESETS: readonly AutoMovieExpressionPreset[] = [
  "aa",
  "ih",
  "ou",
  "ee",
  "oh",
];

/** One actor expression sink beside the authored layer sampled this frame. */
export interface IAutoMovieProductionDialogueActor {
  /** Built model object owning its mouth expression targets. */
  object: IAutoMovieModelObject;
  /** Authored expression retained beneath the derived mouth layer. */
  authored: IAutoMovieExpression | null;
}

/**
 * Apply the final-byte mouth layer without replacing authored emotion.
 *
 * Every actor participating in a dialogue timeline has the five viseme targets
 * cleared at each exact film frame. An active range then raises its one target;
 * receipt gaps and time outside the line remain an explicit closed mouth.
 */
export const applyProductionDialogueMouth = (props: {
  runtime: IAutoMovieProductionDialogueRuntime | null;
  frame: number | null;
  actors: ReadonlyMap<string, IAutoMovieProductionDialogueActor>;
}): ReadonlyMap<string, IAutoMovieDialogueExpressionLayers> => {
  const applied = new Map<string, IAutoMovieDialogueExpressionLayers>();
  if (props.runtime === null || props.frame === null) return applied;
  const frame = props.frame;
  if (Number.isSafeInteger(frame) === false || frame < 0)
    throw new Error("Dialogue runtime frame must be a non-negative integer.");
  const byActor = new Map<string, IAutoMovieDialogueVisemeTimeline[]>();
  for (const timeline of props.runtime.timelines) {
    const timelines = byActor.get(timeline.actor) ?? [];
    timelines.push(timeline);
    byActor.set(timeline.actor, timelines);
  }
  for (const [actor, timelines] of byActor) {
    const active = timelines.filter((timeline) =>
      timeline.ranges.some(
        (range) => frame >= range.startFrame && frame < range.endFrame,
      ),
    );
    if (active.length > 1)
      throw new Error(
        `Dialogue runtime overlaps ${active.length} mouth timelines on actor "${actor}".`,
      );
    const target = props.actors.get(actor);
    if (target === undefined) {
      if (active.length !== 0)
        throw new Error(
          `Dialogue line "${active[0]!.line}" targets absent actor "${actor}" in this shot.`,
        );
      continue;
    }
    const layers =
      active.length === 0
        ? {
            authored: target.authored,
            mouth: { preset: "neutral" as const, intensity: 0 },
          }
        : sampleAutoMovieDialogueExpression({
            timeline: active[0]!,
            frame,
            authored: target.authored,
          });
    const expressionTargets = target.object.expressionTargets ?? [];
    if (active.length !== 0 && expressionTargets.length === 0)
      throw new Error(
        `Dialogue line "${active[0]!.line}" targets actor "${actor}" without a mouth expression sink.`,
      );
    for (const expressionTarget of expressionTargets) {
      for (const preset of MOUTH_PRESETS)
        expressionTarget.setExpressionValue(preset, 0);
      if (layers.mouth.intensity !== 0)
        expressionTarget.setExpressionValue(
          layers.mouth.preset,
          layers.mouth.intensity,
        );
    }
    applied.set(actor, layers);
  }
  return applied;
};

/** Explicit live-soft admission, preserving authored order and nothing else. */
export interface IAutoMovieProductionWearableSoftSelection {
  /** Selected moving-boundary domain. */
  domain: IAutoMovieSoftBodyDomain;
  /** Zero-based authored budget slot. */
  subjectIndex: number;
  /** Exact selected subject ceiling. */
  maxSubjects: number;
}

/** Resolve one shot's exact share of the production-wide live-soft selection. */
export const selectProductionWearableSoftBodies = (
  domains: readonly IAutoMovieSoftBodyDomain[],
  selected: readonly string[],
): IAutoMovieProductionWearableSoftSelection[] =>
  selectProductionLiveWearableSoftBodies(domains, selected);

export interface IAutoMovieCompiledShotRuntime {
  id: string;
  /**
   * The shot's object graph, which is **not renderable until it has been
   * resolved for a camera**.
   *
   * Every instance set and formation builds its level-of-detail meshes hidden
   * and only reveals one when it is told how far away the eye is, so a scene
   * drawn straight out of this field shows the ordinary meshes and silently
   * drops every instanced population; the laid modules, the flags, the
   * boards. Call {@link IAutoMovieCompiledShotRuntime.resolveForCamera} first
   * when drawing this graph with a camera of your own; {@link render} already
   * does it for the shot's own camera.
   */
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /**
   * Reveal the level of detail each population owes the given eye.
   *
   * Separated from {@link render} because looking at a shot from somewhere the
   * shot does not go is an ordinary thing to want; a review from a fresh
   * angle, a survey of a surface nobody authored a camera for; and the only
   * alternative was to draw through the shot's own camera and get the authored
   * view back every time.
   *
   * @param camera Eye the populations resolve against.
   * @param viewportHeight Pixel height the projection is judged at; a taller
   *   viewport resolves more detail at the same distance.
   */
  resolveForCamera: (
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
  ) => void;
  render: (
    renderer: THREE.WebGLRenderer,
    time: number,
    pass: AutoMovieGuidePass,
    globalFrame?: number | null,
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
  runtime?: {
    /** Final-byte dialogue timelines installed before capture. */
    dialogue?: IAutoMovieProductionDialogueRuntime | null;
    /** Normalized production delivery crop for shot and film pages. */
    deliveryCrop?: IAutoMovieDeliveryCrop;
    /** Explicitly admitted live moving soft-body domain ids. */
    liveWearableSoftBodies?: readonly string[];
    /** Current compiler-owned film-global effect runtimes. */
    filmEffects?: readonly IAutoMovieCompiledFilmEffect[];
    /** Current identity established independently from the runtime array. */
    filmEffectIdentity?: IAutoMovieFilmEffectCurrentIdentity;
  },
): Promise<IAutoMovieCompiledShotRuntime> => {
  if (
    (runtime?.filmEffects === undefined) !==
    (runtime?.filmEffectIdentity === undefined)
  )
    throw new Error(
      "Film effects and their independently current identity must be supplied together.",
    );
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
  const filmEffectObjects = (runtime?.filmEffects ?? []).map((effect) => ({
    runtime: effect,
    object: buildInstancedEffect(effect.effect),
  }));
  for (const effect of filmEffectObjects) scene.scene.add(effect.object.object);
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
  const liveSoftSelections = selectProductionWearableSoftBodies(
    [...softBodyDomains.values()],
    runtime?.liveWearableSoftBodies ?? [],
  );
  const liveSoftIds = new Set(
    liveSoftSelections.map((selection) => selection.domain.id),
  );
  const softFurnishings = compiled.softFurnishings ?? [];
  const softDomainOwnership =
    validateAutoMovieSoftFurnishingDomainOwnership(softFurnishings);
  if (softDomainOwnership.success === false)
    throw new Error(
      `Compiled soft furnishing ownership is ambiguous: ${softDomainOwnership.violations
        .map((violation) => violation.expected)
        .join("; ")}.`,
    );
  const furnishingByDomain = new Map(
    softFurnishings.map((furnishing) => [furnishing.domain, furnishing]),
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
  const materialLibrary = await buildAutoMovieMaterialLibrary({
    models: compiled.models,
    materialIds: [
      ...(compiled.waterFeatures ?? []).map((feature) => feature.material),
      ...(compiled.softFurnishings ?? []).map(
        (furnishing) => furnishing.material,
      ),
      ...(compiled.plantingInstallations ?? []).flatMap((installation) => [
        installation.branchMaterial,
        installation.leafMaterial,
      ]),
    ],
    textures,
  });
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
        material: materialLibrary.resolve(feature.material),
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
    if (liveSoftIds.has(domain.id)) return [];
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
          material: materialLibrary.resolve(furnishing.material),
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
          branchMaterial: materialLibrary.resolve(installation.branchMaterial),
          leafMaterial: materialLibrary.resolve(installation.leafMaterial),
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
  const animations = compiled.scene.nodes.flatMap((node) => {
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
        node: node.id,
        target,
        motion,
        skeleton,
        startOffset: performance?.startOffset ?? 0,
        player: new AutoMoviePlayer(target.object, skeleton, motion),
      },
    ];
  });

  /** Reset and evaluate primary motion before any secondary domain reads it. */
  const applyPrimaryState = (
    time: number,
    flushImportedRuntime: boolean,
  ): void => {
    for (const [id, transform] of stagedNodeTransforms) {
      const object = nodeObjects.get(id)!;
      object.position.copy(transform.position);
      object.quaternion.copy(transform.quaternion);
      object.scale.copy(transform.scale);
    }
    for (const item of built)
      if (item.node.pose !== null && item.model.skeleton !== null)
        applyPose(item.object, item.node.pose, item.model.skeleton);
    for (const item of animations) {
      const seconds = Math.max(0, time - item.startOffset);
      if (flushImportedRuntime) item.player.update(seconds);
      else
        applyPose(
          item.target.object,
          sampleMotion(item.motion, seconds).pose,
          item.skeleton,
        );
    }
    articulation.restore();
    applyObjectMotions(
      compiled.shot.objectMotions,
      time,
      (node) => nodeObjects.get(node) ?? articulation.joints.get(node),
    );
    scene.scene.updateMatrixWorld(true);
  };

  /** Read one immutable moving-boundary snapshot from the evaluated scene. */
  const wearableFrame = (step: number): IAutoMovieWearableSoftFrame => ({
    step,
    nodes: [...nodeObjects].map(([node, object]) => {
      const worldPosition = object.getWorldPosition(new THREE.Vector3());
      const worldRotation = object.getWorldQuaternion(new THREE.Quaternion());
      return {
        node,
        worldPosition: vectorRecord(worldPosition),
        worldRotation: quaternionRecord(worldRotation),
      };
    }),
    actors: built.flatMap((item) => {
      if (item.model.skeleton === null) return [];
      const bones: IAutoMovieResolvedBone[] = [...item.object.bones].map(
        ([bone, object]) => {
          const worldPosition = object.getWorldPosition(new THREE.Vector3());
          const worldRotation = object.getWorldQuaternion(
            new THREE.Quaternion(),
          );
          return {
            bone,
            localRotation: quaternionRecord(object.quaternion),
            worldPosition: vectorRecord(worldPosition),
            worldRotation: quaternionRecord(worldRotation),
          };
        },
      );
      return [{ actor: item.node.id, bones }];
    }),
  });

  /** Solve one selected wearable from absolute primary-motion samples. */
  const solveLiveSoft = (
    selection: IAutoMovieProductionWearableSoftSelection,
    time: number,
  ) => {
    const step = softBodyStepAt(selection.domain, time);
    if (step === null)
      throw new Error(
        `Live wearable soft body "${selection.domain.id}" cannot be sampled at a non-finite time.`,
      );
    const frames: IAutoMovieWearableSoftFrame[] = [];
    for (let index = 0; index <= step; ++index) {
      applyPrimaryState(
        index * selection.domain.solver.fixedStepSeconds,
        false,
      );
      frames.push(wearableFrame(index));
    }
    return simulateAutoMovieWearableSoftBody({
      domain: selection.domain,
      step,
      frames,
      subjectIndex: selection.subjectIndex,
      maxSubjects: selection.maxSubjects,
    });
  };

  const liveSoftObjects = liveSoftSelections.map((selection) => {
    const solved = solveLiveSoft(selection, 0);
    const object = buildSoftBodyObject({
      surface: softBodySurfaceGeometry({
        domain: selection.domain,
        state: solved.state,
      }),
      status: "solved",
      material: materialLibrary.resolve(
        furnishingByDomain.get(selection.domain.id)?.material ?? null,
      ),
    });
    scene.scene.add(object.object);
    return { selection, object, budget: solved.budget };
  });

  const cameraIndex = compiled.scene.cameras.findIndex(
    (item) => item.id === compiled.shot.camera,
  );
  const selectedCameraIndex = cameraIndex < 0 ? 0 : cameraIndex;
  const sourceCamera = compiled.scene.cameras[selectedCameraIndex];
  const camera = scene.cameras[selectedCameraIndex];
  if (sourceCamera === undefined || camera === undefined)
    throw new Error("Compiled scene has no camera.");
  applyAutoMovieDeliveryCrop(camera, runtime?.deliveryCrop);
  const stagedCamera = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    scale: camera.scale.clone(),
  };
  /**
   * Reveal the level of detail each population owes one eye.
   *
   * `render` passes the animation state it has already lowered for this frame;
   * an outside caller drawing a still from its own camera passes nothing and
   * gets the populations resolved at rest, which is what a survey wants.
   */
  const resolveForCamera = (
    eye: THREE.PerspectiveCamera,
    viewportHeight: number,
    animation?: {
      time: number;
      heroSources: ReadonlyMap<string, IAutoMovieTransform>;
    },
  ): void => {
    const height = Math.max(1, viewportHeight);
    eye.updateMatrixWorld(true);
    for (const formation of formationObjects)
      formation.update(eye, height, animation?.time, animation?.heroSources);
    for (const instanceSet of instanceSetObjects)
      instanceSet.update(eye, height);
  };
  const render = (
    renderer: THREE.WebGLRenderer,
    time: number,
    pass: AutoMovieGuidePass,
    globalFrame: number | null = null,
  ): string => {
    assertAutoMovieViewerCameraDepthPrecision({
      renderer,
      source: sourceCamera,
      realized: camera,
    });
    const liveResults = liveSoftObjects.map((item) => ({
      item,
      solved: solveLiveSoft(item.selection, time),
    }));
    applyPrimaryState(time, true);
    camera.position.copy(stagedCamera.position);
    camera.quaternion.copy(stagedCamera.quaternion);
    camera.scale.copy(stagedCamera.scale);
    for (const result of liveResults) {
      result.item.object.update({
        surface: softBodySurfaceGeometry({
          domain: result.item.selection.domain,
          state: result.solved.state,
        }),
        status: "solved",
      });
      result.item.budget = result.solved.budget;
    }
    applyProductionDialogueMouth({
      runtime: runtime?.dialogue ?? null,
      frame: globalFrame,
      actors: new Map(
        built.map((item) => [
          item.node.id,
          {
            object: item.object,
            authored:
              animations.find((animation) => animation.node === item.node.id)
                ?.player.lastExpression ?? null,
          },
        ]),
      ),
    });
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
    resolveForCamera(camera, Math.max(1, renderer.domElement.height), {
      time,
      heroSources,
    });
    for (const effect of effectObjects) effect.update(camera, time);
    if (globalFrame === null) {
      for (const effect of filmEffectObjects)
        effect.object.object.visible = false;
    } else if (filmEffectObjects.length !== 0) {
      sampleProductionFilmEffects({
        identity: runtime!.filmEffectIdentity!,
        effects: filmEffectObjects.map((effect) => effect.runtime),
        timelineFrame: globalFrame,
      });
      for (const effect of filmEffectObjects)
        effect.object.update(
          camera,
          productionFrameBoundaryToSeconds({
            frame: globalFrame,
            frameRate: effect.runtime.frameRate,
          }),
        );
    }
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
    filmEffectObjects.forEach(({ runtime: effect, object }) => {
      if (globalFrame === null) return;
      const expectedActive =
        globalFrame >= effect.startFrame && globalFrame < effect.endFrame;
      if (
        object.stats.active !== expectedActive ||
        object.stats.particles < 0 ||
        object.stats.particles > object.stats.cap
      )
        throw new Error(
          `Film effect viewer inventory diverged for "${effect.effect.id}".`,
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
    const liveSoftStatus = liveSoftObjects
      .map(
        ({ selection, budget }) =>
          `S${selection.subjectIndex + 1}/${budget.maxSubjects}` +
          ` A${budget.anchorsPerStep}/C${budget.capsulesPerStep}` +
          ` B${budget.boundaryRecords}`,
      )
      .join(" ");
    const runtimeStatus = [
      formationStatus,
      instanceStatus,
      effectStatus,
      liveSoftStatus,
    ]
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
    resolveForCamera,
    render,
    dispose: async () => {
      for (const water of waterObjects) {
        water.surface.dispose();
        water.spray.dispose();
      }
      for (const soft of softObjects) soft.object.dispose();
      for (const soft of liveSoftObjects) soft.object.dispose();
      for (const planting of plantingObjects) planting.dispose();
      materialLibrary.dispose();
      await textures.dispose();
    },
  };
};

const vectorRecord = (value: THREE.Vector3) => ({
  x: value.x,
  y: value.y,
  z: value.z,
});

const quaternionRecord = (value: THREE.Quaternion) => ({
  x: value.x,
  y: value.y,
  z: value.z,
  w: value.w,
});
