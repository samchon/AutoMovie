import { seededValue, selectFormationLod } from "@automovie/engine";
import {
  IAutoMovieCompiledFormationLod,
  IAutoMovieCompiledInstanceSet,
  IAutoMovieInstanceSlot,
  IAutoMovieModel,
} from "@automovie/interface";
import * as THREE from "three";

import { flattenInstancedModel } from "./formation";

/** Bounded viewer accounting for one general instance set. */
export interface IAutoMovieInstanceSetViewerStats {
  /** Slots currently drawn by automatic LOD tier. */
  visible: Record<IAutoMovieCompiledFormationLod["tier"], number>;
  /** Slots rejected by chunk-frustum culling. */
  culled: number;
}

/** Viewer-owned chunked object for a compiled general instance set. */
export interface IAutoMovieInstanceSetViewerObject {
  /** Add this group to the current scene. */
  object: THREE.Group;
  /** Current LOD and culling accounting. */
  stats: IAutoMovieInstanceSetViewerStats;
  /** Recompute chunk visibility for the current camera. */
  update(camera: THREE.PerspectiveCamera, viewportHeight: number): void;
}

interface IInstanceChunkObject {
  runtime: IAutoMovieCompiledInstanceSet["chunks"][number];
  radius: number;
  tiers: Map<IAutoMovieCompiledFormationLod["tier"], THREE.InstancedMesh>;
  selected: IAutoMovieCompiledFormationLod["tier"] | null;
}

/**
 * Build one non-formation crowd, vegetation, prop, or debris set.
 *
 * Matrices, colors, scales, and numeric trait attributes are regenerated from
 * compact runtime data. No slot is promoted into a scene node.
 */
export const buildInstancedInstanceSet = (input: {
  instanceSet: IAutoMovieCompiledInstanceSet;
  models: ReadonlyMap<string, IAutoMovieModel>;
}): IAutoMovieInstanceSetViewerObject => {
  const root = new THREE.Group();
  root.name = `instance-set:${input.instanceSet.id}`;
  root.position.copy(vector(input.instanceSet.anchor));
  const representations = new Map(
    input.instanceSet.lod.map((lod) => {
      const model = input.models.get(lod.model);
      if (model === undefined)
        throw new Error(
          `Instance set "${input.instanceSet.id}" LOD "${lod.tier}" references missing runtime model "${lod.model}".`,
        );
      const representation = flattenInstancedModel(
        model,
        `Instance set "${input.instanceSet.id}" LOD "${lod.tier}"`,
      );
      return [
        lod.tier,
        {
          ...representation,
          materials: representation.materials.map(exactPaletteMaterial),
        },
      ] as const;
    }),
  );
  const traitNames = input.instanceSet.variation.traits.map(
    (trait) => trait.name,
  );
  const chunks: IInstanceChunkObject[] = input.instanceSet.chunks.map(
    (chunk) => {
      const slots = Array.from({ length: chunk.count }, (_, index) =>
        regenerateInstanceSlot(input.instanceSet, chunk.start + index),
      );
      const tiers = new Map<
        IAutoMovieCompiledFormationLod["tier"],
        THREE.InstancedMesh
      >();
      for (const lod of input.instanceSet.lod) {
        const representation = representations.get(lod.tier)!;
        const geometry = representation.geometry.clone();
        for (const [traitIndex, traitName] of traitNames.entries())
          geometry.setAttribute(
            `automovieTrait${traitIndex}`,
            new THREE.InstancedBufferAttribute(
              new Float32Array(
                slots.map((slot) => slot.traits[traitName] ?? 0),
              ),
              1,
            ),
          );
        const mesh = new THREE.InstancedMesh(
          geometry,
          representation.materials,
          slots.length,
        );
        mesh.name = `${input.instanceSet.id}:${chunk.index}:${lod.tier}`;
        mesh.userData.automovieTraitNames = [...traitNames];
        slots.forEach((slot, index) => {
          mesh.setMatrixAt(
            index,
            instanceMatrix(slot, input.instanceSet.anchor),
          );
          mesh.setColorAt(index, new THREE.Color(slot.palette));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        mesh.frustumCulled = false;
        mesh.visible = false;
        root.add(mesh);
        tiers.set(lod.tier, mesh);
      }
      return {
        runtime: chunk,
        radius: boundsRadius(chunk.bounds, chunk.centroid),
        tiers,
        selected: null,
      };
    },
  );
  const stats: IAutoMovieInstanceSetViewerStats = {
    visible: { hero: 0, near: 0, far: 0 },
    culled: 0,
  };
  return {
    object: root,
    stats,
    update(camera, viewportHeight): void {
      stats.visible = { hero: 0, near: 0, far: 0 };
      stats.culled = 0;
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
      for (const chunk of chunks) {
        const center = root.localToWorld(
          new THREE.Vector3(
            chunk.runtime.centroid.x - input.instanceSet.anchor.x,
            chunk.runtime.centroid.y - input.instanceSet.anchor.y,
            chunk.runtime.centroid.z - input.instanceSet.anchor.z,
          ),
        );
        const sphere = new THREE.Sphere(
          center,
          chunk.radius +
            input.instanceSet.projectionRadius *
              input.instanceSet.variation.scale.max,
        );
        if (frustum.intersectsSphere(sphere) === false) {
          for (const mesh of chunk.tiers.values()) mesh.visible = false;
          stats.culled += chunk.runtime.count;
          continue;
        }
        const distance = Math.max(0.001, cameraPosition.distanceTo(center));
        const cameraDepth = Math.max(
          0.001,
          -center.clone().applyMatrix4(camera.matrixWorldInverse).z,
        );
        const projectedPixels =
          (input.instanceSet.projectionRadius *
            input.instanceSet.variation.scale.max *
            viewportHeight) /
          (halfY * cameraDepth);
        const selected = selectFormationLod({
          lod: input.instanceSet.lod,
          distance,
          projectedPixels,
          previous: chunk.selected,
        }).lod;
        chunk.selected = selected.tier;
        for (const [tier, mesh] of chunk.tiers)
          mesh.visible = tier === selected.tier;
        stats.visible[selected.tier] += chunk.runtime.count;
      }
    },
  };
};

/** Regenerate one exact instance from compact compiled parameters. */
export const regenerateInstanceSlot = (
  instanceSet: IAutoMovieCompiledInstanceSet,
  slot: number,
): IAutoMovieInstanceSlot => {
  if (
    Number.isSafeInteger(slot) === false ||
    slot < 0 ||
    slot >= instanceSet.count
  )
    throw new RangeError(
      `Instance set "${instanceSet.id}" slot ${slot} is outside 0..${instanceSet.count - 1}.`,
    );
  const point = instancePoint(instanceSet, slot);
  const radians = THREE.MathUtils.degToRad(instanceSet.facingDeg);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const scale = stableInterpolate(
    instanceSet.variation.scale.min,
    instanceSet.variation.scale.max,
    seededValue(instanceSet.seed, slot, 0x7363616c),
  );
  const paletteIndex = Math.min(
    instanceSet.variation.palette.length - 1,
    Math.floor(
      seededValue(instanceSet.seed, slot, 0x70616c65) *
        instanceSet.variation.palette.length,
    ),
  );
  return {
    slot,
    node: `instance:${instanceSet.id}:slot:${String(slot).padStart(6, "0")}`,
    modelRecipe: instanceSet.modelRecipe,
    position:
      instanceSet.layout.kind === "along-route"
        ? { x: point.x, y: instanceSet.anchor.y, z: point.z }
        : {
            x: instanceSet.anchor.x + point.x * cosine + point.z * sine,
            y: instanceSet.anchor.y,
            z: instanceSet.anchor.z - point.x * sine + point.z * cosine,
          },
    facingDeg: instanceSet.facingDeg,
    scale,
    palette: instanceSet.variation.palette[paletteIndex]!,
    traits: Object.fromEntries(
      instanceSet.variation.traits.map((trait, index) => [
        trait.name,
        stableInterpolate(
          trait.min,
          trait.max,
          seededValue(instanceSet.seed, slot, index, 0x74726169),
        ),
      ]),
    ),
  };
};

const instancePoint = (
  instanceSet: IAutoMovieCompiledInstanceSet,
  slot: number,
): { x: number; z: number } => {
  const layout = instanceSet.layout;
  if (layout.kind === "grid") {
    const row = Math.floor(slot / layout.columns);
    const column = slot % layout.columns;
    return {
      x: (column - (layout.columns - 1) / 2) * layout.spacing.x,
      z: row * layout.spacing.z,
    };
  }
  if (layout.kind === "scatter") {
    const radius =
      Math.sqrt(seededValue(instanceSet.seed, slot, 0x72616469)) *
      layout.radius;
    const angle = seededValue(instanceSet.seed, slot, 0x616e676c) * Math.PI * 2;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
  }
  const route = instanceSet.route;
  if (route === null || route.waypoints.length < 2)
    throw new Error(
      `Instance set "${instanceSet.id}" route "${layout.route}" is unavailable.`,
    );
  const segments = route.waypoints.slice(1).map((right, index) => {
    const left = route.waypoints[index]!;
    return {
      left,
      right,
      length: Math.hypot(right.x - left.x, right.z - left.z),
    };
  });
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  let remaining = ((slot + 0.5) / instanceSet.count) * total;
  const segment = (segments.find((candidate) => {
    if (remaining <= candidate.length) return true;
    remaining -= candidate.length;
    return false;
  }) ?? segments.at(-1))!;
  const ratio =
    segment.length === 0 ? 0 : Math.min(1, remaining / segment.length);
  const tangentX = segment.right.x - segment.left.x;
  const tangentZ = segment.right.z - segment.left.z;
  const tangentLength = Math.hypot(tangentX, tangentZ);
  const jitter =
    (seededValue(instanceSet.seed, slot, 0x6a697474) * 2 - 1) *
    layout.lateralJitter;
  return {
    x:
      segment.left.x +
      tangentX * ratio -
      (tangentLength === 0 ? 0 : (tangentZ / tangentLength) * jitter),
    z:
      segment.left.z +
      tangentZ * ratio +
      (tangentLength === 0 ? 0 : (tangentX / tangentLength) * jitter),
  };
};

const instanceMatrix = (
  slot: IAutoMovieInstanceSlot,
  anchor: IAutoMovieCompiledInstanceSet["anchor"],
): THREE.Matrix4 =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(
      slot.position.x - anchor.x,
      slot.position.y - anchor.y,
      slot.position.z - anchor.z,
    ),
    new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      THREE.MathUtils.degToRad(slot.facingDeg),
    ),
    new THREE.Vector3(slot.scale, slot.scale, slot.scale),
  );

const boundsRadius = (
  bounds: IAutoMovieCompiledInstanceSet["bounds"],
  centroid: IAutoMovieCompiledInstanceSet["centroid"],
): number =>
  Math.max(
    0.01,
    ...[bounds.min.x, bounds.max.x].flatMap((x) =>
      [bounds.min.y, bounds.max.y].flatMap((y) =>
        [bounds.min.z, bounds.max.z].map((z) =>
          Math.hypot(x - centroid.x, y - centroid.y, z - centroid.z),
        ),
      ),
    ),
  );

const vector = (value: { x: number; y: number; z: number }): THREE.Vector3 =>
  new THREE.Vector3(value.x, value.y, value.z);

const stableInterpolate = (from: number, to: number, ratio: number): number =>
  from * (1 - ratio) + to * ratio;

/**
 * Instance colors multiply the material's diffuse color in Three.js. General
 * instance palettes are exact overrides, so cloned instance-only materials use
 * white as the neutral multiplier while retaining roughness and other
 * channels.
 */
const exactPaletteMaterial = (material: THREE.Material): THREE.Material => {
  const clone = material.clone();
  if ("color" in clone && clone.color instanceof THREE.Color)
    clone.color.set(0xffffff);
  return clone;
};
