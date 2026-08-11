import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";
import { AutoMovieAnalysisDomain } from "./IAutoMovieAnalysisRun";

/**
 * One place a required answer is missing, at whatever granularity it is missing
 * at.
 *
 * A whole run may be unsupported, one metric inside a solved run may be, or a
 * required domain may have no run at all. All three are the same fact to a
 * reader deciding whether the design has been checked, so they are one row
 * shape rather than three lists nobody cross-reads.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `IAutoMovieAnalysisGap` as the portable data boundary for the diagnostics failed not run requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `IAutoMovieAnalysisGap` for the validation failed not run states system contract.
 */
export interface IAutoMovieAnalysisGap {
  /**
   * Run this gap came from, or null when no run answered for the domain.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `run` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `run` for the validation failed not run states system contract.
   */
  run: string | null;
  /**
   * Domain the missing answer belongs to.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `domain` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `domain` for the validation failed not run states system contract.
   */
  domain: AutoMovieAnalysisDomain;
  /**
   * Metric key, or null when the whole run produced nothing.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `metric` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `metric` for the validation failed not run states system contract.
   */
  metric: string | null;
  /**
   * Which kind of nothing this is.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `status` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `status` for the validation failed not run states system contract.
   */
  status: "unsupported" | "not-run";
  /**
   * Non-blank statement of what is missing.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `reason` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `reason` for the validation failed not run states system contract.
   */
  reason: string;
  /**
   * Non-blank statement of the exact change that would fill it.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run Exposes `remedy` as the portable data boundary for the diagnostics failed not run requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states Types `remedy` for the validation failed not run states system contract.
   */
  remedy: string;
}

/**
 * One domain's tally, in the fixed domain order.
 *
 * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order Exposes `IAutoMovieAnalysisDomainRollup` as the portable data boundary for the diagnostics stable order requirement.
 * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order Types `IAutoMovieAnalysisDomainRollup` for the validation canonical diagnostic order system contract.
 */
export interface IAutoMovieAnalysisDomainRollup {
  /**
   * Domain this row answers for.
   *
   * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order Exposes `domain` as the portable data boundary for the diagnostics stable order requirement.
   * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order Types `domain` for the validation canonical diagnostic order system contract.
   */
  domain: AutoMovieAnalysisDomain;
  /**
   * Runs submitted for the domain.
   *
   * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order Exposes `runs` as the portable data boundary for the diagnostics stable order requirement.
   * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order Types `runs` for the validation canonical diagnostic order system contract.
   */
  runs: number;
  /**
   * Runs that solved against the current revision.
   *
   * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order Exposes `solved` as the portable data boundary for the diagnostics stable order requirement.
   * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order Types `solved` for the validation canonical diagnostic order system contract.
   */
  solved: number;
  /**
   * Runs the host cannot perform.
   *
   * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order Exposes `unsupported` as the portable data boundary for the diagnostics stable order requirement.
   * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order Types `unsupported` for the validation canonical diagnostic order system contract.
   */
  unsupported: number;
  /**
   * Runs an adapter could have performed but did not.
   *
   * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order Exposes `notRun` as the portable data boundary for the diagnostics stable order requirement.
   * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order Types `notRun` for the validation canonical diagnostic order system contract.
   */
  notRun: number;
  /**
   * Solved runs that read a superseded design revision.
   *
   * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order Exposes `stale` as the portable data boundary for the diagnostics stable order requirement.
   * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order Types `stale` for the validation canonical diagnostic order system contract.
   */
  stale: number;
  /**
   * Metrics declared across the domain's current solved runs.
   *
   * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order Exposes `metrics` as the portable data boundary for the diagnostics stable order requirement.
   * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order Types `metrics` for the validation canonical diagnostic order system contract.
   */
  metrics: number;
  /**
   * Of those, the ones that produced a value.
   *
   * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order Exposes `measured` as the portable data boundary for the diagnostics stable order requirement.
   * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order Types `measured` for the validation canonical diagnostic order system contract.
   */
  measured: number;
  /**
   * Of the measured ones, those satisfying a declared target.
   *
   * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order Exposes `meets` as the portable data boundary for the diagnostics stable order requirement.
   * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order Types `meets` for the validation canonical diagnostic order system contract.
   */
  meets: number;
  /**
   * Of the measured ones, those violating a declared target.
   *
   * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order Exposes `misses` as the portable data boundary for the diagnostics stable order requirement.
   * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order Types `misses` for the validation canonical diagnostic order system contract.
   */
  misses: number;
  /**
   * Whether the production required this domain to be answered.
   *
   * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order Exposes `required` as the portable data boundary for the diagnostics stable order requirement.
   * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order Types `required` for the validation canonical diagnostic order system contract.
   */
  required: boolean;
}

/**
 * A bounded verdict over every analysis run of one design revision.
 *
 * The report is O(1) in the size of the production: one row per domain and at
 * most {@link AUTOMOVIE_ANALYSIS_REPORT_MAX_GAPS} gaps, with the remainder
 * counted rather than dropped. Bounding it without saying so would be a lie, so
 * {@link omittedGaps} is always stated.
 *
 * {@link status} can never be cleared by silence. A required domain nobody
 * answered, a run that read a superseded revision, and a metric no adapter
 * could produce all land in {@link gaps} and force `incomplete`, and a report
 * must declare at least one required domain to exist at all.
 *
 * @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-required-severity Exposes `IAutoMovieAnalysisReport` as the portable data boundary for the acceptance required severity requirement.
 * @evidence specifications/review-and-acceptance/profiles-aggregation-and-partial-results.md#acceptance-system-required-severity Types `IAutoMovieAnalysisReport` for the acceptance system required severity system contract.
 * @author Samchon
 */
export interface IAutoMovieAnalysisReport {
  /**
   * Schema version.
   *
   * @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-required-severity Exposes `version` as the portable data boundary for the acceptance required severity requirement.
   * @evidence specifications/review-and-acceptance/profiles-aggregation-and-partial-results.md#acceptance-system-required-severity Types `version` for the acceptance system required severity system contract.
   */
  version: 1;
  /**
   * Versioned report protocol.
   *
   * @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-required-severity Exposes `protocol` as the portable data boundary for the acceptance required severity requirement.
   * @evidence specifications/review-and-acceptance/profiles-aggregation-and-partial-results.md#acceptance-system-required-severity Types `protocol` for the acceptance system required severity system contract.
   */
  protocol: "automovie.analysis-report.v1";
  /**
   * Worst outcome: `misses` when any measured metric violates its declared
   * target, otherwise `incomplete` when anything is missing or stale, otherwise
   * `meets`.
   *
   * `meets` means exactly "every required domain answered against this
   * revision, every metric produced a value, and every declared target was
   * satisfied". It never means "nothing objected".
   *
   * @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-required-severity Exposes `status` as the portable data boundary for the acceptance required severity requirement.
   * @evidence specifications/review-and-acceptance/profiles-aggregation-and-partial-results.md#acceptance-system-required-severity Types `status` for the acceptance system required severity system contract.
   */
  status: "meets" | "misses" | "incomplete";
  /**
   * Design revision this report is a verdict about.
   *
   * @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-required-severity Exposes `revision` as the portable data boundary for the acceptance required severity requirement.
   * @evidence specifications/review-and-acceptance/profiles-aggregation-and-partial-results.md#acceptance-system-required-severity Types `revision` for the acceptance system required severity system contract.
   */
  revision: string;
  /**
   * One row per domain, in the fixed domain order.
   *
   * @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-required-severity Exposes `domains` as the portable data boundary for the acceptance required severity requirement.
   * @evidence specifications/review-and-acceptance/profiles-aggregation-and-partial-results.md#acceptance-system-required-severity Types `domains` for the acceptance system required severity system contract.
   */
  domains: IAutoMovieAnalysisDomainRollup[];
  /**
   * Missing answers, bounded and in run order.
   *
   * @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-required-severity Exposes `gaps` as the portable data boundary for the acceptance required severity requirement.
   * @evidence specifications/review-and-acceptance/profiles-aggregation-and-partial-results.md#acceptance-system-required-severity Types `gaps` for the acceptance system required severity system contract.
   */
  gaps: IAutoMovieAnalysisGap[];
  /**
   * Gaps the bound left out.
   *
   * @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-required-severity Exposes `omittedGaps` as the portable data boundary for the acceptance required severity requirement.
   * @evidence specifications/review-and-acceptance/profiles-aggregation-and-partial-results.md#acceptance-system-required-severity Types `omittedGaps` for the acceptance system required severity system contract.
   */
  omittedGaps: number;
  /**
   * Digest over protocol, status, revision, rollups and listed gaps.
   *
   * @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-required-severity Exposes `digest` as the portable data boundary for the acceptance required severity requirement.
   * @evidence specifications/review-and-acceptance/profiles-aggregation-and-partial-results.md#acceptance-system-required-severity Types `digest` for the acceptance system required severity system contract.
   */
  digest: AutoMovieContentDigest;
}
