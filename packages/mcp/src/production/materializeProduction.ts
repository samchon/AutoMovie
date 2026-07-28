import { Quaternion } from "@automovie/engine";
import {
  IAutoMovieCompiledFormation,
  IAutoMovieCompiledShotSource,
  IAutoMovieFormationDesign,
  IAutoMovieFormationSlot,
  IAutoMovieModel,
  IAutoMovieModelPart,
  IAutoMovieModelRecipe,
  IAutoMovieShotContract,
  IAutoMovieShotSourceOutput,
  IAutoMovieTransform,
} from "@automovie/interface";

import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
} from "./contentIdentity";

/** Slots per independently regenerated and culled runtime chunk. */
export const AUTOMOVIE_FORMATION_CHUNK_SIZE = 1_024;

/** Matrix bytes reserved by one slot in one LOD instance buffer. */
export const AUTOMOVIE_FORMATION_MATRIX_BYTES =
  16 * Float32Array.BYTES_PER_ELEMENT;

/** Compiler-owned runtime identity for one model recipe. */
export const productionRuntimeModelId = (recipe: string): string =>
  `automovie:model:${recipe}`;

/** Compiler-owned skeleton identity for one rigged model recipe. */
export const productionRuntimeSkeletonId = (recipe: string): string =>
  `automovie:skeleton:${recipe}`;

/** Materialize every bounded model recipe into deterministic primitive data. */
export const materializeProductionModels = (
  recipes: ReadonlyMap<string, IAutoMovieModelRecipe>,
): ReadonlyMap<string, IAutoMovieModel> =>
  new Map(
    [...recipes]
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([id, recipe]) => [id, materializeModel(recipe)] as const),
  );

/** Materialize one compact formation into ordered world-space slots. */
export const materializeFormationSlots = (
  formation: IAutoMovieFormationDesign,
): IAutoMovieFormationSlot[] =>
  Array.from({ length: formation.count }, (_, slot) =>
    materializeFormationSlot(formation, slot),
  );

/** Regenerate one exact formation slot in constant memory. */
export const materializeFormationSlot = (
  formation: IAutoMovieFormationDesign,
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
  const point = localFormationPoint(formation, slot);
  const radians = (formation.facingDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const actor =
    formation.heroOverrides.find((hero) => hero.slot === slot)?.actor ?? null;
  return {
    slot,
    node:
      actor ??
      `formation:${formation.id}:slot:${String(slot).padStart(6, "0")}`,
    actor,
    modelRecipe: formation.modelRecipe,
    position: {
      x: formation.anchor.x + point.x * cosine + point.z * sine,
      y: formation.anchor.y,
      z: formation.anchor.z - point.x * sine + point.z * cosine,
    },
    facingDeg: formation.facingDeg,
    motionPhase: seededValue(formation.seed, slot, 0x70686173),
  };
};

/** Compiler-owned formation inventory passed to deterministic shot source. */
export const materializeFormationInventory = (
  formations: ReadonlyMap<string, IAutoMovieFormationDesign>,
): Readonly<Record<string, readonly IAutoMovieFormationSlot[]>> =>
  Object.fromEntries(
    [...formations]
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([id, formation]) => [id, materializeFormationSlots(formation)]),
  );

/** Compile every formation into bounded chunks rather than anonymous nodes. */
export const materializeCompiledFormationInventory = (
  formations: ReadonlyMap<string, IAutoMovieFormationDesign>,
  recipes: ReadonlyMap<string, IAutoMovieModelRecipe>,
): Readonly<Record<string, IAutoMovieCompiledFormation>> =>
  Object.fromEntries(
    [...formations]
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([id, formation]) => [
        id,
        materializeCompiledFormation(formation, recipes),
      ]),
  );

/** Compile one formation into independently regenerable chunk metadata. */
export const materializeCompiledFormation = (
  formation: IAutoMovieFormationDesign,
  recipes: ReadonlyMap<string, IAutoMovieModelRecipe> = new Map(),
): IAutoMovieCompiledFormation => {
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
      const summary = summarizeFormationRange(formation, start, count);
      let anonymousCount = count;
      for (const slot of heroes)
        if (slot >= start && slot < start + count) --anonymousCount;
      return { index, start, count, anonymousCount, ...summary };
    },
  );
  const summary = summarizeFormationRange(formation, 0, formation.count);
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
    recipeDigest: digestAutoMovieBytes(
      canonicalAutoMovieJsonBytes(
        recipes.get(item.recipe) ?? {
          id: item.recipe,
          missing: true,
        },
      ),
    ),
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
    facingDeg: formation.facingDeg,
    seed: formation.seed,
    ...summary,
    projectionRadius: Math.max(
      0.01,
      ...lod.map(
        (item) =>
          recipeProjectionRadius(recipes.get(item.recipe)) ??
          recipeProjectionRadius(recipe) ??
          0.5,
      ),
    ),
    chunks,
    heroes: [...formation.heroOverrides]
      .sort((left, right) => left.slot - right.slot)
      .map((hero) => {
        const slot = materializeFormationSlot(formation, hero.slot);
        return {
          slot: hero.slot,
          actor: hero.actor,
          transform: slotTransform(slot),
        };
      }),
    lod,
    phase: {
      seed: mixSeed(formation.seed, 0x70686173),
      periodSeconds: 0.8 + seededValue(formation.seed, 0x70657269) * 0.8,
    },
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
  modelRecipes?: ReadonlyMap<string, IAutoMovieModelRecipe>;
  runtimeModels: ReadonlyMap<string, IAutoMovieModel>;
  source: IAutoMovieShotSourceOutput;
}): {
  value: IAutoMovieCompiledShotSource;
  collisions: string[];
} => {
  const source = structuredClone(props.source);
  const nodes = new Map(source.scene.nodes.map((node) => [node.id, node]));
  const collisions: string[] = [];
  const formations: IAutoMovieCompiledFormation[] = [];
  for (const participant of props.contract.participants) {
    if (participant.kind !== "formation") continue;
    const formation = props.formations.get(participant.id);
    if (formation === undefined) continue;
    const compiled =
      props.formationRuntime?.[participant.id] ??
      materializeCompiledFormation(formation, props.modelRecipes);
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
  const modelByRuntimeId = new Map(
    [...props.runtimeModels.values()].map((model) => [model.id, model]),
  );
  const models = [
    ...new Set([
      ...source.scene.nodes.map((node) => node.model),
      ...formations.flatMap((formation) =>
        formation.lod.map((lod) => lod.model),
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
      models,
      formations,
    },
    collisions,
  };
};

const slotTransform = (slot: IAutoMovieFormationSlot): IAutoMovieTransform => ({
  translation: slot.position,
  rotation: Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, slot.facingDeg),
  scale: { x: 1, y: 1, z: 1 },
});

const localFormationPoint = (
  formation: IAutoMovieFormationDesign,
  slot: number,
): { x: number; z: number } => {
  const layout = formation.layout;
  if (layout.kind === "line" || layout.kind === "column") {
    const rank =
      layout.kind === "line"
        ? Math.floor(slot / layout.files)
        : slot % layout.ranks;
    const file =
      layout.kind === "line"
        ? slot % layout.files
        : Math.floor(slot / layout.ranks);
    return {
      x: (file - (layout.files - 1) / 2) * layout.spacing.lateral,
      z: rank * layout.spacing.depth,
    };
  }
  if (layout.kind === "wedge") {
    const row = Math.floor(Math.sqrt(slot));
    const column = slot - row * row - row;
    return {
      x: column * layout.spacing.lateral,
      z: row * layout.spacing.depth,
    };
  }
  if (layout.kind === "arc") {
    const ratio = formation.count === 1 ? 0.5 : slot / (formation.count - 1);
    const degrees = (ratio - 0.5) * layout.arcDegrees;
    const radians = (degrees * Math.PI) / 180;
    return {
      x: Math.sin(radians) * layout.radius,
      z: Math.cos(radians) * layout.radius,
    };
  }
  const radius =
    Math.sqrt(seededValue(formation.seed, layout.seed, slot, 0)) *
    layout.radius;
  const angle = seededValue(formation.seed, layout.seed, slot, 1) * Math.PI * 2;
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
  };
};

const summarizeFormationRange = (
  formation: IAutoMovieFormationDesign,
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
  const sum = { x: 0, y: 0, z: 0 };
  for (let slot = start; slot < start + count; ++slot) {
    const point = materializeFormationSlot(formation, slot).position;
    min.x = Math.min(min.x, point.x);
    min.y = Math.min(min.y, point.y);
    min.z = Math.min(min.z, point.z);
    max.x = Math.max(max.x, point.x);
    max.y = Math.max(max.y, point.y);
    max.z = Math.max(max.z, point.z);
    sum.x += point.x;
    sum.y += point.y;
    sum.z += point.z;
  }
  return {
    bounds: { min, max },
    centroid: {
      x: sum.x / count,
      y: sum.y / count,
      z: sum.z / count,
    },
  };
};

const seededValue = (...values: number[]): number => {
  let state = 0x9e3779b9;
  for (const value of values) state = mixSeed(value, state);
  state = (state + 0x6d2b79f5) >>> 0;
  let output = state;
  output = Math.imul(output ^ (output >>> 15), output | 1);
  output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
  return ((output ^ (output >>> 14)) >>> 0) / 4_294_967_296;
};

/**
 * Fold one full safe-integer seed into a 32-bit PRNG state.
 *
 * Low and high words are mixed in sequence, with a caller-supplied salt, so
 * swapped seed roles and values separated by 2^32 no longer collapse by
 * construction under JavaScript bitwise XOR.
 */
const mixSeed = (seed: number, salt: number): number => {
  const integer = Math.trunc(seed);
  const low = integer >>> 0;
  const high = Math.floor(integer / 4_294_967_296) >>> 0;
  let value = (salt ^ low) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15) ^ high, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
};

const recipeProjectionRadius = (
  recipe: IAutoMovieModelRecipe | undefined,
): number | null => {
  if (recipe === undefined) return null;
  const number = (key: string): number => {
    const value = recipe.parameters[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  switch (recipe.archetype) {
    case "stickman":
      return number("height") / 2;
    case "horse":
      return Math.hypot(number("length"), number("height")) / 2;
    case "artillery":
      return (
        Math.hypot(
          number("barrelLength"),
          number("wheelRadius") * 2,
          number("gauge"),
        ) / 2
      );
    case "flag":
      return (
        Math.hypot(number("width"), number("height"), number("poleHeight")) / 2
      );
    case "weapon":
      return number("length") / 2;
    case "primitive-prop": {
      const shape = recipe.parameters.shape;
      if (shape === "sphere") return number("radius");
      if (shape === "capsule") return number("radius") + number("height") / 2;
      if (shape === "cylinder" || shape === "cone")
        return Math.hypot(number("radius"), number("height") / 2);
      if (shape === "plane")
        return Math.hypot(number("width"), number("depth")) / 2;
      return Math.hypot(number("width"), number("height"), number("depth")) / 2;
    }
  }
};

const materializeModel = (recipe: IAutoMovieModelRecipe): IAutoMovieModel => {
  const material = materialOf(recipe);
  const base = {
    id: productionRuntimeModelId(recipe.id),
    name: `${recipe.archetype} recipe ${recipe.id}`,
    origin: "generated" as const,
    body: null,
    affordances: null,
    materials: [material],
    asset: null,
  };
  if (recipe.archetype === "stickman") {
    const height = numberParameter(recipe, "height");
    const headRadius = numberParameter(recipe, "headRadius");
    const limbRadius = numberParameter(recipe, "limbRadius");
    const skeleton = stickmanSkeleton(recipe.id, height);
    const part = (
      id: string,
      bone: IAutoMovieModelPart["attachedBone"],
      shape: Extract<
        IAutoMovieModelPart["geometry"],
        { type: "primitive" }
      >["shape"],
      transform: IAutoMovieTransform | null,
    ): IAutoMovieModelPart => ({
      id,
      name: id,
      geometry: { type: "primitive", shape },
      material: material.id,
      attachedBone: bone,
      transform,
    });
    const torsoHeight = Math.max(headRadius * 2, height * 0.3);
    const upperLimb = Math.max(limbRadius * 2, height * 0.15);
    const lowerLimb = Math.max(limbRadius * 2, height * 0.14);
    return {
      ...base,
      skeleton,
      parts: [
        part(
          "pelvis",
          "hips",
          {
            type: "box",
            width: height * 0.19,
            height: height * 0.12,
            depth: height * 0.11,
          },
          transform(0, 0, 0),
        ),
        part(
          "torso",
          "spine",
          {
            type: "box",
            width: height * 0.25,
            height: torsoHeight,
            depth: height * 0.12,
          },
          transform(0, torsoHeight * 0.22, 0),
        ),
        part("head", "head", { type: "sphere", radius: headRadius }, null),
        ...(["left", "right"] as const).flatMap((side) => {
          const sign = side === "left" ? 1 : -1;
          return [
            part(
              `${side}-upper-arm`,
              `${side}UpperArm`,
              {
                type: "capsule",
                radius: limbRadius,
                height: upperLimb,
              },
              horizontal(sign * upperLimb * 0.55),
            ),
            part(
              `${side}-lower-arm`,
              `${side}LowerArm`,
              {
                type: "capsule",
                radius: limbRadius * 0.85,
                height: lowerLimb,
              },
              horizontal(sign * lowerLimb * 0.55),
            ),
            part(
              `${side}-hand`,
              `${side}Hand`,
              { type: "sphere", radius: limbRadius * 1.05 },
              null,
            ),
            part(
              `${side}-thigh`,
              `${side}UpperLeg`,
              {
                type: "capsule",
                radius: limbRadius * 1.15,
                height: height * 0.19,
              },
              transform(0, -height * 0.105, 0),
            ),
            part(
              `${side}-shin`,
              `${side}LowerLeg`,
              {
                type: "capsule",
                radius: limbRadius,
                height: height * 0.19,
              },
              transform(0, -height * 0.105, 0),
            ),
          ];
        }),
      ],
    };
  }
  const staticPart = (
    id: string,
    shape: Extract<
      IAutoMovieModelPart["geometry"],
      { type: "primitive" }
    >["shape"],
    local: IAutoMovieTransform | null = null,
  ): IAutoMovieModelPart => ({
    id,
    name: id,
    geometry: { type: "primitive", shape },
    material: material.id,
    attachedBone: null,
    transform: local,
  });
  if (recipe.archetype === "horse") {
    const length = numberParameter(recipe, "length");
    const height = numberParameter(recipe, "height");
    const leg = numberParameter(recipe, "legLength");
    return {
      ...base,
      skeleton: null,
      parts: [
        staticPart(
          "body",
          {
            type: "capsule",
            radius: height * 0.22,
            height: length * 0.62,
          },
          rotateZ(90, 0, height - leg, 0),
        ),
        staticPart(
          "head",
          {
            type: "box",
            width: height * 0.22,
            height: height * 0.32,
            depth: height * 0.28,
          },
          transform(0, height * 0.9, length * 0.35),
        ),
        ...[-1, 1].flatMap((xSign) =>
          [-1, 1].map((zSign) =>
            staticPart(
              `leg-${xSign}-${zSign}`,
              {
                type: "capsule",
                radius: height * 0.055,
                height: leg,
              },
              transform(
                xSign * height * 0.14,
                leg * 0.5,
                zSign * length * 0.24,
              ),
            ),
          ),
        ),
      ],
    };
  }
  if (recipe.archetype === "artillery") {
    const barrel = numberParameter(recipe, "barrelLength");
    const wheel = numberParameter(recipe, "wheelRadius");
    const gauge = numberParameter(recipe, "gauge");
    return {
      ...base,
      skeleton: null,
      parts: [
        staticPart(
          "barrel",
          { type: "cylinder", radius: gauge * 0.12, height: barrel },
          rotateX(90, 0, wheel * 1.2, 0),
        ),
        staticPart(
          "left-wheel",
          { type: "cylinder", radius: wheel, height: gauge * 0.12 },
          rotateZ(90, -gauge * 0.5, wheel, 0),
        ),
        staticPart(
          "right-wheel",
          { type: "cylinder", radius: wheel, height: gauge * 0.12 },
          rotateZ(90, gauge * 0.5, wheel, 0),
        ),
      ],
    };
  }
  if (recipe.archetype === "flag") {
    const width = numberParameter(recipe, "width");
    const height = numberParameter(recipe, "height");
    const pole = numberParameter(recipe, "poleHeight");
    return {
      ...base,
      skeleton: null,
      parts: [
        staticPart(
          "pole",
          {
            type: "cylinder",
            radius: Math.max(0.01, width * 0.015),
            height: pole,
          },
          transform(0, pole * 0.5, 0),
        ),
        staticPart(
          "cloth",
          { type: "plane", width, depth: height },
          rotateX(90, width * 0.5, pole - height * 0.5, 0),
        ),
      ],
    };
  }
  if (recipe.archetype === "weapon") {
    const length = numberParameter(recipe, "length");
    const thickness = numberParameter(recipe, "thickness");
    return {
      ...base,
      skeleton: null,
      parts: [
        staticPart("weapon", {
          type: "box",
          width: thickness,
          height: length,
          depth: thickness,
        }),
      ],
    };
  }
  const shape = stringParameter(recipe, "shape");
  return {
    ...base,
    skeleton: null,
    parts: [staticPart("primitive", primitivePropShape(recipe, shape))],
  };
};

const stickmanSkeleton = (
  recipe: string,
  height: number,
): NonNullable<IAutoMovieModel["skeleton"]> => {
  const bone = (
    name: NonNullable<IAutoMovieModel["skeleton"]>["bones"][number]["bone"],
    parent: NonNullable<IAutoMovieModel["skeleton"]>["bones"][number]["parent"],
    x: number,
    y: number,
    z: number,
  ): NonNullable<IAutoMovieModel["skeleton"]>["bones"][number] => ({
    bone: name,
    parent,
    rest: transform(x, y, z),
    constraint: null,
  });
  return {
    id: productionRuntimeSkeletonId(recipe),
    bones: [
      bone("hips", null, 0, height * 0.5, 0),
      bone("spine", "hips", 0, height * 0.18, 0),
      bone("head", "spine", 0, height * 0.24, 0),
      bone("leftUpperArm", "spine", height * 0.125, height * 0.15, 0),
      bone("leftLowerArm", "leftUpperArm", height * 0.17, 0, 0),
      bone("leftHand", "leftLowerArm", height * 0.16, 0, 0),
      bone("rightUpperArm", "spine", -height * 0.125, height * 0.15, 0),
      bone("rightLowerArm", "rightUpperArm", -height * 0.17, 0, 0),
      bone("rightHand", "rightLowerArm", -height * 0.16, 0, 0),
      bone("leftUpperLeg", "hips", height * 0.07, -height * 0.04, 0),
      bone("leftLowerLeg", "leftUpperLeg", 0, -height * 0.22, 0),
      bone("rightUpperLeg", "hips", -height * 0.07, -height * 0.04, 0),
      bone("rightLowerLeg", "rightUpperLeg", 0, -height * 0.22, 0),
    ],
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
    metallic: recipe.archetype === "weapon" ? 0.7 : 0,
    roughness: recipe.archetype === "weapon" ? 0.35 : 0.7,
    emissive: null,
    opacity: 1,
    baseColorTexture: null,
  };
};

const primitivePropShape = (
  recipe: IAutoMovieModelRecipe,
  shape: string,
): Extract<IAutoMovieModelPart["geometry"], { type: "primitive" }>["shape"] => {
  if (shape === "box")
    return {
      type: "box",
      width: numberParameter(recipe, "width"),
      height: numberParameter(recipe, "height"),
      depth: numberParameter(recipe, "depth"),
    };
  if (shape === "sphere")
    return { type: "sphere", radius: numberParameter(recipe, "radius") };
  if (shape === "capsule")
    return {
      type: "capsule",
      radius: numberParameter(recipe, "radius"),
      height: numberParameter(recipe, "height"),
    };
  if (shape === "cylinder")
    return {
      type: "cylinder",
      radius: numberParameter(recipe, "radius"),
      height: numberParameter(recipe, "height"),
    };
  if (shape === "cone")
    return {
      type: "cone",
      radius: numberParameter(recipe, "radius"),
      height: numberParameter(recipe, "height"),
    };
  return {
    type: "plane",
    width: numberParameter(recipe, "width"),
    depth: numberParameter(recipe, "depth"),
  };
};

const numberParameter = (recipe: IAutoMovieModelRecipe, key: string): number =>
  recipe.parameters[key] as number;

const stringParameter = (recipe: IAutoMovieModelRecipe, key: string): string =>
  recipe.parameters[key] as string;

const transform = (
  x: number,
  y: number,
  z: number,
  rotation = { x: 0, y: 0, z: 0, w: 1 },
): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation,
  scale: { x: 1, y: 1, z: 1 },
});

const horizontal = (x: number): IAutoMovieTransform =>
  rotateZ(x < 0 ? 90 : -90, x, 0, 0);

const rotateX = (
  degrees: number,
  x: number,
  y: number,
  z: number,
): IAutoMovieTransform =>
  transform(x, y, z, Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, degrees));

const rotateZ = (
  degrees: number,
  x: number,
  y: number,
  z: number,
): IAutoMovieTransform =>
  transform(x, y, z, Quaternion.fromAxisAngle({ x: 0, y: 0, z: 1 }, degrees));
