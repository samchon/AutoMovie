import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  type AutoMovieProductionSubjectInspection,
  AutoMovieProductionSubjectInspectionService,
  openAutoMovieProduction,
  readAutoMovieSubjectInspection,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

const SUBJECT = "prototype:automovie:model:soloist";

/** The reason a world-staging page gives for a model-space subject. */
const REASON =
  "prototype:automovie:model:soloist is measured in model space and stands " +
  'nowhere in shot "opening".';

/** An instrument that answers, working, that it cannot frame this subject. */
const refusingInstrument = (): {
  adapter: AutoMovieProductionSubjectInspection;
  calls: string[];
} => {
  const calls: string[] = [];
  return {
    calls,
    adapter: (input) => {
      calls.push(input.viewpoint);
      return Promise.resolve({ refused: REASON });
    },
  };
};

/** An instrument that fails, which is the opposite claim about itself. */
const throwingInstrument = (): {
  adapter: AutoMovieProductionSubjectInspection;
  calls: string[];
} => {
  const calls: string[] = [];
  return {
    calls,
    adapter: (input) => {
      calls.push(input.viewpoint);
      return Promise.reject(new Error(REASON));
    },
  };
};

/**
 * An instrument that cannot frame a subject is answered as an unsupported
 * viewpoint range, and an instrument that failed is still answered as a
 * failure.
 *
 * The two are opposite claims about the instrument and they were one answer
 * before this. Telling a client to correct an instrument that is working sends
 * it to the one place the fault is not, and the shipped host reads a thrown
 * error as proof its page is unusable, so it discards a staged scene that is
 * intact: measured on the completed fixture, one model-space subject mid-sweep
 * cost the next subject a whole scene rebuild, which is the cost `#1956` exists
 * to remove.
 *
 * Scenarios:
 *
 * 1. An instrument answering `{ refused }` refuses the request under
 *    `review-subject-viewpoint-unsupported`, quotes the instrument's own reason,
 *    and names the subject the caller asked for.
 * 2. The plan is still published, so the denominator a later coverage read
 *    measures against stands with zero observations behind it rather than
 *    vanishing into a clean pass over an empty population.
 * 3. The refusal is taken on the first planned viewpoint, so a subject the
 *    instrument cannot frame costs one round trip and not one per viewpoint.
 * 4. The negative twin: an instrument that throws for the same subject at the
 *    same revision is still `capture-failed`, so the two answers did not
 *    collapse into one.
 * 5. Both keep `inspected` false, `deliveryEvidence` false, and an empty view
 *    set, so neither refusal can be read as an observation.
 */
export const test_production_inspect_subject_instrument_refusal =
  async (): Promise<void> => {
    const fixture = productionFixture();
    try {
      const project = AutoMovieProductionProject.open(fixture.root);
      const compiled = new AutoMovieProductionCompiler(project).compile({
        scope: "source",
      });
      if (
        productionCompileSucceeded("instrument refusal fixture", compiled) ===
        false
      )
        throw new Error("The instrument refusal fixture did not compile.");
      const services = openAutoMovieProduction({
        projectRoot: fixture.root,
        productionId: "fixture-film",
      });
      const target = { shot: "opening", subject: SUBJECT };

      const refusing = refusingInstrument();
      const refused = await new AutoMovieProductionSubjectInspectionService(
        refusing.adapter,
      ).inspect(services, target);

      const published = readAutoMovieSubjectInspection({
        projectRoot: fixture.root,
        productionId: "fixture-film",
        shot: "opening",
        subject: SUBJECT,
        plan: refused.planRecord!,
        runtimeIdentity: null,
      });

      TestValidator.equals(
        "a working instrument that cannot frame a subject reports the range unsupported",
        {
          code: refused.diagnostics[0]?.code,
          quotesTheReason: (refused.diagnostics[0]?.message ?? "").includes(
            REASON,
          ),
          namesTheSubject: (refused.diagnostics[0]?.message ?? "").includes(
            SUBJECT,
          ),
          inspected: refused.inspected,
          deliveryEvidence: refused.deliveryEvidence,
          views: refused.views.length,
          planStands: refused.plan.length,
          asked: refusing.calls.length,
          publishedPlan: published.planned.length,
          publishedObservations: published.observations.length,
          terminal: published.history.at(-1)?.verdict,
        },
        {
          code: "review-subject-viewpoint-unsupported",
          quotesTheReason: true,
          namesTheSubject: true,
          inspected: false,
          deliveryEvidence: false,
          views: 0,
          // The default turntable, published before the first viewpoint was
          // asked for and left standing as the denominator.
          planStands: 6,
          publishedPlan: 6,
          publishedObservations: 0,
          terminal: "unsupported",
          // One round trip, not one per planned viewpoint.
          asked: 1,
        },
      );

      const throwing = throwingInstrument();
      const failed = await new AutoMovieProductionSubjectInspectionService(
        throwing.adapter,
      ).inspect(services, target);

      TestValidator.equals(
        "an instrument that threw is still a failure of the instrument",
        {
          code: failed.diagnostics[0]?.code,
          inspected: failed.inspected,
          deliveryEvidence: failed.deliveryEvidence,
          views: failed.views.length,
          asked: throwing.calls.length,
          correctsTheInstrument: (
            failed.diagnostics[0]?.message ?? ""
          ).includes("Correct the subject inspection instrument"),
        },
        {
          code: "capture-failed",
          inspected: false,
          deliveryEvidence: false,
          views: 0,
          asked: 1,
          correctsTheInstrument: true,
        },
      );

      TestValidator.predicate(
        "the two refusals do not share a diagnostic code",
        refused.diagnostics[0]?.code !== failed.diagnostics[0]?.code,
      );
    } finally {
      fixture.dispose();
    }
  };
