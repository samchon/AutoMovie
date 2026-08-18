import {
  AutoMovieApplication,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  inspectAutoMovieProduction,
  openAutoMovieProduction,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { recordingCapture } from "./captureHost";
import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

/**
 * A render entry says what it was made for, and whether the design still
 * carries it.
 *
 * The entry stated `path` and `current` and nothing else. `current: false` is
 * the ordinary result of iterating — the bundle no longer matches its inputs —
 * and it is also what a bundle rendered for a target the design has since
 * dropped reports. Those are not the same fact and only one of them is anybody's
 * to act on.
 *
 * A `#1954` production measured the cost. Its inspection held **42** render
 * entries, **39** of them `current: false`: thirty-eight superseded renders of
 * shots that still exist, and **one** render of a shot the design no longer
 * carries. Separating them meant parsing a shot id out of a directory name and
 * diffing it against the compile manifest by hand, which is what its driver did.
 * The path spells the target, and spelling is not addressing.
 *
 * `owned` is an accusation, so it is only made where ownership was resolved. A
 * bundle whose manifest cannot be read reports owned rather than unowned,
 * because failing to open a file is not evidence that its work is garbage. The
 * switch over target kinds is exhaustive rather than defaulted for the same
 * reason: a new kind should fail to compile here instead of silently reporting
 * every bundle of that kind as unowned.
 *
 * Scenarios:
 *
 * 1. A captured asset bundle names its own target and reports `owned`, so a
 *    consumer can address the bundle's subject without parsing its path.
 * 2. Deleting that model's design record leaves the bundle on disk and flips
 *    `owned` to false while `target` still names what it was for. Nothing is
 *    removed: the surface says what is there, and the reader decides.
 * 3. A `manifest.json` that cannot be verified reports `target: null` with
 *    `owned` **true**. This is the direction that matters — the opposite
 *    default would accuse every unreadable bundle of being garbage — and it is
 *    asserted rather than assumed because the safe answer and the bug produce
 *    the same value on every other row.
 */
export const test_mcp_render_target_ownership = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    if (
      productionCompileSucceeded("render ownership fixture", compiled) === false
    )
      throw new Error("The render-ownership fixture did not compile.");

    const host = recordingCapture();
    const application = new AutoMovieApplication({
      projectRoot: fixture.root,
      capture: host.adapter,
    });
    application.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    application.getGuideDocument({ name: "CAPTURE_FRAME" });
    const captured = await application.captureFrame({
      target: {
        kind: "asset",
        productionId: "fixture-film",
        id: "soloist",
        angleDeg: 0,
        elevationDeg: 15,
        pose: "rest",
        pass: "beauty",
      },
    });
    if (captured.captured === false)
      throw new Error("The asset view did not capture.");

    const inspect = () =>
      inspectAutoMovieProduction(
        openAutoMovieProduction({
          projectRoot: fixture.root,
          productionId: "fixture-film",
        }),
      ).renders;

    const before = inspect();
    const owning = before.find(
      (entry) =>
        entry.target?.kind === "asset" && entry.target.id === "soloist",
    );

    TestValidator.equals(
      "a render entry names its own target rather than spelling it in a path",
      namedFacts([
        ["the captured bundle is listed", () => owning !== undefined],
        // The whole point of the field: addressable without parsing.
        [
          "and states the target it was made for",
          () =>
            owning?.target?.kind === "asset" && owning.target.id === "soloist",
        ],
        ["which the design still carries", () => owning?.owned === true],
      ]),
      {
        "the captured bundle is listed": true,
        "and states the target it was made for": true,
        "which the design still carries": true,
      },
    );

    // The record the model is derived from. Removing it is what an author does
    // when a subject leaves the production, and the bundle stays behind.
    const record = path.join(
      fixture.root,
      project.designRecordPath({ kind: "model", id: "soloist" }),
    );
    fs.rmSync(record);

    const after = inspect();
    const orphan = after.find((entry) => entry.path === owning?.path);

    TestValidator.equals(
      "a bundle whose target the design dropped is named, kept, and marked unowned",
      namedFacts([
        // Kept. A ledger that deleted would be making the reader's decision.
        ["the bundle is still listed", () => orphan !== undefined],
        [
          "and still names what it was made for",
          () =>
            orphan?.target?.kind === "asset" && orphan.target.id === "soloist",
        ],
        ["but the design no longer carries it", () => orphan?.owned === false],
        [
          "and its bytes are untouched",
          () =>
            fs.existsSync(
              path.join(fixture.root, path.dirname(orphan?.path ?? "")),
            ) === true,
        ],
      ]),
      {
        "the bundle is still listed": true,
        "and still names what it was made for": true,
        "but the design no longer carries it": true,
        "and its bytes are untouched": true,
      },
    );

    // Beside the real bundle rather than at a guessed path: the render root is
    // production-scoped, so `renders/<anything>` would sit outside the walk and
    // the case would pass by never being seen.
    const unreadable = path.join(
      fixture.root,
      ...(owning?.path ?? "").split("/").slice(0, 2),
      "unreadable-bundle",
      "manifest.json",
    );
    fs.mkdirSync(path.dirname(unreadable), { recursive: true });
    fs.writeFileSync(unreadable, "{ this is not a bundle manifest }", "utf8");
    const broken = inspect().find((entry) =>
      entry.path.includes("unreadable-bundle"),
    );

    TestValidator.equals(
      "a bundle that cannot be read is not accused of being unowned",
      namedFacts([
        ["it is listed", () => broken !== undefined],
        ["with no target", () => broken?.target === null],
        // The fail-safe direction. Reversed, every unreadable bundle in every
        // production reads as garbage, and the row that means it is lost.
        ["and reported owned", () => broken?.owned === true],
      ]),
      {
        "it is listed": true,
        "with no target": true,
        "and reported owned": true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
