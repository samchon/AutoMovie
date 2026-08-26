import { IAutoMovieModelRecipe } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionContext,
  AutoMovieProductionProject,
  captureAutoMovieProductionFrame,
  captureAutoMovieProductionTurntable,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { recordingCapture } from "./captureHost";
import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

/** A rigless prop, so the required view set has no extreme-range pose in it. */
const CRATE: IAutoMovieModelRecipe = {
  id: "crate",
  role: "prop",
  archetype: "primitive-prop",
  parameters: { shape: "box", width: 0.8, height: 0.6, depth: 0.5 },
  palette: { body: "#8a6b3f" },
  lod: [{ tier: "hero", maxDistance: null, recipe: "crate" }],
  capabilities: [],
  attachments: [],
};

/**
 * Every capture refusal is attributable, and a rigless model owes five views
 * rather than six.
 *
 * The success paths were pinned by the two cases beside this one, which leaves
 * the answers a caller actually gets when something is wrong: an untrimmed
 * namespace, a production nobody registered, a target absent from the registry,
 * and a compiler registry that cannot be read at all. Each returns a different
 * diagnostic naming a different correction, and a test that never asks for one
 * is a test that would not notice them collapsing into each other.
 *
 * The rigless model is the other half of the required view set. `rom-extremes`
 * joins the set only for a model whose compiled form carries a skeleton, so a
 * prop that owed six views would be a prop whose review can never complete.
 *
 * Scenarios:
 *
 * 1. A shot target captures and receipts through the same path an asset does,
 *    which is the branch the asset cases never walk.
 * 2. `captureFrame` refuses an untrimmed production namespace, an unregistered
 *    production, and an unregistered target, each by its own code, and asks the
 *    host for nothing in any of them.
 * 3. `captureTurntable` refuses the same two production faults with the same
 *    codes, so one tool's namespace rules are not a second dialect.
 * 4. A rigless model's turntable is exactly the five rest-pose views.
 * 5. A registered asset whose compiled model is gone is refused by name rather
 *    than swept at the view set a rigged model would owe.
 * 6. With the compiler registry removed, both tools refuse as
 *    `capture-registry-unavailable` rather than capturing against a target
 *    nothing can currently prove.
 */
export const test_production_capture_refusals = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    fs.writeFileSync(
      path.join(
        fixture.root,
        "automovie",
        "design",
        "shared",
        "models",
        "crate.json",
      ),
      `${JSON.stringify(CRATE, null, 2)}\n`,
      "utf8",
    );
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    if (
      productionCompileSucceeded("capture refusal fixture", compiled) === false
    )
      throw new Error("The capture-refusal fixture did not compile.");

    const host = recordingCapture();
    const opened = new AutoMovieProductionContext(
      host.adapter,
      fixture.root,
      undefined,
    );
    const shot = await captureAutoMovieProductionFrame(opened, {
      target: {
        kind: "shot",
        productionId: "fixture-film",
        id: "opening",
        time: 0,
      },
    });
    TestValidator.equals(
      "a shot frame receipts through the same path an asset does",
      {
        captured: shot.captured,
        reviewTarget: shot.reviewTarget,
        target: shot.receipt?.target,
        diagnostics: shot.diagnostics,
      },
      {
        captured: true,
        reviewTarget: { kind: "shot", id: "opening" },
        target: {
          kind: "shot",
          productionId: "fixture-film",
          id: "opening",
          time: 0,
          pass: "beauty",
        },
        diagnostics: [],
      },
    );

    const asked = host.calls.length;
    const invalid = await captureAutoMovieProductionFrame(opened, {
      target: {
        kind: "asset",
        productionId: " fixture-film",
        id: "soloist",
        angleDeg: 0,
      },
    });
    const unregistered = await captureAutoMovieProductionFrame(opened, {
      target: {
        kind: "asset",
        productionId: "no-such-production",
        id: "soloist",
        angleDeg: 0,
      },
    });
    const missing = await captureAutoMovieProductionFrame(opened, {
      target: {
        kind: "asset",
        productionId: "fixture-film",
        id: "no-such-model",
        angleDeg: 0,
      },
    });
    TestValidator.equals(
      "each capture fault answers with its own code and asks the host for nothing",
      {
        codes: [invalid, unregistered, missing].map((output) =>
          output.diagnostics.map((entry) => entry.code).join(","),
        ),
        captured: [invalid, unregistered, missing].map(
          (output) => output.captured,
        ),
        productionIds: [invalid, unregistered, missing].map(
          (output) => output.productionId,
        ),
        hostCalls: host.calls.length - asked,
      },
      {
        codes: [
          "capture-production-invalid",
          "capture-production-unregistered",
          "capture-target-missing",
        ],
        captured: [false, false, false],
        productionIds: [" fixture-film", "no-such-production", "fixture-film"],
        hostCalls: 0,
      },
    );

    const turntableInvalid = await captureAutoMovieProductionTurntable(opened, {
      productionId: "fixture-film ",
      asset: "soloist",
    });
    const turntableUnregistered = await captureAutoMovieProductionTurntable(
      opened,
      {
        productionId: "no-such-production",
        asset: "soloist",
      },
    );
    TestValidator.equals(
      "a turntable refuses the same production faults by the same codes",
      [turntableInvalid, turntableUnregistered].map((output) => ({
        captured: output.captured,
        views: output.views.length,
        codes: output.diagnostics.map((entry) => entry.code),
      })),
      [
        { captured: false, views: 0, codes: ["capture-production-invalid"] },
        {
          captured: false,
          views: 0,
          codes: ["capture-production-unregistered"],
        },
      ],
    );

    const rigless = await captureAutoMovieProductionTurntable(opened, {
      asset: "crate",
    });
    TestValidator.equals(
      "a rigless model owes the five rest-pose views and no extreme-range one",
      {
        captured: rigless.captured,
        views: rigless.views.map((view) => view.id),
        poses: [...new Set(rigless.views.map((view) => view.pose))],
        diagnostics: rigless.diagnostics,
      },
      {
        captured: true,
        views: [
          "turntable-front",
          "turntable-right",
          "turntable-back",
          "turntable-left",
          "top-outline",
        ],
        poses: ["rest"],
        diagnostics: [],
      },
    );

    fs.rmSync(path.join(project.generatedRoot(), "models", "soloist.json"), {
      force: true,
    });
    const modelless = await captureAutoMovieProductionTurntable(opened, {
      asset: "soloist",
    });
    TestValidator.equals(
      "a registered asset with no readable compiled model is refused by name",
      {
        captured: modelless.captured,
        views: modelless.views.length,
        codes: modelless.diagnostics.map((entry) => entry.code),
        namesTheAsset: modelless.diagnostics.some((entry) =>
          entry.message.includes("no readable current compiled model"),
        ),
      },
      {
        captured: false,
        views: 0,
        codes: ["capture-target-missing"],
        namesTheAsset: true,
      },
    );

    fs.rmSync(path.join(project.generatedRoot(), "manifests", "compile.json"), {
      force: true,
    });
    // A session that already read the registry keeps it, so the broken tree is
    // asked about by a new one. That is also the honest reproduction: the file
    // is gone before anybody opens the production, not while they hold it.
    const reopened = new AutoMovieProductionContext(
      host.adapter,
      fixture.root,
      undefined,
    );
    const registryless = await captureAutoMovieProductionFrame(reopened, {
      target: {
        kind: "asset",
        productionId: "fixture-film",
        id: "soloist",
        angleDeg: 0,
      },
    });
    const turntableRegistryless = await captureAutoMovieProductionTurntable(
      reopened,
      {
        asset: "soloist",
      },
    );
    TestValidator.equals(
      "an unreadable compiler registry refuses both tools by name",
      {
        frame: registryless.diagnostics.map((entry) => entry.code),
        turntable: turntableRegistryless.diagnostics.map((entry) => entry.code),
        views: turntableRegistryless.views.length,
      },
      {
        frame: ["capture-registry-unavailable"],
        turntable: ["capture-registry-unavailable"],
        views: 0,
      },
    );
  } finally {
    fixture.dispose();
  }
};
