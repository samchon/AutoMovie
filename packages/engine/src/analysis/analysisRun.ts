import {
  AutoMovieAnalysisDomain,
  IAutoMovieAnalysisDomainRollup,
  IAutoMovieAnalysisGap,
  IAutoMovieAnalysisMetric,
  IAutoMovieAnalysisMetricGap,
  IAutoMovieAnalysisOutcome,
  IAutoMovieAnalysisReport,
  IAutoMovieAnalysisRun,
  IAutoMovieAnalysisSolver,
  IAutoMovieAnalysisTarget,
  IAutoMovieAnalysisWarning,
  IAutoMovieValidation,
} from "@automovie/interface";

import { autoMovieRenderDigest } from "../render/renderDigest";
import { ViolationCollector } from "../validation/violation";

/**
 * Every analysis domain, in the fixed order every report rolls up in.
 *
 * One table, so a domain added here appears in every rollup at once instead of
 * being remembered in some of the places that enumerate domains.
 *
 * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism `AUTOMOVIE_ANALYSIS_DOMAINS` fixes the complete domain vocabulary and the order in which analysis outcomes roll up.
 * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-result-completeness-determinism The single ordered table gives validation and summaries the same deterministic domain traversal.
 */
export const AUTOMOVIE_ANALYSIS_DOMAINS = [
  "daylight",
  "artificial-light",
  "thermal",
  "moisture",
  "air",
  "acoustic",
] as const;

/**
 * How many spatial samples one run may carry.
 *
 * A field overlay needs every sample it draws, so this is a refusal rather than
 * a truncation: a request for a grid past the bound is an authoring mistake and
 * says so, instead of quietly drawing a heatmap of a coarser study than the one
 * that was asked for.
 *
 * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism `AUTOMOVIE_ANALYSIS_MAX_SAMPLES` makes an oversized spatial field fail visibly instead of silently truncating evidence.
 * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-result-completeness-determinism The 4096-sample ceiling supplies the validator's deterministic refusal boundary for complete overlays.
 */
export const AUTOMOVIE_ANALYSIS_MAX_SAMPLES = 4096;

/**
 * How many gaps one report may list before counting the rest.
 *
 * The report has to be readable at a glance to be read at all, so it names the
 * first gaps in run order and counts the remainder. The count is always stated:
 * a bound nobody can see is indistinguishable from a clean sheet.
 *
 * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism `AUTOMOVIE_ANALYSIS_REPORT_MAX_GAPS` bounds the named gap list while preserving a count of every omitted finding.
 * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-result-completeness-determinism The sixteen-entry display limit makes report size stable without misclassifying truncated diagnostics as complete.
 * @evidence requirements/diagnostics/budgets-and-limits.md#diagnostics-truncation-and-omission `AUTOMOVIE_ANALYSIS_REPORT_MAX_GAPS` exposes the omitted-gap count beside the bounded visible list, so truncation cannot read as completeness.
 * @evidence specifications/validation-and-diagnostics/budget-and-truncation.md#validation-truncation-result The report limit preserves total omitted findings while returning a deterministic prefix of concrete gaps.
 */
export const AUTOMOVIE_ANALYSIS_REPORT_MAX_GAPS = 16;

/** A plain SHA-256 content digest as this project writes it. */
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

/**
 * Test whether a value names a rollable analysis domain.
 *
 * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism `isAutoMovieAnalysisDomain` rejects unknown domain labels before they can disappear from a fixed-order rollup.
 * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-result-completeness-determinism The predicate checks runtime values against the canonical domain table used by collection and summary.
 */
export const isAutoMovieAnalysisDomain = (
  value: unknown,
): value is AutoMovieAnalysisDomain =>
  (AUTOMOVIE_ANALYSIS_DOMAINS as readonly unknown[]).includes(value);

/**
 * Check the targets a production declares before any solver reads them.
 *
 * Targets are the one input that can turn a correct measurement into a wrong
 * verdict, so they are refused at the door rather than negotiated later: a
 * blank key, a blank unit, a non-finite value, an unknown direction, or two
 * targets fighting over the same key are all authoring mistakes with no sane
 * interpretation.
 *
 * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism `assertAutoMovieAnalysisTargets` fails before solving when a target is blank, non-finite, directionless, or duplicated by key.
 * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-result-completeness-determinism The assertion validates target identity, unit, threshold, comparison direction, and uniqueness in declaration order.
 */
export const assertAutoMovieAnalysisTargets = (
  targets: readonly IAutoMovieAnalysisTarget[],
): void => {
  const seen = new Set<string>();
  for (const target of targets) {
    if (target.key.trim().length === 0)
      throw new Error("an analysis target must name a non-blank metric key");
    if (target.unit.trim().length === 0)
      throw new Error(
        `analysis target "${target.key}" must state the unit its value is in`,
      );
    if (!Number.isFinite(target.value))
      throw new Error(
        `analysis target "${target.key}" must be a finite value, but was ${target.value}`,
      );
    if (target.comparison !== "at-least" && target.comparison !== "at-most")
      throw new Error(
        `analysis target "${target.key}" must compare "at-least" or "at-most", but was ${String(target.comparison)}`,
      );
    if (seen.has(target.key))
      throw new Error(
        `analysis target "${target.key}" is declared more than once`,
      );
    seen.add(target.key);
  }
};

/**
 * Build one metric, resolving whatever target the production declared for it.
 *
 * A target stated in the wrong unit does not silently pass and does not
 * silently fail: it is dropped and reported as a `target-unit-mismatch`
 * warning, so the metric reads `untargeted` (which is true, nothing comparable
 * was declared) while the author is told exactly which declaration is wrong.
 * Comparing 300 lux against a target of 300 candela would be the alternative,
 * and it would clear a room nobody measured correctly.
 *
 * A metric with no value must say why. Passing a value and a gap together, or
 * neither, throws: those are the two shapes that let an absent measurement
 * masquerade as a result.
 *
 * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism `autoMovieAnalysisMetric` keeps absent measurements explicit and refuses contradictory value-gap combinations.
 * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-result-completeness-determinism The builder resolves a same-unit target, derives its verdict, reports unit mismatches, and requires one reason for every missing value.
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-unsupported-state `autoMovieAnalysisMetric` records an unavailable solver capability as `unsupported` with a required gap reason instead of fabricating a measured value.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-unsupported-state The metric builder preserves `unsupported` as an explicit no-value outcome with its own reason and remedy.
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-classification-independence `autoMovieAnalysisMetric` keeps measurement availability, threshold verdict, and warning severity in separate fields rather than collapsing them into one status.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-classification-orthogonality The metric record independently represents solver availability, target comparison, and declaration warnings for the same check.
 * @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-automated-finding-boundary `autoMovieAnalysisMetric` labels a solver-produced value or explicit gap as an automated metric result, never as a human approval.
 * @evidence specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-automated-finding-result The metric builder records value, unit, target verdict, or non-execution reason as machine output without manufacturing a judgment record.
 */
export const autoMovieAnalysisMetric = (props: {
  /** Open metric key. */
  key: string;
  /** Unit the value is produced in. */
  unit: string;
  /** Finite measured value, or `null` when the solver produced none. */
  value: number | null;
  /** Targets the production declared, already checked. */
  targets: readonly IAutoMovieAnalysisTarget[];
  /** Sink the resolver appends unit-mismatch warnings to. */
  warnings: IAutoMovieAnalysisWarning[];
  /** Required when `value` is null. */
  gap?: IAutoMovieAnalysisMetricGap;
  /** Which kind of nothing; defaults to `not-run`. */
  status?: "unsupported" | "not-run";
}): IAutoMovieAnalysisMetric => {
  const { key, unit, value, gap } = props;
  if (value === null) {
    if (gap === undefined)
      throw new Error(
        `analysis metric "${key}" produced no value and must state why`,
      );
    return {
      key,
      unit,
      value: null,
      target: null,
      comparison: null,
      status: props.status ?? "not-run",
      gap,
    };
  }
  if (gap !== undefined)
    throw new Error(
      `analysis metric "${key}" carries both a value and a gap; a measured metric has no gap`,
    );
  if (!Number.isFinite(value))
    throw new Error(
      `analysis metric "${key}" must be a finite value, but was ${value}`,
    );
  const target = props.targets.find((entry) => entry.key === key);
  if (target === undefined)
    return {
      key,
      unit,
      value,
      target: null,
      comparison: null,
      status: "untargeted",
      gap: null,
    };
  if (target.unit !== unit) {
    props.warnings.push({
      code: "target-unit-mismatch",
      detail: `target for "${key}" is declared in ${target.unit} while the metric is measured in ${unit}; the target was ignored`,
      subject: key,
    });
    return {
      key,
      unit,
      value,
      target: null,
      comparison: null,
      status: "untargeted",
      gap: null,
    };
  }
  return {
    key,
    unit,
    value,
    target: target.value,
    comparison: target.comparison,
    status: satisfied(value, target.value, target.comparison)
      ? "meets"
      : "misses",
    gap: null,
  };
};

/** Whether a value satisfies a target in the declared direction. */
const satisfied = (
  value: number,
  target: number,
  comparison: IAutoMovieAnalysisTarget["comparison"],
): boolean => (comparison === "at-least" ? value >= target : value <= target);

/**
 * Report every declared target that names no metric the study reports.
 *
 * A target nobody can apply is the quietest way a report reads `meets`. The
 * unit mismatch above is already refused out loud for exactly this reason, and
 * a mistyped or hopeful key is the same fault with the same consequence: the
 * author believes a requirement is enforced, every metric is measured, no gap
 * is recorded, and the verdict comes back clean over a rule that was never
 * checked. So an inapplicable target is stated either way.
 *
 * A target that names a metric which produced no value is **not** reported
 * here. That metric already carries its own reason and reaches the report as a
 * gap, so the requirement is visibly unanswered rather than silently dropped.
 *
 * `keys` is the whole set the study reports, which for a solver that emits more
 * than one run is the union across them: a moisture target is not unmatched
 * merely because the thermal run has no such metric.
 *
 * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism `warnAutoMovieAnalysisTargetKeys` exposes declared thresholds that no reported metric actually checks.
 * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-result-completeness-determinism The pass compares target keys with the union of emitted metric keys and appends stable unmatched-target warnings.
 */
export const warnAutoMovieAnalysisTargetKeys = (props: {
  /** Targets the production declared, already checked. */
  targets: readonly IAutoMovieAnalysisTarget[];
  /** Every metric key the study reports, across all of its runs. */
  keys: readonly string[];
  /** Sink the unmatched targets are appended to, in declared order. */
  warnings: IAutoMovieAnalysisWarning[];
}): void => {
  const reported = new Set(props.keys);
  for (const target of props.targets)
    if (!reported.has(target.key))
      props.warnings.push({
        code: "target-key-unknown",
        detail: `target for "${target.key}" names no metric this study reports; the target was ignored`,
        subject: target.key,
      });
};

/**
 * Seal one run: digest the settings, digest the record, and refuse to emit a
 * record that would not validate.
 *
 * Building and checking are the same call on purpose. A builder that can hand
 * back an invalid artifact is a hole in exactly the contract this module exists
 * to hold, so the seal runs the same validator a deserialized run faces and
 * throws on the first violation rather than shipping it.
 *
 * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism `sealAutoMovieAnalysisRun` refuses to emit incomplete evidence and binds accepted settings and outcomes to reproducible digests.
 * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-result-completeness-determinism The sealing operation hashes settings, canonicalizes the record, computes its digest, and validates the finished run before return.
 * @author Samchon
 */
export const sealAutoMovieAnalysisRun = (props: {
  /** Stable run identity. */
  id: string;
  /** Domain the run answers for. */
  domain: AutoMovieAnalysisDomain;
  /** Open subject label. */
  subject: string;
  /** Design revision read. */
  inputRevision: string;
  /** Solver identity. */
  solver: IAutoMovieAnalysisSolver;
  /** Canonical text of every setting that changes the result. */
  settings: string;
  /** Honest outcome. */
  outcome: IAutoMovieAnalysisOutcome;
}): IAutoMovieAnalysisRun => {
  const draft = {
    version: 1,
    protocol: "automovie.analysis-run.v1",
    id: props.id,
    domain: props.domain,
    subject: props.subject,
    inputRevision: props.inputRevision,
    solver: props.solver,
    settings: autoMovieRenderDigest(props.settings),
    outcome: props.outcome,
  } as const;
  const run: IAutoMovieAnalysisRun = {
    ...draft,
    digest: autoMovieAnalysisRunDigest(draft),
  };
  const validated = validateAutoMovieAnalysisRun({ run });
  if (validated.success === false) {
    const first = validated.violations[0]!;
    throw new Error(
      `analysis run "${props.id}" is invalid at ${first.path}: ${first.expected}`,
    );
  }
  return run;
};

/**
 * Validate one analysis run as evidence.
 *
 * The rules all defend the same line: an absent measurement must stay visibly
 * absent. A metric without a value must carry a reason and a remedy and may not
 * carry a target; a metric with a value may not carry a gap and must agree with
 * its own verdict; a spatial sample may only be a field of a metric that
 * actually produced a value, so no overlay can be drawn for a computation
 * nobody ran. The digest is recomputed, so a run whose outcome was edited after
 * sealing fails here rather than being read as a measurement.
 *
 * Passing `revision` additionally asks whether the run is still about the
 * current design. A run that read an older revision is reported as stale: it
 * was a real measurement of a building that no longer exists.
 *
 * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism `validateAutoMovieAnalysisRun` reports every structural, completeness, verdict, sample, digest, and staleness defect in stable order.
 * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-result-completeness-determinism The validator traverses the sealed run deterministically and distinguishes invalid evidence from a valid result for an obsolete revision.
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding `validateAutoMovieAnalysisRun` diagnoses contradictions inside the sealed solver outcome after input acceptance, including invalid metrics, samples, verdicts, and digests.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding The validator locates defects in computed run evidence separately from authoring-input checks performed before sealing.
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run `validateAutoMovieAnalysisRun` requires failed and not-run outcomes to retain distinct statuses with non-empty reasons and remedies.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states The sealed-run validator rejects an outcome that erases the difference between execution failure and deliberate non-execution.
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-unsupported-and-not-run `validateAutoMovieAnalysisRun` verifies that unsupported and not-run evidence stays explicit and carries an actionable explanation.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-outcome-classification-lattice The validator enforces the analysis run's solved, failed, unsupported, and not-run record shapes without treating absence as success.
 * @evidence requirements/evidence-and-provenance/scope-identity-and-status.md#evidence-portable-inspection `validateAutoMovieAnalysisRun` rechecks a deserialized run from its self-contained protocol, subject, revision, solver, settings digest, outcome, and content digest.
 * @evidence specifications/evidence-and-provenance/scope-identity-and-status.md#evp-portable-inspection-view The public validator supplies a portable inspection boundary for one complete analysis-run record without depending on hidden process state.
 */
export const validateAutoMovieAnalysisRun = (props: {
  /** Run to check. */
  run: IAutoMovieAnalysisRun;
  /** Current design revision, when staleness is being checked. */
  revision?: string;
}): IAutoMovieValidation => {
  const { run } = props;
  const out = new ViolationCollector();
  const root = "$input";

  if (run.version !== 1)
    out.push(
      "type",
      `${root}.version`,
      `analysis run schema version must be 1, but was ${run.version}`,
      run.version,
    );
  if (run.protocol !== "automovie.analysis-run.v1")
    out.push(
      "type",
      `${root}.protocol`,
      `analysis run protocol must be "automovie.analysis-run.v1", but was ${String(run.protocol)}`,
      run.protocol,
    );
  nonEmpty(run.id, `${root}.id`, "analysis run id", out);
  nonEmpty(run.subject, `${root}.subject`, "analysis run subject", out);
  nonEmpty(
    run.inputRevision,
    `${root}.inputRevision`,
    "analysis run input revision",
    out,
  );
  if (!isAutoMovieAnalysisDomain(run.domain))
    out.push(
      "type",
      `${root}.domain`,
      `unknown analysis domain "${String(run.domain)}"`,
      run.domain,
    );
  nonEmpty(run.solver.id, `${root}.solver.id`, "solver id", out);
  nonEmpty(run.solver.version, `${root}.solver.version`, "solver version", out);
  nonEmpty(
    run.solver.model,
    `${root}.solver.model`,
    "solver governing model",
    out,
  );
  for (const key of ["settings", "digest"] as const)
    if (!DIGEST_PATTERN.test(run[key]))
      out.push(
        "type",
        `${root}.${key}`,
        `analysis run ${key} must be a lowercase "sha256:" hex digest, but was ${String(run[key])}`,
        run[key],
      );

  const outcome = run.outcome;
  if (outcome.status === "solved") {
    if (outcome.metrics.length === 0)
      out.push(
        "range",
        `${root}.outcome.metrics`,
        'a "solved" run must carry at least one metric; report an empty result as "not-run" or "unsupported"',
        outcome.metrics,
      );
    const measured = new Set<string>();
    const keys = new Set<string>();
    outcome.metrics.forEach((metric, index) => {
      const path = `${root}.outcome.metrics[${index}]`;
      nonEmpty(metric.key, `${path}.key`, "metric key", out);
      nonEmpty(metric.unit, `${path}.unit`, "metric unit", out);
      if (keys.has(metric.key))
        out.push(
          "type",
          `${path}.key`,
          `metric key "${metric.key}" must be unique within a run`,
          metric.key,
        );
      keys.add(metric.key);
      validateMetric(metric, path, out);
      if (metric.value !== null) measured.add(metric.key);
    });

    if (outcome.samples.length > AUTOMOVIE_ANALYSIS_MAX_SAMPLES)
      out.push(
        "range",
        `${root}.outcome.samples`,
        `an analysis run carries at most ${AUTOMOVIE_ANALYSIS_MAX_SAMPLES} spatial samples, but had ${outcome.samples.length}`,
        outcome.samples.length,
      );
    const sampleIds = new Set<string>();
    outcome.samples.forEach((sample, index) => {
      const path = `${root}.outcome.samples[${index}]`;
      nonEmpty(sample.id, `${path}.id`, "sample id", out);
      if (sampleIds.has(sample.id))
        out.push(
          "type",
          `${path}.id`,
          `sample id "${sample.id}" must be unique within a run`,
          sample.id,
        );
      sampleIds.add(sample.id);
      if (!measured.has(sample.key))
        out.push(
          "type",
          `${path}.key`,
          `sample field "${sample.key}" names no metric of this run that produced a value; a field cannot be drawn for a measurement nobody made`,
          sample.key,
        );
      for (const axis of ["x", "y", "z"] as const)
        if (!Number.isFinite(sample.position[axis]))
          out.push(
            "range",
            `${path}.position.${axis}`,
            `sample position ${axis} must be finite, but was ${sample.position[axis]}`,
            sample.position[axis],
          );
      if (!Number.isFinite(sample.value))
        out.push(
          "range",
          `${path}.value`,
          `sample value must be finite, but was ${sample.value}`,
          sample.value,
        );
    });

    outcome.warnings.forEach((warning, index) => {
      const path = `${root}.outcome.warnings[${index}]`;
      nonEmpty(warning.code, `${path}.code`, "warning code", out);
      nonEmpty(warning.detail, `${path}.detail`, "warning detail", out);
      if (warning.subject !== null && warning.subject.trim() === "")
        out.push(
          "type",
          `${path}.subject`,
          "warning subject must be null or non-blank",
          warning.subject,
        );
    });
  } else if (outcome.status === "unsupported" || outcome.status === "not-run") {
    nonEmpty(
      outcome.reason,
      `${root}.outcome.reason`,
      `a "${outcome.status}" run reason`,
      out,
    );
    nonEmpty(
      outcome.remedy,
      `${root}.outcome.remedy`,
      `a "${outcome.status}" run remedy`,
      out,
    );
  } else
    out.push(
      "type",
      `${root}.outcome.status`,
      `unknown analysis outcome status "${String((outcome as { status: unknown }).status)}"`,
      (outcome as { status: unknown }).status,
    );

  const expected = autoMovieAnalysisRunDigest(run);
  if (run.digest !== expected)
    out.push(
      "type",
      `${root}.digest`,
      `analysis run digest ${run.digest} does not seal its own contents ${expected}`,
      run.digest,
    );
  if (props.revision !== undefined && run.inputRevision !== props.revision)
    out.push(
      "type",
      `${root}.inputRevision`,
      `analysis run read design revision "${run.inputRevision}" while the design is at "${props.revision}"; the result is stale`,
      run.inputRevision,
    );
  return out.toValidation();
};

const validateMetric = (
  metric: IAutoMovieAnalysisMetric,
  path: string,
  out: ViolationCollector,
): void => {
  if (metric.value === null) {
    if (metric.status !== "unsupported" && metric.status !== "not-run")
      out.push(
        "type",
        `${path}.status`,
        `metric "${metric.key}" produced no value, so its status must be "unsupported" or "not-run", but was ${String(metric.status)}`,
        metric.status,
      );
    if (metric.gap === null)
      out.push(
        "type",
        `${path}.gap`,
        `metric "${metric.key}" produced no value and must state the reason and the remedy`,
        metric.gap,
      );
    else {
      nonEmpty(
        metric.gap.reason,
        `${path}.gap.reason`,
        "metric gap reason",
        out,
      );
      nonEmpty(
        metric.gap.remedy,
        `${path}.gap.remedy`,
        "metric gap remedy",
        out,
      );
    }
    if (metric.target !== null)
      out.push(
        "type",
        `${path}.target`,
        `metric "${metric.key}" produced no value, so it cannot be compared to a target`,
        metric.target,
      );
    if (metric.comparison !== null)
      out.push(
        "type",
        `${path}.comparison`,
        `metric "${metric.key}" produced no value, so it carries no comparison`,
        metric.comparison,
      );
    return;
  }
  if (!Number.isFinite(metric.value))
    out.push(
      "range",
      `${path}.value`,
      `metric "${metric.key}" must be a finite value, but was ${metric.value}`,
      metric.value,
    );
  if (metric.gap !== null)
    out.push(
      "type",
      `${path}.gap`,
      `metric "${metric.key}" carries a value, so it cannot also carry a gap`,
      metric.gap,
    );
  if (metric.status === "untargeted") {
    if (metric.target !== null || metric.comparison !== null)
      out.push(
        "type",
        `${path}.target`,
        `metric "${metric.key}" is untargeted, so it must carry neither a target nor a comparison`,
        metric.target,
      );
    return;
  }
  if (metric.status !== "meets" && metric.status !== "misses") {
    out.push(
      "type",
      `${path}.status`,
      `metric "${metric.key}" carries a value, so its status must be "meets", "misses" or "untargeted", but was ${String(metric.status)}`,
      metric.status,
    );
    return;
  }
  if (metric.target === null || metric.comparison === null) {
    out.push(
      "type",
      `${path}.target`,
      `metric "${metric.key}" reports "${metric.status}", so it must carry the target and the direction it was judged against`,
      metric.target,
    );
    return;
  }
  if (!Number.isFinite(metric.target)) {
    out.push(
      "range",
      `${path}.target`,
      `metric "${metric.key}" target must be finite, but was ${metric.target}`,
      metric.target,
    );
    return;
  }
  const verdict = satisfied(metric.value, metric.target, metric.comparison)
    ? "meets"
    : "misses";
  if (verdict !== metric.status)
    out.push(
      "type",
      `${path}.status`,
      `metric "${metric.key}" reports "${metric.status}" while ${metric.value} ${metric.comparison} ${metric.target} ${verdict === "meets" ? "holds" : "fails"}`,
      metric.status,
    );
};

/**
 * Roll every run of one design revision into one bounded verdict.
 *
 * The report cannot be cleared by silence. A required domain nobody submitted a
 * run for becomes a gap of its own; a run that read a superseded revision is
 * counted as stale rather than as an answer; a metric that produced no value
 * carries its reason up. Only when every required domain answered against this
 * revision, every metric produced a value, and every declared target held does
 * the status read `meets`.
 *
 * Declaring at least one required domain is mandatory, which is what removes
 * the last way to pass: a report over nothing would otherwise clear
 * everything.
 *
 * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism `summarizeAutoMovieAnalysis` prevents a clean verdict when a required domain, current revision, measured value, or declared target remains unanswered.
 * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-result-completeness-determinism The rollup validates ordered runs, classifies missing and stale coverage, bounds visible gaps, and computes the aggregate status.
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-partial-results-and-aggregation `summarizeAutoMovieAnalysis` retains per-domain solved, unsupported, not-run, stale, measured, and missed counts while deriving the bounded aggregate verdict.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-partial-aggregation The summary carries partial domain results and omitted-gap counts forward instead of allowing available measurements to conceal missing evidence.
 * @evidence requirements/interior/validation-and-iteration.md#interior-validation-scope-freshness `summarizeAutoMovieAnalysis` compares every run's input revision with the requested current revision and separates stale or missing required domains from current solved evidence.
 * @evidence requirements/interior/validation-and-iteration.md#interior-validation-status `summarizeAutoMovieAnalysis` retains solved, unsupported, not-run, stale, measured, and missed counts instead of collapsing partial execution into success.
 * @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-validation-outcomes `summarizeAutoMovieAnalysis` derives a bounded aggregate from current, stale, unsupported, not-run, measured, and missed outcomes while preserving domain gaps.
 * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-validation-state-compatibility The summary implements current solved, stale, unsupported, not-run, missing, and failed-target state separation without claiming schema migration or suppression policy.
 */
export const summarizeAutoMovieAnalysis = (props: {
  /** Runs to roll up; each is validated before it is counted. */
  runs: readonly IAutoMovieAnalysisRun[];
  /** Design revision the report is a verdict about. */
  revision: string;
  /** Domains the production requires an answer for; at least one. */
  required: readonly AutoMovieAnalysisDomain[];
  /** Listed-gap bound; defaults to the exported maximum. */
  maxGaps?: number;
}): IAutoMovieAnalysisReport => {
  if (props.revision.trim().length === 0)
    throw new Error(
      "an analysis report must state the design revision it is about",
    );
  const bound = props.maxGaps ?? AUTOMOVIE_ANALYSIS_REPORT_MAX_GAPS;
  if (!Number.isSafeInteger(bound) || bound < 1)
    throw new Error(
      `analysis report gap bound must be a positive safe integer, but was ${bound}`,
    );
  if (props.required.length === 0)
    throw new Error(
      "an analysis report must require at least one domain; a report over nothing cannot clear anything",
    );
  for (const domain of props.required)
    if (!isAutoMovieAnalysisDomain(domain))
      throw new Error(`unknown required analysis domain "${String(domain)}"`);
  const required = new Set(props.required);

  const rollups = new Map<
    AutoMovieAnalysisDomain,
    IAutoMovieAnalysisDomainRollup
  >(
    AUTOMOVIE_ANALYSIS_DOMAINS.map((domain) => [
      domain,
      {
        domain,
        runs: 0,
        solved: 0,
        unsupported: 0,
        notRun: 0,
        stale: 0,
        metrics: 0,
        measured: 0,
        meets: 0,
        misses: 0,
        required: required.has(domain),
      },
    ]),
  );
  const gaps: IAutoMovieAnalysisGap[] = [];
  const seen = new Set<string>();
  for (const run of props.runs) {
    const validated = validateAutoMovieAnalysisRun({ run });
    if (validated.success === false) {
      const first = validated.violations[0]!;
      throw new Error(
        `analysis run "${run.id}" cannot be reported at ${first.path}: ${first.expected}`,
      );
    }
    if (seen.has(run.id))
      throw new Error(`analysis run id "${run.id}" is reported more than once`);
    seen.add(run.id);
    const rollup = rollups.get(run.domain)!;
    ++rollup.runs;
    if (run.inputRevision !== props.revision) {
      ++rollup.stale;
      gaps.push({
        run: run.id,
        domain: run.domain,
        metric: null,
        status: "not-run",
        reason: `run "${run.id}" read design revision "${run.inputRevision}" while the design is at "${props.revision}"`,
        remedy: `re-run the ${run.domain} analysis against revision "${props.revision}"`,
      });
      continue;
    }
    if (run.outcome.status !== "solved") {
      if (run.outcome.status === "unsupported") ++rollup.unsupported;
      else ++rollup.notRun;
      gaps.push({
        run: run.id,
        domain: run.domain,
        metric: null,
        status: run.outcome.status,
        reason: run.outcome.reason,
        remedy: run.outcome.remedy,
      });
      continue;
    }
    ++rollup.solved;
    for (const metric of run.outcome.metrics) {
      ++rollup.metrics;
      if (metric.value === null) {
        gaps.push({
          run: run.id,
          domain: run.domain,
          metric: metric.key,
          status: metric.status === "unsupported" ? "unsupported" : "not-run",
          reason: metric.gap!.reason,
          remedy: metric.gap!.remedy,
        });
        continue;
      }
      ++rollup.measured;
      if (metric.status === "meets") ++rollup.meets;
      else if (metric.status === "misses") ++rollup.misses;
    }
  }

  for (const domain of AUTOMOVIE_ANALYSIS_DOMAINS) {
    const rollup = rollups.get(domain)!;
    if (rollup.required && rollup.runs === 0)
      gaps.push({
        run: null,
        domain,
        metric: null,
        status: "not-run",
        reason: `the production requires a ${domain} answer and no run was submitted`,
        remedy: `run a ${domain} analysis against revision "${props.revision}", or stop requiring the domain`,
      });
  }

  const domains = AUTOMOVIE_ANALYSIS_DOMAINS.map(
    (domain) => rollups.get(domain)!,
  );
  const status: IAutoMovieAnalysisReport["status"] = domains.some(
    (rollup) => rollup.misses > 0,
  )
    ? "misses"
    : gaps.length > 0
      ? "incomplete"
      : "meets";
  const listed = gaps.slice(0, bound);
  const report = {
    version: 1,
    protocol: "automovie.analysis-report.v1",
    status,
    revision: props.revision,
    domains,
    gaps: listed,
    omittedGaps: gaps.length - listed.length,
  } as const;
  return {
    ...report,
    digest: autoMovieRenderDigest(
      [
        report.protocol,
        String(report.version),
        report.status,
        report.revision,
        ...domains.map((rollup) =>
          [
            rollup.domain,
            rollup.runs,
            rollup.solved,
            rollup.unsupported,
            rollup.notRun,
            rollup.stale,
            rollup.metrics,
            rollup.measured,
            rollup.meets,
            rollup.misses,
            rollup.required,
          ].join("|"),
        ),
        ...listed.map((gap) =>
          [
            String(gap.run),
            gap.domain,
            String(gap.metric),
            gap.status,
            gap.reason,
            gap.remedy,
          ].join("|"),
        ),
        String(report.omittedGaps),
      ].join("\n"),
    ),
  };
};

/**
 * The digest that seals one run's contents.
 *
 * Exported because a run that arrived as JSON has to be checkable by the same
 * rule that produced it, and because a second implementation of the canonical
 * form would be a second answer to what a run says.
 *
 * @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism `autoMovieAnalysisRunDigest` gives the complete run record one repeatable integrity identity that changes with its evidence.
 * @evidence specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-result-completeness-determinism The function serializes the canonical run payload and applies the shared SHA-256 content digest used during sealing and validation.
 */
export const autoMovieAnalysisRunDigest = (
  run: Omit<IAutoMovieAnalysisRun, "digest">,
): IAutoMovieAnalysisRun["digest"] => autoMovieRenderDigest(runDigestText(run));

/**
 * The canonical text one run's digest is taken over.
 *
 * Every field that changes what the run claims appears exactly once, joined by
 * separators the fields themselves cannot contain positionally, so two runs
 * differing anywhere digest differently and the same run digests identically on
 * every host.
 */
const runDigestText = (run: Omit<IAutoMovieAnalysisRun, "digest">): string => {
  const lines = [
    run.protocol,
    String(run.version),
    run.id,
    run.domain,
    run.subject,
    run.inputRevision,
    [run.solver.id, run.solver.version, run.solver.model].join("|"),
    run.settings,
    run.outcome.status,
  ];
  if (run.outcome.status === "solved") {
    for (const metric of run.outcome.metrics)
      lines.push(
        JSON.stringify([
          metric.key,
          metric.unit,
          metric.value,
          metric.target,
          metric.comparison,
          metric.status,
          metric.gap?.reason ?? null,
          metric.gap?.remedy ?? null,
        ]),
      );
    for (const sample of run.outcome.samples)
      lines.push(
        JSON.stringify([
          sample.id,
          sample.key,
          sample.position.x,
          sample.position.y,
          sample.position.z,
          sample.value,
        ]),
      );
    for (const warning of run.outcome.warnings)
      lines.push(
        JSON.stringify([warning.code, warning.subject, warning.detail]),
      );
  } else lines.push(JSON.stringify([run.outcome.reason, run.outcome.remedy]));
  return lines.join("\n");
};

const nonEmpty = (
  value: string,
  path: string,
  label: string,
  out: ViolationCollector,
): void => {
  if (value.trim().length === 0)
    out.push("type", path, `${label} must be non-empty`, value);
};
