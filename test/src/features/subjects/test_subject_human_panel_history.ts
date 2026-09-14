import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { nclose } from "../internal/predicates";

/**
 * Exact profile replacement and undo/redo share the validated document transaction.
 *
 * Scenarios:
 * 1. Common and left JSON profiles commit to their respective owners.
 * 2. Undo and redo rebuild the previous and current side overrides.
 */
export const test_subject_human_panel_history = async (): Promise<void> => {
  const f = createHumanPanelFixture();
  await f.panel.ready;
  f.element<HTMLTextAreaElement>("region-json").value = '{"foldDepth":0.5}';
  await f.click("region-apply");
  TestValidator.predicate(
    "common JSON",
    nclose(f.panel.snapshot()!.document.detail!.eye!.foldDepth!, 0.5),
  );
  await f.change("face-side", "left");
  f.element<HTMLTextAreaElement>("region-json").value = '{"foldDepth":0.8}';
  await f.click("region-apply");
  TestValidator.predicate(
    "left JSON",
    nclose(f.panel.snapshot()!.document.asymmetry!.left!.eye!.foldDepth!, 0.8),
  );
  await f.click("face-undo");
  TestValidator.equals(
    "undo removes side",
    f.panel.snapshot()!.document.asymmetry,
    undefined,
  );
  await f.click("face-redo");
  TestValidator.predicate(
    "redo restores side",
    nclose(f.panel.snapshot()!.document.asymmetry!.left!.eye!.foldDepth!, 0.8),
  );
  f.dom.window.close();
};
