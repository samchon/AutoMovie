import { TestValidator } from "@nestia/e2e";

import {
  createHumanPanelFixture,
  humanPanelAsset,
} from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";
import { nclose } from "../internal/predicates";

/**
 * A failed subject read cannot grant a superseded edit authority over the
 * displayed pair or leave that pending candidate as the next edit's basis.
 *
 * Scenarios:
 * 1. Begin an eye-width edit, then fail a new subject read before it completes.
 * 2. Resolve the old builder despite cancellation; the committed pair stays put.
 * 3. Change eye height after recovery; the abandoned width must not reappear.
 */
export const test_subject_human_panel_interrupted_edit =
  async (): Promise<void> => {
    const face = humanFaceFixture("first");
    let reads = 0,
      builds = 0;
    let resolveOld!: (model: ReturnType<typeof humanPanelAsset>) => void;
    const f = createHumanPanelFixture({
      face,
      read: async () => {
        if (reads++ !== 0)
          throw new Error("The selected document is unavailable.");
        return JSON.stringify(face);
      },
      build: async (document) => {
        if (++builds === 2)
          return new Promise((resolve) => {
            resolveOld = resolve;
          });
        return humanPanelAsset(document.id);
      },
    });
    await f.panel.ready;
    const pending = f.change("trait-eyeWidth", "0.3");
    TestValidator.equals("edit reached the builder", builds, 2);
    await f.change("face-subject", "first");
    TestValidator.equals(
      "failed read visible",
      f.element("face-status").dataset.state,
      "error",
    );
    resolveOld(humanPanelAsset("obsolete-edit"));
    await pending;
    TestValidator.equals(
      "abandoned width never commits",
      f.panel.snapshot()!.document.controls?.eyeWidth,
      undefined,
    );
    TestValidator.equals(
      "displayed model remains current",
      f.panel.snapshot()!.model.id,
      "first",
    );
    await f.change("trait-eyeHeight", "0.1");
    TestValidator.equals(
      "abandoned draft is not inherited",
      f.panel.snapshot()!.document.controls?.eyeWidth,
      undefined,
    );
    TestValidator.predicate(
      "new height commits",
      nclose(f.panel.snapshot()!.document.controls!.eyeHeight!, 0.1),
    );
    f.dom.window.close();
  };
