import type { IAutoMovieHumanFaceDocument } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import {
  createHumanPanelFixture,
  humanPanelAsset,
} from "../internal/createHumanPanelFixture";

/**
 * A superseded subject build cannot publish and must release its decoded preview.
 *
 * Scenarios:
 * 1. A newer subject resolves first and becomes the displayed identity.
 * 2. An older decoded model is released instead of replacing it.
 * 3. A latest non-Error construction failure is visible without losing the valid model.
 */
export const test_subject_human_panel_subject_races =
  async (): Promise<void> => {
    const pending: {
      face: IAutoMovieHumanFaceDocument;
      resolve: (value: ReturnType<typeof humanPanelAsset>) => void;
      reject: (value: unknown) => void;
    }[] = [];
    const f = createHumanPanelFixture({
      build: (face) =>
        new Promise((resolve, reject) => {
          pending.push({ face, resolve, reject });
        }),
    });
    await Promise.resolve();
    await Promise.resolve();
    TestValidator.equals("initial request exists", pending.length, 1);
    pending[0].resolve(humanPanelAsset("first"));
    await f.panel.ready;
    const old = f.change("face-subject", "second");
    await Promise.resolve();
    await Promise.resolve();
    const latest = f.change("face-subject", "first");
    await Promise.resolve();
    await Promise.resolve();
    TestValidator.equals("both subject requests exist", pending.length, 3);
    pending[2].resolve(humanPanelAsset("latest"));
    await latest;
    pending[1].resolve(humanPanelAsset("obsolete"));
    await old;
    TestValidator.equals(
      "latest model retained",
      f.panel.snapshot()!.model.id,
      "latest",
    );
    TestValidator.equals("superseded model released", f.disposed, ["obsolete"]);
    const failed = f.change("face-subject", "second");
    await Promise.resolve();
    await Promise.resolve();
    pending[3].reject("construction-failure");
    await failed;
    TestValidator.equals(
      "non-Error build failure",
      f.element("face-status").textContent,
      "construction-failure",
    );
    TestValidator.equals(
      "valid model survives",
      f.panel.snapshot()!.model.id,
      "latest",
    );
    TestValidator.equals(
      "failed subject selection returns to displayed document",
      f.element<HTMLSelectElement>("face-subject").value,
      "first",
    );
    f.dom.window.close();
  };
