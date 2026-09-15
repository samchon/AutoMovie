import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Skin condition is a committed editor control, not an ephemeral viewport effect.
 *
 * Scenarios:
 * 1. A legacy face displays taut skin. Laxity and transient creasing edits save
 *    independently and undo/redo retain the complete committed document.
 * 2. JSON download carries the skin controls used by the editor's builder.
 */
export const test_subject_human_panel_skin = async (): Promise<void> => {
  const f = createHumanPanelFixture({ face: humanFaceFixture() });
  try {
    await f.panel.ready;
    await f.change("face-region", "skin");
    TestValidator.equals(
      "legacy taut control",
      f.element<HTMLInputElement>("detail-skin-laxity").value,
      "0",
    );
    await f.change("detail-skin-laxity", "0.8");
    const relaxed = f.panel.snapshot()!.document;
    TestValidator.equals("committed laxity", relaxed.detail?.skin?.laxity, 0.8);
    await f.change("detail-skin-expressionCreasing", "0.2");
    const performed = f.panel.snapshot()!.document;
    TestValidator.equals(
      "independent persistent and transient controls",
      performed.detail?.skin,
      { laxity: 0.8, expressionCreasing: 0.2 },
    );
    await f.click("face-undo");
    TestValidator.equals(
      "undo transient only",
      f.panel.snapshot()!.document,
      relaxed,
    );
    await f.click("face-redo");
    TestValidator.equals(
      "redo complete condition",
      f.panel.snapshot()!.document,
      performed,
    );
    await f.click("face-save");
    TestValidator.equals(
      "portable skin",
      JSON.parse(f.downloads[0].bytes as string),
      performed,
    );
  } finally {
    f.dom.window.close();
  }
};
