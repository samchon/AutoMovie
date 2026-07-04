import { IAutoMovieConstraintViolation } from "./IAutoMovieConstraintViolation";

/**
 * The result of running a automovie artifact through the deterministic
 * validator tiers — success, or the full list of violations to feed back.
 *
 * Discriminated on `success` so the consumer either proceeds with the validated
 * artifact or hands `violations` to the harness for a correction round. The
 * shape mirrors typia's `IValidation` so the two compose: typia handles Tier 1
 * (type/range) structurally, and the engine appends Tier 2+ (ROM, physics,
 * temporal) domain violations into the same envelope.
 *
 * @author Samchon
 */
export type IAutoMovieValidation =
  | IAutoMovieValidation.ISuccess
  | IAutoMovieValidation.IFailure;

export namespace IAutoMovieValidation {
  /** All tiers passed. */
  export interface ISuccess {
    /** Discriminator. */
    success: true;
  }

  /** One or more constraints were violated. */
  export interface IFailure {
    /** Discriminator. */
    success: false;

    /** Every violation found, across all tiers that ran. Non-empty. */
    violations: IAutoMovieConstraintViolation[];
  }
}
