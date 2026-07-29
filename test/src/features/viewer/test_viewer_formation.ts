import { transformFormationPoint } from "@automovie/engine";
import { IAutoMovieModelRecipe } from "@automovie/interface";
import {
  materializeCompiledFormation,
  materializeFormationSlot,
  materializeProductionModels,
} from "@automovie/mcp";
import {
  buildInstancedFormation,
  regenerateFormationSlot,
  sampleFormationMotion,
  selectFormationLod,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { nclose } from "../internal/predicates";
import { formationDesign, modelRecipe } from "../mcp/productionFixtures";

const propRecipe = (id: string, size: number): IAutoMovieModelRecipe => ({
  ...modelRecipe(),
  id,
  role: "prop",
  archetype: "primitive-prop",
  parameters: {
    shape: "box",
    width: size,
    height: size * 2,
    depth: size,
  },
  capabilities: [],
  lod: [{ tier: "far", maxDistance: null, recipe: id }],
});

/**
 * Compact formations regenerate exact slots and render through bounded LOD
 * batches. Promoted heroes remain explicit scene objects whose authored motion
 * composes with the same formation law used by the geometry oracle.
 *
 * Scenarios:
 *
 * 1. Chunk batches exclude promoted heroes, preserve compiler slot regeneration,
 *    carry phase attributes, and change digest when a referenced LOD recipe
 *    changes.
 * 2. Distance, projected size, default/explicit hysteresis, and the unbounded
 *    fallback select stable near/far tiers; an empty LOD list fails closed.
 * 3. A sampled formation update culls whole chunks, preserves a bounded inventory,
 *    composes source hero translation/rotation without repeated-call
 *    accumulation, and culls from the scaled posed visual root rather than the
 *    unscaled slot.
 * 4. Motion sampling covers every easing, before/between/after intervals,
 *    end-exclusive handoff, unrelated formations, deterministic equal starts,
 *    spacing, and base-facing point transforms.
 * 5. Missing runtime LOD models throw, while an all-hero chunk emits no zero-count
 *    instance mesh.
 */
export const test_viewer_formation = (): void => {
  const hero = propRecipe("army-hero", 0.6);
  const near = propRecipe("army-near", 0.4);
  const far = propRecipe("army-far", 0.2);
  hero.lod = [
    { tier: "hero", maxDistance: 10, recipe: hero.id },
    { tier: "near", maxDistance: 50, recipe: near.id },
    { tier: "far", maxDistance: null, recipe: far.id },
  ];
  const recipes = new Map(
    [hero, near, far].map((recipe) => [recipe.id, recipe]),
  );
  const design = {
    ...formationDesign({
      kind: "line",
      ranks: 3,
      files: 1_024,
      spacing: { lateral: 0.8, depth: 0.9 },
    }),
    id: "army",
    modelRecipe: hero.id,
    count: 2_049,
    heroOverrides: [
      { slot: 0, actor: "marshal" },
      { slot: 1_024, actor: "captain" },
    ],
  };
  const formation = materializeCompiledFormation(design, recipes);
  const changedNear = {
    ...near,
    palette: { body: "#abcdef" },
  };
  const changedRecipes = new Map(recipes);
  changedRecipes.set(changedNear.id, changedNear);
  const changedFormation = materializeCompiledFormation(design, changedRecipes);
  const runtimeModels = materializeProductionModels(recipes);
  const models = new Map(
    [...runtimeModels.values()].map((model) => [model.id, model]),
  );
  const heroObjects = new Map(
    formation.heroes.map((hero) => {
      const object = new THREE.Object3D();
      object.position.set(
        hero.transform.translation.x,
        hero.transform.translation.y,
        hero.transform.translation.z,
      );
      object.quaternion.set(
        hero.transform.rotation.x,
        hero.transform.rotation.y,
        hero.transform.rotation.z,
        hero.transform.rotation.w,
      );
      return [hero.actor, object] as const;
    }),
  );
  const heroVisualObjects = new Map(
    [...heroObjects].map(([actor, object]) => {
      const visual = new THREE.Object3D();
      object.add(visual);
      return [actor, visual] as const;
    }),
  );
  const motion = {
    id: "army-advance",
    formation: formation.id,
    action: "advance" as const,
    start: 0,
    end: 6,
    from: {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    to: {
      translation: { x: 0, y: 0, z: -6 },
      facingOffsetDeg: 20,
      spacingScale: { lateral: 1.2, depth: 0.8 },
    },
    easing: "linear" as const,
  };
  const built = buildInstancedFormation({
    formation,
    models,
    motions: [motion],
    heroObjects,
    heroVisualObjects,
  });
  const meshes = built.object.children.filter(
    (object): object is THREE.InstancedMesh =>
      object instanceof THREE.InstancedMesh,
  );
  const perTier = new Map<string, number>();
  for (const mesh of meshes) {
    const tier = mesh.name.split(":").at(-1)!;
    perTier.set(tier, (perTier.get(tier) ?? 0) + mesh.count);
  }
  const compilerBoundary = materializeFormationSlot(design, 1_024);
  const viewerBoundary = regenerateFormationSlot(formation, 1_024);
  TestValidator.predicate(
    "chunk batches exclude heroes and preserve exact compiler slot regeneration",
    formation.chunks.length === 3 &&
      meshes.length === formation.chunks.length * formation.lod.length &&
      [...perTier.values()].every(
        (count) => count === formation.anonymousCount,
      ) &&
      meshes.every(
        (mesh) =>
          mesh.geometry.getAttribute("automoviePhase")?.count === mesh.count &&
          mesh.frustumCulled === false,
      ) &&
      JSON.stringify(compilerBoundary) === JSON.stringify(viewerBoundary) &&
      formation.digest !== changedFormation.digest &&
      formation.lod.find((lod) => lod.tier === "near")?.recipeDigest !==
        changedFormation.lod.find((lod) => lod.tier === "near")?.recipeDigest,
  );

  const nearSelection = selectFormationLod({
    lod: formation.lod,
    distance: 5,
    projectedPixels: 24,
    previous: null,
  });
  const retainedNear = selectFormationLod({
    lod: formation.lod,
    distance: 52,
    projectedPixels: 24,
    previous: "near",
  });
  const retainedWithExplicitHysteresis = selectFormationLod({
    lod: formation.lod,
    distance: 55,
    projectedPixels: 24,
    previous: "near",
    hysteresis: 0.2,
  });
  const farSelection = selectFormationLod({
    lod: formation.lod,
    distance: 56,
    projectedPixels: 24,
    previous: "near",
  });
  const projectedFar = selectFormationLod({
    lod: formation.lod,
    distance: 5,
    projectedPixels: 2,
    previous: null,
  });
  const zeroProjectedFar = selectFormationLod({
    lod: formation.lod,
    distance: 5,
    projectedPixels: 0,
    previous: null,
  });
  const retainedFar = selectFormationLod({
    lod: formation.lod,
    distance: 45,
    projectedPixels: 24,
    previous: "far",
  });
  const switchedNear = selectFormationLod({
    lod: formation.lod,
    distance: 44,
    projectedPixels: 24,
    previous: "far",
  });
  const unchangedNear = selectFormationLod({
    lod: formation.lod,
    distance: 5,
    projectedPixels: 24,
    previous: "near",
  });
  const missingUnboundedFallback = selectFormationLod({
    lod: formation.lod.map((lod) => ({ ...lod, maxDistance: 1 })),
    distance: 100,
    projectedPixels: 24,
    previous: null,
  });
  TestValidator.predicate(
    "automatic LOD combines distance, projected size and hysteresis",
    nearSelection.lod.tier === "near" &&
      retainedNear.lod.tier === "near" &&
      retainedWithExplicitHysteresis.lod.tier === "near" &&
      farSelection.lod.tier === "far" &&
      projectedFar.lod.tier === "far" &&
      zeroProjectedFar.lod.tier === "far" &&
      retainedFar.lod.tier === "far" &&
      switchedNear.lod.tier === "near" &&
      unchangedNear.lod.tier === "near" &&
      missingUnboundedFallback.lod.tier === "far" &&
      (() => {
        try {
          selectFormationLod({
            lod: [],
            distance: 1,
            projectedPixels: 1,
            previous: null,
          });
          return false;
        } catch {
          return true;
        }
      })(),
  );

  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 2_000);
  camera.position.set(0, 5, 20);
  camera.lookAt(0, 0, 0);
  heroObjects.get("marshal")!.position.add(new THREE.Vector3(1, 0, 2));
  heroObjects
    .get("marshal")!
    .quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        THREE.MathUtils.degToRad(15),
      ),
    );
  heroVisualObjects.get("marshal")!.position.x = 100;
  const sourceTransforms = new Map(
    [...heroObjects].map(
      ([actor, object]) =>
        [
          actor,
          {
            translation: point(object.position),
            rotation: rotation(object.quaternion),
            scale: point(object.scale),
          },
        ] as const,
    ),
  );
  built.update(camera, 1_080, 3, sourceTransforms);
  const firstHeroUpdate = {
    position: heroObjects.get("marshal")!.position.clone(),
    rotation: heroObjects.get("marshal")!.quaternion.clone(),
  };
  built.update(camera, 1_080, 3, sourceTransforms);
  const sameSourceStable =
    heroObjects.get("marshal")!.position.equals(firstHeroUpdate.position) &&
    Math.abs(
      heroObjects.get("marshal")!.quaternion.dot(firstHeroUpdate.rotation),
    ) >
      1 - 1e-12;
  const collidingSources = new Map(sourceTransforms);
  collidingSources.set("marshal", {
    translation: point(firstHeroUpdate.position),
    rotation: rotation(firstHeroUpdate.rotation),
    scale: point(heroObjects.get("marshal")!.scale),
  });
  built.update(camera, 1_080, 3, collidingSources);
  const collidingSourceUpdate = {
    position: heroObjects.get("marshal")!.position.clone(),
    rotation: heroObjects.get("marshal")!.quaternion.clone(),
  };
  built.update(camera, 1_080, 3, collidingSources);
  const unscaledHeroCenter = new THREE.Vector3();
  heroVisualObjects.get("captain")!.getWorldPosition(unscaledHeroCenter);
  const cameraSpaceHero = unscaledHeroCenter
    .clone()
    .applyMatrix4(camera.matrixWorldInverse);
  const halfWidthAtHero =
    Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) *
    -cameraSpaceHero.z *
    camera.aspect;
  const authoredRadius = formation.projectionRadius * 12;
  const decomposedRadius =
    formation.projectionRadius * Math.hypot(12, 1) * Math.SQRT1_2;
  const horizontalPlaneNormalization = Math.hypot(
    1,
    Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect,
  );
  const scaledSources = new Map(collidingSources);
  scaledSources.set("captain", {
    ...scaledSources.get("captain")!,
    translation: {
      ...scaledSources.get("captain")!.translation,
      x:
        scaledSources.get("captain")!.translation.x +
        halfWidthAtHero +
        ((authoredRadius + decomposedRadius) / 2) *
          horizontalPlaneNormalization -
        unscaledHeroCenter.x,
    },
    scale: { x: 12, y: 1, z: 1 },
  });
  heroVisualObjects
    .get("captain")!
    .quaternion.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      THREE.MathUtils.degToRad(45),
    );
  built.update(camera, 1_080, 3, scaledSources);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const scaledFrustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  const scaledHeroCenter = new THREE.Vector3();
  const scaledHeroScale = new THREE.Vector3();
  heroVisualObjects.get("captain")!.getWorldPosition(scaledHeroCenter);
  heroVisualObjects.get("captain")!.getWorldScale(scaledHeroScale);
  const scaledHeroBoundary =
    scaledFrustum.intersectsSphere(
      new THREE.Sphere(
        scaledHeroCenter,
        formation.projectionRadius *
          Math.max(
            Math.abs(scaledHeroScale.x),
            Math.abs(scaledHeroScale.y),
            Math.abs(scaledHeroScale.z),
          ),
      ),
    ) === false &&
    scaledFrustum.intersectsSphere(
      new THREE.Sphere(
        scaledHeroCenter,
        formation.projectionRadius *
          Math.max(
            Math.abs(scaledSources.get("captain")!.scale.x),
            Math.abs(scaledSources.get("captain")!.scale.y),
            Math.abs(scaledSources.get("captain")!.scale.z),
          ),
      ),
    );
  const firstMatrix = new THREE.Matrix4();
  meshes[0]!.getMatrixAt(0, firstMatrix);
  const firstTranslation = new THREE.Vector3().setFromMatrixPosition(
    firstMatrix,
  );
  const firstAnonymous = regenerateFormationSlot(formation, 1);
  const firstScaled = transformFormationPoint(
    firstAnonymous.position,
    formation.anchor,
    {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1.1, depth: 0.9 },
    },
    formation.facingDeg,
  );
  const sampledMotion = sampleFormationMotion([motion], formation.id, 3);
  const easingSamples = (
    ["linear", "easeIn", "easeOut", "easeInOut", "step"] as const
  ).map((easing) =>
    sampleFormationMotion([{ ...motion, easing }], formation.id, 3),
  );
  const easeInOutQuarter = sampleFormationMotion(
    [{ ...motion, easing: "easeInOut" }],
    formation.id,
    1.5,
  );
  const delayedMotion = {
    ...motion,
    id: "army-delayed",
    start: 8,
    end: 10,
    from: motion.to,
    to: { ...motion.to, translation: { x: 0, y: 0, z: -10 } },
  };
  const beforeMotion = sampleFormationMotion([motion], formation.id, -1);
  const betweenMotions = sampleFormationMotion(
    [delayedMotion, motion],
    formation.id,
    7,
  );
  const afterMotions = sampleFormationMotion(
    [delayedMotion, motion],
    formation.id,
    11,
  );
  const touchingMotion = {
    ...delayedMotion,
    start: motion.end,
    from: {
      ...motion.to,
      translation: { x: 0, y: 0, z: -8 },
    },
  };
  const atExclusiveBoundary = sampleFormationMotion(
    [motion, touchingMotion],
    formation.id,
    motion.end,
  );
  const unrelatedMotion = sampleFormationMotion([motion], "other", 3);
  const sameStartA = {
    ...motion,
    id: "a",
    to: { ...motion.to, translation: { x: 0, y: 0, z: -2 } },
  };
  const sameStartB = {
    ...motion,
    id: "b",
    to: { ...motion.to, translation: { x: 0, y: 0, z: -4 } },
  };
  const sameStartSamples = [
    sampleFormationMotion([sameStartB, sameStartA], formation.id, 3),
    sampleFormationMotion([sameStartA, sameStartB], formation.id, 3),
    sampleFormationMotion([sameStartA, { ...sameStartA }], formation.id, 3),
  ];
  const transformed = transformFormationPoint(
    { x: 1, y: 2, z: 0 },
    { x: 0, y: 0, z: 0 },
    {
      translation: { x: 3, y: 4, z: 5 },
      facingOffsetDeg: 90,
      spacingScale: { lateral: 2, depth: 3 },
    },
  );
  const baseFacingTransformed = transformFormationPoint(
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 0, z: 0 },
    {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 2, depth: 3 },
    },
    90,
  );
  const visible =
    built.stats.visible.hero +
    built.stats.visible.near +
    built.stats.visible.far;
  const yawDegrees = (rotation: THREE.Quaternion): number =>
    THREE.MathUtils.radToDeg(
      new THREE.Euler().setFromQuaternion(rotation, "YXZ").y,
    );
  const marshal = heroObjects.get("marshal")!;
  // Named rather than folded into one conjunction: this scenario pins thirty
  // separate facts, and a bare predicate reports only that one of them broke.
  TestValidator.equals(
    "camera update culls whole chunks and reports a bounded visible inventory",
    {
      accountedAnonymous: visible + built.stats.culled,
      heroes: built.stats.heroes,
      visibleMeshesWithinChunks:
        meshes.filter((mesh) => mesh.visible).length <= formation.chunks.length,
      motionTranslationZ: sampledMotion.translation.z,
      motionFacingOffsetDeg: sampledMotion.facingOffsetDeg,
      motionLateralScale: sampledMotion.spacingScale.lateral,
      rootPositionZ: built.object.position.z,
      firstHeroPositionZ: firstHeroUpdate.position.z,
      firstHeroYaw: nclose(yawDegrees(firstHeroUpdate.rotation), 25, 1e-9),
      repeatedUpdatesKeepSource: sameSourceStable,
      marshalPositionZ: marshal.position.z,
      marshalYaw: nclose(yawDegrees(marshal.quaternion), 35, 1e-9),
      marshalTracksCollidingSource:
        marshal.position.equals(collidingSourceUpdate.position) &&
        Math.abs(marshal.quaternion.dot(collidingSourceUpdate.rotation)) >
          1 - 1e-12,
      someHeroVisible: built.stats.visible.hero > 0,
      marshalVisible: marshal.visible,
      captainVisible: heroObjects.get("captain")!.visible,
      shearedHeroBoundsStayVisible: scaledHeroBoundary,
      rootScaleX: built.object.scale.x,
      scaledSlotMatchesTranslation: nclose(
        firstTranslation.x,
        firstScaled.x - formation.anchor.x,
        1e-5,
      ),
      easingTrack: easingSamples
        .map((sample) => sample.translation.z)
        .join(","),
      easeInOutQuarterZ: easeInOutQuarter.translation.z,
      beforeMotionZ: beforeMotion.translation.z,
      betweenMotionsZ: betweenMotions.translation.z,
      afterMotionsZ: afterMotions.translation.z,
      exclusiveBoundaryZ: atExclusiveBoundary.translation.z,
      unrelatedMotionZ: unrelatedMotion.translation.z,
      sameStartResolvesOnce: sameStartSamples.every(
        (sample) => sample.translation.z === -1,
      ),
      transformedX: nclose(transformed.x, 3, 1e-12),
      transformedY: transformed.y,
      transformedZ: transformed.z,
      baseFacingX: nclose(baseFacingTransformed.x, 0, 1e-12),
      baseFacingZ: baseFacingTransformed.z,
    },
    {
      accountedAnonymous: formation.anonymousCount,
      heroes: formation.heroes.length,
      visibleMeshesWithinChunks: true,
      motionTranslationZ: -3,
      motionFacingOffsetDeg: 10,
      motionLateralScale: 1.1,
      rootPositionZ: formation.anchor.z - 3,
      firstHeroPositionZ: formation.anchor.z - 1,
      firstHeroYaw: true,
      repeatedUpdatesKeepSource: true,
      marshalPositionZ: firstHeroUpdate.position.z - 3,
      marshalYaw: true,
      marshalTracksCollidingSource: true,
      someHeroVisible: true,
      marshalVisible: false,
      captainVisible: true,
      shearedHeroBoundsStayVisible: true,
      rootScaleX: 1,
      scaledSlotMatchesTranslation: true,
      easingTrack: "-3,-1.5,-4.5,-3,0",
      easeInOutQuarterZ: -0.75,
      beforeMotionZ: 0,
      betweenMotionsZ: -6,
      afterMotionsZ: -10,
      exclusiveBoundaryZ: -8,
      unrelatedMotionZ: 0,
      sameStartResolvesOnce: true,
      transformedX: true,
      transformedY: 6,
      transformedZ: 3,
      baseFacingX: true,
      baseFacingZ: -2,
    },
  );

  TestValidator.predicate(
    "missing LOD runtime models fail closed",
    (() => {
      try {
        buildInstancedFormation({ formation, models: new Map() });
        return false;
      } catch {
        return true;
      }
    })(),
  );

  const heroesOnly = materializeCompiledFormation(
    {
      ...design,
      count: 2,
      layout: {
        kind: "line",
        ranks: 1,
        files: 2,
        spacing: { lateral: 1, depth: 1 },
      },
      heroOverrides: [
        { slot: 0, actor: "first" },
        { slot: 1, actor: "second" },
      ],
    },
    recipes,
  );
  TestValidator.predicate(
    "an all-hero chunk creates no zero-count instance mesh",
    buildInstancedFormation({ formation: heroesOnly, models }).object.children
      .length === 0,
  );
};

const point = (value: { x: number; y: number; z: number }) => ({
  x: value.x,
  y: value.y,
  z: value.z,
});

const rotation = (value: { x: number; y: number; z: number; w: number }) => ({
  x: value.x,
  y: value.y,
  z: value.z,
  w: value.w,
});
