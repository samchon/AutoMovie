import {
  composeFormationHeroTransform,
  formationSlotPosition,
  transformFormationPoint,
} from "@automovie/engine";
import {
  IAutoMovieCompiledFormation,
  IAutoMovieModelRecipe,
} from "@automovie/interface";
import {
  materializeCompiledFormation,
  materializeFormationSlot,
  materializeProductionModels,
} from "@automovie/mcp";
import {
  buildInstancedFormation,
  flattenInstancedObject,
  regenerateFormationSlot,
  sampleFormationMotion,
  selectFormationLod,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts, nclose } from "../internal/predicates";
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
 * 5. Missing runtime LOD models throw, unmergeable rigid parts are refused by
 *    name, a regenerated hero slot names its actor, and an all-hero chunk emits
 *    no zero-count instance mesh.
 * 6. A re-forming unit draws the arrangement it is travelling to rather than the
 *    one it designed, and a frame that repeats the same instant rewrites
 *    nothing.
 * 7. Heroes handed over bare — no host objects at all, or objects with neither a
 *    source nor a pose root — are counted and placed from what the host did
 *    give.
 * 8. At a heading the rounded degree-to-radian conversion gets wrong, the renderer
 *    still puts a chunk's mass on the exact double the engine's placement law
 *    does, proven at an LOD boundary laid on that value from both sides.
 */
export const test_viewer_formation = (): void => {
  const hero = propRecipe("chorus-hero", 0.6);
  const near = propRecipe("chorus-near", 0.4);
  const far = propRecipe("chorus-far", 0.2);
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
    id: "chorus",
    modelRecipe: hero.id,
    count: 2_049,
    // Central slots on two ranks. A promoted hero on the outer file of a
    // 1024-file line stands hundreds of metres off the formation centre, where
    // no camera aimed at the anchor can see it, and the culling half of this
    // scenario needs heroes that are actually in frame.
    heroOverrides: [
      { slot: 511, actor: "lead" },
      { slot: 1_535, actor: "second" },
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
    id: "chorus-advance",
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
  TestValidator.equals(
    "chunk batches exclude heroes and preserve exact compiler slot regeneration",
    namedFacts([
      ["formationChunks", () => formation.chunks.length === 3],
      [
        "meshesFormationChunks",
        () => meshes.length === formation.chunks.length * formation.lod.length,
      ],
      [
        "perTierValuesCount",
        () =>
          [...perTier.values()].every(
            (count) => count === formation.anonymousCount,
          ),
      ],
      [
        "meshesMeshMesh",
        () =>
          meshes.every(
            (mesh) =>
              mesh.geometry.getAttribute("automoviePhase")?.count ===
                mesh.count && mesh.frustumCulled === false,
          ),
      ],
      [
        "stringifyCompilerBoundaryStringify",
        () =>
          JSON.stringify(compilerBoundary) === JSON.stringify(viewerBoundary),
      ],
      [
        "formationDigestChangedFormation",
        () => formation.digest !== changedFormation.digest,
      ],
      [
        "formationLodFind",
        () =>
          formation.lod.find((lod) => lod.tier === "near")?.recipeDigest !==
          changedFormation.lod.find((lod) => lod.tier === "near")?.recipeDigest,
      ],
    ]),
    {
      formationChunks: true,
      meshesFormationChunks: true,
      perTierValuesCount: true,
      meshesMeshMesh: true,
      stringifyCompilerBoundaryStringify: true,
      formationDigestChangedFormation: true,
      formationLodFind: true,
    },
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
  TestValidator.equals(
    "automatic LOD combines distance, projected size and hysteresis",
    namedFacts([
      ["nearSelectionLodTier", () => nearSelection.lod.tier === "near"],
      [
        "retainedNearLodTier",
        () =>
          nearSelection.lod.tier === "near" && retainedNear.lod.tier === "near",
      ],
      [
        "retainedWithExplicitHysteresisLodTier",
        () =>
          nearSelection.lod.tier === "near" &&
          retainedNear.lod.tier === "near" &&
          retainedWithExplicitHysteresis.lod.tier === "near",
      ],
      [
        "farSelectionLodTier",
        () =>
          nearSelection.lod.tier === "near" &&
          retainedNear.lod.tier === "near" &&
          retainedWithExplicitHysteresis.lod.tier === "near" &&
          farSelection.lod.tier === "far",
      ],
      [
        "projectedFarLodTier",
        () =>
          nearSelection.lod.tier === "near" &&
          retainedNear.lod.tier === "near" &&
          retainedWithExplicitHysteresis.lod.tier === "near" &&
          farSelection.lod.tier === "far" &&
          projectedFar.lod.tier === "far",
      ],
      [
        "zeroProjectedFarLodTier",
        () =>
          nearSelection.lod.tier === "near" &&
          retainedNear.lod.tier === "near" &&
          retainedWithExplicitHysteresis.lod.tier === "near" &&
          farSelection.lod.tier === "far" &&
          projectedFar.lod.tier === "far" &&
          zeroProjectedFar.lod.tier === "far",
      ],
      [
        "retainedFarLodTier",
        () =>
          nearSelection.lod.tier === "near" &&
          retainedNear.lod.tier === "near" &&
          retainedWithExplicitHysteresis.lod.tier === "near" &&
          farSelection.lod.tier === "far" &&
          projectedFar.lod.tier === "far" &&
          zeroProjectedFar.lod.tier === "far" &&
          retainedFar.lod.tier === "far",
      ],
      [
        "switchedNearLodTier",
        () =>
          nearSelection.lod.tier === "near" &&
          retainedNear.lod.tier === "near" &&
          retainedWithExplicitHysteresis.lod.tier === "near" &&
          farSelection.lod.tier === "far" &&
          projectedFar.lod.tier === "far" &&
          zeroProjectedFar.lod.tier === "far" &&
          retainedFar.lod.tier === "far" &&
          switchedNear.lod.tier === "near",
      ],
      [
        "unchangedNearLodTier",
        () =>
          nearSelection.lod.tier === "near" &&
          retainedNear.lod.tier === "near" &&
          retainedWithExplicitHysteresis.lod.tier === "near" &&
          farSelection.lod.tier === "far" &&
          projectedFar.lod.tier === "far" &&
          zeroProjectedFar.lod.tier === "far" &&
          retainedFar.lod.tier === "far" &&
          switchedNear.lod.tier === "near" &&
          unchangedNear.lod.tier === "near",
      ],
      [
        "missingUnboundedFallbackLodTier",
        () =>
          nearSelection.lod.tier === "near" &&
          retainedNear.lod.tier === "near" &&
          retainedWithExplicitHysteresis.lod.tier === "near" &&
          farSelection.lod.tier === "far" &&
          projectedFar.lod.tier === "far" &&
          zeroProjectedFar.lod.tier === "far" &&
          retainedFar.lod.tier === "far" &&
          switchedNear.lod.tier === "near" &&
          unchangedNear.lod.tier === "near" &&
          missingUnboundedFallback.lod.tier === "far",
      ],
      [
        "trySelectFormationLodLod",
        () =>
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
      ],
    ]),
    {
      nearSelectionLodTier: true,
      retainedNearLodTier: true,
      retainedWithExplicitHysteresisLodTier: true,
      farSelectionLodTier: true,
      projectedFarLodTier: true,
      zeroProjectedFarLodTier: true,
      retainedFarLodTier: true,
      switchedNearLodTier: true,
      unchangedNearLodTier: true,
      missingUnboundedFallbackLodTier: true,
      trySelectFormationLodLod: true,
    },
  );

  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 2_000);
  camera.position.set(0, 5, 20);
  camera.lookAt(0, 0, 0);
  heroObjects.get("lead")!.position.add(new THREE.Vector3(1, 0, 2));
  heroObjects
    .get("lead")!
    .quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        THREE.MathUtils.degToRad(15),
      ),
    );
  heroVisualObjects.get("lead")!.position.x = 100;
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
    position: heroObjects.get("lead")!.position.clone(),
    rotation: heroObjects.get("lead")!.quaternion.clone(),
  };
  built.update(camera, 1_080, 3, sourceTransforms);
  const sameSourceStable =
    heroObjects.get("lead")!.position.equals(firstHeroUpdate.position) &&
    Math.abs(
      heroObjects.get("lead")!.quaternion.dot(firstHeroUpdate.rotation),
    ) >
      1 - 1e-12;
  const collidingSources = new Map(sourceTransforms);
  collidingSources.set("lead", {
    translation: point(firstHeroUpdate.position),
    rotation: rotation(firstHeroUpdate.rotation),
    scale: point(heroObjects.get("lead")!.scale),
  });
  built.update(camera, 1_080, 3, collidingSources);
  const collidingSourceUpdate = {
    position: heroObjects.get("lead")!.position.clone(),
    rotation: heroObjects.get("lead")!.quaternion.clone(),
  };
  built.update(camera, 1_080, 3, collidingSources);
  const unscaledHeroCenter = new THREE.Vector3();
  heroVisualObjects.get("second")!.getWorldPosition(unscaledHeroCenter);
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
  scaledSources.set("second", {
    ...scaledSources.get("second")!,
    translation: {
      ...scaledSources.get("second")!.translation,
      x:
        scaledSources.get("second")!.translation.x +
        halfWidthAtHero +
        ((authoredRadius + decomposedRadius) / 2) *
          horizontalPlaneNormalization -
        unscaledHeroCenter.x,
    },
    scale: { x: 12, y: 1, z: 1 },
  });
  heroVisualObjects
    .get("second")!
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
  heroVisualObjects.get("second")!.getWorldPosition(scaledHeroCenter);
  heroVisualObjects.get("second")!.getWorldScale(scaledHeroScale);
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
            Math.abs(scaledSources.get("second")!.scale.x),
            Math.abs(scaledSources.get("second")!.scale.y),
            Math.abs(scaledSources.get("second")!.scale.z),
          ),
      ),
    );
  const firstMatrix = new THREE.Matrix4();
  meshes[0]!.getMatrixAt(0, firstMatrix);
  const firstTranslation = new THREE.Vector3().setFromMatrixPosition(
    firstMatrix,
  );
  // Instance 0 of the first chunk is slot 0: the promoted heroes sit at 511
  // and 1535, so no hero displaces the head of the chunk.
  const firstAnonymous = regenerateFormationSlot(formation, 0);
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
  const stepAtEnd = sampleFormationMotion(
    [{ ...motion, easing: "step" }],
    formation.id,
    motion.end,
  );
  const easeInOutQuarter = sampleFormationMotion(
    [{ ...motion, easing: "easeInOut" }],
    formation.id,
    1.5,
  );
  const delayedMotion = {
    ...motion,
    id: "chorus-delayed",
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
  // Anonymous accounting is near + far + culled. The `hero` key counts
  // promoted hero objects inside the frustum, which are not instance slots.
  const visibleAnonymous = built.stats.visible.near + built.stats.visible.far;
  const yawDegrees = (rotation: THREE.Quaternion): number =>
    THREE.MathUtils.radToDeg(
      new THREE.Euler().setFromQuaternion(rotation, "YXZ").y,
    );
  const lead = heroObjects.get("lead")!;
  // A promoted hero renders at its formation-transformed slot plus whatever the
  // source authored as an offset from that slot, so the expected world position
  // is composed from the same law rather than written down.
  const leadSlot = formation.heroes.find((hero) => hero.actor === "lead")!
    .transform.translation;
  const composedLeadZ = (sourceZ: number): number =>
    transformFormationPoint(
      leadSlot,
      formation.anchor,
      sampledMotion,
      formation.facingDeg,
    ).z +
    (sourceZ - leadSlot.z);
  // Named rather than folded into one conjunction: this scenario pins thirty
  // separate facts, and a bare predicate reports only that one of them broke.
  TestValidator.equals(
    "camera update culls whole chunks and reports a bounded visible inventory",
    {
      accountedAnonymous: visibleAnonymous + built.stats.culled,
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
      leadPositionZ: lead.position.z,
      leadYaw: nclose(yawDegrees(lead.quaternion), 35, 1e-9),
      leadTracksCollidingSource:
        lead.position.equals(collidingSourceUpdate.position) &&
        Math.abs(lead.quaternion.dot(collidingSourceUpdate.rotation)) >
          1 - 1e-12,
      visibleHeroes: built.stats.visible.hero,
      leadVisible: lead.visible,
      secondVisible: heroObjects.get("second")!.visible,
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
      stepAtEndZ: stepAtEnd.translation.z,
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
      firstHeroPositionZ: composedLeadZ(
        sourceTransforms.get("lead")!.translation.z,
      ),
      firstHeroYaw: true,
      repeatedUpdatesKeepSource: true,
      leadPositionZ: composedLeadZ(collidingSources.get("lead")!.translation.z),
      leadYaw: true,
      leadTracksCollidingSource: true,
      visibleHeroes: 1,
      leadVisible: false,
      secondVisible: true,
      shearedHeroBoundsStayVisible: true,
      rootScaleX: 1,
      scaledSlotMatchesTranslation: true,
      easingTrack: "-3,-1.5,-4.5,-3,0",
      stepAtEndZ: -6,
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

  // Parts that cannot merge into one geometry are refused by name rather than
  // batched into whichever of them the merge kept. One draw call per chunk is
  // the whole promise of this path, and a merge that quietly dropped a part
  // would keep that promise over a figure missing a limb.
  TestValidator.predicate(
    "rigid parts that cannot merge into one geometry are refused",
    (() => {
      const mismatched = new THREE.Group();
      const textured = new THREE.BufferGeometry();
      textured.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
      );
      textured.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2),
      );
      const untextured = new THREE.BufferGeometry();
      untextured.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3),
      );
      mismatched.add(
        new THREE.Mesh(textured, new THREE.MeshStandardMaterial()),
      );
      mismatched.add(
        new THREE.Mesh(untextured, new THREE.MeshStandardMaterial()),
      );
      try {
        flattenInstancedObject({ object: mismatched, bones: new Map() });
        return false;
      } catch (error) {
        return (
          error instanceof Error &&
          error.message.includes("cannot be flattened for instancing")
        );
      }
    })(),
  );

  // A compiled record spells a promoted hero as a slot that names an actor,
  // which is the one thing the viewer's regeneration has to say differently
  // from the placement law it otherwise defers to.
  const heroSlot = regenerateFormationSlot(formation, 511);
  TestValidator.equals(
    "a regenerated hero slot names its actor instead of a generated node",
    { actor: heroSlot.actor, node: heroSlot.node },
    { actor: "lead", node: "lead" },
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

  // A re-form is the other way an arrangement moves, and the only one that
  // changes which place a member is walking to rather than how far apart the
  // places are. It goes through the same rewrite spacing does, so the drawn
  // member has to be the engine's re-formed placement and not the designed one
  // it left: a renderer that ignored the cue would keep drawing a line while
  // the gate reports a wedge.
  const reformed = {
    ...motion,
    id: "chorus-reform",
    layout: {
      kind: "wedge" as const,
      // 46 rows: the smallest square that covers a 2,049-strong unit.
      depth: 46,
      spacing: { lateral: 0.8, depth: 0.9 },
    },
    to: {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
  };
  const reforming = buildInstancedFormation({
    formation,
    models,
    motions: [reformed],
  });
  const reformProgress = 0.5;
  reforming.update(camera, 1_080, reformed.end * reformProgress);
  const reformMesh = reforming.object.children.find(
    (object): object is THREE.InstancedMesh =>
      object instanceof THREE.InstancedMesh &&
      object.name === `${formation.id}:0:near`,
  )!;
  const reformMatrix = new THREE.Matrix4();
  reformMesh.getMatrixAt(0, reformMatrix);
  const reformDrawn = new THREE.Vector3().setFromMatrixPosition(reformMatrix);
  const reformExpected = transformFormationPoint(
    formationSlotPosition(formation, 0, {
      layout: reformed.layout,
      progress: reformProgress,
    }),
    formation.anchor,
    {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    formation.facingDeg,
  );
  const designedInPlace = regenerateFormationSlot(formation, 0).position;
  const reformBefore = reformMatrix.elements.join(",");
  reforming.update(camera, 1_080, reformed.end * reformProgress);
  const reformRepeat = new THREE.Matrix4();
  reformMesh.getMatrixAt(0, reformRepeat);
  const reformStable = reformRepeat.elements.join(",") === reformBefore;
  TestValidator.equals(
    "a re-forming unit draws its members at the arrangement it is travelling to",
    namedFacts([
      [
        "drawnWhereTheEngineReformsIt",
        () =>
          nclose(reformDrawn.x, reformExpected.x - formation.anchor.x, 1e-4) &&
          nclose(reformDrawn.z, reformExpected.z - formation.anchor.z, 1e-4),
      ],
      // Negative twin: the designed place is metres away, so agreeing with the
      // engine above is a claim about the cue and not about the two answers
      // being indistinguishable.
      [
        "theReformActuallyMovedIt",
        () =>
          Math.hypot(
            reformExpected.x - designedInPlace.x,
            reformExpected.z - designedInPlace.z,
          ) > 1,
      ],
      // A frame that changes neither spacing nor arrangement writes nothing, so
      // the second reading at the same instant has to be the first one.
      ["aRepeatedFrameRewritesNothing", () => reformStable],
    ]),
    {
      drawnWhereTheEngineReformsIt: true,
      theReformActuallyMovedIt: true,
      aRepeatedFrameRewritesNothing: true,
    },
  );

  // A host may hand over none of a unit's promoted heroes, or hand one over
  // without saying where its own source put it. Neither is an error: the first
  // leaves every hero to whatever else placed it and counts none of them, and
  // the second reads the transform captured when the unit was built — which is
  // the transform the host itself handed over — and culls from the hero object
  // rather than from a pose root it never supplied.
  const unhosted = buildInstancedFormation({ formation, models });
  unhosted.update(camera, 1_080, 3);
  const bareHero = heroObjects.get("second")!;
  const bareSource = {
    translation: point(bareHero.position),
    rotation: rotation(bareHero.quaternion),
    scale: point(bareHero.scale),
  };
  const captured = buildInstancedFormation({
    formation,
    models,
    motions: [motion],
    heroObjects,
  });
  captured.update(camera, 1_080, 3);
  const bareExpected = composeFormationHeroTransform(
    formation.heroes.find((hero) => hero.actor === "second")!.transform,
    bareSource,
    formation.anchor,
    sampledMotion,
    formation.facingDeg,
  );
  TestValidator.equals(
    "a unit whose heroes arrive bare is still placed from what the host handed over",
    namedFacts([
      [
        "noHostObjectsLeavesEveryHeroUncounted",
        () => unhosted.stats.visible.hero === 0,
      ],
      [
        "theCrowdIsStillAccountedFor",
        () =>
          unhosted.stats.visible.near +
            unhosted.stats.visible.far +
            unhosted.stats.culled ===
          formation.anonymousCount,
      ],
      [
        "aSourcelessHeroReadsItsBuildTimeCapture",
        () =>
          nclose(bareHero.position.x, bareExpected.translation.x, 1e-9) &&
          nclose(bareHero.position.z, bareExpected.translation.z, 1e-9),
      ],
      // Negative twin: the composed place is not merely the transform that was
      // captured, so agreeing with it is a claim about the composition.
      [
        "theCaptureWasActuallyComposed",
        () =>
          Math.hypot(
            bareExpected.translation.x - bareSource.translation.x,
            bareExpected.translation.z - bareSource.translation.z,
          ) > 1,
      ],
    ]),
    {
      noHostObjectsLeavesEveryHeroUncounted: true,
      theCrowdIsStillAccountedFor: true,
      aSourcelessHeroReadsItsBuildTimeCapture: true,
      theCaptureWasActuallyComposed: true,
    },
  );

  // A heading is where a renderer and the law it renders can quietly part. The
  // viewer turns a unit's interior itself, and `deg * (PI / 180)` is not the
  // same double as `(deg * PI) / 180`: three degrees separates them, and the
  // separation is one unit in the last place, so it is invisible in a pixel and
  // gone the moment an instance matrix rounds to float32. Where it survives is
  // the accounting the viewer keeps in doubles: a chunk's world centre, and the
  // tier that centre's distance selects. A column puts that centre hundreds of
  // metres off the anchor while the camera stands twenty away, so one ulp of
  // the centre is several ulps of the distance, and the engine's own placement
  // of the same mass is the oracle the boundary is laid on. The case is run
  // from both sides of that boundary, so a renderer landing on any other double
  // falls off one side or the other whichever way it is wrong.
  const parityDesign = {
    ...formationDesign({
      kind: "column",
      ranks: 8,
      files: 1_024,
      spacing: { lateral: 0.8, depth: 0.9 },
    }),
    id: "parity",
    modelRecipe: hero.id,
    count: 8_192,
    facingDeg: 3,
    heroOverrides: [],
  };
  const parityFormation = materializeCompiledFormation(parityDesign, recipes);
  const parityChunk = parityFormation.chunks[0]!;
  const parityViewportHeight = 1_080;
  const parityCentre = transformFormationPoint(
    parityChunk.centroid,
    parityFormation.anchor,
    {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    parityFormation.facingDeg,
  );
  const parityCamera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 4_000);
  parityCamera.position.set(
    parityCentre.x,
    parityCentre.y + 6,
    parityCentre.z + 20,
  );
  parityCamera.lookAt(parityCentre.x, parityCentre.y, parityCentre.z);
  parityCamera.updateMatrixWorld(true);
  parityCamera.updateProjectionMatrix();
  // The same mass, turned the way `THREE.MathUtils.degToRad` turns it. It is
  // never asserted as an expectation, only as the answer the renderer must NOT
  // agree with, which is what keeps the fixture from passing by coincidence.
  const roundedCentre = ((): { x: number; y: number; z: number } => {
    const radians = THREE.MathUtils.degToRad(parityFormation.facingDeg);
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const deltaX = parityChunk.centroid.x - parityFormation.anchor.x;
    const deltaZ = parityChunk.centroid.z - parityFormation.anchor.z;
    const localX = deltaX * cosine - deltaZ * sine;
    const localZ = deltaX * sine + deltaZ * cosine;
    return {
      x: parityFormation.anchor.x + localX * cosine + localZ * sine,
      y: parityChunk.centroid.y,
      z: parityFormation.anchor.z - localX * sine + localZ * cosine,
    };
  })();
  const effectiveDistanceTo = (centre: {
    x: number;
    y: number;
    z: number;
  }): number => {
    const world = new THREE.Vector3(centre.x, centre.y, centre.z);
    const eye = new THREE.Vector3();
    parityCamera.getWorldPosition(eye);
    const distance = Math.max(0.001, eye.distanceTo(world));
    const depth = Math.max(
      0.001,
      -world.clone().applyMatrix4(parityCamera.matrixWorldInverse).z,
    );
    const halfY = Math.tan(THREE.MathUtils.degToRad(parityCamera.fov) / 2);
    const projectedPixels =
      (parityFormation.projectionRadius * parityViewportHeight) /
      (halfY * depth);
    return distance * (24 / Math.max(1, projectedPixels));
  };
  const parityBoundary = effectiveDistanceTo(parityCentre);
  const atBoundary = buildInstancedFormation({
    formation: withNearBoundary(parityFormation, parityBoundary),
    models,
  });
  atBoundary.update(parityCamera, parityViewportHeight);
  const pastBoundary = buildInstancedFormation({
    formation: withNearBoundary(
      parityFormation,
      previousDouble(parityBoundary),
    ),
    models,
  });
  pastBoundary.update(parityCamera, parityViewportHeight);
  // The camera stands beside chunk zero and every other chunk of the column is
  // hundreds of metres down the line, so the tier is read off that one chunk's
  // own batches rather than off a total the other chunks also contribute to.
  const tierVisible = (
    unit: ReturnType<typeof buildInstancedFormation>,
    tier: string,
  ): boolean =>
    unit.object.children.some(
      (object) =>
        object instanceof THREE.InstancedMesh &&
        object.name === `${parityFormation.id}:${parityChunk.index}:${tier}` &&
        object.visible,
    );
  TestValidator.equals(
    "the renderer places a unit's mass on the engine's own double, not a rounded one",
    namedFacts([
      // Two tiers, the near one bounded and the far one open, so the boundary
      // below is the only thing deciding which of the two is drawn.
      [
        "boundedNearOpenFar",
        () =>
          parityFormation.lod.map((lod) => lod.tier).join(",") === "near,far" &&
          parityFormation.lod[1]!.maxDistance === null,
      ],
      [
        "boundaryApplied",
        () =>
          withNearBoundary(parityFormation, parityBoundary).lod.find(
            (lod) => lod.tier === "near",
          )?.maxDistance === parityBoundary,
      ],
      // The witness that this heading discriminates at all: the rounded
      // conversion puts the same mass at a different effective distance, so
      // neither comparison below can pass by coincidence.
      [
        "roundedConversionDiffers",
        () => effectiveDistanceTo(roundedCentre) !== parityBoundary,
      ],
      // Exactly at the boundary the comparison is `<=`, so the near tier is
      // kept; one double below it, the near tier is out and the open far tier
      // is what remains. A centre off by any amount at all fails one of the two.
      ["atBoundaryStaysNear", () => tierVisible(atBoundary, "near")],
      ["atBoundaryDropsFar", () => tierVisible(atBoundary, "far") === false],
      ["pastBoundaryFallsToFar", () => tierVisible(pastBoundary, "far")],
      [
        "pastBoundaryDropsNear",
        () => tierVisible(pastBoundary, "near") === false,
      ],
    ]),
    {
      boundedNearOpenFar: true,
      boundaryApplied: true,
      roundedConversionDiffers: true,
      atBoundaryStaysNear: true,
      atBoundaryDropsFar: true,
      pastBoundaryFallsToFar: true,
      pastBoundaryDropsNear: true,
    },
  );
};

/** The same compiled unit with its bounded tier ending at `maxDistance`. */
const withNearBoundary = (
  formation: IAutoMovieCompiledFormation,
  maxDistance: number,
): IAutoMovieCompiledFormation => ({
  ...formation,
  lod: formation.lod.map((lod) =>
    lod.tier === "near" ? { ...lod, maxDistance } : lod,
  ),
});

/**
 * The largest double strictly below a positive finite `value`.
 *
 * A boundary one unit in the last place away is the whole point: the two
 * conversions differ by about that much, so a tolerance would hide exactly what
 * the case exists to see.
 */
const previousDouble = (value: number): number => {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) - 1n);
  return view.getFloat64(0);
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
