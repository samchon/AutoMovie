import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * The numerical hair relief control participates in the ordinary editor
 * transaction and portable document, not a renderer-only material override.
 * Scenarios:
 * 1. A groom with omitted relief displays zero and edits only that detail.
 * 2. Undo, redo and save retain exactly the committed document.
 */
export const test_subject_human_panel_hair_normal = async (): Promise<void> => {
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
    const id = "detail-hair-fibreNormalScale";
    TestValidator.equals(
      "default slider",
      f.element<HTMLInputElement>(id).value,
      "0",
    );
    const before = f.panel.snapshot()!.document;
    await f.change(id, "0.4");
    const after = f.panel.snapshot()!.document;
    const expected = structuredClone(before);
    expected.detail = { hair: { fibreNormalScale: 0.4 } };
    TestValidator.equals("only normal strength", after, expected);
    await f.click("face-undo");
    TestValidator.equals("undo", f.panel.snapshot()!.document, before);
    await f.click("face-redo");
    TestValidator.equals("redo", f.panel.snapshot()!.document, after);
    await f.click("face-save");
    TestValidator.equals(
      "portable strength",
      JSON.parse(f.downloads[0].bytes as string),
      after,
    );
  } finally {
    f.dom.window.close();
  }
};
