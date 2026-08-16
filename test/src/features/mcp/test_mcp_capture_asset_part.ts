import { IAutoMovieModel } from "@automovie/interface";
import {
  AutoMovieApplication,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { recordingCapture } from "./captureHost";
import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

const ASSET = "soloist";

/**
 * A turntable frames one compiled part on request, and that view stays a
 * diagnostic look rather than asset review coverage.
 *
 * Judging a mullion, a hinge, or a hand from a whole-model turntable is judging
 * a few dozen pixels, so the honest options were exporting a throwaway model or
 * accepting that the piece is never actually looked at. Framing the part
 * removes that choice. What it must not do is answer the review: the asset
 * review judges the silhouette of the whole model, and a part frame taken at a
 * required angle would otherwise close out the view the model itself owed.
 *
 * Scenarios:
 *
 * 1. A named part captures at production raster, and its receipt carries the
 *    part beside the angle, elevation, and pose, so the frame states which
 *    framing produced it rather than reading as another whole-model view.
 * 2. The host is asked for that exact part, which is what makes the page frame
 *    it rather than the model.
 * 3. Part frames at every required angle discharge no required asset view:
 *    `prepareReview` still reports the whole set as missing evidence.
 * 4. A part the compiled model does not carry is refused by name and lists the
 *    parts it does carry, so a misspelling is corrected from the refusal.
 */
export const test_mcp_capture_asset_part = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    if (productionCompileSucceeded("asset part fixture", compiled))
      TestValidator.equals("the asset part fixture compiles", true, true);
    else throw new Error("The asset-part fixture did not compile.");

    const model = JSON.parse(
      Buffer.from(project.readGeneratedFile(`models/${ASSET}.json`)).toString(
        "utf8",
      ),
    ) as IAutoMovieModel;
    const part = model.parts[0]?.id;
    if (part === undefined)
      throw new Error("The compiled fixture model carries no part to frame.");

    const host = recordingCapture();
    const application = new AutoMovieApplication({
      projectRoot: fixture.root,
      capture: host.adapter,
    });
    application.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    application.getGuideDocument({ name: "CAPTURE_FRAME" });

    const framed = await application.captureFrame({
      target: {
        kind: "asset",
        productionId: "fixture-film",
        id: ASSET,
        angleDeg: 0,
        elevationDeg: 15,
        pose: "rest",
        part,
      },
    });
    TestValidator.equals(
      "a part-framed capture states the part it framed",
      {
        captured: framed.captured,
        target: framed.receipt?.target,
        diagnostics: framed.diagnostics,
        requestedPart: host.calls.map((call) =>
          call.target.kind === "asset" ? call.target.part : null,
        ),
      },
      {
        captured: true,
        target: {
          kind: "asset",
          productionId: "fixture-film",
          id: ASSET,
          angleDeg: 0,
          elevationDeg: 15,
          pose: "rest",
          part,
          pass: "beauty",
        },
        diagnostics: [],
        requestedPart: [part],
      },
    );

    for (const angleDeg of [90, 180, 270])
      await application.captureFrame({
        target: {
          kind: "asset",
          productionId: "fixture-film",
          id: ASSET,
          angleDeg,
          elevationDeg: 15,
          pose: "rest",
          part,
        },
      });
    application.getGuideDocument({ name: "REVIEW_ASSET" });
    TestValidator.equals(
      "part views discharge no required asset review view",
      application.prepareReview({ target: { kind: "asset", id: ASSET } }).frames
        .length,
      0,
    );

    const unknown = await application.captureFrame({
      target: {
        kind: "asset",
        productionId: "fixture-film",
        id: ASSET,
        angleDeg: 0,
        elevationDeg: 15,
        pose: "rest",
        part: "no-such-part",
      },
    });
    TestValidator.equals(
      "an unknown part is refused with the parts the model does carry",
      {
        captured: unknown.captured,
        codes: unknown.diagnostics.map((entry) => entry.code),
        namesThePart: unknown.diagnostics.some((entry) =>
          entry.message.includes(`has no part "no-such-part"`),
        ),
        listsCurrentParts: unknown.diagnostics.some((entry) =>
          entry.message.includes(part),
        ),
      },
      {
        captured: false,
        codes: ["preview-input-invalid"],
        namesThePart: true,
        listsCurrentParts: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
