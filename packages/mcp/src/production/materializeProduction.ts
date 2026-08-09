import {
  IAutoMovieFormationGrounding,
  Quaternion,
  formationSlot,
  mixSeed,
  productionRuntimeModelId,
  productionRuntimeSkeletonId,
  seededValue,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieCompiledEffect,
  IAutoMovieCompiledFormation,
  IAutoMovieCompiledInstanceSet,
  IAutoMovieCompiledShotSource,
  IAutoMovieFormationDesign,
  IAutoMovieFormationSlot,
  IAutoMovieGeneratedCollisionProxy,
  IAutoMovieGeneratedMeasurementProxy,
  IAutoMovieInstanceSetDesign,
  IAutoMovieInstanceSlot,
  IAutoMovieModel,
  IAutoMovieModelRecipe,
  IAutoMovieShotContract,
  IAutoMovieShotSourceOutput,
  IAutoMovieTransform,
  IAutoMovieWorldDesign,
} from "@automovie/interface";

import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
} from "./contentIdentity";
import {
  AUTOMOVIE_REGISTERED_ARCHETYPES,
  AutoMovieModelArchetypeRegistry,
} from "./productionArchetypes";

/** Slots per independently regenerated and culled runtime chunk. */
export const AUTOMOVIE_FORMATION_CHUNK_SIZE = 1_024;

/** Slots per independently regenerated general-instance chunk. */
export const AUTOMOVIE_INSTANCE_CHUNK_SIZE = 1_024;

/** Matrix bytes reserved by one slot in one LOD instance buffer. */
export const AUTOMOVIE_FORMATION_MATRIX_BYTES =
  16 * Float32Array.BYTES_PER_ELEMENT;

export { productionRuntimeModelId, productionRuntimeSkeletonId };

/** Compiler-resolved external appearance and deterministic proxy semantics. */
export interface IAutoMovieExternalModelRuntimeBinding {
  /** Manifest-owned final render asset. */
  asset: string;
  /** Fixed normalization profile proved by ingest. */
  profile: NonNullable<IAutoMovieModel["imported"]>["profile"];
  /** Exact model LOD identities retained for host selection. */
  lod: NonNullable<IAutoMovieModel["imported"]>["lod"];
  /** Compiler-sealed model, sidecar and proxy digest closure. */
  assets: NonNullable<IAutoMovieModel["imported"]>["assets"];
  /** Ingest/VRM-owned normalized bone mapping. */
  humanoidBones: NonNullable<IAutoMovieModel["imported"]>["humanoidBones"];
  /** Exact collision primitive used by engine geometry and mass queries. */
  collision: IAutoMovieGeneratedCollisionProxy;
  /** Exact measurement envelope used by projection and distance queries. */
  measurement: IAutoMovieGeneratedMeasurementProxy;
}

/**
 * Materialize every bounded model recipe into deterministic proxy data.
 *
 * External appearances keep only a recipe skeleton proved by ingest mapping,
 * drop unproved semantic profiles, replace visible primitive parts with the
 * registered collision proxy for engine semantics, and bind the final
 * manifest-owned mesh plus its closed byte ledger.
 */
export const materializeProductionModels = (
  recipes: ReadonlyMap<string, IAutoMovieModelRecipe>,
  externalModels: ReadonlyMap<
    string,
    IAutoMovieExternalModelRuntimeBinding
  > = new Map(),
  archetypes: AutoMovieModelArchetypeRegistry = AUTOMOVIE_REGISTERED_ARCHETYPES,
): ReadonlyMap<string, IAutoMovieModel> =>
  new Map(
    [...recipes]
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(
        ([id, recipe]) =>
          [
            id,
            materializeModel(recipe, externalModels.get(id), archetypes),
          ] as const,
      ),
  );

/**
 * One formation design together with the terrain its members stand on.
 *
 * The grounding is optional, so an ordinary design is already one of these and
 * places every member at its anchor's height, which is what a formation with no
 * declared terrain under it has always done.
 */
export type IAutoMovieGroundedFormationDesign = IAutoMovieFormationDesign &
  IAutoMovieFormationGrounding;

/** Materialize one compact formation into ordered world-space slots. */
export const materializeFormationSlots = (
  formation: IAutoMovieGroundedFormationDesign,
): IAutoMovieFormationSlot[] =>
  Array.from({ length: formation.count }, (_, slot) =>
    materializeFormationSlot(formation, slot),
  );

/** Regenerate one exact formation slot in constant memory. */
export const materializeFormationSlot = (
  formation: IAutoMovieGroundedFormationDesign,
  slot: number,
): IAutoMovieFormationSlot => formationSlot(formation, slot);

/** Compiler-owned formation inventory passed to deterministic shot source. */
export const materializeFormationInventory = (
  formations: ReadonlyMap<string, IAutoMovieFormationDesign>,
  surfaces: IAutoMovieWorldDesign["surfaces"] = [],
): Readonly<Record<string, readonly IAutoMovieFormationSlot[]>> =>
  Object.fromEntries(
    [...formations]
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([id, formation]) => [
        id,
        materializeFormationSlots(
          groundFormation(formation, surfaces).formation,
        ),
      ]),
  );

/** Compile every formation into bounded chunks rather than anonymous nodes. */
export const materializeCompiledFormationInventory = (
  formations: ReadonlyMap<string, IAutoMovieFormationDesign>,
  recipes: ReadonlyMap<string, IAutoMovieModelRecipe>,
  externalModels: ReadonlyMap<
    string,
    IAutoMovieExternalModelRuntimeBinding
  > = new Map(),
  surfaces: IAutoMovieWorldDesign["surfaces"] = [],
  archetypes: AutoMovieModelArchetypeRegistry = AUTOMOVIE_REGISTERED_ARCHETYPES,
): Readonly<Record<string, IAutoMovieCompiledFormation>> =>
  Object.fromEntries(
    [...formations]
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([id, formation]) => [
        id,
        materializeCompiledFormation(
          formation,
          recipes,
          externalModels,
          surfaces,
          archetypes,
        ),
      ]),
  );

/** Compile one formation into independently regenerable chunk metadata. */
export const materializeCompiledFormation = (
  formation: IAutoMovieFormationDesign,
  recipes: ReadonlyMap<string, IAutoMovieModelRecipe> = new Map(),
  externalModels: ReadonlyMap<
    string,
    IAutoMovieExternalModelRuntimeBinding
  > = new Map(),
  surfaces: IAutoMovieWorldDesign["surfaces"] = [],
  archetypes: AutoMovieModelArchetypeRegistry = AUTOMOVIE_REGISTERED_ARCHETYPES,
): IAutoMovieCompiledFormation => {
  const grounded = groundFormation(formation, surfaces);
  const heroes = new Set(formation.heroOverrides.map((hero) => hero.slot));
  const chunks = Array.from(
    {
      length: Math.ceil(formation.count / AUTOMOVIE_FORMATION_CHUNK_SIZE),
    },
    (_, index) => {
      const start = index * AUTOMOVIE_FORMATION_CHUNK_SIZE;
      const count = Math.min(
        AUTOMOVIE_FORMATION_CHUNK_SIZE,
        formation.count - start,
      );
      const summary = summarizeFormationRange(grounded.formation, start, count);
      let anonymousCount = count;
      for (const slot of heroes)
        if (slot >= start && slot < start + count) --anonymousCount;
      return { index, start, count, anonymousCount, ...summary };
    },
  );
  const summary =
    grounded.footprint ??
    summarizeFormationRange(grounded.formation, 0, formation.count);
  const recipe = recipes.get(formation.modelRecipe);
  const anonymousLod = recipe?.lod.filter((item) => item.tier !== "hero") ?? [];
  const lod = (
    anonymousLod.length === 0
      ? [
          {
            tier: "near" as const,
            maxDistance: null,
            recipe: formation.modelRecipe,
          },
        ]
      : anonymousLod
  ).map((item) => ({
    ...item,
    recipeDigest: lodRecipeDigest(recipes, item.recipe),
    model: productionRuntimeModelId(item.recipe),
  }));
  const core = {
    version: 1 as const,
    id: formation.id,
    count: formation.count,
    anonymousCount: formation.count - formation.heroOverrides.length,
    modelRecipe: formation.modelRecipe,
    layout: structuredClone(formation.layout),
    anchor: structuredClone(formation.anchor),
    ground: structuredClone(grounded.ground),
    facingDeg: formation.facingDeg,
    seed: formation.seed,
    ...summary,
    projectionRadius: Math.max(
      0.01,
      ...lod.map(
        (item) =>
          recipeProjectionRadius(
            recipes.get(item.recipe),
            externalModels.get(item.recipe),
            archetypes,
          ) ??
          recipeProjectionRadius(
            recipe,
            externalModels.get(formation.modelRecipe),
            archetypes,
          ) ??
          0.5,
      ),
    ),
    chunks,
    heroes: [...formation.heroOverrides]
      .sort((left, right) => left.slot - right.slot)
      .map((hero) => {
        const slot = materializeFormationSlot(grounded.formation, hero.slot);
        return {
          slot: hero.slot,
          actor: hero.actor,
          transform: slotTransform(slot),
        };
      }),
    lod,
    // Phase only. A cycle length compiled here would be a number nothing in the
    // unit produced: cadence is the ground a unit's cues cover, and a seeded
    // period made a halted crowd march in place and a marching one skate.
    phase: {
      seed: mixSeed(formation.seed, 0x70686173),
    },
  };
  return {
    ...core,
    digest: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(core)),
  };
};

/** Regenerate one exact non-formation instance in constant memory. */
export const materializeInstanceSlot = (
  instanceSet: IAutoMovieInstanceSetDesign,
  world: Pick<IAutoMovieWorldDesign, "routes">,
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
  const point = localInstancePoint(instanceSet, world, slot);
  const radians = (instanceSet.facingDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const scaleSample = seededValue(instanceSet.seed, slot, 0x7363616c);
  const scale = stableInterpolate(
    instanceSet.variation.scale.min,
    instanceSet.variation.scale.max,
    scaleSample,
  );
  const paletteIndex = Math.min(
    instanceSet.variation.palette.length - 1,
    Math.floor(
      seededValue(instanceSet.seed, slot, 0x70616c65) *
        instanceSet.variation.palette.length,
    ),
  );
  const position =
    instanceSet.layout.kind === "along-route"
      ? {
          x: point.x,
          y: instanceSet.anchor.y,
          z: point.z,
        }
      : {
          x: instanceSet.anchor.x + point.x * cosine + point.z * sine,
          y: instanceSet.anchor.y,
          z: instanceSet.anchor.z - point.x * sine + point.z * cosine,
        };
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
  const palette = instanceSet.variation.palette[paletteIndex];
  if (
    [position.x, position.y, position.z, scale, ...Object.values(traits)].some(
      (value) => Number.isFinite(value) === false,
    ) ||
    palette === undefined
  )
    throw new RangeError(
      `Instance set "${instanceSet.id}" slot ${slot} derived non-finite variation or an empty palette.`,
    );
  return {
    slot,
    node: `instance:${instanceSet.id}:slot:${String(slot).padStart(6, "0")}`,
    modelRecipe: instanceSet.modelRecipe,
    position,
    facingDeg: instanceSet.facingDeg,
    scale,
    palette,
    traits,
  };
};

/** Materialize one general instance set for direct inspection. */
export const materializeInstanceSlots = (
  instanceSet: IAutoMovieInstanceSetDesign,
  world: Pick<IAutoMovieWorldDesign, "routes">,
): IAutoMovieInstanceSlot[] =>
  Array.from({ length: instanceSet.count }, (_, slot) =>
    materializeInstanceSlot(instanceSet, world, slot),
  );

/** Compile every world instance set into bounded regenerable chunks. */
export const materializeCompiledInstanceSetInventory = (
  world: IAutoMovieWorldDesign,
  recipes: ReadonlyMap<string, IAutoMovieModelRecipe>,
  externalModels: ReadonlyMap<
    string,
    IAutoMovieExternalModelRuntimeBinding
  > = new Map(),
  archetypes: AutoMovieModelArchetypeRegistry = AUTOMOVIE_REGISTERED_ARCHETYPES,
): Readonly<Record<string, IAutoMovieCompiledInstanceSet>> =>
  Object.fromEntries(
    [...(world.instanceSets ?? [])]
      .sort((left, right) => compareCodeUnits(left.id, right.id))
      .map((instanceSet) => [
        instanceSet.id,
        materializeCompiledInstanceSet(
          instanceSet,
          world,
          recipes,
          externalModels,
          archetypes,
        ),
      ]),
  );

/** Compile one world instance set without expanding its full slot inventory. */
export const materializeCompiledInstanceSet = (
  instanceSet: IAutoMovieInstanceSetDesign,
  world: IAutoMovieWorldDesign,
  recipes: ReadonlyMap<string, IAutoMovieModelRecipe> = new Map(),
  externalModels: ReadonlyMap<
    string,
    IAutoMovieExternalModelRuntimeBinding
  > = new Map(),
  archetypes: AutoMovieModelArchetypeRegistry = AUTOMOVIE_REGISTERED_ARCHETYPES,
): IAutoMovieCompiledInstanceSet => {
  const chunks = Array.from(
    {
      length: Math.ceil(instanceSet.count / AUTOMOVIE_INSTANCE_CHUNK_SIZE),
    },
    (_, index) => {
      const start = index * AUTOMOVIE_INSTANCE_CHUNK_SIZE;
      const count = Math.min(
        AUTOMOVIE_INSTANCE_CHUNK_SIZE,
        instanceSet.count - start,
      );
      return {
        index,
        start,
        count,
        ...summarizeInstanceRange(instanceSet, world, start, count),
      };
    },
  );
  const summary = summarizeInstanceRange(
    instanceSet,
    world,
    0,
    instanceSet.count,
  );
  const recipe = recipes.get(instanceSet.modelRecipe);
  const layout = instanceSet.layout;
  const sourceLod = recipe?.lod ?? [];
  const lod = (
    sourceLod.length === 0
      ? [
          {
            tier: "near" as const,
            maxDistance: null,
            recipe: instanceSet.modelRecipe,
          },
        ]
      : sourceLod
  ).map((item) => ({
    ...item,
    recipeDigest: lodRecipeDigest(recipes, item.recipe),
    model: productionRuntimeModelId(item.recipe),
  }));
  const core = {
    version: 1 as const,
    id: instanceSet.id,
    count: instanceSet.count,
    modelRecipe: instanceSet.modelRecipe,
    layout: structuredClone(layout),
    route:
      layout.kind === "along-route"
        ? structuredClone(
            world.routes.find((route) => route.id === layout.route) ?? null,
          )
        : null,
    anchor: structuredClone(instanceSet.anchor),
    facingDeg: instanceSet.facingDeg,
    seed: instanceSet.seed,
    variation: structuredClone(instanceSet.variation),
    ...summary,
    projectionRadius: Math.max(
      0.01,
      ...lod.map(
        (item) =>
          recipeProjectionRadius(
            recipes.get(item.recipe),
            externalModels.get(item.recipe),
            archetypes,
          ) ??
          recipeProjectionRadius(
            recipe,
            externalModels.get(instanceSet.modelRecipe),
            archetypes,
          ) ??
          0.5,
      ),
    ),
    chunks,
    lod,
  };
  return {
    ...core,
    digest: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(core)),
  };
};

/**
 * Add compiler-owned models, hero nodes and compact formations to choreography.
 *
 * Anonymous identities remain derived from formation id and slot index and
 * never become a large scene-node array.
 */
export const materializeCompiledShot = (props: {
  contract: IAutoMovieShotContract;
  formations: ReadonlyMap<string, IAutoMovieFormationDesign>;
  formationRuntime?: Readonly<Record<string, IAutoMovieCompiledFormation>>;
  instanceSetRuntime?: Readonly<Record<string, IAutoMovieCompiledInstanceSet>>;
  modelRecipes?: ReadonlyMap<string, IAutoMovieModelRecipe>;
  runtimeModels: ReadonlyMap<string, IAutoMovieModel>;
  world?: IAutoMovieWorldDesign;
  fps?: number;
  source: IAutoMovieShotSourceOutput;
  /** Archetype catalogue used when a formation is compiled here. */
  archetypes?: AutoMovieModelArchetypeRegistry;
}): {
  value: IAutoMovieCompiledShotSource;
  collisions: string[];
} => {
  const source = structuredClone(props.source);
  const effects = materializeCompiledEffects({
    contract: props.contract,
    world: props.world,
    fps: props.fps,
    cues: source.effectCues ?? [],
  });
  const nodes = new Map(source.scene.nodes.map((node) => [node.id, node]));
  const collisions: string[] = [];
  const formations: IAutoMovieCompiledFormation[] = [];
  for (const participant of props.contract.participants) {
    if (participant.kind !== "formation") continue;
    const formation = props.formations.get(participant.id);
    if (formation === undefined) continue;
    const compiled =
      props.formationRuntime?.[participant.id] ??
      materializeCompiledFormation(
        formation,
        props.modelRecipes,
        undefined,
        // The terrain a member stands on, so a unit compiled here rather than
        // taken from the shared inventory is the same unit either way.
        props.world?.surfaces,
        props.archetypes,
      );
    const runtimeModel = props.runtimeModels.get(formation.modelRecipe);
    if (runtimeModel === undefined) continue;
    formations.push(compiled);
    const ordinaryPrefix = `formation:${formation.id}:slot:`;
    for (const node of source.scene.nodes) {
      if (node.id.startsWith(ordinaryPrefix) === false) continue;
      const suffix = node.id.slice(ordinaryPrefix.length);
      const slot = Number(suffix);
      if (
        /^\d{6}$/.test(suffix) &&
        Number.isSafeInteger(slot) &&
        slot >= 0 &&
        slot < formation.count &&
        formation.heroOverrides.some((hero) => hero.slot === slot) === false
      )
        collisions.push(node.id);
    }
    for (const hero of compiled.heroes) {
      const existing = nodes.get(hero.actor);
      if (existing !== undefined) {
        existing.model = runtimeModel.id;
        existing.transform = hero.transform;
        continue;
      }
      const node = {
        id: hero.actor,
        model: runtimeModel.id,
        transform: hero.transform,
        motion: null,
        pose: null,
      };
      source.scene.nodes.push(node);
      nodes.set(node.id, node);
    }
  }
  for (const instanceSet of Object.values(props.instanceSetRuntime ?? {})) {
    const ordinaryPrefix = `instance:${instanceSet.id}:slot:`;
    for (const node of source.scene.nodes) {
      if (node.id.startsWith(ordinaryPrefix) === false) continue;
      const suffix = node.id.slice(ordinaryPrefix.length);
      const slot = Number(suffix);
      if (
        /^\d{6}$/.test(suffix) &&
        Number.isSafeInteger(slot) &&
        slot >= 0 &&
        slot < instanceSet.count
      )
        collisions.push(node.id);
    }
  }
  const modelByRuntimeId = new Map(
    [...props.runtimeModels.values()].map((model) => [model.id, model]),
  );
  const models = [
    ...new Set([
      ...source.scene.nodes.map((node) => node.model),
      ...formations.flatMap((formation) =>
        formation.lod.map((lod) => lod.model),
      ),
      ...Object.values(props.instanceSetRuntime ?? {}).flatMap((instanceSet) =>
        instanceSet.lod.map((lod) => lod.model),
      ),
    ]),
  ]
    .sort(compareCodeUnits)
    .flatMap((id) => {
      const model = modelByRuntimeId.get(id);
      return model === undefined ? [] : [model];
    });
  return {
    value: {
      ...source,
      formationMotions: source.formationMotions ?? [],
      formationSlotMotions: source.formationSlotMotions ?? [],
      effects,
      models,
      formations,
      instanceSets: Object.values(props.instanceSetRuntime ?? {}).sort(
        (left, right) => compareCodeUnits(left.id, right.id),
      ),
    },
    collisions,
  };
};

/** Materialize shot-local cues into compiler-owned deterministic streams. */
export const materializeCompiledEffects = (props: {
  contract: IAutoMovieShotContract;
  world?: IAutoMovieWorldDesign;
  fps?: number;
  cues: NonNullable<IAutoMovieShotSourceOutput["effectCues"]>;
}): IAutoMovieCompiledEffect[] => {
  if (props.world === undefined) return [];
  const recipes = new Map(
    props.world.effectRecipes.map((recipe) => [recipe.id, recipe]),
  );
  const zones = new Map(props.world.effectZones.map((zone) => [zone.id, zone]));
  return [...props.cues]
    .sort((left, right) => compareCodeUnits(left.id, right.id))
    .flatMap((cue): IAutoMovieCompiledEffect[] => {
      const zone = zones.get(cue.zone);
      const recipe = zone === undefined ? undefined : recipes.get(zone.recipe);
      if (zone === undefined || recipe === undefined) return [];
      const seedDigest = digestAutoMovieBytes(
        canonicalAutoMovieJsonBytes({
          protocol: "automovie.effect-stream.v1",
          shot: props.contract.id,
          cue: cue.id,
          recipeSeed: recipe.seed,
          zoneSeed: zone.seed,
        }),
      );
      const core = {
        version: 1 as const,
        id: cue.id,
        zone: zone.id,
        kind: recipe.kind,
        bounds: structuredClone(zone.bounds),
        seed: Number.parseInt(seedDigest.slice(7, 20), 16),
        recipe: structuredClone(recipe),
        start: cue.start,
        end: cue.end,
        intensity: structuredClone(cue.intensity),
        ...(cue.event === undefined ? {} : { event: cue.event }),
        fixedStepSeconds: 1 / (props.fps ?? 24),
      };
      return [
        {
          ...core,
          digest: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(core)),
        },
      ];
    });
};

const slotTransform = (slot: IAutoMovieFormationSlot): IAutoMovieTransform => ({
  translation: slot.position,
  rotation: Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, slot.facingDeg),
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * Bind one formation to the terrain its members stand on.
 *
 * The snapshot is the surfaces whose extent reaches the formation's own
 * footprint, in declared order. Reaching is decided on the ground plan alone: a
 * surface whose XZ extent misses the footprint box cannot be under any member
 * of it, so dropping it is sound, and keeping the rest whole is what lets the
 * viewer answer heights from the compiled record without the world beside it.
 *
 * The footprint that decides this is measured with no terrain, which is exactly
 * right: relief moves members up and down, never sideways, so the ground plan
 * is the same before and after. That flat pass is also the finished summary
 * whenever nothing relieves it, so a production on level ground pays for no
 * extra work at all.
 */
const groundFormation = (
  formation: IAutoMovieFormationDesign,
  surfaces: IAutoMovieWorldDesign["surfaces"],
): {
  formation: IAutoMovieGroundedFormationDesign;
  ground: IAutoMovieWorldDesign["surfaces"];
  /** The finished summary, or null when terrain still has to relieve it. */
  footprint: ReturnType<typeof summarizeFormationRange> | null;
} => {
  const flat: IAutoMovieGroundedFormationDesign = { ...formation, ground: [] };
  const footprint = summarizeFormationRange(flat, 0, formation.count);
  const ground = surfaces.filter((surface) =>
    reachesFootprint(surface.polygon, footprint.bounds),
  );
  return ground.length === 0
    ? { formation: flat, ground: [], footprint }
    : { formation: { ...formation, ground }, ground, footprint: null };
};

/** Does a surface footprint's XZ extent reach a formation's XZ extent? */
const reachesFootprint = (
  polygon: IAutoMovieWorldDesign["surfaces"][number]["polygon"],
  bounds: IAutoMovieCompiledFormation["bounds"],
): boolean => {
  const xs = polygon.map((point) => point.x);
  const zs = polygon.map((point) => point.z);
  return (
    Math.min(...xs) <= bounds.max.x &&
    Math.max(...xs) >= bounds.min.x &&
    Math.min(...zs) <= bounds.max.z &&
    Math.max(...zs) >= bounds.min.z
  );
};

const summarizeFormationRange = (
  formation: IAutoMovieGroundedFormationDesign,
  start: number,
  count: number,
): {
  bounds: IAutoMovieCompiledFormation["bounds"];
  centroid: IAutoMovieCompiledFormation["centroid"];
} => {
  const min = {
    x: Number.POSITIVE_INFINITY,
    y: Number.POSITIVE_INFINITY,
    z: Number.POSITIVE_INFINITY,
  };
  const max = {
    x: Number.NEGATIVE_INFINITY,
    y: Number.NEGATIVE_INFINITY,
    z: Number.NEGATIVE_INFINITY,
  };
  const centroid = { x: 0, y: 0, z: 0 };
  for (let slot = start; slot < start + count; ++slot) {
    const point = materializeFormationSlot(formation, slot).position;
    min.x = Math.min(min.x, point.x);
    min.y = Math.min(min.y, point.y);
    min.z = Math.min(min.z, point.z);
    max.x = Math.max(max.x, point.x);
    max.y = Math.max(max.y, point.y);
    max.z = Math.max(max.z, point.z);
    const seen = slot - start + 1;
    centroid.x = stableMeanStep(centroid.x, point.x, seen);
    centroid.y = stableMeanStep(centroid.y, point.y, seen);
    centroid.z = stableMeanStep(centroid.z, point.z, seen);
  }
  return {
    bounds: { min, max },
    centroid,
  };
};

const localInstancePoint = (
  instanceSet: IAutoMovieInstanceSetDesign,
  world: Pick<IAutoMovieWorldDesign, "routes">,
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
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
    };
  }
  const route = world.routes.find((candidate) => candidate.id === layout.route);
  if (route === undefined || route.waypoints.length < 2)
    throw new Error(
      `Instance set "${instanceSet.id}" references unavailable route "${layout.route}".`,
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
  if (Number.isFinite(total) === false || total <= 0)
    throw new RangeError(
      `Instance set "${instanceSet.id}" route "${layout.route}" must have finite non-zero length.`,
    );
  let remaining = ((slot + 0.5) / instanceSet.count) * total;
  const segment = (segments.find((candidate) => {
    if (remaining <= candidate.length) return true;
    remaining -= candidate.length;
    return false;
  }) ?? segments.at(-1))!;
  const ratio =
    segment.length === 0 ? 0 : Math.min(1, remaining / segment.length);
  const tangent = {
    x: segment.right.x - segment.left.x,
    z: segment.right.z - segment.left.z,
  };
  const tangentLength = Math.hypot(tangent.x, tangent.z);
  const jitter =
    (seededValue(instanceSet.seed, slot, 0x6a697474) * 2 - 1) *
    layout.lateralJitter;
  return {
    x:
      segment.left.x +
      tangent.x * ratio -
      (tangentLength === 0 ? 0 : (tangent.z / tangentLength) * jitter),
    z:
      segment.left.z +
      tangent.z * ratio +
      (tangentLength === 0 ? 0 : (tangent.x / tangentLength) * jitter),
  };
};

const summarizeInstanceRange = (
  instanceSet: IAutoMovieInstanceSetDesign,
  world: Pick<IAutoMovieWorldDesign, "routes">,
  start: number,
  count: number,
): {
  bounds: IAutoMovieCompiledInstanceSet["bounds"];
  centroid: IAutoMovieCompiledInstanceSet["centroid"];
} => {
  const min = {
    x: Number.POSITIVE_INFINITY,
    y: Number.POSITIVE_INFINITY,
    z: Number.POSITIVE_INFINITY,
  };
  const max = {
    x: Number.NEGATIVE_INFINITY,
    y: Number.NEGATIVE_INFINITY,
    z: Number.NEGATIVE_INFINITY,
  };
  const centroid = { x: 0, y: 0, z: 0 };
  for (let slot = start; slot < start + count; ++slot) {
    const point = materializeInstanceSlot(instanceSet, world, slot).position;
    min.x = Math.min(min.x, point.x);
    min.y = Math.min(min.y, point.y);
    min.z = Math.min(min.z, point.z);
    max.x = Math.max(max.x, point.x);
    max.y = Math.max(max.y, point.y);
    max.z = Math.max(max.z, point.z);
    const seen = slot - start + 1;
    centroid.x = stableMeanStep(centroid.x, point.x, seen);
    centroid.y = stableMeanStep(centroid.y, point.y, seen);
    centroid.z = stableMeanStep(centroid.z, point.z, seen);
  }
  return { bounds: { min, max }, centroid };
};

const stableMeanStep = (mean: number, value: number, count: number): number =>
  mean * ((count - 1) / count) + value / count;

const stableInterpolate = (from: number, to: number, ratio: number): number =>
  from * (1 - ratio) + to * ratio;

/**
 * Content digest for one LOD tier's model-recipe reference.
 *
 * The design gate refuses an absent recipe and a non-finite parameter alike, so
 * neither reaches a compiled production through a tracked model recipe. The
 * materializer still answers for both the bounded way it answers a malformed
 * projection proxy: a reference that cannot be canonically encoded digests a
 * marker naming what the tier pointed at, instead of letting a canonical-JSON
 * `TypeError` escape and discard the whole compiled formation.
 */
const lodRecipeDigest = (
  recipes: ReadonlyMap<string, IAutoMovieModelRecipe>,
  id: string,
): AutoMovieContentDigest => {
  const recipe = recipes.get(id);
  if (recipe === undefined)
    return digestAutoMovieBytes(
      canonicalAutoMovieJsonBytes({ id, missing: true }),
    );
  try {
    return digestAutoMovieBytes(canonicalAutoMovieJsonBytes(recipe));
  } catch {
    return digestAutoMovieBytes(
      canonicalAutoMovieJsonBytes({ id, unencodable: true }),
    );
  }
};

const recipeProjectionRadius = (
  recipe: IAutoMovieModelRecipe | undefined,
  external: IAutoMovieExternalModelRuntimeBinding | undefined,
  archetypes: AutoMovieModelArchetypeRegistry,
): number | null => {
  if (external !== undefined)
    return external.measurement.recipe === "box-v1"
      ? Math.hypot(
          external.measurement.parameters.width,
          external.measurement.parameters.height,
          external.measurement.parameters.depth,
        ) / 2
      : Math.hypot(
          Math.max(
            external.measurement.parameters.shoulderWidth,
            external.measurement.parameters.hipWidth,
          ),
          external.measurement.parameters.height,
        ) / 2;
  if (recipe === undefined) return null;
  // An unregistered archetype has no measurement of its own, and selection runs
  // before the design gate can refuse it. Answering "unknown" lets the caller
  // fall back to its declared default instead of inventing a bound here.
  const archetype = archetypes.get(recipe.archetype);
  return archetype === undefined
    ? null
    : archetype.projectionRadius(recipe.parameters);
};

const materializeModel = (
  recipe: IAutoMovieModelRecipe,
  external: IAutoMovieExternalModelRuntimeBinding | undefined,
  archetypes: AutoMovieModelArchetypeRegistry,
): IAutoMovieModel => {
  const generated = materializeGeneratedModel(recipe, archetypes);
  if (external === undefined) return generated;
  const shape =
    external.collision.recipe === "capsule-v1"
      ? {
          type: "capsule" as const,
          radius: external.collision.parameters.radius,
          height: external.collision.parameters.height,
        }
      : {
          type: "box" as const,
          width: external.collision.parameters.width,
          height: external.collision.parameters.height,
          depth: external.collision.parameters.depth,
        };
  return {
    ...generated,
    name: `imported recipe ${recipe.id}`,
    origin: "imported",
    asset: external.asset,
    profiles: [],
    imported: {
      profile: external.profile,
      lod: structuredClone(external.lod),
      assets: structuredClone(external.assets),
      humanoidBones: structuredClone(external.humanoidBones),
    },
    parts: [
      {
        id: "registered-collision-proxy",
        name: "registered collision proxy",
        geometry: { type: "primitive", shape },
        material: generated.materials[0]?.id ?? null,
        attachedBone: null,
        transform: null,
      },
    ],
  };
};

const materializeGeneratedModel = (
  recipe: IAutoMovieModelRecipe,
  archetypes: AutoMovieModelArchetypeRegistry,
): IAutoMovieModel => {
  const archetype = archetypes.get(recipe.archetype);
  if (archetype === undefined)
    throw new Error(
      `Model recipe "${recipe.id}" names archetype "${recipe.archetype}", which is not registered with this compiler. Register a builder for it, or name a registered archetype in the tracked model recipe record; the design gate refuses an unregistered archetype before compilation reaches geometry.`,
    );
  const material = materialOf(recipe);
  const geometry = archetype.build({
    recipe: recipe.id,
    parameters: recipe.parameters,
    material: material.id,
    skeleton: productionRuntimeSkeletonId(recipe.id),
  });
  return {
    id: productionRuntimeModelId(recipe.id),
    name: `${recipe.archetype} recipe ${recipe.id}`,
    origin: "generated" as const,
    body: null,
    affordances: null,
    materials: [material],
    asset: null,
    profiles: structuredClone(recipe.profiles ?? []),
    skeleton: geometry.skeleton,
    parts: geometry.parts,
  };
};

const materialOf = (
  recipe: IAutoMovieModelRecipe,
): IAutoMovieModel["materials"][number] => {
  const [name, hex] = Object.entries(recipe.palette).sort(([left], [right]) =>
    compareCodeUnits(left, right),
  )[0]!;
  const channels = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)!;
  return {
    id: name,
    name,
    baseColor: {
      r: Number.parseInt(channels[1]!, 16) / 255,
      g: Number.parseInt(channels[2]!, 16) / 255,
      b: Number.parseInt(channels[3]!, 16) / 255,
      a: 1,
      hex,
    },
    metallic: 0,
    roughness: 0.7,
    emissive: null,
    opacity: 1,
    baseColorTexture: null,
  };
};
