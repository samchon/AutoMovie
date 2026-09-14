import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { nclose } from "../internal/predicates";

/**
 * A side-specific scalar override can return to its common inherited value.
 *
 * Scenarios:
 * 1. Editing the left lid leaves the common profile untouched.
 * 2. The scalar reset removes that leaf and its now-empty side owner.
 */
export const test_subject_human_panel_side = async (): Promise<void> => {
  const f = createHumanPanelFixture();
  await f.panel.ready;
  await f.change("face-side", "left");
  await f.change("detail-eye-foldDepth", ".7");
  TestValidator.predicate(
    "left-only detail",
    nclose(f.panel.snapshot()!.document.asymmetry!.left!.eye!.foldDepth!, 0.7),
  );
  TestValidator.equals(
    "common inherited",
    f.panel.snapshot()!.document.detail,
    undefined,
  );
  const inherit = f
    .element("detail-eye-foldDepth")
    .parentElement!.querySelector<HTMLButtonElement>("button")!;
  await inherit.onclick!.call(inherit, f.clickEvent());
  TestValidator.equals(
    "scalar inherits",
    f.panel.snapshot()!.document.asymmetry,
    undefined,
  );
  f.dom.window.close();
};
