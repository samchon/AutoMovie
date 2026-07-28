import { Quaternion } from "@automovie/engine";
import {
  IAutoMovieFormationDesign,
  IAutoMovieFormationSlot,
  IAutoMovieModel,
  IAutoMovieModelPart,
  IAutoMovieModelRecipe,
  IAutoMovieShotContract,
  IAutoMovieShotSourceOutput,
  IAutoMovieTransform,
} from "@automovie/interface";

import { compareCodeUnits } from "./contentIdentity";

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
): IAutoMovieFormationSlot[] => {
  const local = localFormationPoints(formation);
  const radians = (formation.facingDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const heroes = new Map(
    formation.heroOverrides.map((hero) => [hero.slot, hero.actor]),
  );
  return local.map((point, slot) => {
    const actor = heroes.get(slot) ?? null;
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
    };
  });
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

/**
 * Add compiler-owned models and exact formation slots to source choreography.
 *
 * A source may animate the deterministic slot ids supplied in its build
 * context, but it cannot choose their count, base placement, model, or hero
 * id.
 */
export const materializeCompiledShot = (props: {
  contract: IAutoMovieShotContract;
  formations: ReadonlyMap<string, IAutoMovieFormationDesign>;
  formationSlots: Readonly<Record<string, readonly IAutoMovieFormationSlot[]>>;
  runtimeModels: ReadonlyMap<string, IAutoMovieModel>;
  source: IAutoMovieShotSourceOutput;
}): {
  value: IAutoMovieShotSourceOutput & { models: IAutoMovieModel[] };
  collisions: string[];
} => {
  const source = structuredClone(props.source);
  const nodes = new Map(source.scene.nodes.map((node) => [node.id, node]));
  const collisions: string[] = [];
  for (const participant of props.contract.participants) {
    if (participant.kind !== "formation") continue;
    const formation = props.formations.get(participant.id);
    const slots = props.formationSlots[participant.id];
    if (formation === undefined || slots === undefined) continue;
    const runtimeModel = props.runtimeModels.get(formation.modelRecipe);
    if (runtimeModel === undefined) continue;
    for (const slot of slots) {
      const expected = slotTransform(slot);
      const existing = nodes.get(slot.node);
      if (existing !== undefined) {
        if (slot.actor === null) {
          collisions.push(slot.node);
          continue;
        }
        existing.model = runtimeModel.id;
        existing.transform = expected;
        continue;
      }
      const node = {
        id: slot.node,
        model: runtimeModel.id,
        transform: expected,
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
  const models = [...new Set(source.scene.nodes.map((node) => node.model))]
    .sort(compareCodeUnits)
    .flatMap((id) => {
      const model = modelByRuntimeId.get(id);
      return model === undefined ? [] : [model];
    });
  return { value: { ...source, models }, collisions };
};

const slotTransform = (slot: IAutoMovieFormationSlot): IAutoMovieTransform => ({
  translation: slot.position,
  rotation: Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, slot.facingDeg),
  scale: { x: 1, y: 1, z: 1 },
});

const localFormationPoints = (
  formation: IAutoMovieFormationDesign,
): Array<{ x: number; z: number }> => {
  const layout = formation.layout;
  if (layout.kind === "line" || layout.kind === "column") {
    const points: Array<{ x: number; z: number }> = [];
    for (let slot = 0; slot < formation.count; ++slot) {
      const rank =
        layout.kind === "line"
          ? Math.floor(slot / layout.files)
          : slot % layout.ranks;
      const file =
        layout.kind === "line"
          ? slot % layout.files
          : Math.floor(slot / layout.ranks);
      points.push({
        x: (file - (layout.files - 1) / 2) * formation.spacing.lateral,
        z: rank * formation.spacing.depth,
      });
    }
    return points;
  }
  if (layout.kind === "wedge") {
    const points: Array<{ x: number; z: number }> = [];
    for (let row = 0; points.length < formation.count; ++row)
      for (
        let column = -row;
        column <= row && points.length < formation.count;
        ++column
      )
        points.push({
          x: column * formation.spacing.lateral,
          z: row * formation.spacing.depth,
        });
    return points;
  }
  if (layout.kind === "arc")
    return Array.from({ length: formation.count }, (_, slot) => {
      const ratio = formation.count === 1 ? 0.5 : slot / (formation.count - 1);
      const degrees = (ratio - 0.5) * layout.arcDegrees;
      const radians = (degrees * Math.PI) / 180;
      return {
        x: Math.sin(radians) * layout.radius,
        z: Math.cos(radians) * layout.radius,
      };
    });
  const random = seededRandom(formation.seed, layout.seed);
  return Array.from({ length: formation.count }, () => {
    const radius = Math.sqrt(random()) * layout.radius;
    const angle = random() * Math.PI * 2;
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
    };
  });
};

const seededRandom = (
  formationSeed: number,
  layoutSeed: number,
): (() => number) => {
  let state =
    (Math.trunc(formationSeed) ^ Math.trunc(layoutSeed) ^ 0x9e3779b9) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
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
