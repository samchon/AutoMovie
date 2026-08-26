import {
  AutoMovieProductionCompiler,
  AutoMovieProductionContext,
  AutoMovieProductionProject,
  captureAutoMovieProductionFrame,
} from "@automovie/production";

import { recordingCapture } from "./captureHost";
import { productionFixture } from "./productionFixtures";

/**
 * Measure whether one capture still costs the whole bundle.
 *
 * Not a test: it prints wall-clock numbers for a pull-request body, because a
 * timing assertion in the suite is a flake waiting for a slower machine. Run it
 * with `ttsx -P test/tsconfig.json test/src/features/mcp/measureBundleGrowth.ts`.
 */
const main = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    if (compiled.success === false)
      throw new Error("The growth fixture did not compile.");
    const host = recordingCapture();
    const context = new AutoMovieProductionContext(host.adapter, fixture.root);

    const spans: number[] = [];
    const total = 40;
    for (let index = 0; index < total; index++) {
      const started = process.hrtime.bigint();
      const output = await captureAutoMovieProductionFrame(context, {
        target: {
          kind: "shot",
          productionId: "fixture-film",
          id: "opening",
          time: index / 24,
        },
      });
      if (output.captured === false)
        throw new Error(
          `capture ${index} refused: ${JSON.stringify(output.diagnostics)}`,
        );
      spans.push(Number(process.hrtime.bigint() - started) / 1_000_000);
    }
    const mean = (values: readonly number[]): number =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    console.log(
      JSON.stringify(
        {
          frames: total,
          firstTenMs: Math.round(mean(spans.slice(0, 10))),
          lastTenMs: Math.round(mean(spans.slice(-10))),
          growth:
            Math.round(
              (mean(spans.slice(-10)) / mean(spans.slice(0, 10))) * 100,
            ) / 100,
        },
        null,
        2,
      ),
    );
  } finally {
    fixture.dispose();
  }
};

void main();
