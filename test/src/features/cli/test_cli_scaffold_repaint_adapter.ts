import type { AutoMovieProductionShotRepaint } from "@automovie/interface";
import { renderScaffold } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

const adapterPath = path.resolve(
  __dirname,
  "../../../../packages/template/scaffold/scripts/repaintAdapter.ts",
);

const adapter = require(adapterPath) as {
  repaintProductionShot: AutoMovieProductionShotRepaint;
};

/**
 * The shipped repaint adapter refuses by name instead of fabricating output.
 *
 * A generated project selects `visualDelivery: "repainted"` on its design
 * record, and something then has to draw that rendition. AutoMovie ships no
 * model, so the scaffold hands over an adapter that throws. Leaving it as it
 * stands is a legitimate state rather than an unfinished one, and the refusal is
 * what makes that state honest: a deterministic delivery never reaches this
 * function, and a repainted one stops here with a message naming the file to
 * implement and the alternative setting, rather than publishing bytes nobody
 * drew.
 *
 * The bytes are checked against the ones a generated project actually receives.
 * Requiring the repository module proves the behaviour; comparing it with the
 * rendered inventory proves the shipped copy is that same reviewed module, which
 * a test that only read a temporary copy would leave open.
 *
 * Scenarios:
 *
 * 1. Calling the adapter with an ordinary repaint request throws, and the
 *    message names `scripts/repaintAdapter.ts`, the export to implement, and
 *    the `deterministic` setting that avoids needing one.
 * 2. The refusal states that no output was fabricated, so a caller cannot read
 *    it as a transient failure worth retrying.
 * 3. The rendered scaffold ships this exact module at
 *    `scripts/repaintAdapter.ts`, byte-identical to the one exercised above.
 */
export const test_cli_scaffold_repaint_adapter = (): void => {
  let refusal: unknown;
  try {
    void adapter.repaintProductionShot({
      controls: [],
      parameters: {},
      references: [],
      shot: "opening",
    } as unknown as Parameters<AutoMovieProductionShotRepaint>[0]);
  } catch (error) {
    refusal = error;
  }
  const message = refusal instanceof Error ? refusal.message : String(refusal);
  const rendered = renderScaffold({ name: "repaint-adapter-probe" });
  TestValidator.equals(
    "the shipped repaint adapter refuses by name and ships as one module",
    namedFacts([
      ["threw", () => refusal instanceof Error],
      ["namesTheFile", () => message.includes("scripts/repaintAdapter.ts")],
      ["namesTheExport", () => message.includes("repaintProductionShot")],
      [
        "namesTheAlternative",
        () => message.includes('set visualDelivery to "deterministic"'),
      ],
      [
        "refusesToFabricate",
        () => message.includes("will not fabricate diffusion output"),
      ],
      [
        "shipsTheReviewedModule",
        () =>
          rendered["scripts/repaintAdapter.ts"] ===
          fs.readFileSync(adapterPath, "utf8").replaceAll("\r\n", "\n"),
      ],
    ]),
    {
      threw: true,
      namesTheFile: true,
      namesTheExport: true,
      namesTheAlternative: true,
      refusesToFabricate: true,
      shipsTheReviewedModule: true,
    },
  );
};
