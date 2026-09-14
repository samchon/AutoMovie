import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";

/**
 * Brow foundation history restores complete numerical documents.
 *
 * Scenarios:
 * 1. A signed frame edit can be undone to the basis and redone without drift.
 */
export const test_subject_human_panel_brow_history =
  async (): Promise<void> => {
    const f = createHumanPanelFixture();
    await f.panel.ready;
    const original = structuredClone(f.panel.snapshot()!.document);
    await f.change("face-region", "frame");
    await f.change("detail-frame-browProjection", "-6");
    const committed = structuredClone(f.panel.snapshot()!.document);
    await f.click("face-undo");
    TestValidator.equals(
      "undo restores original document",
      f.panel.snapshot()!.document,
      original,
    );
    await f.click("face-redo");
    TestValidator.equals(
      "redo restores signed value",
      f.panel.snapshot()!.document,
      committed,
    );
    f.dom.window.close();
  };
