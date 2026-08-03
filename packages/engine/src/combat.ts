import {
  IAutoMovieFirearm,
  IAutoMovieModel,
  IAutoMovieProfile,
  IAutoMovieProfileTrait,
  IAutoMovieShooterTrait,
} from "@automovie/interface";

import { seededValue } from "./math/random";

/** One member's inputs to a deterministic firearm volley. */
export interface IAutoMovieFirearmVolleyMember {
  /** Stable agent-facing shooter identity. */
  id: string;
  /** Shooter-to-target distance in meters. */
  distance: number;
  /** Explicit battle modifier multiplied onto bench accuracy. */
  accuracyMultiplier?: number;
  /** Seconds elapsed since this shooter last fired. */
  elapsedSinceLastShot?: number;
}

/** Inputs to a deterministic profile-gated firearm volley. */
export interface IAutoMovieFirearmVolleyInput {
  /** Runtime model whose profile data proves the capability. */
  model: Pick<IAutoMovieModel, "id" | "profiles">;
  /** Exact bound profile id. */
  profile: string;
  /** Exact firearm id inside the profile's shooter trait. */
  weapon: string;
  /** Full non-negative safe-integer volley seed. */
  seed: number;
  /** Ordered shooters; 500 members produce exactly 500 result events. */
  shooters: IAutoMovieFirearmVolleyMember[];
}

/** One inspectable result event returned to agent-owned behavior code. */
export interface IAutoMovieFirearmEvent {
  /** Event discriminator. */
  kind: "firearm-shot";
  /** Stable shooter identity copied from input. */
  shooter: string;
  /** Exact typed weapon id. */
  weapon: string;
  /** Zero-based input slot used for deterministic stream separation. */
  slot: number;
  /** Evaluated range in meters. */
  distance: number;
  /** Interpolated and battle-modified hit probability. */
  accuracyProbability: number;
  /** Independent deterministic misfire draw, or null while reloading. */
  misfireSample: number | null;
  /** Deterministic accuracy draw, only present when a projectile left. */
  accuracySample: number | null;
  /** Machine-readable outcome for agent-owned reactions. */
  outcome: "reloading" | "misfire" | "hit" | "miss";
  /** Remaining reload time after this attempted volley. */
  reloadRemainingSeconds: number;
  /** Typed projectile velocity available to downstream ballistics. */
  muzzleVelocity: number;
}

/** Find one typed trait without consulting model names or free-form labels. */
export const findProfileTrait = <Kind extends IAutoMovieProfileTrait["kind"]>(
  profile: IAutoMovieProfile,
  kind: Kind,
): Extract<IAutoMovieProfileTrait, { kind: Kind }> | null =>
  ((profile.traits ?? []).find((trait) => trait.kind === kind) as
    | Extract<IAutoMovieProfileTrait, { kind: Kind }>
    | undefined) ?? null;

/**
 * Resolve an ordered firearm volley as pure, reproducible event data.
 *
 * Misfire is sampled before accuracy, matching the state separation documented
 * in `docs/research/napoleonic-line-battle.md#musket-misfire-and-ammunition`.
 * Replaying the same input yields byte-equivalent events; wall time, worker
 * order, and GPU randomness never participate.
 */
export const resolveFirearmVolley = (
  input: IAutoMovieFirearmVolleyInput,
): IAutoMovieFirearmEvent[] => {
  assertSafeSeed(input.seed);
  const profile = input.model.profiles?.find(
    (candidate) => candidate.id === input.profile,
  );
  if (profile === undefined)
    throw new Error(
      `Model "${input.model.id}" cannot perform "shoot": profile "${input.profile}" is not bound.`,
    );
  const shooter = findProfileTrait(profile, "shooter");
  if (shooter === null)
    throw new Error(
      `Model "${input.model.id}" cannot perform "shoot": profile "${profile.id}" has no Shooter trait.`,
    );
  const weapon = firearm(shooter, input.weapon, input.model.id, profile.id);
  assertFirearm(weapon, input.model.id, profile.id);
  const ids = new Set<string>();
  return input.shooters.map((member, slot) => {
    if (member.id.trim().length === 0 || ids.has(member.id))
      throw new Error(
        `Firearm volley shooter id "${member.id}" must be non-blank and unique.`,
      );
    ids.add(member.id);
    if (Number.isFinite(member.distance) === false || member.distance < 0)
      throw new Error(
        `Firearm volley distance for "${member.id}" must be finite and non-negative.`,
      );
    const multiplier = member.accuracyMultiplier ?? 1;
    if (Number.isFinite(multiplier) === false || multiplier < 0)
      throw new Error(
        `Firearm volley accuracyMultiplier for "${member.id}" must be finite and non-negative.`,
      );
    const elapsed = member.elapsedSinceLastShot;
    if (
      elapsed !== undefined &&
      (Number.isFinite(elapsed) === false || elapsed < 0)
    )
      throw new Error(
        `Firearm volley elapsedSinceLastShot for "${member.id}" must be finite and non-negative when supplied.`,
      );
    const accuracyProbability =
      member.distance > weapon.effectiveRange
        ? 0
        : clamp01(interpolateAccuracy(weapon, member.distance) * multiplier);
    const reloadRemainingSeconds = Math.max(
      0,
      weapon.reloadSeconds - (elapsed ?? Number.POSITIVE_INFINITY),
    );
    if (reloadRemainingSeconds > 0)
      return {
        kind: "firearm-shot",
        shooter: member.id,
        weapon: weapon.id,
        slot,
        distance: member.distance,
        accuracyProbability,
        misfireSample: null,
        accuracySample: null,
        outcome: "reloading",
        reloadRemainingSeconds,
        muzzleVelocity: weapon.muzzleVelocity,
      };
    const misfireSample = seededValue(
      input.seed,
      slot,
      0x6d697366, // "misf"
    );
    if (misfireSample < weapon.misfireProbability)
      return {
        kind: "firearm-shot",
        shooter: member.id,
        weapon: weapon.id,
        slot,
        distance: member.distance,
        accuracyProbability,
        misfireSample,
        accuracySample: null,
        outcome: "misfire",
        reloadRemainingSeconds: 0,
        muzzleVelocity: weapon.muzzleVelocity,
      };
    const accuracySample = seededValue(
      input.seed,
      slot,
      0x61636375, // "accu"
    );
    return {
      kind: "firearm-shot",
      shooter: member.id,
      weapon: weapon.id,
      slot,
      distance: member.distance,
      accuracyProbability,
      misfireSample,
      accuracySample,
      outcome: accuracySample < accuracyProbability ? "hit" : "miss",
      reloadRemainingSeconds: 0,
      muzzleVelocity: weapon.muzzleVelocity,
    };
  });
};

const firearm = (
  shooter: IAutoMovieShooterTrait,
  id: string,
  model: string,
  profile: string,
): IAutoMovieFirearm => {
  const weapon = shooter.weapons.find((candidate) => candidate.id === id);
  if (weapon === undefined)
    throw new Error(
      `Model "${model}" cannot perform "shoot" with "${id}": profile "${profile}" does not declare that weapon.`,
    );
  if (weapon.kind !== "firearm")
    throw new Error(
      `Model "${model}" cannot perform firearm "shoot" with "${id}": its typed weapon kind is "${weapon.kind}".`,
    );
  return weapon;
};

const assertFirearm = (
  weapon: IAutoMovieFirearm,
  model: string,
  profile: string,
): void => {
  const invalidPositive = (
    [
      ["reloadSeconds", weapon.reloadSeconds],
      ["effectiveRange", weapon.effectiveRange],
      ["muzzleVelocity", weapon.muzzleVelocity],
    ] satisfies Array<[string, number]>
  ).find(([, value]) => Number.isFinite(value) === false || value <= 0);
  if (invalidPositive !== undefined)
    throw new Error(
      `Model "${model}" profile "${profile}" firearm "${weapon.id}" ${invalidPositive[0]} must be finite and positive.`,
    );
  if (
    Number.isFinite(weapon.misfireProbability) === false ||
    weapon.misfireProbability < 0 ||
    weapon.misfireProbability > 1
  )
    throw new Error(
      `Model "${model}" profile "${profile}" firearm "${weapon.id}" misfireProbability must be between zero and one.`,
    );
  if (weapon.accuracy.length === 0)
    throw new Error(
      `Model "${model}" profile "${profile}" firearm "${weapon.id}" requires at least one accuracy point.`,
    );
  let prior = -1;
  for (const point of weapon.accuracy) {
    if (
      Number.isFinite(point.distance) === false ||
      point.distance < 0 ||
      point.distance <= prior ||
      Number.isFinite(point.probability) === false ||
      point.probability < 0 ||
      point.probability > 1
    )
      throw new Error(
        `Model "${model}" profile "${profile}" firearm "${weapon.id}" accuracy points require strictly increasing non-negative distance and probability between zero and one.`,
      );
    prior = point.distance;
  }
};

const interpolateAccuracy = (
  weapon: IAutoMovieFirearm,
  distance: number,
): number => {
  const points = weapon.accuracy;
  if (distance <= points[0]!.distance) return points[0]!.probability;
  for (let index = 1; index < points.length; ++index) {
    const right = points[index]!;
    if (distance > right.distance) continue;
    const left = points[index - 1]!;
    const ratio = (distance - left.distance) / (right.distance - left.distance);
    return left.probability * (1 - ratio) + right.probability * ratio;
  }
  return points.at(-1)!.probability;
};

const assertSafeSeed = (seed: number): void => {
  if (Number.isSafeInteger(seed) === false || seed < 0)
    throw new Error("Firearm volley seed must be a non-negative safe integer.");
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
