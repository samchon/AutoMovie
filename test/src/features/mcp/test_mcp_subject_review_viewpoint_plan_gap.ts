import type {
  IAutoMovieModelRecipe,
  IAutoMoviePrepareReviewOutput,
  IAutoMovieReviewCheck,
  IAutoMovieSubmitReviewInput,
} from "@automovie/interface";
import {
  AUTOMOVIE_SUBJECT_INSPECTION_ROOT,
  AutoMovieApplication,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  type AutoMovieProductionSubjectInspection,
  AutoMovieProductionSubjectInspectionService,
  compareCodeUnits,
  openAutoMovieProduction,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { recolouredModelRecipe } from "../internal/designMutation";
import { resolveJsonPointer } from "../internal/jsonPointer";
import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";
import { inspectionPng, recordingInstrument } from "./test_mcp_inspect_subject";

const SUBJECT = "prototype:automovie:model:soloist";

const TARGET = {
  kind: "subject",
  shot: "opening",
  subject: SUBJECT,
} as const;

/** An instrument that refuses the first viewpoint it is handed. */
const failingInstrument: AutoMovieProductionSubjectInspection = () =>
  Promise.reject(new Error("the inspection instrument is unavailable."));

const CRITERIA = [
  "identity-and-composition",
  "placement-and-bounds",
  "viewpoint-coverage",
  "subject-frame-separation",
] as const;

/**
 * One distinct current description pointer per required criterion.
 *
 * Coverage itself is not quotable: `quotable` is built from the compiled
 * description alone, and the coverage record is not part of it. A criterion
 * about what was looked at therefore cites a description pointer and says its
 * piece in prose, which is the route this case has to take too.
 */
const POINTERS = ["/id", "/bounds", "/materials", "/members"] as const;

/**
 * Build a completion worksheet that is valid apart from what coverage says.
 *
 * Everything a completion needs beyond viewpoint coverage is satisfied here, so
 * whether the submission is accepted turns on the coverage gate alone rather
 * than on a worksheet defect standing in for it.
 */
const subjectWorksheet = (
  prepared: IAutoMoviePrepareReviewOutput,
): IAutoMovieSubmitReviewInput => {
  const description = prepared.subjectReview?.unit.description;
  if (description === undefined)
    throw new Error("The prepared worksheet carries no subject description.");
  const selectors = prepared.quotable.filter(
    (selector) => selector.kind === "subject",
  );
  const checks: IAutoMovieReviewCheck[] = CRITERIA.map((criterion, index) => {
    const pointer = POINTERS[index]!;
    const selector = selectors.find(
      (candidate) => candidate.pointer === pointer,
    );
    const resolved = resolveJsonPointer(description, pointer);
    if (selector === undefined || resolved.found === false)
      throw new Error(
        `Prepared subject selector "${pointer}" does not resolve in the current description.`,
      );
    return {
      criterion,
      verdict: "pass",
      observation: `The current compiled subject answers ${criterion} at ${pointer}.`,
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
  return {
    target: TARGET,
    preparedFingerprint: prepared.fingerprint,
    observations:
      "The compiled subject was read structurally and opened from every planned inspection viewpoint.",
    checks,
    corrections: [],
    completionBasis:
      "identity-and-composition and viewpoint-coverage are both current at this compiled revision.",
    complete: true,
  };
};

/**
 * A subject review reads the coverage the inspection actually published, so
 * every state of that fold is produced by a real sweep rather than asserted.
 *
 * The fold has always been able to say `not-run`, `partial`, `stale` and
 * `reviewed`; until the receipts were published and read, none of them could
 * happen to a production. This pins each one to the sequence of events that
 * causes it, because a state nothing can reach is a state nobody maintains, and
 * because the difference between "not looked at" and "looked at, and wrong" is
 * the entire value of the surface.
 *
 * Scenarios:
 *
 * 1. Before anything inspects it, the subject is `indeterminate`, and that is
 *    the one case still carrying `review-subject-viewpoint-unsupported`.
 * 2. A sweep whose instrument refuses the first viewpoint still publishes its
 *    plan, so the review then reads a standing denominator with no observation
 *    and reports `not-run`, which is a different fact from `indeterminate`.
 * 3. A complete sweep makes the same review report `reviewed` over the same
 *    plan the inspection itself folded.
 * 4. Replacing one observation's bytes withdraws exactly that viewpoint, so the
 *    review reports `partial` and names the one id that went missing.
 * 5. Recompiling the reviewed model moves the compiled revision, so every
 *    standing receipt is `stale` and none of them counts as observed.
 * 6. Sweeping the current revision again reaches reviewed, which is the state
 *    under which a completion is accepted; withdrawing nine of the twelve
 *    pictures reopens the gate, which then names every unobserved id, and a
 *    target resolving no subject at all is answered by the missing target
 *    alone rather than by coverage numbers about nothing.
 * 7. Through all of it the axes stay apart: every artifact is published under
 *    the inspection root, the resolved unit keeps refusing delivery-evidence
 *    eligibility, and `prepareReview` offers a subject target no frame evidence
 *    at all even while its pictures exist on disk.
 */
export const test_mcp_subject_review_viewpoint_plan_gap =
  async (): Promise<void> => {
    const fixture = productionFixture();
    try {
      const project = AutoMovieProductionProject.open(fixture.root);
      const compiler = new AutoMovieProductionCompiler(project);
      if (
        productionCompileSucceeded(
          "subject review coverage fixture",
          compiler.compile({ scope: "source" }),
        ) === false
      )
        throw new Error("The subject-review coverage fixture did not compile.");
      const services = openAutoMovieProduction({
        projectRoot: fixture.root,
        productionId: "fixture-film",
      });
      const application = new AutoMovieApplication({
        projectRoot: fixture.root,
      });
      application.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
      application.getGuideDocument({ name: "REVIEW" });
      application.getGuideDocument({ name: "REVIEW_SUBJECT" });
      const coverageOf = (): {
        state: string;
        planned: number;
        observed: string[];
        missing: string[];
        stale: string[];
        unsupported: number;
        frames: number;
      } => {
        const prepared = application.prepareReview({
          target: TARGET,
        });
        const coverage = prepared.subjectReview?.coverage;
        if (coverage === undefined)
          throw new Error("The reviewed subject resolved no review unit.");
        return {
          state: coverage.state,
          planned: coverage.planned.length,
          observed: [...coverage.observed],
          missing: [...coverage.missing],
          stale: [...coverage.stale],
          unsupported: prepared.diagnostics.filter(
            (diagnostic) =>
              diagnostic.code === "review-subject-viewpoint-unsupported",
          ).length,
          frames: prepared.frames.length,
        };
      };

      const untouched = coverageOf();
      TestValidator.equals(
        "a subject nothing inspected is indeterminate and says so once",
        {
          state: untouched.state,
          planned: untouched.planned,
          unsupported: untouched.unsupported,
        },
        { state: "indeterminate", planned: 0, unsupported: 1 },
      );

      const refused = await new AutoMovieProductionSubjectInspectionService(
        failingInstrument,
      ).inspect(services, { shot: "opening", subject: SUBJECT });
      TestValidator.predicate(
        "an instrument that refuses still leaves the plan it published",
        refused.inspected === false,
      );
      const notRun = coverageOf();
      TestValidator.equals(
        "a published plan with no observation is not-run, not indeterminate",
        {
          state: notRun.state,
          observed: notRun.observed,
          unsupported: notRun.unsupported,
          denominator: notRun.planned !== 0,
          missingAll: notRun.missing.length === notRun.planned,
        },
        {
          state: "not-run",
          observed: [],
          unsupported: 0,
          denominator: true,
          missingAll: true,
        },
      );

      const swept = await new AutoMovieProductionSubjectInspectionService(
        recordingInstrument().adapter,
      ).inspect(services, { shot: "opening", subject: SUBJECT });
      if (swept.coverage === null || swept.revision === null)
        throw new Error(
          `The instrumented sweep produced no coverage: ${JSON.stringify(
            swept.diagnostics,
          )}`,
        );
      const reviewed = coverageOf();
      TestValidator.equals(
        "a wholly observed plan is reviewed on both surfaces at one revision",
        {
          state: reviewed.state,
          missing: reviewed.missing,
          stale: reviewed.stale,
          unsupported: reviewed.unsupported,
          agrees:
            reviewed.observed.length === swept.coverage.observed.length &&
            reviewed.planned === swept.coverage.planned.length,
        },
        {
          state: "reviewed",
          missing: [],
          stale: [],
          unsupported: 0,
          agrees: true,
        },
      );

      const withdrawn = swept.views[1]!;
      fs.writeFileSync(
        path.join(fixture.root, ...withdrawn.path.split("/")),
        inspectionPng(withdrawn.width, withdrawn.height + 1),
      );
      const partial = coverageOf();
      TestValidator.equals(
        "replacing one picture withdraws exactly that viewpoint",
        {
          state: partial.state,
          missing: partial.missing,
          observed: partial.observed.length,
          unsupported: partial.unsupported,
        },
        {
          state: "partial",
          missing: [withdrawn.viewpoint],
          observed: reviewed.observed.length - 1,
          unsupported: 0,
        },
      );

      const recipe = project.design({
        kind: "model",
        id: "soloist",
      }) as IAutoMovieModelRecipe;
      const mutation = project.setModelRecipe(recolouredModelRecipe(recipe));
      if (mutation.accepted === false)
        throw new Error(
          `The subject-coverage model mutation was refused: ${JSON.stringify(
            mutation.diagnostics,
          )}`,
        );
      if (
        productionCompileSucceeded(
          "changed subject coverage fixture",
          compiler.compile({ scope: "source" }),
        ) === false
      )
        throw new Error(
          "The changed subject-coverage fixture did not compile.",
        );
      const stale = coverageOf();
      TestValidator.equals(
        "a moved compiled revision makes every standing receipt stale",
        {
          state: stale.state,
          observed: stale.observed,
          missingAll: stale.missing.length === stale.planned,
          stale: stale.stale,
          unsupported: stale.unsupported,
        },
        {
          state: "stale",
          observed: [],
          missingAll: true,
          stale: partial.observed,
          unsupported: 0,
        },
      );

      const resweep = await new AutoMovieProductionSubjectInspectionService(
        recordingInstrument().adapter,
      ).inspect(services, {
        shot: "opening",
        subject: SUBJECT,
        azimuthCount: 12,
      });
      if (resweep.inspected === false)
        throw new Error(
          `The second sweep refused: ${JSON.stringify(resweep.diagnostics)}`,
        );
      const completable = application.prepareReview({ target: TARGET });
      const completed = application.submitReview(subjectWorksheet(completable));
      TestValidator.equals(
        "reviewed is the state under which a subject review may complete",
        {
          state: completable.subjectReview?.coverage.state,
          planned: completable.subjectReview?.coverage.planned.length,
          accepted: completed.accepted,
          stored: completed.state,
          diagnostics: completed.diagnostics,
        },
        {
          state: "reviewed",
          planned: resweep.plan.length,
          accepted: true,
          stored: "complete",
          diagnostics: [],
        },
      );

      const withheld = resweep.views.slice(0, 9);
      for (const view of withheld)
        fs.writeFileSync(
          path.join(fixture.root, ...view.path.split("/")),
          inspectionPng(view.width + 1, view.height),
        );
      const reopened = application.prepareReview({ target: TARGET });
      const refusedCompletion = application.submitReview(
        subjectWorksheet(reopened),
      );
      const gate = refusedCompletion.diagnostics.find(
        (diagnostic) =>
          diagnostic.code === "review-subject-coverage-incomplete",
      );
      TestValidator.equals(
        "withdrawing pictures reopens the gate and names every look it wants",
        {
          accepted: refusedCompletion.accepted,
          state: reopened.subjectReview?.coverage.state,
          missing: reopened.subjectReview?.coverage.missing.length,
          named: withheld.filter(
            (view) => gate?.message.includes(view.viewpoint) !== true,
          ).length,
          staleNone: gate?.message.includes("stale []") ?? false,
        },
        {
          accepted: false,
          state: "partial",
          missing: withheld.length,
          named: 0,
          staleNone: true,
        },
      );

      const absent = {
        kind: "subject",
        shot: "opening",
        subject: "space:no/such",
      } as const;
      const onAbsent = application.submitReview({
        ...subjectWorksheet(reopened),
        target: absent,
        preparedFingerprint: application.prepareReview({ target: absent })
          .fingerprint,
      });
      TestValidator.equals(
        "a target that resolves nothing is named missing, not lectured on coverage",
        {
          accepted: onAbsent.accepted,
          missing: onAbsent.diagnostics.some(
            (diagnostic) => diagnostic.code === "review-target-missing",
          ),
          coverage: onAbsent.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "review-subject-coverage-incomplete",
          ),
        },
        { accepted: false, missing: true, coverage: false },
      );

      const unit = reopened.subjectReview?.unit;
      TestValidator.equals(
        "inspection artifacts never enter the delivery axis",
        {
          published: swept.views
            .filter(
              (view) =>
                view.path.startsWith(
                  `${AUTOMOVIE_SUBJECT_INSPECTION_ROOT}/`,
                ) === false,
            )
            .map((view) => view.path)
            .sort(compareCodeUnits),
          owner: unit?.viewpointOwner,
          eligible: unit?.deliveryEvidenceEligible,
          framesWhileReviewed: reviewed.frames,
          framesWhileStale: stale.frames,
        },
        {
          published: [],
          owner: "inspection",
          eligible: false,
          framesWhileReviewed: 0,
          framesWhileStale: 0,
        },
      );
    } finally {
      fixture.dispose();
    }
  };
