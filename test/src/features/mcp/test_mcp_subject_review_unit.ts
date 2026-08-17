import {
  IAutoMovieModelRecipe,
  IAutoMovieReviewCheck,
  IAutoMovieSubjectReviewTarget,
  IAutoMovieSubmitReviewInput,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  compareCodeUnits,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { recolouredModelRecipe } from "../internal/designMutation";
import { resolveJsonPointer } from "../internal/jsonPointer";
import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

const TARGET: { kind: "subject" } & IAutoMovieSubjectReviewTarget = {
  kind: "subject",
  shot: "opening",
  subject: "prototype:automovie:model:soloist",
};

const CRITERIA = [
  "identity-and-composition",
  "placement-and-bounds",
  "viewpoint-coverage",
  "subject-frame-separation",
] as const;

const diagnosticCodes = (
  diagnostics: ReadonlyArray<{ code: string }>,
): string[] =>
  [...new Set(diagnostics.map((diagnostic) => diagnostic.code))].sort(
    compareCodeUnits,
  );

/**
 * The public review tools accept a compiled subject as its own unit without
 * inventing visual completion before the subject-view harness exists.
 *
 * Scenarios:
 *
 * 1. After a real source compile and subject-guide credit, `prepareReview`
 *    resolves the compiled `soloist` prototype from the generated shot,
 *    returns subject
 *    selectors, and reports indeterminate viewpoint coverage as a warning.
 * 2. `submitReview` accepts an explicitly incomplete worksheet backed by four
 *    distinct current subject-description selectors and stores it incomplete.
 * 3. The same worksheet cannot claim completion while subject-view coverage is
 *    unavailable, and replacing subject evidence with an ordinary shot frame
 *    cannot discharge even one subject criterion.
 * 4. Changing the reviewed model and recompiling moves the subject fingerprint;
 *    resubmitting the older worksheet is stale, while unrelated film time is
 *    never used as the subject revision.
 */
export const test_mcp_subject_review_unit = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiler = new AutoMovieProductionCompiler(project);
    const firstCompile = compiler.compile({ scope: "source" });
    if (
      productionCompileSucceeded("subject review fixture", firstCompile) ===
      false
    )
      throw new Error(
        "The subject-review fixture did not compile current source.",
      );

    const application = new AutoMovieApplication({ projectRoot: fixture.root });
    application.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    application.getGuideDocument({ name: "REVIEW" });
    application.getGuideDocument({ name: "REVIEW_SUBJECT" });
    const prepared = application.prepareReview({ target: TARGET });
    TestValidator.equals(
      "prepareReview reports one compiled subject without visual completion",
      {
        target: prepared.target,
        criteria: prepared.requiredCriteria,
        description: {
          id: prepared.subjectReview?.unit.description.id,
          kind: prepared.subjectReview?.unit.description.kind,
          viewpointOwner: prepared.subjectReview?.unit.viewpointOwner,
          deliveryEvidenceEligible:
            prepared.subjectReview?.unit.deliveryEvidenceEligible,
        },
        coverage: prepared.subjectReview?.coverage,
        diagnostics: prepared.diagnostics.map((diagnostic) => ({
          code: diagnostic.code,
          category: diagnostic.category,
        })),
        frames: prepared.frames,
      },
      {
        target: TARGET,
        criteria: [...CRITERIA],
        description: {
          id: "prototype:automovie:model:soloist",
          kind: "prototype",
          viewpointOwner: "inspection",
          deliveryEvidenceEligible: false,
        },
        coverage: {
          state: "indeterminate",
          planned: [],
          observed: [],
          missing: [],
          stale: [],
          unplanned: [],
          foreign: 0,
          duplicates: 0,
        },
        diagnostics: [
          {
            code: "review-subject-viewpoint-unsupported",
            category: "warning",
          },
        ],
        frames: [],
      },
    );

    const description = prepared.subjectReview?.unit.description;
    if (description === undefined)
      throw new Error("Prepared subject review omitted its resolved unit.");
    const subjectSelectors = prepared.quotable.filter(
      (selector) => selector.kind === "subject",
    );
    const wantedPointers = ["/id", "/bounds", "/materials", "/members"];
    const checks: IAutoMovieReviewCheck[] = CRITERIA.map((criterion, index) => {
      const pointer = wantedPointers[index]!;
      const selector = subjectSelectors.find(
        (candidate) => candidate.pointer === pointer,
      );
      const resolved = resolveJsonPointer(description, pointer);
      if (selector === undefined || resolved.found === false)
        throw new Error(
          `Prepared subject selector "${pointer}" does not resolve in current description.`,
        );
      return {
        criterion,
        verdict: "pass",
        observation: `Current compiled subject answers ${criterion} at ${pointer}.`,
        evidence: [
          {
            kind: "subject",
            target: selector.target,
            pointer,
            exactValue: resolved.value,
          },
        ],
      };
    });
    const incomplete: IAutoMovieSubmitReviewInput = {
      target: TARGET,
      preparedFingerprint: prepared.fingerprint,
      observations:
        "The current compiled prototype is structurally inspectable, but no subject-owned viewpoint plan has run.",
      checks,
      corrections: [
        {
          owner: "render",
          target: "prototype:automovie:model:soloist",
          problem:
            "No subject-view observation exists for this compiled revision.",
          expected:
            "Run the subject harness viewpoints and submit their current receipts.",
        },
      ],
      completionBasis:
        "identity-and-composition is current; viewpoint-coverage remains explicitly incomplete.",
      complete: false,
    };
    const accepted = application.submitReview(incomplete);
    TestValidator.equals(
      "an evidence-bound incomplete subject review is stored honestly",
      {
        accepted: accepted.accepted,
        state: accepted.state,
        diagnostics: accepted.diagnostics,
        stored: project.review(TARGET)?.complete,
      },
      {
        accepted: true,
        state: "incomplete",
        diagnostics: [],
        stored: false,
      },
    );

    const falseCompletion = application.submitReview({
      ...incomplete,
      corrections: [],
      completionBasis:
        "identity-and-composition and viewpoint-coverage are claimed current.",
      complete: true,
    });
    const frameSubstitution = application.submitReview({
      ...incomplete,
      checks: incomplete.checks.map((check, index) =>
        index === 0
          ? {
              ...check,
              evidence: [
                {
                  kind: "frame",
                  target: { kind: "shot", id: "opening" },
                  reviewFrame: "opening-beauty",
                  bundle: ".automovie/renders/opening",
                  frame: 0,
                  time: 0,
                  pass: "beauty",
                  digest: `sha256:${"0".repeat(64)}`,
                },
              ],
            }
          : check,
      ),
    });
    TestValidator.equals(
      "neither a completion assertion nor a shot frame substitutes for subject views",
      {
        falseCompletion: {
          accepted: falseCompletion.accepted,
          codes: diagnosticCodes(falseCompletion.diagnostics),
        },
        frameSubstitution: {
          accepted: frameSubstitution.accepted,
          codes: diagnosticCodes(frameSubstitution.diagnostics),
        },
      },
      {
        falseCompletion: {
          accepted: false,
          codes: ["review-subject-coverage-incomplete"],
        },
        frameSubstitution: {
          accepted: false,
          codes: ["review-evidence-stale"],
        },
      },
    );

    const recipe = project.design({
      kind: "model",
      id: "soloist",
    }) as IAutoMovieModelRecipe;
    const mutation = project.setModelRecipe(recolouredModelRecipe(recipe));
    if (mutation.accepted === false)
      throw new Error(
        `Subject-review model mutation was refused: ${JSON.stringify(mutation.diagnostics)}`,
      );
    const secondCompile = compiler.compile({ scope: "source" });
    if (
      productionCompileSucceeded(
        "changed subject review fixture",
        secondCompile,
      ) === false
    )
      throw new Error("The changed subject-review fixture did not recompile.");
    const afterChange = application.prepareReview({ target: TARGET });
    const stale = application.submitReview(incomplete);
    TestValidator.equals(
      "a changed compiled subject makes the older worksheet stale",
      {
        moved: afterChange.fingerprint !== prepared.fingerprint,
        accepted: stale.accepted,
        state: stale.state,
        codes: diagnosticCodes(stale.diagnostics),
      },
      {
        moved: true,
        accepted: false,
        state: "stale",
        codes: ["review-worksheet-stale"],
      },
    );
  } finally {
    fixture.dispose();
  }
};
