/**
 * One observed point in a firearm's bench-accuracy curve.
 *
 * The values are probabilities for the declared target geometry, not an
 * intrinsic probability of hitting one person. Shot code supplies battle
 * modifiers separately.
 */
export interface IAutoMovieFirearmAccuracyPoint {
  /** Non-negative range in meters. */
  distance: number;
  /** Bench hit probability from zero through one. */
  probability: number;
}

/**
 * Typed firearm data consumed by the deterministic combat resolver.
 *
 * Historical defaults and their provenance live under
 * `docs/research/napoleonic-line-battle.md#musket-rate-of-fire`,
 * `#musket-accuracy-by-range`, and `#musket-misfire-and-ammunition`.
 */
export interface IAutoMovieFirearm {
  /** Weapon discriminator. */
  kind: "firearm";
  /** Stable weapon id within its shooter trait. */
  id: string;
  /** Complete reload cycle in seconds. */
  reloadSeconds: number;
  /** Range beyond which the weapon is not accepted for a shot. */
  effectiveRange: number;
  /** Increasing distance samples used by piecewise-linear interpolation. */
  accuracy: IAutoMovieFirearmAccuracyPoint[];
  /** Independent probability that no projectile leaves the weapon. */
  misfireProbability: number;
  /** Projectile speed at the muzzle in meters per second. */
  muzzleVelocity: number;
}

/** A round-shot payload whose post-impact travel is explicitly bounded. */
export interface IAutoMovieRoundShot {
  /** Ammunition discriminator. */
  kind: "round-shot";
  /** Projectile mass in kilograms. */
  mass: number;
  /** Maximum deterministic ground rebounds. */
  maxRicochets: number;
  /** Velocity retained after each rebound, from zero through one. */
  ricochetRetention: number;
}

/** A canister payload expanded into seeded pellets. */
export interface IAutoMovieCanisterShot {
  /** Ammunition discriminator. */
  kind: "canister";
  /** Positive number of pellets. */
  pellets: number;
  /** Full angular spread in degrees. */
  spreadDegrees: number;
  /** Mass of one pellet in kilograms. */
  pelletMass: number;
}

/** Typed smooth-bore cannon data. */
export interface IAutoMovieCannon {
  /** Weapon discriminator. */
  kind: "cannon";
  /** Stable weapon id within its shooter trait. */
  id: string;
  /** Complete reload cycle in seconds. */
  reloadSeconds: number;
  /** Range beyond which the selected ammunition is refused. */
  effectiveRange: number;
  /** Projectile speed at the muzzle in meters per second. */
  muzzleVelocity: number;
  /** Supported historically distinct payloads. */
  ammunition: Array<IAutoMovieRoundShot | IAutoMovieCanisterShot>;
}

/** Typed close-combat data. */
export interface IAutoMovieMeleeWeapon {
  /** Weapon discriminator. */
  kind: "melee";
  /** Stable weapon id within its wielder trait. */
  id: string;
  /** Maximum contact distance in meters. */
  reach: number;
  /** Minimum seconds between committed strikes. */
  recoverySeconds: number;
  /** Scalar impact energy multiplier. */
  impact: number;
}

/** A material response owned by a deterministic collision/measurement proxy. */
export interface IAutoMovieImpactBody {
  /** Body mass in kilograms. */
  mass: number;
  /** Normal rebound ratio from zero through one. */
  restitution: number;
  /** Relative surface hardness, strictly above zero. */
  hardness: number;
  /** Relative penetration resistance, strictly above zero. */
  penetrability: number;
}

/** Profile trait proving that its body can operate typed weapons. */
export interface IAutoMovieShooterTrait {
  /** Trait discriminator. */
  kind: "shooter";
  /** Non-empty typed weapon inventory. */
  weapons: Array<IAutoMovieFirearm | IAutoMovieCannon | IAutoMovieMeleeWeapon>;
}

/** Profile trait proving that other bodies can mount this one. */
export interface IAutoMovieMountableTrait {
  /** Trait discriminator. */
  kind: "mountable";
  /** Positive simultaneous rider capacity. */
  seats: number;
  /** Maximum supported payload in kilograms. */
  payloadMass: number;
}

/** Profile trait proving that deterministic impacts can damage this body. */
export interface IAutoMovieDestructibleTrait {
  /** Trait discriminator. */
  kind: "destructible";
  /** Positive structural durability. */
  durability: number;
  /** Collision and material response owned by the declared proxy. */
  impactBody: IAutoMovieImpactBody;
}

/** Declarative profile capabilities; every variant is data, never code. */
export type IAutoMovieProfileTrait =
  | IAutoMovieShooterTrait
  | IAutoMovieMountableTrait
  | IAutoMovieDestructibleTrait;
