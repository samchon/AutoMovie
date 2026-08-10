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
  | IAutoMovieMountableTrait
  | IAutoMovieDestructibleTrait;
