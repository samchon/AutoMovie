import {
  AutoMovieApplication,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";
import { recordingInstrument } from "./test_mcp_inspect_subject";

const SUBJECT = "prototype:automovie:model:soloist";

/** Run one call and hand back whatever it did, refusal included. */
const attempt = async (
  run: () => Promise<unknown>,
): Promise<{ threw: boolean; message: string }> => {
  try {
    await run();
    return { threw: false, message: "" };
  } catch (error) {
    return {
      threw: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * `inspectSubject` reaches its service only through the knowledge gate, and the
 * gate is what a client actually meets.
 *
 * Every other case in this suite calls the inspection service directly, which
 * is the half below the gate. A client never has that half: it holds
 * `AutoMovieApplication`, and the first thing its call meets is a demand that
 * the guides have session credit. So the gate on this tool was carried by
 * nothing, and a tool whose gate is never exercised is a tool that can be
 * opened ungated without a single case going red.
 *
 * Scenarios:
 *
 * 1. Calling `inspectSubject` with no guide credit is refused, and the refusal
 *    names the tool and the exact reads that recover it rather than reporting
 *    which production failed to open.
 * 2. The refusal happens before any production work, so the instrument is never
 *    asked to draw and nothing is published.
 * 3. Crediting `AUTOMOVIE_OVERALL` alone is not enough, because the gate counts
 *    every guide the tool is bound to rather than any one of them.
 * 4. With both guides credited the same call serves, drawing the whole planned
 *    turntable through the same instrument, which is what proves the gate was
 *    the only thing standing in the way.
 */
export const test_mcp_inspect_subject_tool_surface =
  async (): Promise<void> => {
    const fixture = productionFixture();
    try {
      const project = AutoMovieProductionProject.open(fixture.root);
      const compiled = new AutoMovieProductionCompiler(project).compile({
        scope: "source",
      });
      if (
        productionCompileSucceeded("tool surface fixture", compiled) === false
      )
        return;
      const instrument = recordingInstrument();
      const application = new AutoMovieApplication({
        projectRoot: fixture.root,
        productionId: "fixture-film",
        inspect: instrument.adapter,
      });
      const call = (): Promise<unknown> =>
        application.inspectSubject({ shot: "opening", subject: SUBJECT });

      const ungated = await attempt(call);
      const drawnWhileUngated = instrument.calls.length;

      application.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
      const halfGated = await attempt(call);

      application.getGuideDocument({ name: "SUBJECT_INSPECTION" });
      const served = await application.inspectSubject({
        shot: "opening",
        subject: SUBJECT,
      });

      TestValidator.equals(
        "inspectSubject is served only once every guide it is gated on has credit",
        {
          ungated: {
            threw: ungated.threw,
            namesTheTool: ungated.message.includes("inspectSubject"),
            namesTheRecovery: ungated.message.includes("SUBJECT_INSPECTION"),
            drawn: drawnWhileUngated,
          },
          halfGated: {
            threw: halfGated.threw,
            // The one still missing is named; the one already credited is not
            // asked for again.
            namesTheRemaining: halfGated.message.includes("SUBJECT_INSPECTION"),
          },
          served: {
            inspected: served.inspected,
            views: served.views.length,
            planned: served.plan.length,
            deliveryEvidence: served.deliveryEvidence,
            diagnostics: served.diagnostics.length,
          },
        },
        {
          ungated: {
            threw: true,
            namesTheTool: true,
            namesTheRecovery: true,
            // Refused before the production is resolved, so nothing was drawn.
            drawn: 0,
          },
          halfGated: { threw: true, namesTheRemaining: true },
          served: {
            inspected: true,
            views: 6,
            planned: 6,
            deliveryEvidence: false,
            diagnostics: 0,
          },
        },
      );

      TestValidator.predicate(
        "the served call is the one that reached the instrument",
        instrument.calls.length === 6,
      );
    } finally {
      fixture.dispose();
    }
  };
