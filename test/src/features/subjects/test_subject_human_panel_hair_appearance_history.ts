import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanHairAppearanceFixture } from "../internal/humanHairAppearanceFixture";

/**
 * Hair appearance history restores whole committed documents, not just UI fields.
 * Scenarios:
 * 1. A red-channel edit remains part of the document when traversing undo and redo.
 * 2. Both history directions preserve the inherited guides and all other values.
 */
export const test_subject_human_panel_hair_appearance_history =
  async (): Promise<void> => {
    const face = humanHairAppearanceFixture();
    face.appearance = face.appearance!.filter((m) => m.id === "copper-groom");
    const f = createHumanPanelFixture({ face });
    try {
      await f.panel.ready;
      const before = f.panel.snapshot()!.document;
      await f.change("material-copper-groom-r", "0.25");
      const after = f.panel.snapshot()!.document;
      TestValidator.equals(
        "colour arranged",
        after.appearance![0].baseColor.r,
        0.25,
      );
      await f.click("face-undo");
      TestValidator.equals(
        "undo full document",
        f.panel.snapshot()!.document,
        before,
      );
      await f.click("face-redo");
      TestValidator.equals(
        "redo full document",
        f.panel.snapshot()!.document,
        after,
      );
    } finally {
      f.dom.window.close();
    }
  };
