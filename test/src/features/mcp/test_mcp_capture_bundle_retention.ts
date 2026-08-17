import { IAutoMovieRenderBundleManifest } from "@automovie/interface";
import {
  AutoMovieApplication,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  compareCodeUnits,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

import { recordingCapture } from "./captureHost";
import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

/** A decodable frame whose bytes differ from anything the host produced. */
const tamperedPng = (width: number, height: number): Uint8Array => {
  const image = new PNG({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = (offset * 3) % 253;
    image.data[offset + 1] = (offset * 11) % 251;
    image.data[offset + 2] = (offset * 5) % 247;
    image.data[offset + 3] = 255;
  }
  return PNG.sync.write(image);
};

/**
 * Appending a frame leaves the bundle's existing frames on disk untouched, and
 * a frame whose bytes moved still costs the bundle its retained history.
 *
 * Appending used to rewrite every frame the bundle already held: each one was
 * read for its rollback copy, decoded to prove its raster again, and written
 * back beside the new one. One capture therefore cost the whole bundle and a
 * capture loop cost its square, measured at 1.7 seconds per frame at 139 frames
 * and 14 seconds at 163, which turned a 432-capture scenario into hours nobody
 * would run (`#1957`).
 *
 * The rewrite and the second decode proved nothing. Every retained frame is
 * already authenticated through the manifest's own receipt digest, which the
 * append re-reads anyway, and the place a frame becomes evidence re-reads its
 * bytes and refuses a digest that moved.
 *
 * Scenarios:
 *
 * 1. A second pass of one target lands in the same bundle and is appended to a
 *    manifest naming both frames.
 * 2. That append does not rewrite the first frame: its modification time is
 *    still the one the first capture left.
 * 3. A frame tampered with on disk breaks the manifest's authentication, so the
 *    next append retains nothing and the manifest names only what it wrote.
 *    Quietly keeping the tampered frame is the failure this trade is accused of.
 * 4. `prepareReview` then reports the required view that frame was meant to
 *    discharge as missing, which is where a moved byte has to surface.
 */
export const test_mcp_capture_bundle_retention = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    if (
      productionCompileSucceeded("bundle retention fixture", compiled) === false
    )
      throw new Error("The bundle-retention fixture did not compile.");

    const host = recordingCapture();
    const application = new AutoMovieApplication({
      projectRoot: fixture.root,
      capture: host.adapter,
    });
    application.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    application.getGuideDocument({ name: "CAPTURE_FRAME" });

    const target = {
      kind: "asset",
      productionId: "fixture-film",
      id: "soloist",
      angleDeg: 0,
      elevationDeg: 15,
      pose: "rest",
    } as const;
    const first = await application.captureFrame({
      target: { ...target, pass: "beauty" },
    });
    if (first.captured === false || first.frame === null)
      throw new Error("The first asset view did not capture.");
    const framePath = path.join(fixture.root, first.frame.path);
    const writtenAt = fs.statSync(framePath).mtimeMs;

    const manifestOf = (
      relativeBundle: string,
    ): IAutoMovieRenderBundleManifest =>
      JSON.parse(
        fs.readFileSync(
          path.join(fixture.root, relativeBundle, "manifest.json"),
          "utf8",
        ),
      ) as IAutoMovieRenderBundleManifest;

    const second = await application.captureFrame({
      target: { ...target, pass: "outline" },
    });
    const bundle = second.receipt?.bundle ?? "";
    TestValidator.equals(
      "an append keeps the bundle's frames and rewrites none of them",
      {
        captured: second.captured,
        sameBundle: bundle === first.receipt?.bundle,
        passes: manifestOf(bundle)
          .frames.map((frame) => frame.pass)
          .sort(compareCodeUnits),
        retainedFileUntouched: fs.statSync(framePath).mtimeMs === writtenAt,
      },
      {
        captured: true,
        sameBundle: true,
        passes: ["beauty", "outline"],
        retainedFileUntouched: true,
      },
    );

    fs.writeFileSync(
      framePath,
      tamperedPng(first.frame.width, first.frame.height),
    );
    const third = await application.captureFrame({
      target: { ...target, pass: "depth" },
    });
    TestValidator.equals(
      "a tampered frame costs the bundle its retained history rather than being kept",
      {
        captured: third.captured,
        passes: manifestOf(third.receipt?.bundle ?? "")
          .frames.map((frame) => frame.pass)
          .sort(compareCodeUnits),
      },
      { captured: true, passes: ["depth"] },
    );

    application.getGuideDocument({ name: "REVIEW" });
    application.getGuideDocument({ name: "REVIEW_ASSET" });
    const worksheet = application.prepareReview({
      target: { kind: "asset", id: "soloist" },
    });
    TestValidator.equals(
      "review reports the view the tampered frame was meant to discharge",
      {
        missingFront: worksheet.diagnostics.some(
          (entry) =>
            entry.code === "review-evidence-missing" &&
            entry.target.endsWith("turntable-front"),
        ),
        citesAnyFrameFromThatBundle: worksheet.frames.some(
          (frame) => frame.bundle === bundle,
        ),
      },
      { missingFront: true, citesAnyFrameFromThatBundle: false },
    );
  } finally {
    fixture.dispose();
  }
};
