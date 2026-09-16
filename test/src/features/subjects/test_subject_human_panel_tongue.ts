import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";
import { portraitTongueFixture } from "../internal/portraitTongueFixture";

/**
 * Lingual shape and performance controls pass through the actual panel state.
 *
 * Scenarios:
 * 1. The selected region displays a complete tongue, changes one shape scalar
 *    and independent performance, then retains exact undo/redo and JSON state.
 */
export const test_subject_human_panel_tongue = async (): Promise<void> => {
  const face = humanFaceFixture();
  face.basis.bindings.jawHinge = { x: 0, y: 0, z: -40 };
  face.basis.recipe.tongue = portraitTongueFixture();
  const f = createHumanPanelFixture({ face });
  try {
    await f.panel.ready;
    await f.change("face-region", "tongue");
    TestValidator.equals(
      "inherited tongue width",
      f.element<HTMLInputElement>("detail-tongue-halfWidth").value,
      "18",
    );
    await f.change("detail-tongue-halfWidth", "20");
    await f.change("expression-tongueRaise-common", "2");
    await f.change("expression-tongueAdvance-common", "3");
    const after = f.panel.snapshot()!.document;
    TestValidator.equals(
      "independent shape and expression",
      [
        after.detail?.tongue?.halfWidth,
        after.expression?.tongueRaise,
        after.expression?.tongueAdvance,
      ],
      [20, 2, 3],
    );
    await f.click("face-undo");
    TestValidator.equals(
      "undo performance",
      f.panel.snapshot()!.document.expression?.tongueAdvance,
      0,
    );
    await f.click("face-redo");
    TestValidator.equals("redo exact", f.panel.snapshot()!.document, after);
    await f.click("face-save");
    TestValidator.equals(
      "portable panel state",
      JSON.parse(f.downloads[0].bytes as string),
      after,
    );
  } finally {
    f.dom.window.close();
  }
};
