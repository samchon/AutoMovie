import {
  IAutoMovieInstanceSlot,
  IAutoMovieQuaternion,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { seededValue } from "../math/random";
import { IAutoMovieInstanceSetPlacement } from "./IAutoMovieInstanceSetPlacement";
import { selectInstancePrototype } from "./selectInstancePrototype";

/**
 * Regenerate one exact member of a compact instance set in constant memory.
 *
 * A grid, lattice, scatter or explicit member is laid out in the set's local
 * frame and turned by the set's heading about its anchor. A route member takes
 * its ground-plan point from the route snapshot, spaced by arc length and
 * pushed sideways by its seeded jitter, and stands at the anchor's height.
 * Scale, palette, traits, prototype, rotation and visibility are drawn from the
 * set seed and the slot, each under its own salt, and an explicit block
 * overrides what it states. A set that declares no prototype table, no lattice
 * or explicit layout, no per-axis scale, no rotation range and no visibility
 * probability keeps its original output, which names no prototype.
 *
 * The compiled instance-set kernel measures chunk bounds through this function,
 * the shot-source oracle answers `instanceSlot` through it, and a subject
 * description and the viewer regenerate members through it, so a member asked
 * for while a shot compiles, described in a review, or drawn is the member the
 * compiled set regenerates.
 * The input is the compiled shape for that reason: reading a compiled set as a
 * design once counted its default prototype twice.
 *
 * It throws for a slot outside the set, a missing or mismatched route snapshot,
 * a route without finite positive length, an explicit block missing the slot,
 * an explicit prototype no choice names, and a non-finite derived value or an
 * empty palette. A set the kernel compiled never throws, because compilation
 * regenerates every slot through here before it writes the record.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-determinism Regenerates the same member identity, transform, and variation for an instance slot however the set is enumerated or which consumer asks.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Serves as the one instance-member regenerator that the compiled runtime and every one-member oracle share.
 * @evidence requirements/asset-authoring/patterns-and-procedural-composition.md#asset-pattern-local-stability Derives node identity, prototype choice, and seeded scale, palette, rotation, visibility, and traits from the set's own seed and slot key, so a change elsewhere in the scene cannot reshuffle them.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-deterministic-instance-generation Determines a rule-generated instance's identity and variation from its stable slot key, set seed, and explicit exception block.
 */
export const instanceSlot = (
  instanceSet: IAutoMovieInstanceSetPlacement,
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
  const point = localInstancePoint(instanceSet, slot);
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
  const selected = selectInstancePrototype(
    instanceSet,
    slot,
    explicit?.prototype,
  );
  const base = {
    slot,
    node:
      explicit === undefined
        ? `instance:${instanceSet.id}:slot:${String(slot).padStart(6, "0")}`
        : `instance:${instanceSet.id}:${explicit.id}`,
    modelRecipe: selected.modelRecipe,
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
    prototype: selected.id,
    rotation,
    scale3,
    visible:
      explicit?.visible ??
      (instanceSet.variation.visibleProbability === undefined ||
        seededValue(instanceSet.seed, slot, 0x76697369) <
          instanceSet.variation.visibleProbability),
  };
};

/** Seeded XYZ Euler offset applied after the set heading, or identity. */
const seededInstanceRotation = (
  instanceSet: IAutoMovieInstanceSetPlacement,
  slot: number,
): IAutoMovieQuaternion => {
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
 * One member's point before the set heading is applied.
 *
 * Local layouts answer in the set frame. A route answers in the world ground
 * plan, because the route snapshot is already there, so its heading and anchor
 * translation are skipped by the caller.
 */
const localInstancePoint = (
  instanceSet: IAutoMovieInstanceSetPlacement,
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
  if (route === null || route.id !== layout.route || route.waypoints.length < 2)
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

/** Interpolate one seeded sample between an authored range's ends. */
const stableInterpolate = (from: number, to: number, ratio: number): number =>
  from * (1 - ratio) + to * ratio;
