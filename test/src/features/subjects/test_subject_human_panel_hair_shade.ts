import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";
import { portraitHairShadeFixture } from "../internal/portraitHairShadeFixture";

/**
 * Pigment modulation is edited on the saved hair document, not just the preview.
 * Scenarios:
 * 1. A legacy groom displays one; zero changes only detailed shade strength.
 * 2. An out-of-range value preserves the document and does not consume history.
 * 3. Undo, redo and JSON download preserve the exact before/after documents.
 */
export const test_subject_human_panel_hair_shade = async (): Promise<void> => {
  const face = humanFaceFixture();
  face.basis.recipe.hair = { ...portraitHairShadeFixture().shape, cards: [] };
  const f = createHumanPanelFixture({ face });
  try {
    await f.panel.ready;
    await f.change("face-region", "hair");
    const id = "detail-hair-fibreShadeStrength";
    TestValidator.equals(
      "default shade",
      f.element<HTMLInputElement>(id).value,
      "1",
    );
    const before = f.panel.snapshot()!.document;
    await f.change(id, "0");
    const after = f.panel.snapshot()!.document,
      expected = structuredClone(before);
    expected.detail = { hair: { fibreShadeStrength: 0 } };
    TestValidator.equals("only shade", after, expected);
    await f.change(id, "1.01");
    TestValidator.equals(
      "invalid preserves document",
      f.panel.snapshot()!.document,
      after,
    );
    TestValidator.equals(
      "visible refusal",
      f.element("face-status").dataset.state,
      "error",
    );
    await f.click("face-undo");
    TestValidator.equals("undo", f.panel.snapshot()!.document, before);
    await f.click("face-redo");
    TestValidator.equals("redo", f.panel.snapshot()!.document, after);
    await f.click("face-save");
    TestValidator.equals(
      "portable shade",
      JSON.parse(f.downloads[0].bytes as string),
      after,
    );
  } finally {
    f.dom.window.close();
  }
};
