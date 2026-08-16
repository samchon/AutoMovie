import {
  AutoMovieProductionFrameCapture,
  IAutoMovieCaptureTurntable,
  IAutoMovieReviewTarget,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFactsAsync, rejectsError } from "../internal/predicates";
import { recordingCapture } from "./captureHost";
import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

const ASSET = "soloist";

/** The exact views an asset review is judged from, in canonical order. */
const REQUIRED_VIEWS = [
  "turntable-front",
  "turntable-right",
  "turntable-back",
  "turntable-left",
  "top-outline",
  "rig-rom-extremes",
];

/** The angle, elevation, pose, and pass the host was actually asked for. */
const requestedView = (
  input: Parameters<AutoMovieProductionFrameCapture>[0],
): string =>
  input.target.kind === "asset"
    ? `${input.target.angleDeg}/${input.target.elevationDeg}/${input.target.pose}/${input.pass ?? "beauty"}`
    : `shot:${input.target.id}`;

/** The view ledger, reduced to what a caller reads it for. */
interface ITurntableLedger {
  captured: boolean;
  productionId: string;
  reviewTarget: IAutoMovieReviewTarget | null;
  views: string[];
  committed: number;
}

const ledger = (output: IAutoMovieCaptureTurntable): ITurntableLedger => ({
  captured: output.captured,
  productionId: output.productionId,
  reviewTarget: output.reviewTarget,
  views: output.views.map((view) => view.id),
  committed: output.views.filter((view) => view.frame !== null).length,
});

/**
 * One call captures the complete view set an asset review is judged from.
 *
 * The required views live in the review contract, and before this tool the only
 * way to produce them was to reproduce that list by hand through `captureFrame`.
 * A reviewer who dropped one angle still recorded coverage of the asset, and the
 * side nobody opened is exactly where the defect survives. So the tool and the
 * review read one declaration, and this case holds them to it: what the sweep
 * commits is what `prepareReview` then counts as current asset evidence.
 *
 * Scenarios:
 *
 * 1. The tool is knowledge-gated before it is anything else: with no session
 *    credit it refuses naming the overall contract and the capture document as
 *    ordered recovery steps rather than as a payload complaint.
 * 2. An asset the compiler registry does not own is refused by name before any
 *    view is opened, so nothing is captured against a target that is not there.
 * 3. A registered asset sweeps its whole required set: every canonical view
 *    commits a frame, the host is asked for exactly those angles, poses, and
 *    passes, and `captured` is true.
 * 4. Those committed frames are what the asset review reads. `prepareReview`
 *    returns one current frame per required view and reports no missing
 *    evidence, which is the agreement between producer and consumer that the
 *    shared declaration exists to keep.
 * 5. A host with no capture adapter refuses every view separately: the ledger
 *    keeps the full required set with a null frame each, and each refusal is
 *    attributable to its own view rather than to the asset as a whole.
 */
export const test_mcp_capture_turntable = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    const compiled = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    if (productionCompileSucceeded("capture turntable fixture", compiled))
      TestValidator.equals("the turntable fixture compiles", true, true);
    else throw new Error("The capture-turntable fixture did not compile.");

    const host = recordingCapture();
    const application = new AutoMovieApplication({
      projectRoot: fixture.root,
      capture: host.adapter,
    });

    TestValidator.equals(
      "a turntable is knowledge-gated before it is a payload check",
      await namedFactsAsync([
        [
          "ungatedRefused",
          () =>
            rejectsError(
              () => application.captureTurntable({ asset: ASSET }),
              [
                "captureTurntable is knowledge-gated",
                'getGuideDocument({ name: "AUTOMOVIE_OVERALL" })',
                'getGuideDocument({ name: "CAPTURE_FRAME" })',
                "missing-knowledge precondition, not a payload validation error",
              ],
            ),
        ],
        [
          "overallAloneRefused",
          () => {
            application.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
            return rejectsError(
              () => application.captureTurntable({ asset: ASSET }),
              ['getGuideDocument({ name: "CAPTURE_FRAME" })', "1/2"],
            );
          },
        ],
      ]),
      { ungatedRefused: true, overallAloneRefused: true },
    );
    application.getGuideDocument({ name: "CAPTURE_FRAME" });

    const unregistered = await application.captureTurntable({
      asset: "no-such-model",
    });
    TestValidator.equals(
      "an unregistered asset is refused before any view is opened",
      {
        ...ledger(unregistered),
        codes: unregistered.diagnostics.map((entry) => entry.code),
        targets: unregistered.diagnostics.map((entry) => entry.target),
        hostCalls: host.calls.length,
      },
      {
        captured: false,
        productionId: "fixture-film",
        reviewTarget: null,
        views: [],
        committed: 0,
        codes: ["capture-target-missing"],
        targets: ["no-such-model"],
        hostCalls: 0,
      },
    );

    const swept = await application.captureTurntable({ asset: ASSET });
    TestValidator.equals(
      "one call commits every view the asset review requires",
      {
        ...ledger(swept),
        diagnostics: swept.diagnostics,
        requested: host.calls.map(requestedView),
      },
      {
        captured: true,
        productionId: "fixture-film",
        reviewTarget: { kind: "asset", id: ASSET },
        views: REQUIRED_VIEWS,
        committed: REQUIRED_VIEWS.length,
        diagnostics: [],
        requested: [
          "0/15/rest/beauty",
          "90/15/rest/beauty",
          "180/15/rest/beauty",
          "270/15/rest/beauty",
          "0/65/rest/outline",
          "0/15/rom-extremes/beauty",
        ],
      },
    );

    application.getGuideDocument({ name: "REVIEW_ASSET" });
    const worksheet = application.prepareReview({
      target: { kind: "asset", id: ASSET },
    });
    TestValidator.equals(
      "the swept frames are what the asset review counts as current evidence",
      {
        frames: worksheet.frames.length,
        errors: worksheet.diagnostics
          .filter((entry) => entry.category === "error")
          .map((entry) => entry.code),
      },
      { frames: REQUIRED_VIEWS.length, errors: [] },
    );

    const hostless = new AutoMovieApplication({ projectRoot: fixture.root });
    hostless.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    hostless.getGuideDocument({ name: "CAPTURE_FRAME" });
    const refused = await hostless.captureTurntable({ asset: ASSET });
    TestValidator.equals(
      "a host with no capture adapter refuses each required view by name",
      {
        ...ledger(refused),
        codes: [...new Set(refused.diagnostics.map((entry) => entry.code))],
        targets: refused.diagnostics.map((entry) => entry.target),
      },
      {
        captured: false,
        productionId: "fixture-film",
        reviewTarget: { kind: "asset", id: ASSET },
        views: REQUIRED_VIEWS,
        committed: 0,
        codes: ["capture-host-unavailable"],
        targets: REQUIRED_VIEWS.map((view) => `${ASSET}#${view}`),
      },
    );
  } finally {
    fixture.dispose();
  }
};
