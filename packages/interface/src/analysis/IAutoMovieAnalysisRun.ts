import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";

/**
 * Every analysis domain a run may answer for.
 *
 * The list is closed because the report rolls up by domain and a rollup over an
 * open vocabulary silently loses whatever it has never heard of. Naming a
 * domain here is not a claim that it is solved: a domain with no adapter is
 * answered by an `unsupported` run, which is the point of the vocabulary.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `AutoMovieAnalysisDomain` as the portable data boundary for the diagnostics failed not run requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `AutoMovieAnalysisDomain` for the validation failed not run states system contract.
 */
export type AutoMovieAnalysisDomain =
  | "daylight"
  | "artificial-light"
  | "thermal"
  | "moisture"
  | "air"
  | "acoustic";

/**
 * Which way a declared target is satisfied.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `AutoMovieAnalysisComparison` as the portable data boundary for the diagnostics failed not run requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `AutoMovieAnalysisComparison` for the validation failed not run states system contract.
 */
export type AutoMovieAnalysisComparison = "at-least" | "at-most";

/**
 * One numeric target the production declares for one metric.
 *
 * The unit is declared beside the value on purpose. A target of `300` against a
 * metric measured in lux and a target of `300` against a metric measured in
 * candela are different requirements, and a contract that carried only the
 * number would let one silently clear the other.
 *
 * A target only ever narrows a verdict; it never widens one. One that cannot be
 * applied, because its unit disagrees with the metric or its key names nothing
 * the study reports, is dropped and said out loud as a run warning rather than
 * quietly satisfied. That is the difference between a rule that was checked and
 * a rule nobody could check, and only the first of them may leave a report
 * reading `meets`.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `IAutoMovieAnalysisTarget` as the portable data boundary for the diagnostics failed not run requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `IAutoMovieAnalysisTarget` for the validation failed not run states system contract.
 */
export interface IAutoMovieAnalysisTarget {
  /**
   * Metric key this target applies to.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `key` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `key` for the validation failed not run states system contract.
   */
  key: string;
  /**
   * Unit symbol the target is stated in, such as `lx`, `s`, `dB`.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `unit` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `unit` for the validation failed not run states system contract.
   */
  unit: string;
  /**
   * Finite target value in {@link unit}.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `value` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `value` for the validation failed not run states system contract.
   */
  value: number;
  /**
   * Whether the metric must reach the value or stay under it.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `comparison` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `comparison` for the validation failed not run states system contract.
   */
  comparison: AutoMovieAnalysisComparison;
}

/**
 * How one metric came out.
 *
 * `meets` and `misses` are the only two that mean a number was produced and
 * compared. `untargeted` means a number exists but nobody said what good is.
 * `unsupported` and `not-run` mean there is no number at all, and they carry
 * the reason instead.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `AutoMovieAnalysisMetricStatus` as the portable data boundary for the diagnostics failed not run requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `AutoMovieAnalysisMetricStatus` for the validation failed not run states system contract.
 */
export type AutoMovieAnalysisMetricStatus =
  | "meets"
  | "misses"
  | "untargeted"
  | "unsupported"
  | "not-run";

/**
 * Why a metric produced no value, and what would change that.
 *
 * The two fields mirror the render report's analysis gap deliberately: one
 * project should have one way of saying "this was not measured", and a second
 * spelling of the same idea is how two artifacts start disagreeing about what
 * an absent number means.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `IAutoMovieAnalysisMetricGap` as the portable data boundary for the diagnostics failed not run requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `IAutoMovieAnalysisMetricGap` for the validation failed not run states system contract.
 */
export interface IAutoMovieAnalysisMetricGap {
  /**
   * Non-blank statement of what is missing or unimplemented.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `reason` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `reason` for the validation failed not run states system contract.
   */
  reason: string;
  /**
   * Non-blank statement of the exact change that would produce a value.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `remedy` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `remedy` for the validation failed not run states system contract.
   */
  remedy: string;
}

/**
 * One measured quantity, or one honest hole where a measurement is not.
 *
 * {@link value} is `null` exactly when {@link gap} is present, and never zero as
 * a stand-in. Zero reverberation and unmeasured reverberation are different
 * facts, and only one of them is a room.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `IAutoMovieAnalysisMetric` as the portable data boundary for the diagnostics failed not run requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `IAutoMovieAnalysisMetric` for the validation failed not run states system contract.
 */
export interface IAutoMovieAnalysisMetric {
  /**
   * Open metric key such as `workplane.total.illuminance.mean`.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `key` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `key` for the validation failed not run states system contract.
   */
  key: string;
  /**
   * Unit symbol the value is stated in; non-blank even when there is no value.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `unit` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `unit` for the validation failed not run states system contract.
   */
  unit: string;
  /**
   * Finite measured value in {@link unit}, or `null` when none was produced.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `value` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `value` for the validation failed not run states system contract.
   */
  value: number | null;
  /**
   * Declared target in {@link unit}, or `null` when none applies.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `target` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `target` for the validation failed not run states system contract.
   */
  target: number | null;
  /**
   * Direction of {@link target}, or `null` when there is no target.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `comparison` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `comparison` for the validation failed not run states system contract.
   */
  comparison: AutoMovieAnalysisComparison | null;
  /**
   * Outcome for this metric.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `status` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `status` for the validation failed not run states system contract.
   */
  status: AutoMovieAnalysisMetricStatus;
  /**
   * Present exactly when {@link value} is `null`.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `gap` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `gap` for the validation failed not run states system contract.
   */
  gap: IAutoMovieAnalysisMetricGap | null;
}

/**
 * One value of one metric at one place, for a field overlay.
 *
 * A sample may only carry a key some metric of the same run actually measured.
 * A heatmap of a metric that produced no value would be a picture of a
 * computation nobody ran, which is the exact confusion this contract exists to
 * make impossible.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `IAutoMovieAnalysisSample` as the portable data boundary for the diagnostics failed not run requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `IAutoMovieAnalysisSample` for the validation failed not run states system contract.
 */
export interface IAutoMovieAnalysisSample {
  /**
   * Stable sample identity within the run.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `id` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `id` for the validation failed not run states system contract.
   */
  id: string;
  /**
   * Metric key this sample is a field of.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `key` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `key` for the validation failed not run states system contract.
   */
  key: string;
  /**
   * World position in metres.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `position` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `position` for the validation failed not run states system contract.
   */
  position: IAutoMovieVector3;
  /**
   * Finite value at {@link position}, in the metric's unit.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `value` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `value` for the validation failed not run states system contract.
   */
  value: number;
}

/**
 * Something the solver noticed that does not invalidate the result.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `IAutoMovieAnalysisWarning` as the portable data boundary for the diagnostics failed not run requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `IAutoMovieAnalysisWarning` for the validation failed not run states system contract.
 */
export interface IAutoMovieAnalysisWarning {
  /**
   * Stable warning code such as `target-unit-mismatch`.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `code` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `code` for the validation failed not run states system contract.
   */
  code: string;
  /**
   * Non-blank human-readable detail.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `detail` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `detail` for the validation failed not run states system contract.
   */
  detail: string;
  /**
   * Input the warning is about, or null when it is about the run.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `subject` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `subject` for the validation failed not run states system contract.
   */
  subject: string | null;
}

/**
 * Identity of the solver that produced, or refused, a result.
 *
 * {@link model} states the governing equation in one line. A result whose model
 * is unstated cannot be checked by the reader, and an unstated model is how a
 * placeholder survives review.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `IAutoMovieAnalysisSolver` as the portable data boundary for the diagnostics derived result finding requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `IAutoMovieAnalysisSolver` for the validation derived result finding system contract.
 */
export interface IAutoMovieAnalysisSolver {
  /**
   * Stable solver identity such as `automovie.daylight.isotropic-sky`.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `id` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `id` for the validation derived result finding system contract.
   */
  id: string;
  /**
   * Version that changes whenever the result for the same input changes.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `version` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `version` for the validation derived result finding system contract.
   */
  version: string;
  /**
   * One-line statement of the governing model and its stated exclusions.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `model` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `model` for the validation derived result finding system contract.
   */
  model: string;
}

/**
 * What one analysis run actually produced.
 *
 * Three arms, and only the first one may carry results. `unsupported` means the
 * host has no adapter for what was asked; `not-run` means an adapter exists but
 * its input was not supplied. Both carry a reason and a remedy and structurally
 * have nowhere to put a metric, a sample or a warning, so an absent analysis
 * cannot be dressed as a clean one by any amount of field-filling.
 *
 * This is the same three-arm shape the design-observation contract uses, with
 * `observed` renamed to `solved`: a thermal solver computes, it does not
 * observe, and the two negative arms deliberately keep their exact spelling so
 * one project has one vocabulary for "we did not look".
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `IAutoMovieAnalysisOutcome` as the portable data boundary for the diagnostics failed not run requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `IAutoMovieAnalysisOutcome` for the validation failed not run states system contract.
 */
export type IAutoMovieAnalysisOutcome =
  | {
      /** The solver ran and produced results. */
      status: "solved";
      /** At least one metric; each one measured or explicitly gapped. */
      metrics: IAutoMovieAnalysisMetric[];
      /** Spatial field, possibly empty; every key must name a measured metric. */
      samples: IAutoMovieAnalysisSample[];
      /** Non-fatal observations about the inputs. */
      warnings: IAutoMovieAnalysisWarning[];
    }
  | {
      /** This host cannot perform the analysis at all. */
      status: "unsupported";
      /** Non-blank statement of what is missing. */
      reason: string;
      /** Non-blank statement of what would make it possible. */
      remedy: string;
    }
  | {
      /** An adapter exists but was not executed. */
      status: "not-run";
      /** Non-blank statement of why it was skipped. */
      reason: string;
      /** Non-blank statement of the input that would let it run. */
      remedy: string;
    };

/**
 * One analysis run: what was asked, of which design revision, by which solver,
 * and what honestly came back.
 *
 * {@link inputRevision} is what makes a result perishable. A run that read
 * revision `r7` is evidence about `r7` and about nothing else, so a report
 * assembled at `r8` reports it as stale rather than counting it as an answer.
 * {@link digest} seals the whole record, so an artifact whose outcome was edited
 * after the fact fails validation instead of passing as a measurement.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `IAutoMovieAnalysisRun` as the portable data boundary for the diagnostics failed not run requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `IAutoMovieAnalysisRun` for the validation failed not run states system contract.
 * @author Samchon
 */
export interface IAutoMovieAnalysisRun {
  /**
   * Schema version.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `version` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `version` for the validation failed not run states system contract.
   */
  version: 1;
  /**
   * Versioned run protocol.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `protocol` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `protocol` for the validation failed not run states system contract.
   */
  protocol: "automovie.analysis-run.v1";
  /**
   * Stable run identity within the production.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `id` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `id` for the validation failed not run states system contract.
   */
  id: string;
  /**
   * Domain this run answers for.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `domain` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `domain` for the validation failed not run states system contract.
   */
  domain: AutoMovieAnalysisDomain;
  /**
   * Open subject label, usually the logical space or boundary analysed.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `subject` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `subject` for the validation failed not run states system contract.
   */
  subject: string;
  /**
   * Design revision the run read.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `inputRevision` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `inputRevision` for the validation failed not run states system contract.
   */
  inputRevision: string;
  /**
   * Solver identity.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `solver` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `solver` for the validation failed not run states system contract.
   */
  solver: IAutoMovieAnalysisSolver;
  /**
   * Digest of the canonical settings the run was configured with.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `settings` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `settings` for the validation failed not run states system contract.
   */
  settings: AutoMovieContentDigest;
  /**
   * Honest outcome.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `outcome` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `outcome` for the validation failed not run states system contract.
   */
  outcome: IAutoMovieAnalysisOutcome;
  /**
   * Digest over protocol, identity, solver, settings and outcome.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `digest` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `digest` for the validation failed not run states system contract.
   */
  digest: AutoMovieContentDigest;
}
