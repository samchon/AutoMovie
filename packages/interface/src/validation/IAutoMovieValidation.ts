import { IAutoMovieConstraintViolation } from "./IAutoMovieConstraintViolation";

/**
 * The result of running a automovie artifact through the deterministic
 * validator tiers: success, or the full list of violations to feed back.
 *
 * Discriminated on `success` so the consumer either proceeds with the validated
 * artifact or hands `violations` to the harness for a correction round. Success
 * means no `"error"`-severity violation: a run that produced only `"warning"`s
 * (physical-plausibility advice) still succeeds, carrying them in `warnings`
 * for the harness to surface without blocking. The shape mirrors typia's
 * `IValidation` so the two compose: typia handles Tier 1 (type/range)
 * structurally, and the engine appends Tier 2+ (ROM, physics, temporal) domain
 * violations into the same envelope.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-correction-and-recheck Exposes `IAutoMovieValidation` as the portable data boundary for the diagnostics correction and recheck requirement.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-correction-revalidation Types `IAutoMovieValidation` for the validation diagnostic correction revalidation system contract.
 * @author Samchon
 */
export type IAutoMovieValidation =
  | IAutoMovieValidation.ISuccess
  | IAutoMovieValidation.IFailure;

export namespace IAutoMovieValidation {
  /**
   * No `"error"`-severity violation.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-severity-and-outcome Exposes `ISuccess` as the portable data boundary for the diagnostics severity and outcome requirement.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-severity-outcome Types `ISuccess` for the validation diagnostic severity outcome system contract.
   */
  export interface ISuccess {
    /**
     * Discriminator.
     *
     * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-severity-and-outcome Exposes `success` as the portable data boundary for the diagnostics severity and outcome requirement.
     * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-severity-outcome Types `success` for the validation diagnostic severity outcome system contract.
     */
    success: true;

    /**
     * `"warning"`-severity violations that did not block success: physical
     * implausibilities the author may accept or correct. Present only when the
     * run produced warnings; absent when everything was clean.
     *
     * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-severity-and-outcome Exposes `warnings` as the portable data boundary for the diagnostics severity and outcome requirement.
     * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-severity-outcome Types `warnings` for the validation diagnostic severity outcome system contract.
     */
    warnings?: IAutoMovieConstraintViolation[];
  }

  /**
   * One or more constraints were violated.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-finding Exposes `IFailure` as the portable data boundary for the diagnostics input finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-input-finding Types `IFailure` for the validation input finding system contract.
   */
  export interface IFailure {
    /**
     * Discriminator.
     *
     * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-finding Exposes `success` as the portable data boundary for the diagnostics input finding requirement.
     * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-input-finding Types `success` for the validation input finding system contract.
     */
    success: false;

    /**
     * Every violation found, across all tiers that ran. Non-empty.
     *
     * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-finding Exposes `violations` as the portable data boundary for the diagnostics input finding requirement.
     * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-input-finding Types `violations` for the validation input finding system contract.
     */
    violations: IAutoMovieConstraintViolation[];
  }
}
