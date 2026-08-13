import { IAutoMovieModelRecipe } from "@automovie/interface";
import {
  AutoMovieApplication,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { recolouredModelRecipe } from "../internal/designMutation";
import { resolveJsonPointer } from "../internal/jsonPointer";
import { namedFacts, throwsError } from "../internal/predicates";
import { AUTOMOVIE_REVIEW_CRITERION_VOCABULARY } from "../internal/reviewVocabulary";
import { productionFixture } from "./productionFixtures";

const DESIGN_CRITERIA = [...AUTOMOVIE_REVIEW_CRITERION_VOCABULARY.design];

const MODEL_TARGET = {
  kind: "design",
  design: { kind: "model", id: "soloist" },
} as const;

/**
 * `prepareReview` hands out one current, target-bound worksheet and refuses to
 * pretend a target it cannot read exists.
 *
 * Nothing in the suite called this tool, so the whole review gate stood on an
 * unexecuted claim: that the worksheet names the exact criteria a reviewer must
 * answer, quotes only selectors that resolve in current bytes, and carries a
 * fingerprint that moves the moment the target does. Each of those is what
 * `submitReview` later refuses against, so an error here is invisible until it
 * has already accepted a review of something that no longer exists.
 *
 * Scenarios:
 *
 * 1. The tool is knowledge-gated before it is anything else: called with no
 *    session credit it throws naming both the overall contract and the review
 *    document for this target kind, and the refusal is ordered recovery steps
 *    rather than a payload complaint.
 * 2. Credit for the dependency review document does not unlock an asset review;
 *    that target kind demands its own document, so the per-kind guide map is
 *    exercised rather than assumed.
 * 3. A prepared model design returns the five canonical criteria in canonical
 *    order, no diagnostics, and no frame, rendition, or outcome evidence, since
 *    a design target is not visual.
 * 4. Every quotable selector addresses the prepared target and resolves in the
 *    current design bytes -- an invented selector in this list is what would let
 *    a reviewer cite something that is not there.
 * 5. The fingerprint is a function of current bytes: it repeats for an unchanged
 *    target, differs from another target's, and changes when the model recipe
 *    changes.
 * 6. A design target that does not exist is refused by name with the correction
 *    safety sentence appended, and offers nothing quotable.
 */
export const test_mcp_prepare_review_worksheet = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const application = new AutoMovieApplication({ projectRoot: fixture.root });

    TestValidator.equals(
      "review preparation is a knowledge precondition before it is a payload check",
      namedFacts([
        [
          "ungatedRefused",
          () =>
            throwsError(
              () => application.prepareReview({ target: MODEL_TARGET }),
              [
                "prepareReview is knowledge-gated",
                'getGuideDocument({ name: "AUTOMOVIE_OVERALL" })',
                'getGuideDocument({ name: "REVIEW_DEPENDENCY" })',
                "missing-knowledge precondition, not a payload validation error",
              ],
            ),
        ],
        [
          "overallAloneRefused",
          () => {
            application.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
            return throwsError(
              () => application.prepareReview({ target: MODEL_TARGET }),
              ['getGuideDocument({ name: "REVIEW_DEPENDENCY" })', "1/2"],
            );
          },
        ],
        [
          "dependencyCreditAdmits",
          () => {
            application.getGuideDocument({ name: "REVIEW_DEPENDENCY" });
            return (
              application.prepareReview({ target: MODEL_TARGET }).target
                .kind === "design"
            );
          },
        ],
        [
          "assetKindNeedsItsOwnDocument",
          () =>
            throwsError(
              () =>
                application.prepareReview({
                  target: { kind: "asset", id: "soloist" },
                }),
              ['getGuideDocument({ name: "REVIEW_ASSET" })'],
            ),
        ],
      ]),
      {
        ungatedRefused: true,
        overallAloneRefused: true,
        dependencyCreditAdmits: true,
        assetKindNeedsItsOwnDocument: true,
      },
    );

    const prepared = application.prepareReview({ target: MODEL_TARGET });
    TestValidator.equals(
      "a design worksheet asks the five canonical questions and nothing visual",
      {
        target: prepared.target,
        requiredCriteria: prepared.requiredCriteria,
        diagnostics: prepared.diagnostics,
        frames: prepared.frames,
        renditions: prepared.renditions,
        outcomes: prepared.outcomes,
      },
      {
        target: { kind: "design", design: { kind: "model", id: "soloist" } },
        requiredCriteria: DESIGN_CRITERIA,
        diagnostics: [],
        frames: [],
        renditions: [],
        outcomes: [],
      },
    );

    const recipe = project.design({
      kind: "model",
      id: "soloist",
    }) as IAutoMovieModelRecipe;
    TestValidator.equals(
      "every prepared selector addresses this target and resolves in current bytes",
      namedFacts([
        ["nonEmpty", () => prepared.quotable.length > 0],
        [
          "allDesignSelectors",
          () =>
            prepared.quotable.every(
              (selector) =>
                selector.kind === "design" &&
                selector.target.kind === "model" &&
                selector.target.id === "soloist",
            ),
        ],
        [
          "allResolve",
          () =>
            prepared.quotable.every(
              (selector) =>
                selector.kind === "design" &&
                resolveJsonPointer(recipe, selector.pointer).found,
            ),
        ],
        [
          "namesTheRecipeIdentity",
          () =>
            prepared.quotable.some(
              (selector) =>
                selector.kind === "design" && selector.pointer === "/id",
            ),
        ],
        [
          "malformedPointerRefused",
          () => resolveJsonPointer(recipe, "id").found === false,
        ],
      ]),
      {
        nonEmpty: true,
        allDesignSelectors: true,
        allResolve: true,
        namesTheRecipeIdentity: true,
        malformedPointerRefused: true,
      },
    );

    const repeated = application.prepareReview({ target: MODEL_TARGET });
    const worldPrepared = application.prepareReview({
      target: { kind: "design", design: { kind: "world" } },
    });
    const rewritten = project.setModelRecipe(recolouredModelRecipe(recipe));
    const afterEdit = application.prepareReview({ target: MODEL_TARGET });
    TestValidator.equals(
      "the worksheet fingerprint is a function of the current target bytes",
      namedFacts([
        [
          "repeatsForUnchangedBytes",
          () => repeated.fingerprint === prepared.fingerprint,
        ],
        [
          "differsFromAnotherTarget",
          () => worldPrepared.fingerprint !== prepared.fingerprint,
        ],
        [
          "everyDesignTargetAsksTheSameQuestions",
          () =>
            worldPrepared.requiredCriteria.join(",") ===
            DESIGN_CRITERIA.join(","),
        ],
        ["editAccepted", () => rewritten.accepted],
        [
          "missingPaletteAnchorRefused",
          () =>
            throwsError(
              () => recolouredModelRecipe(recipe, "no-such-entry"),
              "no six-digit hex palette entry",
            ),
        ],
        [
          "movesWithTheEdit",
          () => afterEdit.fingerprint !== prepared.fingerprint,
        ],
      ]),
      {
        repeatsForUnchangedBytes: true,
        differsFromAnotherTarget: true,
        everyDesignTargetAsksTheSameQuestions: true,
        editAccepted: true,
        missingPaletteAnchorRefused: true,
        movesWithTheEdit: true,
      },
    );

    const absent = application.prepareReview({
      target: {
        kind: "design",
        design: { kind: "model", id: "no-such-model" },
      },
    });
    TestValidator.equals(
      "an unreadable design target is refused by name, not prepared empty",
      {
        quotable: absent.quotable,
        diagnostics: absent.diagnostics.map((diagnostic) => ({
          code: diagnostic.code,
          category: diagnostic.category,
          phase: diagnostic.phase,
          target: diagnostic.target,
          correctionSafe: diagnostic.message.endsWith(
            "Correction feedback does not authorize deleting the artifact.",
          ),
        })),
      },
      {
        quotable: [],
        diagnostics: [
          {
            code: "review-target-missing",
            category: "error",
            phase: "review",
            target: "design:model:no-such-model",
            correctionSafe: true,
          },
        ],
      },
    );
  } finally {
    fixture.dispose();
  }
};
