import {
  IAutoMovieFormationGrounding,
  Quaternion,
  formationSlot,
  mixSeed,
  productionRuntimeModelId,
  productionRuntimeSkeletonId,
  seededValue,
  srgbHexToLinearColor,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieBuiltEnvironment,
  IAutoMovieCompiledEffect,
  IAutoMovieCompiledFormation,
  IAutoMovieCompiledInstanceSet,
  IAutoMovieCompiledShotSource,
  IAutoMovieEnvironmentContext,
  IAutoMovieFormationDesign,
  IAutoMovieFormationSlot,
  IAutoMovieGeneratedCollisionProxy,
  IAutoMovieGeneratedMeasurementProxy,
  IAutoMovieInstanceSetDesign,
  IAutoMovieInstanceSlot,
  IAutoMovieLibraryContribution,
  IAutoMovieMaterializedLibrary,
  IAutoMovieMaterializedLibraryOwner,
  IAutoMovieModel,
  IAutoMovieModelRecipe,
  IAutoMovieShotContract,
  IAutoMovieShotSourceOutput,
  IAutoMovieTransform,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import typia from "typia";

import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";
import {
  AUTOMOVIE_REGISTERED_ARCHETYPES,
  AutoMovieModelArchetypeRegistry,
} from "./productionArchetypes";

/**
 * Slots per independently regenerated and culled runtime chunk.
 */
export const AUTOMOVIE_FORMATION_CHUNK_SIZE = 1_024;

/**
 * Slots per independently regenerated general-instance chunk.
 */
export const AUTOMOVIE_INSTANCE_CHUNK_SIZE = 1_024;

/**
 * Matrix bytes reserved by one slot in one LOD instance buffer.
 */
export const AUTOMOVIE_FORMATION_MATRIX_BYTES =
  16 * Float32Array.BYTES_PER_ELEMENT;

export { productionRuntimeModelId, productionRuntimeSkeletonId };

/**
 * Compiler-resolved external appearance and deterministic proxy semantics.
 */
export interface IAutoMovieExternalModelRuntimeBinding {
  /**
   * Manifest-owned final render asset.
   */
  asset: string;
  /**
   * Fixed normalization profile proved by ingest.
   */
  profile: NonNullable<IAutoMovieModel["imported"]>["profile"];
  /**
   * Exact model LOD identities retained for host selection.
   */
  lod: NonNullable<IAutoMovieModel["imported"]>["lod"];
  /**
   * Compiler-sealed model, sidecar and proxy digest closure.
   */
  assets: NonNullable<IAutoMovieModel["imported"]>["assets"];
  /**
   * Ingest/VRM-owned normalized bone mapping.
   */
  humanoidBones: NonNullable<IAutoMovieModel["imported"]>["humanoidBones"];
  /**
   * Exact collision primitive used by engine geometry and mass queries.
   */
  collision: IAutoMovieGeneratedCollisionProxy;
  /**
   * Exact measurement envelope used by projection and distance queries.
   */
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

/**
 * Regenerate one exact formation slot in constant memory.
 */
export const materializeFormationSlot = (
  formation: IAutoMovieGroundedFormationDesign,
  slot: number,
): IAutoMovieFormationSlot => formationSlot(formation, slot);

/**
 * Compile every formation into bounded chunks rather than anonymous nodes.
 */
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

/**
 * Compile one formation into independently regenerable chunk metadata.
 */
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

/**
 * Regenerate one exact non-formation instance in constant memory.
 */
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
          y: instanceSet.anchor.y + point.y,
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
  const explicit =
    instanceSet.layout.kind === "explicit"
      ? instanceSet.layout.transforms[slot]
      : undefined;
  const palette =
    explicit?.palette ?? instanceSet.variation.palette[paletteIndex];
  if (
    [position.x, position.y, position.z, scale, ...Object.values(traits)].some(
      (value) => Number.isFinite(value) === false,
    ) ||
    palette === undefined
  )
    throw new RangeError(
      `Instance set "${instanceSet.id}" slot ${slot} derived non-finite variation or an empty palette.`,
    );
  const legacy =
    instanceSet.prototypes === undefined &&
    instanceSet.layout.kind !== "lattice" &&
    instanceSet.layout.kind !== "explicit" &&
    instanceSet.variation.scale3 === undefined &&
    instanceSet.variation.rotationDeg === undefined &&
    instanceSet.variation.visibleProbability === undefined;
  const base = {
    slot,
    node:
      explicit === undefined
        ? `instance:${instanceSet.id}:slot:${String(slot).padStart(6, "0")}`
        : `instance:${instanceSet.id}:${explicit.id}`,
    modelRecipe: selectedInstancePrototype(
      instanceSet,
      slot,
      explicit?.prototype,
    ).modelRecipe,
    position,
    facingDeg: instanceSet.facingDeg,
    scale,
    palette,
    traits: { ...traits, ...explicit?.traits },
  };
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
  const rotation = Quaternion.normalize(
    Quaternion.multiply(
      Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, instanceSet.facingDeg),
      explicit?.rotation ?? seededInstanceRotation(instanceSet, slot),
    ),
  );
  return {
    ...base,
    prototype: selectedInstancePrototype(instanceSet, slot, explicit?.prototype)
      .id,
    rotation,
    scale3,
    visible:
      explicit?.visible ??
      (instanceSet.variation.visibleProbability === undefined ||
        seededValue(instanceSet.seed, slot, 0x76697369) <
          instanceSet.variation.visibleProbability),
  };
};

const selectedInstancePrototype = (
  instanceSet: IAutoMovieInstanceSetDesign,
  slot: number,
  explicit?: string,
): { id: string; modelRecipe: string } => {
  const choices = [
    { id: "default", modelRecipe: instanceSet.modelRecipe, weight: 1 },
    ...(instanceSet.prototypes ?? []),
  ];
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
  for (const choice of choices.slice(0, -1)) {
    if (sample < choice.weight) return choice;
    sample -= choice.weight;
  }
  return choices.at(-1)!;
};

const seededInstanceRotation = (
  instanceSet: IAutoMovieInstanceSetDesign,
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

/**
 * Compile every world instance set into bounded regenerable chunks.
 */
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

/**
 * Compile one world instance set without expanding its full slot inventory.
 */
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
  const layout = instanceSet.layout;
  const compilePrototype = (prototype: {
    id: string;
    modelRecipe: string;
    weight: number;
  }) => {
    const prototypeRecipe = recipes.get(prototype.modelRecipe);
    const sourceLod = prototypeRecipe?.lod ?? [];
    const lod = (
      sourceLod.length === 0
        ? [
            {
              tier: "near" as const,
              maxDistance: null,
              recipe: prototype.modelRecipe,
            },
          ]
        : sourceLod
    ).map((item) => ({
      ...item,
      recipeDigest: lodRecipeDigest(recipes, item.recipe),
      model: productionRuntimeModelId(item.recipe),
    }));
    return {
      ...prototype,
      lod,
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
              prototypeRecipe,
              externalModels.get(prototype.modelRecipe),
              archetypes,
            ) ??
            0.5,
        ),
      ),
    };
  };
  const defaultPrototype = compilePrototype({
    id: "default",
    modelRecipe: instanceSet.modelRecipe,
    weight: 1,
  });
  const prototypes =
    instanceSet.prototypes === undefined
      ? undefined
      : [defaultPrototype, ...instanceSet.prototypes.map(compilePrototype)];
  const lod = defaultPrototype.lod;
  const core = {
    version: 1 as const,
    id: instanceSet.id,
    count: instanceSet.count,
    modelRecipe: instanceSet.modelRecipe,
    ...(prototypes === undefined ? {} : { prototypes }),
    layout: structuredClone(layout),
    route:
      layout.kind === "along-route"
        ? structuredClone(
            world.routes.find((route) => route.id === layout.route)!,
          )
        : null,
    anchor: structuredClone(instanceSet.anchor),
    facingDeg: instanceSet.facingDeg,
    seed: instanceSet.seed,
    variation: structuredClone(instanceSet.variation),
    ...summary,
    projectionRadius:
      prototypes === undefined
        ? defaultPrototype.projectionRadius
        : Math.max(
            ...prototypes.map((prototype) => prototype.projectionRadius),
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
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-structural-output-invariant Materializes each compiled shot's models, hero nodes and formations into a reviewable runtime form whose proxies stay marked as proxies.
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
    const explicitIds = new Set(
      instanceSet.layout.kind === "explicit"
        ? instanceSet.layout.transforms.map(
            (transform) => `instance:${instanceSet.id}:${transform.id}`,
          )
        : [],
    );
    for (const node of source.scene.nodes) {
      if (explicitIds.has(node.id)) {
        collisions.push(node.id);
        continue;
      }
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
  for (const model of source.authoredModels ?? [])
    modelByRuntimeId.set(model.id, model);
  const models = [
    ...new Set([
      ...source.scene.nodes.map((node) => node.model),
      ...formations.flatMap((formation) =>
        formation.lod.map((lod) => lod.model),
      ),
      ...Object.values(props.instanceSetRuntime ?? {}).flatMap((instanceSet) =>
        (instanceSet.prototypes ?? [{ lod: instanceSet.lod }]).flatMap(
          (prototype) => prototype.lod.map((lod) => lod.model),
        ),
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

/**
 * Materialize shot-local cues into compiler-owned deterministic streams.
 */
export const materializeCompiledEffects = (
  props: {
    world?: IAutoMovieWorldDesign;
    fps?: number;
    fixedStepSeconds?: number;
    cues: NonNullable<IAutoMovieShotSourceOutput["effectCues"]>;
  } & (
    | { contract: IAutoMovieShotContract; seedOwner?: never }
    | {
        contract?: never;
        seedOwner: { production: string; film: string };
      }
  ),
): IAutoMovieCompiledEffect[] => {
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
        canonicalAutoMovieJsonBytes(
          props.seedOwner === undefined
            ? {
                protocol: "automovie.effect-stream.v1",
                shot: props.contract!.id,
                cue: cue.id,
                recipeSeed: recipe.seed,
                zoneSeed: zone.seed,
              }
            : {
                protocol: "automovie.film-effect-seed.v1",
                owner: props.seedOwner,
                cue: cue.id,
                recipe,
                zone,
              },
        ),
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
        fixedStepSeconds: props.fixedStepSeconds ?? 1 / (props.fps ?? 24),
      };
      return [
        {
          ...core,
          digest: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(core)),
        },
      ];
    });
};

/**
 * Generated-root path of the compiler-owned library index.
 *
 * Exported because the offline observation command opens the same file the
 * compiler wrote, and a second spelling of that path is a second answer to
 * where the library's lineage lives.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Gives the compiler and the offline observation command one address for the published library lineage.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Fixes the locator through which the derived delivery population reopens compiled owners.
 */
export const AUTOMOVIE_LIBRARY_INDEX_PATH = "library/index.json";

/**
 * One design owner's executed source result, before it becomes generated bytes.
 *
 * The compiler produces these by running library source; this module turns them
 * into the compiler-owned files and index a later reader opens. Keeping the two
 * apart is what lets the publication be measured against a hand-built result
 * rather than only against whatever the sandbox happened to return.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Carries the executed owner whose published artifact the delivery population is charged over.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types the executed owner result the published owner index is derived from.
 * @author Samchon
 */
export interface IAutoMovieMaterializedLibraryResult {
  /** Active manifest-derived design branch. */
  branch: string;
  /** Exact `docs/<document>.md#<anchor>` address the export registered. */
  owner: string;
  /** Project-relative source file whose export produced the contribution. */
  source: string;
  /** Named export inside that file. */
  export: string;
  /** Digest of the normalized source bytes that were executed. */
  sourceDigest: AutoMovieContentDigest;
  /** Exact validated contribution that export returned. */
  /**
   * What the owner's build function returned, with `contexts` already decided.
   *
   * Definite here where the contract leaves it optional. The compiler is this
   * type's only producer and normalizes at the registration boundary, so a
   * second `?? []` on this side would be a branch no run can take -- which is
   * what it became the moment that normalization landed.
   */
  contribution: IAutoMovieLibraryContribution & {
    contexts: IAutoMovieEnvironmentContext[];
  };
}

/**
 * Turn every executed library owner into compiler-owned bytes and one index.
 *
 * A library publishes what a film publishes for the two things a film also has
 * and at the same addresses: a model lands under `models/` so the fixed turntable set and
 * the rig test read it exactly as they read a film's, and a built environment
 * lands under `library/environments/` because a film has no equivalent to
 * reuse. The index beside them is the part a film does not need at all: without
 * a shot there is nothing that already says which design decision an artifact
 * belongs to, so the lineage is written down rather than inferred from a
 * filename.
 *
 * The result is a pure function of the executed owners, so a second compile of
 * unchanged source produces the same bytes down to the trailing newline.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Makes the compiled topology a library review population is derived from an actual compiler-owned artifact rather than an unexecuted source path.
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence Publishes each artifact with the owner, source export, and compile identity a receipt is bound to.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Supplies the published owner-to-artifact index the library review denominator is read through.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness Records the compile identity the published library artifacts were derived at.
 * @author Samchon
 */
export const materializeAutoMovieLibraryFiles = (props: {
  /** Production namespace this library is compiled under. */
  production: string;
  /** Compiler protocol identity recorded in the index. */
  compiler: string;
  /** Compiler input identity this publication was derived at. */
  inputFingerprint: AutoMovieContentDigest;
  /** Executed owners in any order; the result is sorted by its own address. */
  results: readonly IAutoMovieMaterializedLibraryResult[];
}): {
  files: ReadonlyMap<string, Uint8Array>;
  index: IAutoMovieMaterializedLibrary;
} => {
  const files = new Map<string, Uint8Array>();
  const put = (file: string, value: unknown): void => {
    files.set(
      file,
      Buffer.concat([
        Buffer.from(canonicalAutoMovieJsonBytes(value)),
        Buffer.from("\n", "utf8"),
      ]),
    );
  };
  const owners = [...props.results]
    .sort((left, right) =>
      compareCodeUnits(
        JSON.stringify([left.branch, left.owner]),
        JSON.stringify([right.branch, right.owner]),
      ),
    )
    .map((result): IAutoMovieMaterializedLibraryOwner => {
      for (const environment of result.contribution.environments)
        put(
          `library/environments/${encodeAutoMoviePathSegment(environment.id)}.json`,
          environment,
        );
      for (const model of result.contribution.models)
        put(`models/${encodeAutoMoviePathSegment(model.id)}.json`, model);
      // Under their own directory rather than beside the environments. A
      // context is not a thing in the world the environments describe; it is
      // the world they are described against, and one adopted context may be
      // the ground several owners' buildings stand on.
      for (const context of result.contribution.contexts)
        put(
          `library/contexts/${encodeAutoMoviePathSegment(context.id)}.json`,
          context,
        );
      return {
        branch: result.branch,
        owner: result.owner,
        source: result.source,
        export: result.export,
        sourceDigest: result.sourceDigest,
        environments: result.contribution.environments
          .map((environment) => environment.id)
          .sort(compareCodeUnits),
        models: result.contribution.models
          .map((model) => model.id)
          .sort(compareCodeUnits),
        contexts: result.contribution.contexts
          .map((context) => context.id)
          .sort(compareCodeUnits),
      };
    });
  const index: IAutoMovieMaterializedLibrary = {
    version: 1,
    compiler: props.compiler,
    production: props.production,
    inputFingerprint: props.inputFingerprint,
    owners,
  };
  put(AUTOMOVIE_LIBRARY_INDEX_PATH, index);
  return { files, index };
};

/**
 * Reopen the buildings a library compile published, addressed by design owner.
 *
 * The compiler answers this from memory while it is running, because the owner
 * it just refused must not be charged observations against a building still on
 * disk from an earlier run. Every other reader is outside that run and has only
 * the tree, so this is how the shipped observation command arrives at the same
 * required population the review gate will derive: through the index the same
 * compile wrote, never by re-executing source or by guessing from a filename.
 *
 * A missing, unreadable, or schema-invalid index yields an empty population
 * rather than throwing. That is the honest answer for a project that has not
 * compiled yet, and the compile gate is what refuses the state itself; a reader
 * that threw here would report a compile problem as an observation problem.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Gives an offline observation command the same published owner population the review gate charges.
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Supplies the compiled topology the required viewpoint population is derived from.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Reopens the published owner-to-artifact index instead of recomputing a branch list.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Hands the derivation the exact compiled buildings one owner published.
 * @author Samchon
 */
export const autoMovieMaterializedLibraryEnvironments = (props: {
  /** Read one generated-root-relative file, throwing when it is absent. */
  read: (relativePath: string) => Uint8Array;
}): ((request: {
  branch: string;
  owner: string;
  anchor: string;
}) => readonly IAutoMovieBuiltEnvironment[]) =>
  materializedLibraryReader<IAutoMovieBuiltEnvironment>({
    read: props.read,
    select: (owner) => owner.environments,
    file: (id) => `library/environments/${encodeAutoMoviePathSegment(id)}.json`,
    validate: (value) =>
      typia.validateEquals<IAutoMovieBuiltEnvironment>(value),
    what: "environments",
  });

/**
 * Reopen the worlds a library compile published, addressed by design owner.
 *
 * Beside {@link autoMovieMaterializedLibraryEnvironments} and through the same
 * index, because a map owner is measured the way a space owner is: against
 * what it contributed, not against what the production happens to carry. The
 * production design also holds one context for the whole production, and that
 * one belongs to nobody -- two map owners would each owe its every instant, and
 * one adopted world would be paid for twice.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Reopens the adopted world a map owner published so its observation population is derived from what that owner contributed.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Reads the per-owner context ids the same compile wrote rather than re-executing source.
 * @author Samchon
 */
export const autoMovieMaterializedLibraryContexts = (props: {
  /** Read one generated-root-relative file, throwing when it is absent. */
  read: (relativePath: string) => Uint8Array;
}): ((request: {
  branch: string;
  owner: string;
  anchor: string;
}) => readonly IAutoMovieEnvironmentContext[]) =>
  materializedLibraryReader<IAutoMovieEnvironmentContext>({
    read: props.read,
    select: (owner) => owner.contexts,
    file: (id) => `library/contexts/${encodeAutoMoviePathSegment(id)}.json`,
    validate: (value) =>
      typia.validateEquals<IAutoMovieEnvironmentContext>(value),
    what: "contexts",
  });

/**
 * One reading of the published index, for one kind of published artifact.
 *
 * The two readers differ in three values and in nothing else, and the parts
 * they share are the parts that were wrong: the index is keyed by the design
 * owner's full `path#anchor` address, and a request carrying the document path
 * alone matched nothing -- every time, for every owner, in silence. Written
 * twice, that defect would have had two places to be reintroduced.
 */
const materializedLibraryReader = <T>(props: {
  read: (relativePath: string) => Uint8Array;
  select: (
    owner: IAutoMovieMaterializedLibraryOwner,
  ) => readonly string[] | undefined;
  file: (id: string) => string;
  validate: (value: unknown) => typia.IValidation<T>;
  what: string;
}): ((request: {
  branch: string;
  owner: string;
  anchor: string;
}) => readonly T[]) => {
  const published = new Map<string, string[]>();
  try {
    const index = typia.validateEquals<IAutoMovieMaterializedLibrary>(
      JSON.parse(
        Buffer.from(props.read(AUTOMOVIE_LIBRARY_INDEX_PATH)).toString("utf8"),
      ) as unknown,
    );
    if (index.success === true)
      for (const owner of index.data.owners)
        published.set(JSON.stringify([owner.branch, owner.owner]), [
          ...(props.select(owner) ?? []),
        ]);
  } catch {
    // An absent or unreadable index is an uncompiled project, which the compile
    // gate reports at its own address; here it is simply an empty population.
  }
  return (request) => {
    // An empty answer is a real one for an owner that published nothing, so it
    // cannot also mean "you addressed this wrongly"; that has to be said
    // separately or it is never said at all. `building:report` passed the
    // document path alone and read no materialized building for as long as that
    // stood, while reporting that it had looked.
    if (request.owner.includes("#") === false)
      throw new Error(
        `Materialized library ${props.what} are addressed by the design owner's "path#anchor", not by "${request.owner}" alone.`,
      );
    const ids = published.get(JSON.stringify([request.branch, request.owner]));
    if (ids === undefined) return [];
    const found: T[] = [];
    for (const id of ids)
      try {
        const validation = props.validate(
          JSON.parse(Buffer.from(props.read(props.file(id))).toString("utf8")),
        );
        if (validation.success === true) found.push(validation.data);
      } catch {
        // A published path the tree no longer carries is generated-output
        // tampering, which `generated-tampered` names at that exact file.
      }
    return found;
  };
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
  let segment = segments.at(-1)!;
  for (const candidate of segments.slice(0, -1)) {
    if (remaining <= candidate.length) {
      segment = candidate;
      break;
    }
    remaining -= candidate.length;
  }
  const ratio = Math.min(1, remaining / segment.length);
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
      segment.left.x + tangent.x * ratio - (tangent.z / tangentLength) * jitter,
    y: 0,
    z:
      segment.left.z + tangent.z * ratio + (tangent.x / tangentLength) * jitter,
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
        material: generated.materials[0]!.id,
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
  return {
    id: name,
    name,
    // A recipe palette is an sRGB swatch and `baseColor` is linear, so the
    // digits are decoded rather than divided by 255. Dividing was this
    // repository's only sRGB-to-linear "conversion", and being an identity it
    // made every generated material about 2.3x too bright at midtones while
    // instanced slots covering the same surface decoded theirs correctly.
    baseColor: srgbHexToLinearColor(hex),
    metallic: 0,
    roughness: 0.7,
    emissive: null,
    opacity: 1,
    baseColorTexture: null,
  };
};
