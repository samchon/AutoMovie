import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { nclose } from "../internal/predicates";

/**
 * Default-palette edits and subject reset remain ordinary undoable transactions.
 *
 * Scenarios:
 * 1. A missing palette materializes its defaults when one linear channel is changed.
 * 2. Reset returns to omission and can be undone.
 */
export const test_subject_human_panel_reset = async (): Promise<void> => {
  const f = createHumanPanelFixture();
  await f.panel.ready;
  await f.change("material-skin-r", ".4");
  TestValidator.predicate(
    "default palette edit",
    nclose(
      f.panel.snapshot()!.document.appearance!.find((m) => m.id === "skin")!
        .baseColor.r,
      0.4,
    ),
  );
  await f.click("face-reset");
  TestValidator.equals(
    "reset restores omission",
    f.panel.snapshot()!.document.appearance,
    undefined,
  );
  TestValidator.equals("reset can undo", f.panel.snapshot()!.canUndo, true);
  f.dom.window.close();
};
