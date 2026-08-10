import {
  AUTOMOVIE_ANALYSIS_MAX_SAMPLES,
  AUTOMOVIE_ANALYSIS_REPORT_MAX_GAPS,
  assertAutoMovieAnalysisTargets,
  autoMovieAnalysisMetric,
  isAutoMovieAnalysisDomain,
  sealAutoMovieAnalysisRun,
  summarizeAutoMovieAnalysis,
  validateAutoMovieAnalysisRun,
} from "@automovie/engine";
import {
  IAutoMovieAnalysisMetric,
  IAutoMovieAnalysisRun,
  IAutoMovieAnalysisSample,
  IAutoMovieAnalysisWarning,
  IAutoMovieValidation,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { sealedAnalysisRun } from "../internal/analysisFixtures";
import { hasViolation, namedFacts, throwsError } from "../internal/predicates";

/**
 * An analysis run says what it measured, says what it did not, and cannot be
 * edited into saying otherwise.
 *
 * This is the honesty machinery itself rather than any one solver. The three
 * outcome arms are structural: `unsupported` and `not-run` have nowhere to put
 * a metric, so an absent analysis cannot be dressed as a clean one by filling
 * fields in. Inside a solved run the same line is held per metric: no value
 * without a reason and a remedy, no gap beside a value, no target on a metric
 * that produced nothing, and no verdict that disagrees with its own
 * arithmetic.
 *
 * The rule that stops the most persuasive lie is the sample rule. A spatial
 * field may only be recorded for a metric of the same run that actually
 * produced a value, so no heatmap can ever be drawn for a computation nobody
 * ran.
 *
 * Scenarios:
 *
 * 1. A sealed run validates, re-seals identically, and is refused the moment its
 *    digest or its contents are edited apart.
 * 2. Every identity field has a refusing twin: version, protocol, blank id,
 *    subject and revision, unknown domain, blank solver identity, and a
 *    settings digest that is not one.
 * 3. A solved run with no metric is refused, and so is a duplicated metric key.
 * 4. A metric with no value must carry a reason and a remedy, must be
 *    `unsupported` or `not-run`, and may carry neither target nor comparison.
 * 5. A metric with a value may carry no gap, must be finite, must not be
 *    `unsupported` or `not-run`, must carry both target and comparison when it
 *    judges, and must agree with its own comparison in both directions.
 * 6. A sample may only field a metric of the same run that produced a value; an
 *    unknown key, a gapped key, a duplicate id, a blank id, a non-finite
 *    position, a non-finite value and an over-bound grid are each refused.
 * 7. Warnings must carry a code and a detail, and a subject that is null or real.
 * 8. The metric builder resolves declared targets in both directions, drops a
 *    target declared in the wrong unit with a warning rather than comparing
 *    across units, and refuses a value with a gap, a gap-less absence and a
 *    non-finite value.
 * 9. Declared targets are refused at the door for a blank key, a blank unit, a
 *    non-finite value, an unknown direction and a duplicated key.
 * 10. A report is `meets` only when every required domain answered this revision,
 *     every metric produced a value and every target held; a miss, a stale run,
 *     an unsupported run, a not-run run, a gapped metric and an unanswered
 *     required domain each change that.
 * 11. The report bounds its gap list and counts the remainder, and refuses to exist
 *     over no required domain at all.
 */
export const test_analysis_run_contract = (): void => {
  const digest = (fill: string): `sha256:${string}` =>
    `sha256:${fill.repeat(64)}`;
  const measured = (
    overrides: Partial<IAutoMovieAnalysisMetric> = {},
  ): IAutoMovieAnalysisMetric => ({
    key: "room.reverberationTime",
    unit: "s",
    value: 0.8,
    target: null,
    comparison: null,
    status: "untargeted",
    gap: null,
    ...overrides,
  });
  const draft = (
    overrides: Partial<Omit<IAutoMovieAnalysisRun, "digest">> = {},
  ): Omit<IAutoMovieAnalysisRun, "digest"> => ({
    version: 1,
    protocol: "automovie.analysis-run.v1",
    id: "hall-acoustics",
    domain: "acoustic",
    subject: "space:hall",
    inputRevision: "r7",
    solver: { id: "solver", version: "1", model: "Sabine" },
    settings: digest("1"),
    outcome: {
      status: "solved",
      metrics: [measured()],
      samples: [],
      warnings: [],
    },
    ...overrides,
  });
  const check = (
    overrides: Partial<Omit<IAutoMovieAnalysisRun, "digest">> = {},
  ): IAutoMovieValidation =>
    validateAutoMovieAnalysisRun({ run: sealedAnalysisRun(draft(overrides)) });
  const solved = (
    metrics: IAutoMovieAnalysisMetric[],
    samples: IAutoMovieAnalysisSample[] = [],
    warnings: IAutoMovieAnalysisWarning[] = [],
  ): IAutoMovieValidation =>
    check({ outcome: { status: "solved", metrics, samples, warnings } });

  const sealed = sealAutoMovieAnalysisRun({
    id: "hall-acoustics",
    domain: "acoustic",
    subject: "space:hall",
    inputRevision: "r7",
    solver: { id: "solver", version: "1", model: "Sabine" },
    settings: "volume=100",
    outcome: {
      status: "solved",
      metrics: [measured()],
      samples: [],
      warnings: [],
    },
  });
  const resealed = sealAutoMovieAnalysisRun({
    id: "hall-acoustics",
    domain: "acoustic",
    subject: "space:hall",
    inputRevision: "r7",
    solver: { id: "solver", version: "1", model: "Sabine" },
    settings: "volume=100",
    outcome: {
      status: "solved",
      metrics: [measured()],
      samples: [],
      warnings: [],
    },
  });
  TestValidator.equals(
    "a sealed run validates, re-seals identically, and refuses every edit",
    {
      clean: validateAutoMovieAnalysisRun({ run: sealed }),
      stable: sealed.digest === resealed.digest,
      forgedSeal: hasViolation(
        validateAutoMovieAnalysisRun({
          run: { ...sealed, digest: digest("a") },
        }),
        "type",
        "$input.digest",
      ),
      forgedContents: hasViolation(
        validateAutoMovieAnalysisRun({
          run: {
            ...sealed,
            outcome: {
              status: "solved",
              metrics: [measured({ value: 0.4 })],
              samples: [],
              warnings: [],
            },
          },
        }),
        "type",
        "$input.digest",
      ),
      current: validateAutoMovieAnalysisRun({ run: sealed, revision: "r7" })
        .success,
      stale: hasViolation(
        validateAutoMovieAnalysisRun({ run: sealed, revision: "r8" }),
        "type",
        "$input.inputRevision",
      ),
      refusesInvalid: throwsError(
        () =>
          sealAutoMovieAnalysisRun({
            id: "empty",
            domain: "acoustic",
            subject: "space:hall",
            inputRevision: "r7",
            solver: { id: "solver", version: "1", model: "Sabine" },
            settings: "none",
            outcome: {
              status: "solved",
              metrics: [],
              samples: [],
              warnings: [],
            },
          }),
        "at least one metric",
      ),
      knownDomain: isAutoMovieAnalysisDomain("thermal"),
      unknownDomain: isAutoMovieAnalysisDomain("structural"),
    },
    {
      clean: { success: true },
      stable: true,
      forgedSeal: true,
      forgedContents: true,
      current: true,
      stale: true,
      refusesInvalid: true,
      knownDomain: true,
      unknownDomain: false,
    },
  );

  TestValidator.equals(
    "every identity field of a run has a refusing twin",
    namedFacts([
      [
        "version",
        () =>
          hasViolation(
            check({ version: 2 as unknown as 1 }),
            "type",
            "$input.version",
          ),
      ],
      [
        "protocol",
        () =>
          hasViolation(
            check({
              protocol:
                "automovie.analysis-run.v2" as unknown as IAutoMovieAnalysisRun["protocol"],
            }),
            "type",
            "$input.protocol",
          ),
      ],
      ["blank id", () => hasViolation(check({ id: " " }), "type", "$input.id")],
      [
        "blank subject",
        () => hasViolation(check({ subject: "" }), "type", "$input.subject"),
      ],
      [
        "blank revision",
        () =>
          hasViolation(
            check({ inputRevision: "  " }),
            "type",
            "$input.inputRevision",
          ),
      ],
      [
        "unknown domain",
        () =>
          hasViolation(
            check({
              domain:
                "structural" as unknown as IAutoMovieAnalysisRun["domain"],
            }),
            "type",
            "$input.domain",
          ),
      ],
      [
        "blank solver id",
        () =>
          hasViolation(
            check({ solver: { id: "", version: "1", model: "m" } }),
            "type",
            "$input.solver.id",
          ),
      ],
      [
        "blank solver version",
        () =>
          hasViolation(
            check({ solver: { id: "s", version: " ", model: "m" } }),
            "type",
            "$input.solver.version",
          ),
      ],
      [
        "blank solver model",
        () =>
          hasViolation(
            check({ solver: { id: "s", version: "1", model: "" } }),
            "type",
            "$input.solver.model",
          ),
      ],
      [
        "settings digest",
        () =>
          hasViolation(
            check({
              settings: "sha256:not-a-digest" as unknown as `sha256:${string}`,
            }),
            "type",
            "$input.settings",
          ),
      ],
      [
        "unknown outcome status",
        () =>
          hasViolation(
            check({
              outcome: {
                status: "pending",
              } as unknown as IAutoMovieAnalysisRun["outcome"],
            }),
            "type",
            "$input.outcome.status",
          ),
      ],
      [
        "unsupported without a reason",
        () =>
          hasViolation(
            check({
              outcome: {
                status: "unsupported",
                reason: " ",
                remedy: "bind one",
              },
            }),
            "type",
            "$input.outcome.reason",
          ),
      ],
      [
        "not-run without a remedy",
        () =>
          hasViolation(
            check({
              outcome: { status: "not-run", reason: "no input", remedy: "" },
            }),
            "type",
            "$input.outcome.remedy",
          ),
      ],
      [
        "not-run stated in full",
        () =>
          check({
            outcome: {
              status: "not-run",
              reason: "no exterior boundary condition",
              remedy: "declare the outdoor air temperature",
            },
          }).success,
      ],
      [
        "no metric at all",
        () => hasViolation(solved([]), "range", "$input.outcome.metrics"),
      ],
      [
        "duplicate metric key",
        () =>
          hasViolation(
            solved([measured(), measured({ value: 0.9 })]),
            "type",
            "$input.outcome.metrics[1].key",
          ),
      ],
      [
        "blank metric key",
        () =>
          hasViolation(
            solved([measured({ key: " " })]),
            "type",
            "$input.outcome.metrics[0].key",
          ),
      ],
      [
        "blank metric unit",
        () =>
          hasViolation(
            solved([measured({ unit: "" })]),
            "type",
            "$input.outcome.metrics[0].unit",
          ),
      ],
    ]),
    {
      version: true,
      protocol: true,
      "blank id": true,
      "blank subject": true,
      "blank revision": true,
      "unknown domain": true,
      "blank solver id": true,
      "blank solver version": true,
      "blank solver model": true,
      "settings digest": true,
      "unknown outcome status": true,
      "unsupported without a reason": true,
      "not-run without a remedy": true,
      "not-run stated in full": true,
      "no metric at all": true,
      "duplicate metric key": true,
      "blank metric key": true,
      "blank metric unit": true,
    },
  );

  const gap = { reason: "no solver", remedy: "bind one" };
  const absent = (
    overrides: Partial<IAutoMovieAnalysisMetric> = {},
  ): IAutoMovieAnalysisMetric =>
    measured({ value: null, status: "not-run", gap, ...overrides });
  TestValidator.equals(
    "an absent measurement must stay visibly absent",
    namedFacts([
      ["not-run in full", () => solved([absent()]).success],
      [
        "unsupported in full",
        () => solved([absent({ status: "unsupported" })]).success,
      ],
      [
        "absent but claiming a verdict",
        () =>
          hasViolation(
            solved([absent({ status: "meets" })]),
            "type",
            "$input.outcome.metrics[0].status",
          ),
      ],
      [
        "absent with no gap",
        () =>
          hasViolation(
            solved([measured({ value: null, status: "not-run", gap: null })]),
            "type",
            "$input.outcome.metrics[0].gap",
          ),
      ],
      [
        "absent with a blank reason",
        () =>
          hasViolation(
            solved([absent({ gap: { reason: " ", remedy: "bind one" } })]),
            "type",
            "$input.outcome.metrics[0].gap.reason",
          ),
      ],
      [
        "absent with a blank remedy",
        () =>
          hasViolation(
            solved([absent({ gap: { reason: "no solver", remedy: "" } })]),
            "type",
            "$input.outcome.metrics[0].gap.remedy",
          ),
      ],
      [
        "absent with a target",
        () =>
          hasViolation(
            solved([absent({ target: 1 })]),
            "type",
            "$input.outcome.metrics[0].target",
          ),
      ],
      [
        "absent with a comparison",
        () =>
          hasViolation(
            solved([absent({ comparison: "at-most" })]),
            "type",
            "$input.outcome.metrics[0].comparison",
          ),
      ],
    ]),
    {
      "not-run in full": true,
      "unsupported in full": true,
      "absent but claiming a verdict": true,
      "absent with no gap": true,
      "absent with a blank reason": true,
      "absent with a blank remedy": true,
      "absent with a target": true,
      "absent with a comparison": true,
    },
  );

  TestValidator.equals(
    "a measurement must agree with its own verdict",
    namedFacts([
      [
        "non-finite value",
        () =>
          hasViolation(
            solved([measured({ value: Number.NaN })]),
            "range",
            "$input.outcome.metrics[0].value",
          ),
      ],
      [
        "value beside a gap",
        () =>
          hasViolation(
            solved([measured({ gap })]),
            "type",
            "$input.outcome.metrics[0].gap",
          ),
      ],
      [
        "untargeted with a target",
        () =>
          hasViolation(
            solved([measured({ target: 1 })]),
            "type",
            "$input.outcome.metrics[0].target",
          ),
      ],
      [
        "untargeted with a comparison",
        () =>
          hasViolation(
            solved([measured({ comparison: "at-most" })]),
            "type",
            "$input.outcome.metrics[0].target",
          ),
      ],
      [
        "value claiming to be unmeasured",
        () =>
          hasViolation(
            solved([measured({ status: "not-run", gap: null })]),
            "type",
            "$input.outcome.metrics[0].status",
          ),
      ],
      [
        "judging with no target",
        () =>
          hasViolation(
            solved([measured({ status: "meets", comparison: "at-most" })]),
            "type",
            "$input.outcome.metrics[0].target",
          ),
      ],
      [
        "judging with no comparison",
        () =>
          hasViolation(
            solved([measured({ status: "meets", target: 1 })]),
            "type",
            "$input.outcome.metrics[0].target",
          ),
      ],
      [
        "judging against a non-finite target",
        () =>
          hasViolation(
            solved([
              measured({
                status: "meets",
                target: Number.POSITIVE_INFINITY,
                comparison: "at-most",
              }),
            ]),
            "range",
            "$input.outcome.metrics[0].target",
          ),
      ],
      [
        "claiming to meet what it misses",
        () =>
          hasViolation(
            solved([
              measured({ status: "meets", target: 0.5, comparison: "at-most" }),
            ]),
            "type",
            "$input.outcome.metrics[0].status",
          ),
      ],
      [
        "claiming to miss what it meets",
        () =>
          hasViolation(
            solved([
              measured({ status: "misses", target: 1, comparison: "at-most" }),
            ]),
            "type",
            "$input.outcome.metrics[0].status",
          ),
      ],
      [
        "an honest at-most pass",
        () =>
          solved([
            measured({ status: "meets", target: 1, comparison: "at-most" }),
          ]).success,
      ],
      [
        "an honest at-least failure",
        () =>
          solved([
            measured({ status: "misses", target: 1, comparison: "at-least" }),
          ]).success,
      ],
    ]),
    {
      "non-finite value": true,
      "value beside a gap": true,
      "untargeted with a target": true,
      "untargeted with a comparison": true,
      "value claiming to be unmeasured": true,
      "judging with no target": true,
      "judging with no comparison": true,
      "judging against a non-finite target": true,
      "claiming to meet what it misses": true,
      "claiming to miss what it meets": true,
      "an honest at-most pass": true,
      "an honest at-least failure": true,
    },
  );

  const at = (
    id: string,
    key: string,
    value = 1,
  ): IAutoMovieAnalysisSample => ({
    id,
    key,
    position: { x: 0, y: 0, z: 0 },
    value,
  });
  TestValidator.equals(
    "a field may only be drawn for a metric that produced a value",
    namedFacts([
      [
        "a real field",
        () =>
          solved(
            [measured()],
            [
              at("a", "room.reverberationTime"),
              at("b", "room.reverberationTime"),
            ],
          ).success,
      ],
      [
        "a field of nothing",
        () =>
          hasViolation(
            solved([absent()], [at("a", "room.reverberationTime")]),
            "type",
            "$input.outcome.samples[0].key",
          ),
      ],
      [
        "a field of an unknown metric",
        () =>
          hasViolation(
            solved([measured()], [at("a", "room.clarity")]),
            "type",
            "$input.outcome.samples[0].key",
          ),
      ],
      [
        "a blank sample id",
        () =>
          hasViolation(
            solved([measured()], [at(" ", "room.reverberationTime")]),
            "type",
            "$input.outcome.samples[0].id",
          ),
      ],
      [
        "a duplicated sample id",
        () =>
          hasViolation(
            solved(
              [measured()],
              [
                at("a", "room.reverberationTime"),
                at("a", "room.reverberationTime"),
              ],
            ),
            "type",
            "$input.outcome.samples[1].id",
          ),
      ],
      [
        "a non-finite position",
        () =>
          hasViolation(
            solved(
              [measured()],
              [
                {
                  id: "a",
                  key: "room.reverberationTime",
                  position: { x: 0, y: Number.NaN, z: 0 },
                  value: 1,
                },
              ],
            ),
            "range",
            "$input.outcome.samples[0].position.y",
          ),
      ],
      [
        "a non-finite sample value",
        () =>
          hasViolation(
            solved(
              [measured()],
              [at("a", "room.reverberationTime", Number.POSITIVE_INFINITY)],
            ),
            "range",
            "$input.outcome.samples[0].value",
          ),
      ],
      [
        "a grid past the bound",
        () =>
          hasViolation(
            solved(
              [measured()],
              Array.from(
                { length: AUTOMOVIE_ANALYSIS_MAX_SAMPLES + 1 },
                (_, index) => at(`s${index}`, "room.reverberationTime"),
              ),
            ),
            "range",
            "$input.outcome.samples",
          ),
      ],
    ]),
    {
      "a real field": true,
      "a field of nothing": true,
      "a field of an unknown metric": true,
      "a blank sample id": true,
      "a duplicated sample id": true,
      "a non-finite position": true,
      "a non-finite sample value": true,
      "a grid past the bound": true,
    },
  );

  TestValidator.equals(
    "a warning must say something about something",
    namedFacts([
      [
        "stated in full",
        () =>
          solved(
            [measured()],
            [],
            [
              {
                code: "reverse-heat-flow",
                detail: "indoor is colder",
                subject: null,
              },
            ],
          ).success,
      ],
      [
        "about a named subject",
        () =>
          solved(
            [measured()],
            [],
            [{ code: "c", detail: "d", subject: "assembly:wall" }],
          ).success,
      ],
      [
        "blank code",
        () =>
          hasViolation(
            solved(
              [measured()],
              [],
              [{ code: " ", detail: "d", subject: null }],
            ),
            "type",
            "$input.outcome.warnings[0].code",
          ),
      ],
      [
        "blank detail",
        () =>
          hasViolation(
            solved(
              [measured()],
              [],
              [{ code: "c", detail: "", subject: null }],
            ),
            "type",
            "$input.outcome.warnings[0].detail",
          ),
      ],
      [
        "blank subject",
        () =>
          hasViolation(
            solved(
              [measured()],
              [],
              [{ code: "c", detail: "d", subject: " " }],
            ),
            "type",
            "$input.outcome.warnings[0].subject",
          ),
      ],
    ]),
    {
      "stated in full": true,
      "about a named subject": true,
      "blank code": true,
      "blank detail": true,
      "blank subject": true,
    },
  );

  const warnings: IAutoMovieAnalysisWarning[] = [];
  const build = (
    value: number | null,
    targets: Parameters<typeof autoMovieAnalysisMetric>[0]["targets"],
    extra: Partial<Parameters<typeof autoMovieAnalysisMetric>[0]> = {},
  ): IAutoMovieAnalysisMetric =>
    autoMovieAnalysisMetric({
      key: "room.reverberationTime",
      unit: "s",
      value,
      targets,
      warnings,
      ...extra,
    });
  TestValidator.equals(
    "the metric builder judges only what it can compare",
    {
      untargeted: build(0.8, []),
      meetsAtMost: build(0.8, [
        {
          key: "room.reverberationTime",
          unit: "s",
          value: 1,
          comparison: "at-most",
        },
      ]),
      missesAtMost: build(1.2, [
        {
          key: "room.reverberationTime",
          unit: "s",
          value: 1,
          comparison: "at-most",
        },
      ]),
      meetsAtLeast: build(0.8, [
        {
          key: "room.reverberationTime",
          unit: "s",
          value: 0.5,
          comparison: "at-least",
        },
      ]),
      missesAtLeast: build(0.4, [
        {
          key: "room.reverberationTime",
          unit: "s",
          value: 0.5,
          comparison: "at-least",
        },
      ]),
      wrongUnit: build(0.8, [
        {
          key: "room.reverberationTime",
          unit: "ms",
          value: 800,
          comparison: "at-most",
        },
      ]),
      otherKey: build(0.8, [
        { key: "room.constant", unit: "m2", value: 1, comparison: "at-least" },
      ]),
      absent: build(null, [], { gap, status: "unsupported" }),
      warnings,
    },
    {
      untargeted: measured(),
      meetsAtMost: measured({
        target: 1,
        comparison: "at-most",
        status: "meets",
      }),
      missesAtMost: measured({
        value: 1.2,
        target: 1,
        comparison: "at-most",
        status: "misses",
      }),
      meetsAtLeast: measured({
        target: 0.5,
        comparison: "at-least",
        status: "meets",
      }),
      missesAtLeast: measured({
        value: 0.4,
        target: 0.5,
        comparison: "at-least",
        status: "misses",
      }),
      wrongUnit: measured(),
      otherKey: measured(),
      absent: measured({ value: null, status: "unsupported", gap }),
      warnings: [
        {
          code: "target-unit-mismatch",
          detail:
            'target for "room.reverberationTime" is declared in ms while the metric is measured in s; the target was ignored',
          subject: "room.reverberationTime",
        },
      ],
    },
  );
  TestValidator.equals(
    "the builder and the target table refuse what has no honest reading",
    namedFacts([
      [
        "absence with no reason",
        () => throwsError(() => build(null, []), "must state why"),
      ],
      [
        "a value beside a gap",
        () =>
          throwsError(
            () => build(0.8, [], { gap }),
            "a measured metric has no gap",
          ),
      ],
      [
        "a non-finite value",
        () => throwsError(() => build(Number.NaN, []), "finite value"),
      ],
      [
        "a blank target key",
        () =>
          throwsError(
            () =>
              assertAutoMovieAnalysisTargets([
                { key: " ", unit: "s", value: 1, comparison: "at-most" },
              ]),
            "non-blank metric key",
          ),
      ],
      [
        "a blank target unit",
        () =>
          throwsError(
            () =>
              assertAutoMovieAnalysisTargets([
                { key: "k", unit: "", value: 1, comparison: "at-most" },
              ]),
            "must state the unit",
          ),
      ],
      [
        "a non-finite target value",
        () =>
          throwsError(
            () =>
              assertAutoMovieAnalysisTargets([
                {
                  key: "k",
                  unit: "s",
                  value: Number.NaN,
                  comparison: "at-most",
                },
              ]),
            "finite value",
          ),
      ],
      [
        "an unknown direction",
        () =>
          throwsError(
            () =>
              assertAutoMovieAnalysisTargets([
                {
                  key: "k",
                  unit: "s",
                  value: 1,
                  comparison: "near" as unknown as "at-most",
                },
              ]),
            "at-least",
          ),
      ],
      [
        "a duplicated target",
        () =>
          throwsError(
            () =>
              assertAutoMovieAnalysisTargets([
                { key: "k", unit: "s", value: 1, comparison: "at-most" },
                { key: "k", unit: "s", value: 2, comparison: "at-most" },
              ]),
            "declared more than once",
          ),
      ],
    ]),
    {
      "absence with no reason": true,
      "a value beside a gap": true,
      "a non-finite value": true,
      "a blank target key": true,
      "a blank target unit": true,
      "a non-finite target value": true,
      "an unknown direction": true,
      "a duplicated target": true,
    },
  );

  const run = (
    id: string,
    overrides: Partial<Omit<IAutoMovieAnalysisRun, "digest">>,
  ): IAutoMovieAnalysisRun => sealedAnalysisRun(draft({ id, ...overrides }));
  const clean = run("clean", {
    outcome: {
      status: "solved",
      metrics: [
        measured({ status: "meets", target: 1, comparison: "at-most" }),
      ],
      samples: [],
      warnings: [],
    },
  });
  const report = summarizeAutoMovieAnalysis({
    runs: [clean],
    revision: "r7",
    required: ["acoustic"],
  });
  TestValidator.equals(
    "a report meets only when the required domain answered this revision",
    {
      status: report.status,
      gaps: report.gaps,
      omitted: report.omittedGaps,
      acoustic: report.domains.find((row) => row.domain === "acoustic"),
      domains: report.domains.map((row) => row.domain),
      required: report.domains.filter((row) => row.required).length,
      stable:
        report.digest ===
        summarizeAutoMovieAnalysis({
          runs: [clean],
          revision: "r7",
          required: ["acoustic"],
        }).digest,
      different:
        report.digest !==
        summarizeAutoMovieAnalysis({
          runs: [clean],
          revision: "r7",
          required: ["acoustic", "thermal"],
        }).digest,
    },
    {
      status: "meets",
      gaps: [],
      omitted: 0,
      acoustic: {
        domain: "acoustic",
        runs: 1,
        solved: 1,
        unsupported: 0,
        notRun: 0,
        stale: 0,
        metrics: 1,
        measured: 1,
        meets: 1,
        misses: 0,
        required: true,
      },
      domains: [
        "daylight",
        "artificial-light",
        "thermal",
        "moisture",
        "air",
        "acoustic",
      ],
      required: 1,
      stable: true,
      different: true,
    },
  );

  const missing = summarizeAutoMovieAnalysis({
    runs: [clean],
    revision: "r7",
    required: ["acoustic", "air"],
  });
  const stale = summarizeAutoMovieAnalysis({
    runs: [run("stale", { inputRevision: "r6" })],
    revision: "r7",
    required: ["acoustic"],
  });
  const refused = summarizeAutoMovieAnalysis({
    runs: [
      run("unsupported", {
        outcome: {
          status: "unsupported",
          reason: "no adapter",
          remedy: "bind one",
        },
      }),
      run("skipped", {
        domain: "air",
        outcome: {
          status: "not-run",
          reason: "no flow declared",
          remedy: "declare the supply flow",
        },
      }),
    ],
    revision: "r7",
    required: ["acoustic", "air"],
  });
  const gapped = summarizeAutoMovieAnalysis({
    runs: [
      run("gapped", {
        outcome: {
          status: "solved",
          metrics: [
            measured(),
            absent({ key: "room.speechTransmissionIndex" }),
            absent({ key: "room.impulseResponse", status: "unsupported" }),
          ],
          samples: [],
          warnings: [],
        },
      }),
    ],
    revision: "r7",
    required: ["acoustic"],
  });
  const failing = summarizeAutoMovieAnalysis({
    runs: [
      run("failing", {
        outcome: {
          status: "solved",
          metrics: [
            measured({ status: "misses", target: 0.5, comparison: "at-most" }),
            absent({ key: "room.speechTransmissionIndex" }),
          ],
          samples: [],
          warnings: [],
        },
      }),
    ],
    revision: "r7",
    required: ["acoustic"],
  });
  TestValidator.equals(
    "a missing, stale, refused or gapped answer is incomplete, and a miss outranks it",
    {
      missing: [
        missing.status,
        missing.gaps.map((entry) => [entry.domain, entry.run, entry.status]),
      ],
      stale: [
        stale.status,
        stale.domains.find((row) => row.domain === "acoustic")?.stale,
        stale.gaps[0]?.reason.includes("r6"),
      ],
      refused: [
        refused.status,
        refused.domains.find((row) => row.domain === "acoustic")?.unsupported,
        refused.domains.find((row) => row.domain === "air")?.notRun,
        refused.gaps.map((entry) => entry.status),
      ],
      gapped: [
        gapped.status,
        gapped.gaps.map((entry) => [entry.metric, entry.status]),
        gapped.domains.find((row) => row.domain === "acoustic")?.measured,
      ],
      failing: [failing.status, failing.gaps.length],
    },
    {
      missing: ["incomplete", [["air", null, "not-run"]]],
      stale: ["incomplete", 1, true],
      refused: ["incomplete", 1, 1, ["unsupported", "not-run"]],
      gapped: [
        "incomplete",
        [
          ["room.speechTransmissionIndex", "not-run"],
          ["room.impulseResponse", "unsupported"],
        ],
        1,
      ],
      failing: ["misses", 1],
    },
  );

  const crowded = summarizeAutoMovieAnalysis({
    runs: Array.from({ length: 5 }, (_, index) =>
      run(`skip-${index}`, {
        outcome: {
          status: "not-run",
          reason: `no input ${index}`,
          remedy: "declare it",
        },
      }),
    ),
    revision: "r7",
    required: ["acoustic"],
    maxGaps: 2,
  });
  TestValidator.equals(
    "the report bounds its gap list and counts the rest",
    {
      bound: AUTOMOVIE_ANALYSIS_REPORT_MAX_GAPS,
      listed: crowded.gaps.map((entry) => entry.run),
      omitted: crowded.omittedGaps,
      status: crowded.status,
    },
    {
      bound: 16,
      listed: ["skip-0", "skip-1"],
      omitted: 3,
      status: "incomplete",
    },
  );

  TestValidator.equals(
    "a report over nothing, or over a run that cannot be read, does not exist",
    namedFacts([
      [
        "blank revision",
        () =>
          throwsError(
            () =>
              summarizeAutoMovieAnalysis({
                runs: [],
                revision: " ",
                required: ["acoustic"],
              }),
            "state the design revision",
          ),
      ],
      [
        "no required domain",
        () =>
          throwsError(
            () =>
              summarizeAutoMovieAnalysis({
                runs: [],
                revision: "r7",
                required: [],
              }),
            "cannot clear anything",
          ),
      ],
      [
        "unknown required domain",
        () =>
          throwsError(
            () =>
              summarizeAutoMovieAnalysis({
                runs: [],
                revision: "r7",
                required: [
                  "structural" as unknown as IAutoMovieAnalysisRun["domain"],
                ],
              }),
            "unknown required analysis domain",
          ),
      ],
      [
        "fractional gap bound",
        () =>
          throwsError(
            () =>
              summarizeAutoMovieAnalysis({
                runs: [],
                revision: "r7",
                required: ["acoustic"],
                maxGaps: 1.5,
              }),
            "positive safe integer",
          ),
      ],
      [
        "zero gap bound",
        () =>
          throwsError(
            () =>
              summarizeAutoMovieAnalysis({
                runs: [],
                revision: "r7",
                required: ["acoustic"],
                maxGaps: 0,
              }),
            "positive safe integer",
          ),
      ],
      [
        "a duplicated run",
        () =>
          throwsError(
            () =>
              summarizeAutoMovieAnalysis({
                runs: [clean, clean],
                revision: "r7",
                required: ["acoustic"],
              }),
            "reported more than once",
          ),
      ],
      [
        "an unreadable run",
        () =>
          throwsError(
            () =>
              summarizeAutoMovieAnalysis({
                runs: [{ ...clean, digest: digest("b") }],
                revision: "r7",
                required: ["acoustic"],
              }),
            "cannot be reported at",
          ),
      ],
    ]),
    {
      "blank revision": true,
      "no required domain": true,
      "unknown required domain": true,
      "fractional gap bound": true,
      "zero gap bound": true,
      "a duplicated run": true,
      "an unreadable run": true,
    },
  );
};
