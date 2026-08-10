import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";

/**
 * Every analysis domain a run may answer for.
 *
 * The list is closed because the report rolls up by domain and a rollup over an
 * open vocabulary silently loses whatever it has never heard of. Naming a
 * domain here is not a claim that it is solved: a domain with no adapter is
 * answered by an `unsupported` run, which is the point of the vocabulary.
 */
export type AutoMovieAnalysisDomain =
  | "daylight"
  | "artificial-light"
  | "thermal"
  | "moisture"
  | "air"
  | "acoustic";

/** Which way a declared target is satisfied. */
export type AutoMovieAnalysisComparison = "at-least" | "at-most";

/**
 * One numeric target the production declares for one metric.
 *
 * The unit is declared beside the value on purpose. A target of `300` against a
 * metric measured in lux and a target of `300` against a metric measured in
 * candela are different requirements, and a contract that carried only the
 * number would let one silently clear the other.
 */
export interface IAutoMovieAnalysisTarget {
  /** Metric key this target applies to. */
  key: string;
  /** Unit symbol the target is stated in, such as `lx`, `s`, `dB`. */
  unit: string;
  /** Finite target value in {@link unit}. */
  value: number;
  /** Whether the metric must reach the value or stay under it. */
  comparison: AutoMovieAnalysisComparison;
}

/**
 * How one metric came out.
 *
 * `meets` and `misses` are the only two that mean a number was produced and
 * compared. `untargeted` means a number exists but nobody said what good is.
 * `unsupported` and `not-run` mean there is no number at all, and they carry
 * the reason instead.
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
 */
export interface IAutoMovieAnalysisMetricGap {
  /** Non-blank statement of what is missing or unimplemented. */
  reason: string;
  /** Non-blank statement of the exact change that would produce a value. */
  remedy: string;
}

/**
 * One measured quantity, or one honest hole where a measurement is not.
 *
 * {@link value} is `null` exactly when {@link gap} is present, and never zero as
 * a stand-in. Zero reverberation and unmeasured reverberation are different
 * facts, and only one of them is a room.
 */
export interface IAutoMovieAnalysisMetric {
  /** Open metric key such as `workplane.total.illuminance.mean`. */
  key: string;
  /** Unit symbol the value is stated in; non-blank even when there is no value. */
  unit: string;
  /** Finite measured value in {@link unit}, or `null` when none was produced. */
  value: number | null;
  /** Declared target in {@link unit}, or `null` when none applies. */
  target: number | null;
  /** Direction of {@link target}, or `null` when there is no target. */
  comparison: AutoMovieAnalysisComparison | null;
  /** Outcome for this metric. */
  status: AutoMovieAnalysisMetricStatus;
  /** Present exactly when {@link value} is `null`. */
  gap: IAutoMovieAnalysisMetricGap | null;
}

/**
 * One value of one metric at one place, for a field overlay.
 *
 * A sample may only carry a key some metric of the same run actually measured.
 * A heatmap of a metric that produced no value would be a picture of a
 * computation nobody ran, which is the exact confusion this contract exists to
 * make impossible.
 */
export interface IAutoMovieAnalysisSample {
  /** Stable sample identity within the run. */
  id: string;
  /** Metric key this sample is a field of. */
  key: string;
  /** World position in metres. */
  position: IAutoMovieVector3;
  /** Finite value at {@link position}, in the metric's unit. */
  value: number;
}

/** Something the solver noticed that does not invalidate the result. */
export interface IAutoMovieAnalysisWarning {
  /** Stable warning code such as `target-unit-mismatch`. */
  code: string;
  /** Non-blank human-readable detail. */
  detail: string;
  /** Input the warning is about, or null when it is about the run. */
  subject: string | null;
}

/**
 * Identity of the solver that produced, or refused, a result.
 *
 * {@link model} states the governing equation in one line. A result whose model
 * is unstated cannot be checked by the reader, and an unstated model is how a
 * placeholder survives review.
 */
export interface IAutoMovieAnalysisSolver {
  /** Stable solver identity such as `automovie.daylight.isotropic-sky`. */
  id: string;
  /** Version that changes whenever the result for the same input changes. */
  version: string;
  /** One-line statement of the governing model and its stated exclusions. */
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
 * @author Samchon
 */
export interface IAutoMovieAnalysisRun {
  /** Schema version. */
  version: 1;
  /** Versioned run protocol. */
  protocol: "automovie.analysis-run.v1";
  /** Stable run identity within the production. */
  id: string;
  /** Domain this run answers for. */
  domain: AutoMovieAnalysisDomain;
  /** Open subject label, usually the logical space or boundary analysed. */
  subject: string;
  /** Design revision the run read. */
  inputRevision: string;
  /** Solver identity. */
  solver: IAutoMovieAnalysisSolver;
  /** Digest of the canonical settings the run was configured with. */
  settings: AutoMovieContentDigest;
  /** Honest outcome. */
  outcome: IAutoMovieAnalysisOutcome;
  /** Digest over protocol, identity, solver, settings and outcome. */
  digest: AutoMovieContentDigest;
}
