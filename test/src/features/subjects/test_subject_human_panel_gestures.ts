import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";

/**
 * Gesture shortcuts publish explicit channels rather than hidden identity mutations.
 *
 * Scenarios:
 * 1. Smile sets both corners, wink closes only the right lid, and open rotates the jaw.
 * 2. Each shortcut is a normal undoable edit.
 */
export const test_subject_human_panel_gestures = async (): Promise<void> => {
  const f = createHumanPanelFixture();
  await f.panel.ready;
  for (const [preset, expected] of [
    ["smile", { smile: { right: 4, left: 4 }, lipPart: 7 }],
    ["wink", { blink: { right: 1, left: 0 }, smile: { right: 2, left: 1 } }],
    ["open", { jawOpen: 8, lipPart: 2 }],
  ] as const) {
    const button = f.app.querySelector<HTMLButtonElement>(
      `[data-expression='${preset}']`,
    )!;
    await button.onclick!.call(button, f.clickEvent());
    TestValidator.equals(
      "explicit gesture channels",
      f.panel.snapshot()!.document.expression,
      expected,
    );
  }
  TestValidator.equals("gesture can undo", f.panel.snapshot()!.canUndo, true);
  f.dom.window.close();
};
