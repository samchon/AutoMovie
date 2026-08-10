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
 */
export interface IAutoMovieAnalysisGap {
  /** Run this gap came from, or null when no run answered for the domain. */
  run: string | null;
  /** Domain the missing answer belongs to. */
  domain: AutoMovieAnalysisDomain;
  /** Metric key, or null when the whole run produced nothing. */
  metric: string | null;
  /** Which kind of nothing this is. */
  status: "unsupported" | "not-run";
  /** Non-blank statement of what is missing. */
  reason: string;
  /** Non-blank statement of the exact change that would fill it. */
  remedy: string;
}

/** One domain's tally, in the fixed domain order. */
export interface IAutoMovieAnalysisDomainRollup {
  /** Domain this row answers for. */
  domain: AutoMovieAnalysisDomain;
  /** Runs submitted for the domain. */
  runs: number;
  /** Runs that solved against the current revision. */
  solved: number;
  /** Runs the host cannot perform. */
  unsupported: number;
  /** Runs an adapter could have performed but did not. */
  notRun: number;
  /** Solved runs that read a superseded design revision. */
  stale: number;
  /** Metrics declared across the domain's current solved runs. */
  metrics: number;
  /** Of those, the ones that produced a value. */
  measured: number;
  /** Of the measured ones, those satisfying a declared target. */
  meets: number;
  /** Of the measured ones, those violating a declared target. */
  misses: number;
  /** Whether the production required this domain to be answered. */
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
 * @author Samchon
 */
export interface IAutoMovieAnalysisReport {
  /** Schema version. */
  version: 1;
  /** Versioned report protocol. */
  protocol: "automovie.analysis-report.v1";
  /**
   * Worst outcome: `misses` when any measured metric violates its declared
   * target, otherwise `incomplete` when anything is missing or stale, otherwise
   * `meets`.
   *
   * `meets` means exactly "every required domain answered against this
   * revision, every metric produced a value, and every declared target was
   * satisfied". It never means "nothing objected".
   */
  status: "meets" | "misses" | "incomplete";
  /** Design revision this report is a verdict about. */
  revision: string;
  /** One row per domain, in the fixed domain order. */
  domains: IAutoMovieAnalysisDomainRollup[];
  /** Missing answers, bounded and in run order. */
  gaps: IAutoMovieAnalysisGap[];
  /** Gaps the bound left out. */
  omittedGaps: number;
  /** Digest over protocol, status, revision, rollups and listed gaps. */
  digest: AutoMovieContentDigest;
}
