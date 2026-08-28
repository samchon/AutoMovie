import { IAutoMovieProductionDesign } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionContext,
  AutoMovieProductionProject,
  captureAutoMovieProductionFrame,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { recordingCapture } from "./captureHost";
import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

/** Shot capture owns the production crop while an asset turntable stays whole. */
export const test_production_delivery_crop_capture =
  async (): Promise<void> => {
    const fixture = productionFixture();
    try {
      const productionFile = path.join(
        fixture.root,
        "automovie",
        "design",
        "fixture-film",
        "production.json",
      );
      const production = JSON.parse(
        fs.readFileSync(productionFile, "utf8"),
      ) as IAutoMovieProductionDesign;
      production.frameFormat.crop = {
        left: 0.1,
        top: 0.2,
        right: 0.9,
        bottom: 0.8,
      };
      fs.writeFileSync(
        productionFile,
        `${JSON.stringify(production, null, 2)}\n`,
        "utf8",
      );

      const project = AutoMovieProductionProject.open(fixture.root);
      const compiled = new AutoMovieProductionCompiler(project).compile({
        scope: "source",
      });
      if (
        productionCompileSucceeded(
          "delivery crop capture fixture",
          compiled,
        ) === false
      )
        throw new Error("The delivery-crop capture fixture did not compile.");

      const host = recordingCapture();
      const context = new AutoMovieProductionContext(
        host.adapter,
        fixture.root,
        undefined,
      );
      const shot = await captureAutoMovieProductionFrame(context, {
        target: {
          kind: "shot",
          productionId: "fixture-film",
          id: "opening",
          time: 0,
        },
      });
      const asset = await captureAutoMovieProductionFrame(context, {
        target: {
          kind: "asset",
          productionId: "fixture-film",
          id: "soloist",
          angleDeg: 0,
        },
      });
      if (shot.receipt === null || asset.receipt === null)
        throw new Error("Delivery-crop capture did not produce both receipts.");
      const shotManifest = project.verifiedRenderManifest(
        path.join(fixture.root, shot.receipt.bundle, "manifest.json"),
      );
      const assetManifest = project.verifiedRenderManifest(
        path.join(fixture.root, asset.receipt.bundle, "manifest.json"),
      );
      TestValidator.equals(
        "shot adapter and manifest keep the crop while isolated asset capture omits it",
        {
          captured: [shot.captured, asset.captured],
          hostCrops: host.calls.map((call) => call.crop ?? null),
          manifestCrops: [shotManifest, assetManifest].map(
            (manifest) => manifest?.renderSpec.frameFormat.crop ?? null,
          ),
        },
        {
          captured: [true, true],
          hostCrops: [{ left: 0.1, top: 0.2, right: 0.9, bottom: 0.8 }, null],
          manifestCrops: [
            { left: 0.1, top: 0.2, right: 0.9, bottom: 0.8 },
            null,
          ],
        },
      );
    } finally {
      fixture.dispose();
    }
  };
