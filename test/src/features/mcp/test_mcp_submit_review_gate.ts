import {
  AutoMovieContentDigest,
  IAutoMovieModelRecipe,
  IAutoMovieReviewCheck,
  IAutoMovieSubmitReviewInput,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  AutoMovieProductionProject,
  compareCodeUnits,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { recolouredModelRecipe } from "../internal/designMutation";
import { resolveJsonPointer } from "../internal/jsonPointer";
import { namedFacts } from "../internal/predicates";
import {
  AUTOMOVIE_REVIEW_CRITERION_VOCABULARY,
  AUTOMOVIE_REVIEW_HIGH_RISK_CRITERIA,
} from "../internal/reviewVocabulary";
import { productionFixture } from "./productionFixtures";

const MODEL_TARGET = {
  kind: "design",
  design: { kind: "model", id: "soloist" },
} as const;

const DESIGN_CRITERIA = AUTOMOVIE_REVIEW_CRITERION_VOCABULARY.design;

const HIGH_RISK = AUTOMOVIE_REVIEW_HIGH_RISK_CRITERIA.design[0];

const codes = (diagnostics: ReadonlyArray<{ code: string }>): string[] =>
  [...new Set(diagnostics.map((diagnostic) => diagnostic.code))].sort(
    compareCodeUnits,
  );

/**
 * `submitReview` stores exactly one current, self-consistent, evidence-bound
 * worksheet and refuses every other shape by name.
 *
 * This is the gate the whole review loop rests on and no test called it. Its
 * promise is narrow and total: the reviewer decides, the service decides
 * nothing, and in exchange the service refuses any worksheet whose criteria,
 * evidence, freshness, or self-consistency it cannot verify against current
 * bytes. A refusal that silently passed would store a completed review of
 * something nobody looked at, and every later stage treats a stored completion
 * as proof the work was inspected.
 *
 * Every refusal below is produced from one valid worksheet by changing exactly
 * one thing, so each named diagnostic is attributable to that one change.
 *
 * Scenarios:
 *
 * 1. A worksheet prepared under a fingerprint that is no longer current is
 *    refused as stale and names the current fingerprint to re-prepare against.
 * 2. A checklist missing a criterion, duplicating one criterion in place of
 *    another, or carrying the same criteria out of canonical order is refused
 *    as incomplete; the set and order are contract, not presentation detail.
 * 3. Two criteria sharing one observation and one evidence set are refused as
 *    copied and as reusing evidence, which is what stops a reviewer from
 *    answering five questions with one look.
 * 4. Evidence is checked against current bytes: an invented JSON pointer is an
 *    invalid selector, and a real pointer quoted with a value it no longer has
 *    is stale.
 * 5. Self-consistency is checked before the boolean: complete with a revise
 *    verdict, complete with an outstanding correction, and incomplete with
 *    neither a revise nor a correction are each refused, and completion basis
 *    that never names the high-risk criterion is refused separately from the
 *    verdicts.
 * 6. A blank overall observation and a blank completion basis are refused as
 *    empty rather than stored as an inspection nobody wrote down.
 * 7. None of those refusals stores anything: the ledger is still empty.
 * 8. The valid worksheet is accepted, stored verbatim under the prepared
 *    fingerprint, and reported complete; resubmitting that same accepted
 *    worksheet after the design changes is refused as stale, and the previously
 *    stored record is then reported stale rather than current.
 */
export const test_mcp_submit_review_gate = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const application = new AutoMovieApplication({ projectRoot: fixture.root });
    application.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    application.getGuideDocument({ name: "REVIEW" });
    application.getGuideDocument({ name: "REVIEW_DEPENDENCY" });

    const prepared = application.prepareReview({ target: MODEL_TARGET });
    const recipe = project.design({
      kind: "model",
      id: "soloist",
    }) as IAutoMovieModelRecipe;

    /**
     * One distinct current selector per criterion.
     *
     * The gate refuses a design worksheet that cites the same evidence item
     * twice, so the five criteria need five different pointers; taking them in
     * the prepared order keeps the choice deterministic instead of naming
     * pointers this recipe happens to have today.
     */
    const pointers = prepared.quotable.flatMap((selector) =>
      selector.kind === "design" ? [selector.pointer] : [],
    );
    if (pointers.length < DESIGN_CRITERIA.length)
      throw new Error(
        `The prepared model worksheet offers ${pointers.length} design selectors, fewer than the ${DESIGN_CRITERIA.length} criteria it requires.`,
      );
    const check = (
      criterion: string,
      pointer: string,
    ): IAutoMovieReviewCheck => {
      const resolved = resolveJsonPointer(recipe, pointer);
      if (resolved.found === false)
        throw new Error(
          `Prepared selector "${pointer}" does not resolve in the current soloist recipe.`,
        );
      return {
        criterion,
        verdict: "pass",
        observation: `The recipe answers "${criterion}" at ${pointer}.`,
        evidence: [
          {
            kind: "design",
            target: { kind: "model", id: "soloist" },
            pointer,
            exactValue: resolved.value,
          },
        ],
      };
    };
    const worksheet = (): IAutoMovieSubmitReviewInput => ({
      target: MODEL_TARGET,
      preparedFingerprint: prepared.fingerprint,
      observations:
        "The soloist recipe declares one primitive performer with a single LOD.",
      checks: DESIGN_CRITERIA.map((criterion, index) =>
        check(criterion, pointers[index]!),
      ),
      corrections: [],
      completionBasis: `Reconfirmed ${HIGH_RISK} against the current recipe identity and its declared LOD recipes.`,
      complete: true,
    });
    const refusal = (
      mutate: (
        input: IAutoMovieSubmitReviewInput,
      ) => IAutoMovieSubmitReviewInput,
    ): { accepted: boolean; fingerprint: unknown; codes: string[] } => {
      const output = application.submitReview(mutate(worksheet()));
      return {
        accepted: output.accepted,
        fingerprint: output.fingerprint,
        codes: codes(output.diagnostics),
      };
    };

    TestValidator.equals(
      "a worksheet prepared against other bytes cannot be stored",
      refusal((input) => ({
        ...input,
        preparedFingerprint:
          `sha256:${"0".repeat(64)}` as AutoMovieContentDigest,
      })),
      {
        accepted: false,
        fingerprint: null,
        codes: ["review-worksheet-stale"],
      },
    );

    TestValidator.equals(
      "the checklist is a fixed set in a fixed order",
      namedFacts([
        [
          "missingCriterion",
          () =>
            refusal((input) => ({
              ...input,
              checks: input.checks.slice(0, 4),
            })).codes.join(",") === "review-checklist-incomplete",
        ],
        [
          "duplicateCriterion",
          () =>
            refusal((input) => ({
              ...input,
              checks: input.checks.map((entry, index) =>
                index === 1
                  ? { ...entry, criterion: input.checks[0]!.criterion }
                  : entry,
              ),
            })).codes.join(",") === "review-checklist-incomplete",
        ],
        [
          "reorderedCriteria",
          () =>
            refusal((input) => ({
              ...input,
              checks: [
                input.checks[1]!,
                input.checks[0]!,
                ...input.checks.slice(2),
              ],
            })).codes.join(",") === "review-checklist-incomplete",
        ],
      ]),
      {
        missingCriterion: true,
        duplicateCriterion: true,
        reorderedCriteria: true,
      },
    );

    TestValidator.equals(
      "five questions cannot be answered with one look",
      refusal((input) => ({
        ...input,
        checks: input.checks.map((entry, index) =>
          index === 1
            ? {
                ...entry,
                observation: input.checks[0]!.observation,
                evidence: input.checks[0]!.evidence,
              }
            : entry,
        ),
      })).codes,
      ["review-evidence-reused", "review-observation-copied"],
    );

    TestValidator.equals(
      "evidence is rechecked against the bytes it claims to quote",
      namedFacts([
        [
          "inventedSelector",
          () =>
            refusal((input) => ({
              ...input,
              checks: input.checks.map((entry, index) =>
                index === 0
                  ? {
                      ...entry,
                      evidence: [
                        {
                          kind: "design" as const,
                          target: { kind: "model" as const, id: "soloist" },
                          pointer: "/invented",
                          exactValue: null,
                        },
                      ],
                    }
                  : entry,
              ),
            })).codes.join(",") === "review-evidence-selector-invalid",
        ],
        [
          "staleValue",
          () =>
            refusal((input) => ({
              ...input,
              checks: input.checks.map((entry, index) =>
                index === 0
                  ? {
                      ...entry,
                      evidence: entry.evidence.map((item) =>
                        item.kind === "design"
                          ? { ...item, exactValue: "not what is there" }
                          : item,
                      ),
                    }
                  : entry,
              ),
            })).codes.join(",") === "review-evidence-stale",
        ],
        [
          "foreignTarget",
          () =>
            refusal((input) => ({
              ...input,
              checks: input.checks.map((entry, index) =>
                index === 0
                  ? {
                      ...entry,
                      evidence: entry.evidence.map((item) =>
                        item.kind === "design"
                          ? {
                              ...item,
                              target: { kind: "model" as const, id: "other" },
                            }
                          : item,
                      ),
                    }
                  : entry,
              ),
            })).codes.join(",") === "review-evidence-target-mismatch",
        ],
        [
          "noEvidence",
          () =>
            refusal((input) => ({
              ...input,
              checks: input.checks.map((entry, index) =>
                index === 0 ? { ...entry, evidence: [] } : entry,
              ),
            })).codes.join(",") === "review-evidence-missing",
        ],
      ]),
      {
        inventedSelector: true,
        staleValue: true,
        foreignTarget: true,
        noEvidence: true,
      },
    );

    TestValidator.equals(
      "the boolean cannot contradict the worksheet that precedes it",
      namedFacts([
        [
          "completeWithRevise",
          () =>
            refusal((input) => ({
              ...input,
              checks: input.checks.map((entry, index) =>
                index === 4 ? { ...entry, verdict: "revise" as const } : entry,
              ),
            })).codes.join(",") ===
            "review-required-criterion-not-passed,review-self-contradiction",
        ],
        [
          "completeWithCorrection",
          () =>
            refusal((input) => ({
              ...input,
              corrections: [
                {
                  owner: "design" as const,
                  target: "model:soloist",
                  problem: "The palette is unreadable against the ground.",
                  expected: "A body colour separated from the ground colour.",
                },
              ],
            })).codes.join(",") === "review-self-contradiction",
        ],
        [
          "incompleteWithoutNextRound",
          () =>
            refusal((input) => ({ ...input, complete: false })).codes.join(
              ",",
            ) === "review-self-contradiction",
        ],
        [
          "notApplicableCannotDischarge",
          () =>
            refusal((input) => ({
              ...input,
              checks: input.checks.map((entry) =>
                entry.criterion === HIGH_RISK
                  ? { ...entry, verdict: "not-applicable" as const }
                  : entry,
              ),
            })).codes.join(",") ===
            "review-high-risk-not-passed,review-required-criterion-not-passed",
        ],
        [
          "highRiskUnnamedInBasis",
          () =>
            refusal((input) => ({
              ...input,
              completionBasis: "Everything looked fine.",
            })).codes.join(",") === "review-completion-basis-incomplete",
        ],
        [
          "blankObservations",
          () =>
            refusal((input) => ({ ...input, observations: "   " })).codes.join(
              ",",
            ) === "review-observation-empty",
        ],
        [
          "blankCompletionBasis",
          () =>
            refusal((input) => ({ ...input, completionBasis: " " })).codes.join(
              ",",
            ) ===
            "review-completion-basis-empty,review-completion-basis-incomplete",
        ],
      ]),
      {
        completeWithRevise: true,
        completeWithCorrection: true,
        incompleteWithoutNextRound: true,
        notApplicableCannotDischarge: true,
        highRiskUnnamedInBasis: true,
        blankObservations: true,
        blankCompletionBasis: true,
      },
    );

    TestValidator.equals(
      "a refused worksheet leaves the ledger exactly as it found it",
      project.review(MODEL_TARGET),
      null,
    );

    const accepted = application.submitReview(worksheet());
    const stored = project.review(MODEL_TARGET);
    TestValidator.equals(
      "the accepted worksheet is stored verbatim under the prepared fingerprint",
      {
        accepted: accepted.accepted,
        state: accepted.state,
        fingerprint: accepted.fingerprint,
        diagnostics: accepted.diagnostics,
        storedVersion: stored?.version ?? null,
        storedFingerprint: stored?.fingerprint ?? null,
        storedComplete: stored?.complete ?? null,
        storedCriteria: stored?.checks.map((entry) => entry.criterion) ?? null,
        storedObservations: stored?.observations ?? null,
      },
      {
        accepted: true,
        state: "complete",
        fingerprint: prepared.fingerprint,
        diagnostics: [],
        storedVersion: 1,
        storedFingerprint: prepared.fingerprint,
        storedComplete: true,
        storedCriteria: [...DESIGN_CRITERIA],
        storedObservations:
          "The soloist recipe declares one primitive performer with a single LOD.",
      },
    );

    const edited = project.setModelRecipe(recolouredModelRecipe(recipe));
    const resubmitted = application.submitReview(worksheet());
    TestValidator.equals(
      "an accepted review does not survive the bytes it was written about",
      namedFacts([
        ["editAccepted", () => edited.accepted],
        ["resubmitRefused", () => resubmitted.accepted === false],
        [
          "resubmitStale",
          () =>
            codes(resubmitted.diagnostics).join(",") ===
            "review-worksheet-stale",
        ],
        ["storedReportedStale", () => resubmitted.state === "stale"],
        [
          "storedRecordUntouched",
          () =>
            project.review(MODEL_TARGET)?.fingerprint === prepared.fingerprint,
        ],
      ]),
      {
        editAccepted: true,
        resubmitRefused: true,
        resubmitStale: true,
        storedReportedStale: true,
        storedRecordUntouched: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
