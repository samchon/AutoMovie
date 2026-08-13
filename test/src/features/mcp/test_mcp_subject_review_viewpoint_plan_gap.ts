import {
  AUTOMOVIE_SUBJECT_INSPECTION_ROOT,
  AutoMovieApplication,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionSubjectInspectionService,
  compareCodeUnits,
  openAutoMovieProduction,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";
import { recordingInstrument } from "./test_mcp_inspect_subject";

const SUBJECT = "prototype:automovie:model:soloist";

const UNSUPPORTED =
  "inspectSubject is the inspection-owned viewpoint plan source: it derives a turntable from a subject's own measured extent, draws every viewpoint in it, and reports its own coverage, refusing outright any subject it cannot frame. What it does not do is publish a record prepareReview can read, because the images it leaves behind state no compiled revision and no plan. So no subject-view observation is recoverable here, the plan folded by this surface stays empty, coverage is indeterminate, and this review cannot be completed. Record what you inspected structurally and leave the viewpoint range explicitly unobserved. Correction feedback does not authorize deleting the artifact.";

/**
 * The inspection surface can look at a compiled subject while the review
 * surface still folds an empty plan, and the review warning says exactly that
 * instead of denying that any plan source exists.
 *
 * This pins the boundary between two surfaces rather than one function's
 * output, because the boundary is the thing that goes quietly wrong. An agent
 * holding an `inspectSubject` coverage record reading `reviewed` and a
 * `prepareReview` coverage record reading `indeterminate` for the same subject
 * at the same compiled revision has to be told which of the two is a statement
 * about evidence, and the diagnostic message is where it is told. `submitReview`
 * requires that message quoted back verbatim, so it is a contract string and is
 * asserted here as one.
 *
 * Scenarios:
 *
 * 1. A recording instrument answers every planned viewpoint, so `inspectSubject`
 *    reports a non-empty plan wholly observed at the current revision.
 * 2. `prepareReview` on the same subject, at the same compiled revision, still
 *    folds an empty plan and reports `indeterminate` with an empty planned,
 *    observed, missing and stale set.
 * 3. The reason is measurable rather than editorial: everything the inspection
 *    published is a PNG under the inspection root, no published name states the
 *    compiled revision, and nothing beside the images records the plan, so no
 *    observation the fold admits can be recovered from what is on disk.
 * 4. The warning carries the exact contract message, including the appended
 *    correction-safety sentence, so a worksheet may cite it unchanged.
 */
export const test_mcp_subject_review_viewpoint_plan_gap =
  async (): Promise<void> => {
    const fixture = productionFixture();
    try {
      const project = AutoMovieProductionProject.open(fixture.root);
      if (
        productionCompileSucceeded(
          "subject review plan gap fixture",
          new AutoMovieProductionCompiler(project).compile({ scope: "source" }),
        ) === false
      )
        throw new Error("The subject-review plan-gap fixture did not compile.");
      const services = openAutoMovieProduction({
        projectRoot: fixture.root,
        productionId: "fixture-film",
      });

      const swept = await new AutoMovieProductionSubjectInspectionService(
        recordingInstrument().adapter,
      ).inspect(services, { shot: "opening", subject: SUBJECT });
      if (swept.coverage === null || swept.revision === null)
        throw new Error(
          `The instrumented sweep produced no coverage: ${JSON.stringify(
            swept.diagnostics,
          )}`,
        );
      TestValidator.predicate(
        "the inspection folds a non-empty plan it wholly observed",
        swept.inspected === true &&
          swept.coverage.state === "reviewed" &&
          swept.coverage.planned.length !== 0 &&
          swept.coverage.observed.length === swept.coverage.planned.length,
      );

      const application = new AutoMovieApplication({
        projectRoot: fixture.root,
      });
      application.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
      application.getGuideDocument({ name: "REVIEW_SUBJECT" });
      const prepared = application.prepareReview({
        target: { kind: "subject", shot: "opening", subject: SUBJECT },
      });
      TestValidator.equals(
        "the review surface folds no plan for the subject the inspection just swept",
        {
          revision: prepared.subjectReview?.unit.description.revision,
          coverage: prepared.subjectReview?.coverage,
          warnings: prepared.diagnostics
            .filter(
              (diagnostic) =>
                diagnostic.code === "review-subject-viewpoint-unsupported",
            )
            .map((diagnostic) => ({
              category: diagnostic.category,
              message: diagnostic.message,
            })),
        },
        {
          revision: swept.revision,
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
          warnings: [{ category: "warning", message: UNSUPPORTED }],
        },
      );

      const published = swept.views.map((view) => view.path);
      const directory = path.posix.dirname(published[0]!);
      const entries = fs
        .readdirSync(path.join(fixture.root, ...directory.split("/")))
        .sort(compareCodeUnits);
      TestValidator.equals(
        "nothing the inspection published states the revision its images were drawn at",
        {
          root: directory.startsWith(`${AUTOMOVIE_SUBJECT_INSPECTION_ROOT}/`),
          missing: published.filter(
            (relative) =>
              fs.existsSync(path.join(fixture.root, ...relative.split("/"))) ===
              false,
          ),
          images: entries.length,
          beside: entries.filter((entry) => entry.endsWith(".png") === false),
          naming: entries.filter((entry) => entry.includes(swept.revision!)),
        },
        {
          root: true,
          missing: [],
          images: swept.views.length,
          beside: [],
          naming: [],
        },
      );
    } finally {
      fixture.dispose();
    }
  };
