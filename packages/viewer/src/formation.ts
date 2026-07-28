import {
  composeFormationHeroTransform,
  sampleFormationMotion,
  selectFormationLod,
  transformFormationPoint,
} from "@automovie/engine";
import {
  IAutoMovieCompiledFormation,
  IAutoMovieCompiledFormationLod,
  IAutoMovieFormationMotion,
  IAutoMovieFormationSlot,
  IAutoMovieModel,
  IAutoMovieTransform,
} from "@automovie/interface";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { buildModel } from "./buildModel";

export { sampleFormationMotion, selectFormationLod } from "@automovie/engine";
export type {
  IAutoMovieFormationLodInput,
  IAutoMovieFormationLodSelection,
} from "@automovie/engine";

/** Per-frame bounded debug summary for one formation. */
export interface IAutoMovieFormationViewerStats {
  /** Anonymous slots selected per tier after chunk culling. */
  visible: Record<IAutoMovieCompiledFormationLod["tier"], number>;
  /** Anonymous slots rejected by camera-frustum chunk culling. */
  culled: number;
  /** Named heroes kept outside instance batches. */
  heroes: number;
}

/** Built instance runtime consumed by a viewer host. */
export interface IAutoMovieFormationViewerObject {
  /** Add this group to the current scene. */
  object: THREE.Group;
  /** Current LOD and culling summary. */
  stats: IAutoMovieFormationViewerStats;
  /** Recompute chunk visibility for the current camera. */
  update(
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
    time?: number,
  ): void;
}

interface IChunkObject {
  runtime: IAutoMovieCompiledFormation["chunks"][number];
  radius: number;
  slots: IAutoMovieFormationSlot[];
  tiers: Map<IAutoMovieCompiledFormationLod["tier"], THREE.InstancedMesh>;
  selected: IAutoMovieCompiledFormationLod["tier"] | null;
}

interface IHeroCompositionState {
  source: IAutoMovieTransform;
  outputPosition: THREE.Vector3;
  outputRotation: THREE.Quaternion;
}

/**
 * Build one compact formation as chunked instance batches.
 *
 * Heroes are deliberately absent: the compiler promoted them to explicit scene
 * nodes. Each LOD recipe is flattened into one static mesh, keeping exactly one
 * 64-byte instance matrix per anonymous slot and tier.
 */
export const buildInstancedFormation = (input: {
  formation: IAutoMovieCompiledFormation;
  models: ReadonlyMap<string, IAutoMovieModel>;
  motions?: readonly IAutoMovieFormationMotion[];
  /** Explicit scene wrappers keyed by promoted hero actor id. */
  heroObjects?: ReadonlyMap<string, THREE.Object3D>;
  /** Pose-root objects whose actual world positions drive hero culling. */
  heroVisualObjects?: ReadonlyMap<string, THREE.Object3D>;
}): IAutoMovieFormationViewerObject => {
  const root = new THREE.Group();
  root.name = `formation:${input.formation.id}`;
  root.position.copy(vector(input.formation.anchor));
  const heroes = new Set(input.formation.heroes.map((hero) => hero.slot));
  const representations = new Map(
    input.formation.lod.map((lod) => {
      const model = input.models.get(lod.model);
      if (model === undefined)
        throw new Error(
          `Formation "${input.formation.id}" LOD "${lod.tier}" references missing runtime model "${lod.model}".`,
        );
      return [lod.tier, flattenModel(model)] as const;
    }),
  );
  const selectionRadius = input.formation.projectionRadius;
  const chunks: IChunkObject[] = input.formation.chunks.map((chunk) => {
    const slots: IAutoMovieFormationSlot[] = [];
    for (let slot = chunk.start; slot < chunk.start + chunk.count; ++slot)
      if (heroes.has(slot) === false)
        slots.push(regenerateFormationSlot(input.formation, slot));
    const tiers = new Map<
      IAutoMovieCompiledFormationLod["tier"],
      THREE.InstancedMesh
    >();
    for (const lod of slots.length === 0 ? [] : input.formation.lod) {
      const representation = representations.get(lod.tier)!;
      const geometry = representation.geometry.clone();
      geometry.setAttribute(
        "automoviePhase",
        new THREE.InstancedBufferAttribute(
          new Float32Array(slots.map((slot) => slot.motionPhase)),
          1,
        ),
      );
      const mesh = new THREE.InstancedMesh(
        geometry,
        representation.materials,
        slots.length,
      );
      mesh.name = `${input.formation.id}:${chunk.index}:${lod.tier}`;
      slots.forEach((slot, index) => {
        mesh.setMatrixAt(index, slotMatrix(slot, input.formation.anchor));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      mesh.frustumCulled = false;
      mesh.visible = false;
      root.add(mesh);
      tiers.set(lod.tier, mesh);
    }
    return {
      runtime: chunk,
      radius: Math.max(
        0.01,
        ...[chunk.bounds.min.x, chunk.bounds.max.x].flatMap((x) =>
          [chunk.bounds.min.y, chunk.bounds.max.y].flatMap((y) =>
            [chunk.bounds.min.z, chunk.bounds.max.z].map((z) =>
              Math.hypot(
                x - chunk.centroid.x,
                y - chunk.centroid.y,
                z - chunk.centroid.z,
              ),
            ),
          ),
        ),
      ),
      slots,
      tiers,
      selected: null,
    };
  });
  let spacing = { lateral: 1, depth: 1 };
  const heroStates = new Map<string, IHeroCompositionState>();
  const stats: IAutoMovieFormationViewerStats = {
    visible: { hero: 0, near: 0, far: 0 },
    culled: 0,
    heroes: input.formation.heroes.length,
  };
  return {
    object: root,
    stats,
    update(camera, viewportHeight, time = 0): void {
      stats.visible = { hero: 0, near: 0, far: 0 };
      stats.culled = 0;
      const sampled = sampleFormationMotion(
        input.motions ?? [],
        input.formation.id,
        time,
      );
      root.position.set(
        input.formation.anchor.x + sampled.translation.x,
        input.formation.anchor.y + sampled.translation.y,
        input.formation.anchor.z + sampled.translation.z,
      );
      root.quaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        THREE.MathUtils.degToRad(sampled.facingOffsetDeg),
      );
      if (
        sampled.spacingScale.lateral !== spacing.lateral ||
        sampled.spacingScale.depth !== spacing.depth
      ) {
        spacing = { ...sampled.spacingScale };
        for (const chunk of chunks)
          for (const mesh of chunk.tiers.values()) {
            chunk.slots.forEach((slot, index) => {
              mesh.setMatrixAt(
                index,
                slotMatrix(
                  slot,
                  input.formation.anchor,
                  spacing,
                  input.formation.facingDeg,
                ),
              );
            });
            mesh.instanceMatrix.needsUpdate = true;
          }
      }
      root.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();
      const projection = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      );
      const frustum = new THREE.Frustum().setFromProjectionMatrix(projection);
      const cameraPosition = new THREE.Vector3();
      camera.getWorldPosition(cameraPosition);
      const halfY = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      for (const hero of input.formation.heroes) {
        const object = input.heroObjects?.get(hero.actor);
        if (object === undefined) continue;
        let composition = heroStates.get(hero.actor);
        if (
          composition === undefined ||
          object.position.equals(composition.outputPosition) === false ||
          Math.abs(object.quaternion.dot(composition.outputRotation)) <
            1 - 1e-12
        ) {
          composition = {
            source: {
              translation: point(object.position),
              rotation: quaternion(object.quaternion),
              scale: point(object.scale),
            },
            outputPosition: new THREE.Vector3(),
            outputRotation: new THREE.Quaternion(),
          };
          heroStates.set(hero.actor, composition);
        }
        composition.source.scale = point(object.scale);
        const transformed = composeFormationHeroTransform(
          hero.transform,
          composition.source,
          input.formation.anchor,
          sampled,
          input.formation.facingDeg,
        );
        object.position.copy(vector(transformed.translation));
        object.quaternion.set(
          transformed.rotation.x,
          transformed.rotation.y,
          transformed.rotation.z,
          transformed.rotation.w,
        );
        composition.outputPosition.copy(object.position);
        composition.outputRotation.copy(object.quaternion);
        object.updateMatrixWorld(true);
        const worldPosition = new THREE.Vector3();
        (input.heroVisualObjects?.get(hero.actor) ?? object).getWorldPosition(
          worldPosition,
        );
        object.visible = frustum.intersectsSphere(
          new THREE.Sphere(worldPosition, selectionRadius),
        );
        if (object.visible) ++stats.visible.hero;
      }
      for (const chunk of chunks) {
        const localCenter = formationSpacingOffset(
          chunk.runtime.centroid,
          input.formation.anchor,
          spacing,
          input.formation.facingDeg,
        );
        const center = root.localToWorld(localCenter);
        const sphere = new THREE.Sphere(
          center,
          chunk.radius *
            Math.max(sampled.spacingScale.lateral, sampled.spacingScale.depth) +
            selectionRadius,
        );
        if (frustum.intersectsSphere(sphere) === false) {
          for (const mesh of chunk.tiers.values()) mesh.visible = false;
          stats.culled += chunk.runtime.anonymousCount;
          continue;
        }
        const distance = Math.max(0.001, cameraPosition.distanceTo(center));
        const cameraDepth = Math.max(
          0.001,
          -center.clone().applyMatrix4(camera.matrixWorldInverse).z,
        );
        const projectedPixels =
          (selectionRadius * viewportHeight) / (halfY * cameraDepth);
        const selected = selectFormationLod({
          lod: input.formation.lod,
          distance,
          projectedPixels,
          previous: chunk.selected,
        }).lod;
        chunk.selected = selected.tier;
        for (const [tier, mesh] of chunk.tiers)
          mesh.visible = tier === selected.tier;
        stats.visible[selected.tier] += chunk.runtime.anonymousCount;
      }
    },
  };
};

/** Regenerate one exact slot from compact runtime parameters. */
export const regenerateFormationSlot = (
  formation: IAutoMovieCompiledFormation,
  slot: number,
): IAutoMovieFormationSlot => {
  if (
    Number.isSafeInteger(slot) === false ||
    slot < 0 ||
    slot >= formation.count
  )
    throw new RangeError(
      `Formation "${formation.id}" slot ${slot} is outside 0..${formation.count - 1}.`,
    );
  const layout = formation.layout;
  let x: number;
  let z: number;
  if (layout.kind === "line" || layout.kind === "column") {
    const rank =
      layout.kind === "line"
        ? Math.floor(slot / layout.files)
        : slot % layout.ranks;
    const file =
      layout.kind === "line"
        ? slot % layout.files
        : Math.floor(slot / layout.ranks);
    x = (file - (layout.files - 1) / 2) * layout.spacing.lateral;
    z = rank * layout.spacing.depth;
  } else if (layout.kind === "wedge") {
    const row = Math.floor(Math.sqrt(slot));
    x = (slot - row * row - row) * layout.spacing.lateral;
    z = row * layout.spacing.depth;
  } else if (layout.kind === "arc") {
    const ratio = formation.count === 1 ? 0.5 : slot / (formation.count - 1);
    const radians = THREE.MathUtils.degToRad((ratio - 0.5) * layout.arcDegrees);
    x = Math.sin(radians) * layout.radius;
    z = Math.cos(radians) * layout.radius;
  } else {
    const radius =
      Math.sqrt(seededValue(formation.seed, layout.seed, slot, 0)) *
      layout.radius;
    const angle =
      seededValue(formation.seed, layout.seed, slot, 1) * Math.PI * 2;
    x = Math.cos(angle) * radius;
    z = Math.sin(angle) * radius;
  }
  const radians = THREE.MathUtils.degToRad(formation.facingDeg);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const actor =
    formation.heroes.find((hero) => hero.slot === slot)?.actor ?? null;
  return {
    slot,
    node:
      actor ??
      `formation:${formation.id}:slot:${String(slot).padStart(6, "0")}`,
    actor,
    modelRecipe: formation.modelRecipe,
    position: {
      x: formation.anchor.x + x * cosine + z * sine,
      y: formation.anchor.y,
      z: formation.anchor.z - x * sine + z * cosine,
    },
    facingDeg: formation.facingDeg,
    motionPhase: seededValue(formation.seed, slot, 0x70686173),
  };
};

const flattenModel = (
  model: IAutoMovieModel,
): { geometry: THREE.BufferGeometry; materials: THREE.Material[] } => {
  const built = buildModel(model);
  built.object.updateMatrixWorld(true);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  built.object.traverse((object) => {
    if ((object as THREE.Mesh).isMesh !== true) return;
    const mesh = object as THREE.Mesh;
    if (Array.isArray(mesh.material))
      throw new Error(
        `Formation runtime model "${model.id}" has a multi-material source mesh.`,
      );
    geometries.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    materials.push(mesh.material);
  });
  const geometry = mergeGeometries(geometries, true);
  if (geometry === null || materials.length === 0)
    throw new Error(
      `Formation runtime model "${model.id}" cannot be flattened for instancing.`,
    );
  return { geometry, materials };
};

const slotMatrix = (
  slot: IAutoMovieFormationSlot,
  anchor: IAutoMovieCompiledFormation["anchor"],
  spacing: { lateral: number; depth: number } = { lateral: 1, depth: 1 },
  baseFacingDeg = 0,
): THREE.Matrix4 =>
  new THREE.Matrix4().compose(
    formationSpacingOffset(slot.position, anchor, spacing, baseFacingDeg),
    new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      THREE.MathUtils.degToRad(slot.facingDeg),
    ),
    new THREE.Vector3(1, 1, 1),
  );

const formationSpacingOffset = (
  point: { x: number; y: number; z: number },
  anchor: IAutoMovieCompiledFormation["anchor"],
  spacing: { lateral: number; depth: number },
  baseFacingDeg: number,
): THREE.Vector3 => {
  const radians = THREE.MathUtils.degToRad(baseFacingDeg);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const deltaX = point.x - anchor.x;
  const deltaZ = point.z - anchor.z;
  const localX = (deltaX * cosine - deltaZ * sine) * spacing.lateral;
  const localZ = (deltaX * sine + deltaZ * cosine) * spacing.depth;
  return new THREE.Vector3(
    localX * cosine + localZ * sine,
    point.y - anchor.y,
    -localX * sine + localZ * cosine,
  );
};

const vector = (value: { x: number; y: number; z: number }): THREE.Vector3 =>
  new THREE.Vector3(value.x, value.y, value.z);

const point = (value: { x: number; y: number; z: number }) => ({
  x: value.x,
  y: value.y,
  z: value.z,
});

const quaternion = (value: { x: number; y: number; z: number; w: number }) => ({
  x: value.x,
  y: value.y,
  z: value.z,
  w: value.w,
});

const seededValue = (...values: number[]): number => {
  let state = 0x9e3779b9;
  for (const value of values) state = mixSeed(value, state);
  state = (state + 0x6d2b79f5) >>> 0;
  let output = state;
  output = Math.imul(output ^ (output >>> 15), output | 1);
  output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
  return ((output ^ (output >>> 14)) >>> 0) / 4_294_967_296;
};

const mixSeed = (seed: number, salt: number): number => {
  const integer = Math.trunc(seed);
  const low = integer >>> 0;
  const high = Math.floor(integer / 4_294_967_296) >>> 0;
  let value = (salt ^ low) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15) ^ high, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
};
