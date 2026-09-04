import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionSubjectInspectionService,
  openAutoMovieProduction,
  readAutoMovieSubjectInspection,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";
import { recordingInstrument } from "./test_production_inspect_subject";

const SUBJECT = "prototype:automovie:model:soloist";

/**
 * A file that is not there is answered as absent, on both sides of the receipt.
 *
 * The read side documents that "a picture that was deleted or replaced is not
 * an observation", and only the replaced half was ever pinned: a replaced
 * picture fails the digest, while a deleted one fails the read before any
 * digest exists. They are different branches and only one of them was carried.
 * The write side has the same shape one step earlier, where the compiled shot
 * the target names is itself missing.
 *
 * Both matter to coverage counting rather than to tidiness. An observation that
 * survived its own artifact would let a subject review report a viewpoint as
 * observed with nothing behind it, which is the fabricated pass the whole
 * refusal exists to prevent.
 *
 * Scenarios:
 *
 * 1. Inspecting a shot whose compiled artifact does not exist is refused as
 *    `capture-target-missing` before the instrument is asked to draw anything.
 * 2. A completed sweep reads back its full plan and every observation.
 * 3. Deleting one published picture drops exactly that observation and keeps
 *    the rest, and the plan stays whole, so coverage reads partial against the
 *    denominator it always had rather than passing over a smaller one.
 * 4. Deleting every picture leaves the plan standing with no observations at
 *    all, which is the honest `not-run` shape and never an empty pass.
 */
export const test_production_inspect_subject_absent_files =
  async (): Promise<void> => {
    const fixture = productionFixture();
    try {
      const project = AutoMovieProductionProject.open(fixture.root);
      const compiled = new AutoMovieProductionCompiler(project).compile({
        scope: "source",
      });
      if (
        productionCompileSucceeded("absent files fixture", compiled) === false
      )
        throw new Error("The absent files fixture did not compile.");
      const services = openAutoMovieProduction({
        projectRoot: fixture.root,
        productionId: "fixture-film",
      });
      const instrument = recordingInstrument();
      const inspection = new AutoMovieProductionSubjectInspectionService(
        instrument.adapter,
      );

      // The compiled shot the target names is not a file this project has, so the
      // read that would resolve the subject cannot even begin.
      const absentShot = await inspection.inspect(services, {
        shot: "no-such-shot",
        subject: SUBJECT,
      });
      const drawnForAbsentShot = instrument.calls.length;

      const swept = await inspection.inspect(services, {
        shot: "opening",
        subject: SUBJECT,
      });
      const readBack = (): ReturnType<typeof readAutoMovieSubjectInspection> =>
        readAutoMovieSubjectInspection({
          projectRoot: fixture.root,
          productionId: "fixture-film",
          shot: "opening",
          subject: SUBJECT,
          plan: swept.planRecord!,
          runtimeIdentity: swept.runtimeIdentity,
        });
      const whole = readBack();

      // Deleted rather than rewritten. A rewritten picture is refused by its
      // digest; a deleted one has to be refused by its absence, and that is the
      // branch nothing reached.
      fs.rmSync(path.join(fixture.root, ...swept.views[0]!.path.split("/")));
      const oneGone = readBack();

      for (const view of swept.views.slice(1))
        fs.rmSync(path.join(fixture.root, ...view.path.split("/")));
      const allGone = readBack();

      TestValidator.equals(
        "an absent artifact is absent rather than assumed, on the shot and on the picture",
        {
          absentShot: {
            code: absentShot.diagnostics[0]?.code,
            inspected: absentShot.inspected,
            plan: absentShot.plan.length,
            views: absentShot.views.length,
            drawn: drawnForAbsentShot,
          },
          whole: {
            planned: whole.planned.length,
            observations: whole.observations.length,
          },
          oneGone: {
            planned: oneGone.planned.length,
            observations: oneGone.observations.length,
            // The one still readable is not the one that was deleted.
            keptTheOthers:
              oneGone.observations.some(
                (observation) =>
                  observation.viewpoint === swept.views[0]!.viewpoint,
              ) === false,
          },
          allGone: {
            planned: allGone.planned.length,
            observations: allGone.observations.length,
          },
        },
        {
          absentShot: {
            code: "capture-target-missing",
            inspected: false,
            plan: 0,
            views: 0,
            drawn: 0,
          },
          whole: { planned: 6, observations: 6 },
          oneGone: { planned: 6, observations: 5, keptTheOthers: true },
          // The denominator survives its numerator, which is what makes the
          // honest incomplete reading possible at all.
          allGone: { planned: 6, observations: 0 },
        },
      );
    } finally {
      fixture.dispose();
    }
  };
