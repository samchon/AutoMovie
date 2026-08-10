import {
  Quaternion,
  seededValue,
  selectFormationLod,
} from "@automovie/engine";
import {
  IAutoMovieCompiledFormationLod,
  IAutoMovieCompiledInstanceSet,
  IAutoMovieInstanceSlot,
  IAutoMovieModel,
} from "@automovie/interface";
import * as THREE from "three";

import {
  flattenInstancedModel,
  flattenInstancedObject,
} from "./formation";
import { IAutoMovieModelObject } from "./buildModel";

/** Bounded viewer accounting for one general instance set. */
export interface IAutoMovieInstanceSetViewerStats {
  /** Slots currently drawn by automatic LOD tier. */
  visible: Record<IAutoMovieCompiledFormationLod["tier"], number>;
  /** Slots rejected by chunk-frustum culling. */
  culled: number;
  /** Slots intentionally hidden by authored or seeded visibility. */
  hidden: number;
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

interface IInstancePrototypeChunkObject {
  projectionRadius: number;
  count: number;
  lod: IAutoMovieCompiledInstanceSet["lod"];
  tiers: Map<IAutoMovieCompiledFormationLod["tier"], THREE.InstancedMesh>;
  selected: IAutoMovieCompiledFormationLod["tier"] | null;
}

interface IInstanceChunkObject {
  runtime: IAutoMovieCompiledInstanceSet["chunks"][number];
  radius: number;
  prototypes: IInstancePrototypeChunkObject[];
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
  /** Optional already-loaded generated or imported prototype objects. */
  prototypeObjects?: ReadonlyMap<string, IAutoMovieModelObject>;
}): IAutoMovieInstanceSetViewerObject => {
  const root = new THREE.Group();
  root.name = `instance-set:${input.instanceSet.id}`;
  root.position.copy(vector(input.instanceSet.anchor));
  const prototypes =
    input.instanceSet.prototypes ??
    [
      {
        id: "default",
        modelRecipe: input.instanceSet.modelRecipe,
        weight: 1,
        lod: input.instanceSet.lod,
        projectionRadius: input.instanceSet.projectionRadius,
      },
    ];
  const representations = new Map(
    prototypes.flatMap((prototype) =>
      prototype.lod.map((lod) => {
        const model = input.models.get(lod.model);
        if (model === undefined)
          throw new Error(
            `Instance set "${input.instanceSet.id}" prototype "${prototype.id}" LOD "${lod.tier}" references missing runtime model "${lod.model}".`,
          );
        const owner = `Instance set "${input.instanceSet.id}" prototype "${prototype.id}" LOD "${lod.tier}"`;
        const loaded = input.prototypeObjects?.get(lod.model);
        const representation =
          loaded === undefined
            ? flattenInstancedModel(model, owner)
            : flattenInstancedObject(loaded, owner);
        return [
          `${prototype.id}:${lod.tier}`,
          {
            ...representation,
            materials: representation.materials.map(exactPaletteMaterial),
          },
        ] as const;
      }),
    ),
  );
  const traitNames = input.instanceSet.variation.traits.map(
    (trait) => trait.name,
  );
  const chunks: IInstanceChunkObject[] = input.instanceSet.chunks.map(
    (chunk) => {
      const slots = Array.from({ length: chunk.count }, (_, index) =>
        regenerateInstanceSlot(input.instanceSet, chunk.start + index),
      );
      const visibleSlots = slots.filter((slot) => slot.visible !== false);
      const prototypeObjects = prototypes.flatMap((prototype) => {
        const selectedSlots = visibleSlots.filter(
          (slot) => (slot.prototype ?? "default") === prototype.id,
        );
        if (selectedSlots.length === 0) return [];
        const tiers = new Map<
          IAutoMovieCompiledFormationLod["tier"],
          THREE.InstancedMesh
        >();
        for (const lod of prototype.lod) {
          const representation = representations.get(
            `${prototype.id}:${lod.tier}`,
          )!;
          const geometry = representation.geometry.clone();
          for (const [traitIndex, traitName] of traitNames.entries())
            geometry.setAttribute(
              `automovieTrait${traitIndex}`,
              new THREE.InstancedBufferAttribute(
                new Float32Array(
                  selectedSlots.map((slot) => slot.traits[traitName] ?? 0),
                ),
                1,
              ),
            );
          const mesh = new THREE.InstancedMesh(
            geometry,
            representation.materials,
            selectedSlots.length,
          );
          mesh.name = `${input.instanceSet.id}:${chunk.index}:${prototype.id}:${lod.tier}`;
          mesh.userData.automovieTraitNames = [...traitNames];
          mesh.userData.automoviePrototype = prototype.id;
          mesh.userData.automovieSlots = selectedSlots.map((slot) => slot.slot);
          selectedSlots.forEach((slot, index) => {
            mesh.setMatrixAt(
              index,
              instanceMatrix(slot, input.instanceSet.anchor),
            );
            mesh.setColorAt(index, new THREE.Color(slot.palette));
          });
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor !== null)
            mesh.instanceColor.needsUpdate = true;
          mesh.computeBoundingBox();
          mesh.computeBoundingSphere();
          mesh.frustumCulled = false;
          mesh.visible = false;
          root.add(mesh);
          tiers.set(lod.tier, mesh);
        }
        return [
          {
            projectionRadius: prototype.projectionRadius,
            count: selectedSlots.length,
            lod: prototype.lod,
            tiers,
            selected: null,
          },
        ];
      });
      return {
        runtime: chunk,
        radius: boundsRadius(chunk.bounds, chunk.centroid),
        prototypes: prototypeObjects,
      };
    },
  );
  const drawn = chunks.reduce(
    (count, chunk) =>
      count +
      chunk.prototypes.reduce(
        (prototypeCount, prototype) => prototypeCount + prototype.count,
        0,
      ),
    0,
  );
  const stats: IAutoMovieInstanceSetViewerStats = {
    visible: { hero: 0, near: 0, far: 0 },
    culled: 0,
    hidden: input.instanceSet.count - drawn,
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
              maximumInstanceScale(input.instanceSet),
        );
        if (frustum.intersectsSphere(sphere) === false) {
          for (const prototype of chunk.prototypes)
            for (const mesh of prototype.tiers.values()) mesh.visible = false;
          stats.culled += chunk.prototypes.reduce(
            (count, prototype) => count + prototype.count,
            0,
          );
          continue;
        }
        const distance = Math.max(0.001, cameraPosition.distanceTo(center));
        const cameraDepth = Math.max(
          0.001,
          -center.clone().applyMatrix4(camera.matrixWorldInverse).z,
        );
        for (const prototype of chunk.prototypes) {
          const projectedPixels =
            (prototype.projectionRadius *
              maximumInstanceScale(input.instanceSet) *
              viewportHeight) /
            (halfY * cameraDepth);
          const selected = selectFormationLod({
            lod: prototype.lod,
            distance,
            projectedPixels,
            previous: prototype.selected,
          }).lod;
          prototype.selected = selected.tier;
          for (const [tier, mesh] of prototype.tiers)
            mesh.visible = tier === selected.tier;
          stats.visible[selected.tier] += prototype.count;
        }
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
  const explicit =
    instanceSet.layout.kind === "explicit"
      ? instanceSet.layout.transforms[slot]
      : undefined;
  const position =
    instanceSet.layout.kind === "along-route"
      ? { x: point.x, y: instanceSet.anchor.y, z: point.z }
      : {
          x: instanceSet.anchor.x + point.x * cosine + point.z * sine,
          y: instanceSet.anchor.y + point.y,
          z: instanceSet.anchor.z - point.x * sine + point.z * cosine,
        };
  const prototype = selectedInstancePrototype(
    instanceSet,
    slot,
    explicit?.prototype,
  );
  const traits = Object.fromEntries(
    instanceSet.variation.traits.map((trait, index) => [
      trait.name,
      stableInterpolate(
        trait.min,
        trait.max,
        seededValue(instanceSet.seed, slot, index, 0x74726169),
      ),
    ]),
  );
  const base = {
    slot,
    node:
      explicit === undefined
        ? `instance:${instanceSet.id}:slot:${String(slot).padStart(6, "0")}`
        : `instance:${instanceSet.id}:${explicit.id}`,
    modelRecipe: prototype.modelRecipe,
    position,
    facingDeg: instanceSet.facingDeg,
    scale,
    palette:
      explicit?.palette ?? (instanceSet.variation.palette[paletteIndex] as string),
    traits: { ...traits, ...explicit?.traits },
  };
  const legacy =
    instanceSet.prototypes === undefined &&
    instanceSet.layout.kind !== "lattice" &&
    instanceSet.layout.kind !== "explicit" &&
    instanceSet.variation.scale3 === undefined &&
    instanceSet.variation.rotationDeg === undefined &&
    instanceSet.variation.visibleProbability === undefined;
  if (legacy) return base;
  const scale3 =
    explicit?.scale ??
    (instanceSet.variation.scale3 === undefined
      ? { x: scale, y: scale, z: scale }
      : {
          x: stableInterpolate(
            instanceSet.variation.scale3.min.x,
            instanceSet.variation.scale3.max.x,
            seededValue(instanceSet.seed, slot, 0x73637878),
          ),
          y: stableInterpolate(
            instanceSet.variation.scale3.min.y,
            instanceSet.variation.scale3.max.y,
            seededValue(instanceSet.seed, slot, 0x73637979),
          ),
          z: stableInterpolate(
            instanceSet.variation.scale3.min.z,
            instanceSet.variation.scale3.max.z,
            seededValue(instanceSet.seed, slot, 0x73637a7a),
          ),
        });
  return {
    ...base,
    prototype: prototype.id,
    rotation: Quaternion.normalize(
      Quaternion.multiply(
        Quaternion.fromAxisAngle(
          { x: 0, y: 1, z: 0 },
          instanceSet.facingDeg,
        ),
        explicit?.rotation ?? seededInstanceRotation(instanceSet, slot),
      ),
    ),
    scale3,
    visible:
      explicit?.visible ??
      (instanceSet.variation.visibleProbability === undefined ||
        seededValue(instanceSet.seed, slot, 0x76697369) <
          instanceSet.variation.visibleProbability),
  };
};

const selectedInstancePrototype = (
  instanceSet: IAutoMovieCompiledInstanceSet,
  slot: number,
  explicit?: string,
): { id: string; modelRecipe: string; weight: number } => {
  const choices =
    instanceSet.prototypes ??
    [{ id: "default", modelRecipe: instanceSet.modelRecipe, weight: 1 }];
  if (explicit !== undefined) {
    const selected = choices.find((choice) => choice.id === explicit);
    if (selected === undefined)
      throw new Error(
        `Instance set "${instanceSet.id}" slot ${slot} references missing prototype "${explicit}".`,
      );
    return selected;
  }
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let sample = seededValue(instanceSet.seed, slot, 0x70726f74) * total;
  for (const choice of choices) {
    if (sample < choice.weight) return choice;
    sample -= choice.weight;
  }
  return choices.at(-1)!;
};

const seededInstanceRotation = (
  instanceSet: IAutoMovieCompiledInstanceSet,
  slot: number,
) => {
  const ranges = instanceSet.variation.rotationDeg;
  return ranges === undefined
    ? Quaternion.identity()
    : Quaternion.fromEuler({
        x: stableInterpolate(
          ranges.x.min,
          ranges.x.max,
          seededValue(instanceSet.seed, slot, 0x726f7478),
        ),
        y: stableInterpolate(
          ranges.y.min,
          ranges.y.max,
          seededValue(instanceSet.seed, slot, 0x726f7479),
        ),
        z: stableInterpolate(
          ranges.z.min,
          ranges.z.max,
          seededValue(instanceSet.seed, slot, 0x726f747a),
        ),
        order: "XYZ",
      });
};

const instancePoint = (
  instanceSet: IAutoMovieCompiledInstanceSet,
  slot: number,
): { x: number; y: number; z: number } => {
  const layout = instanceSet.layout;
  if (layout.kind === "grid") {
    const row = Math.floor(slot / layout.columns);
    const column = slot % layout.columns;
    return {
      x: (column - (layout.columns - 1) / 2) * layout.spacing.x,
      y: 0,
      z: row * layout.spacing.z,
    };
  }
  if (layout.kind === "scatter") {
    const radius =
      Math.sqrt(seededValue(instanceSet.seed, slot, 0x72616469)) *
      layout.radius;
    const angle = seededValue(instanceSet.seed, slot, 0x616e676c) * Math.PI * 2;
    return {
      x: Math.cos(angle) * radius,
      y: 0,
      z: Math.sin(angle) * radius,
    };
  }
  if (layout.kind === "lattice") {
    const perLayer = layout.rows * layout.columns;
    const layer = Math.floor(slot / perLayer);
    const within = slot % perLayer;
    const row = Math.floor(within / layout.columns);
    const column = within % layout.columns;
    return {
      x: (column - (layout.columns - 1) / 2) * layout.spacing.x,
      y: layer * layout.spacing.y,
      z: row * layout.spacing.z,
    };
  }
  if (layout.kind === "explicit") {
    const transform = layout.transforms[slot];
    if (transform === undefined)
      throw new Error(
        `Instance set "${instanceSet.id}" slot ${slot} has no explicit transform.`,
      );
    return transform.translation;
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
    y: 0,
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
    slot.rotation === undefined
      ? new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          THREE.MathUtils.degToRad(slot.facingDeg),
        )
      : new THREE.Quaternion(
          slot.rotation.x,
          slot.rotation.y,
          slot.rotation.z,
          slot.rotation.w,
        ),
    slot.scale3 === undefined
      ? new THREE.Vector3(slot.scale, slot.scale, slot.scale)
      : vector(slot.scale3),
  );

const maximumInstanceScale = (
  instanceSet: IAutoMovieCompiledInstanceSet,
): number => {
  if (instanceSet.layout.kind === "explicit")
    return Math.max(
      Number.EPSILON,
      ...instanceSet.layout.transforms.flatMap((transform) => [
        transform.scale.x,
        transform.scale.y,
        transform.scale.z,
      ]),
    );
  const range = instanceSet.variation.scale3;
  return range === undefined
    ? instanceSet.variation.scale.max
    : Math.max(range.max.x, range.max.y, range.max.z);
};

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
