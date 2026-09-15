import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Taper placement is edited on the committed hair document, not on a temporary
 * viewer material or a guide array disconnected from the export.
 *
 * Scenarios:
 * 1. A legacy groom displays zero and a valid edit changes only taper placement.
 * 2. Undo, redo and JSON save retain the exact committed document.
 */
export const test_subject_human_panel_hair_taper = async (): Promise<void> => {
  const face = humanFaceFixture();
  face.basis.recipe.hair = {
    material: "hair",
    cards: [],
    segments: 2,
    widthScale: 1,
    tipWidth: 0.5,
    seed: 0,
    fibres: 1,
    coverage: 1,
  };
  const f = createHumanPanelFixture({ face });
  try {
    await f.panel.ready;
    await f.change("face-region", "hair");
    const id = "detail-hair-taperStart";
    TestValidator.equals(
      "default slider",
      f.element<HTMLInputElement>(id).value,
      "0",
    );
    const before = f.panel.snapshot()!.document;
    await f.change(id, "0.75");
    const after = f.panel.snapshot()!.document,
      expected = structuredClone(before);
    expected.detail = { hair: { taperStart: 0.75 } };
    TestValidator.equals("only taper placement", after, expected);
    await f.click("face-undo");
    TestValidator.equals("undo", f.panel.snapshot()!.document, before);
    await f.click("face-redo");
    TestValidator.equals("redo", f.panel.snapshot()!.document, after);
    await f.click("face-save");
    TestValidator.equals(
      "portable taper",
      JSON.parse(f.downloads[0].bytes as string),
      after,
    );
  } finally {
    f.dom.window.close();
  }
};
