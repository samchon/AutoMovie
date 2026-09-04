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

/** Retained render bytes stay exact across the guarded manifest transaction. */
export const test_production_render_bundle_payload_races =
  async (): Promise<void> => {
    const fixture = productionFixture();
    try {
      const project = AutoMovieProductionProject.open(fixture.root);
      const compiled = new AutoMovieProductionCompiler(project).compile({
        scope: "source",
      });
      if (productionCompileSucceeded("render race fixture", compiled) === false)
        throw new Error("The render-race fixture did not compile.");
      const captured = await captureAutoMovieProductionFrame(
        new AutoMovieProductionContext(
          recordingCapture().adapter,
          fixture.root,
          undefined,
        ),
        {
          target: {
            kind: "asset",
            productionId: "fixture-film",
            id: "soloist",
            angleDeg: 0,
            elevationDeg: 15,
            pose: "rest",
            pass: "beauty",
          },
        },
      );
      if (captured.captured === false)
        throw new Error("The render-race fixture did not capture.");
      const relativeBundle = path.relative(
        project.renderRoot(),
        path.join(project.root, captured.receipt.bundle),
      );
      const manifestPath = path.join(
        project.root,
        captured.receipt.bundle,
        "manifest.json",
      );
      const manifest = project.verifiedRenderManifest(manifestPath);
      if (manifest === null)
        throw new Error("The captured render bundle did not reopen.");
      const framePath = path.join(
        project.root,
        captured.receipt.bundle,
        manifest.frames[0]!.path,
      );
      const original = fs.readFileSync(framePath);
      const outcomes: Record<string, boolean> = {};
      for (const [name, mutate] of [
        [
          "same-size mutation",
          () => {
            const changed = Buffer.from(original);
            changed[changed.length - 1] ^= 1;
            fs.writeFileSync(framePath, changed);
          },
        ],
        ["deletion", () => fs.rmSync(framePath)],
        [
          "recreation",
          () => {
            fs.rmSync(framePath);
            const changed = Buffer.from(original);
            changed[0] ^= 1;
            fs.writeFileSync(framePath, changed);
          },
        ],
      ] as const) {
        const current = AutoMovieProductionProject.open(fixture.root);
        const before = current.revision();
        let observations = 0;
        let refused = false;
        try {
          current.commitRenderBundle(
            relativeBundle,
            new Map(),
            manifest,
            () => {
              if (++observations === 2) mutate();
              return true;
            },
          );
        } catch (error) {
          refused =
            error instanceof Error &&
            error.message.includes("payload changed while its manifest");
        } finally {
          fs.writeFileSync(framePath, original);
        }
        const previousReopens =
          AutoMovieProductionProject.openReadOnly(
            fixture.root,
            "fixture-film",
          ).verifiedRenderManifest(manifestPath) !== null;
        const revisionRolledBack = current.revision() === before;
        const retry = AutoMovieProductionProject.open(
          fixture.root,
        ).commitRenderBundle(relativeBundle, new Map(), manifest, () => true);
        outcomes[name] =
          refused &&
          observations === 2 &&
          revisionRolledBack &&
          previousReopens &&
          retry === before + 1;
      }
      TestValidator.equals(
        "every retained-frame race rolls back and a clean retry succeeds",
        outcomes,
        {
          "same-size mutation": true,
          deletion: true,
          recreation: true,
        },
      );
    } finally {
      fixture.dispose();
    }
  };
