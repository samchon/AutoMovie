import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * The panel commits curl controls through document history and JSON export.
 * Scenarios:
 * 1. A complete inherited curl displays all three scalar values.
 * 2. Editing amplitude changes that one detail, and undo/redo/save preserve
 *    the exact paired document and model transaction.
 */
export const test_subject_human_panel_hair_curl = async (): Promise<void> => {
  const face = humanFaceFixture();
  face.basis.recipe.hair = {
    material: "hair",
    cards: [],
    segments: 2,
    widthScale: 1,
    tipWidth: 0.5,
    seed: 1,
    fibres: 1,
    coverage: 1,
    fibreCurl: { amplitude: 0.2, cycles: 3, aspectRatio: 0.5 },
  };
  const f = createHumanPanelFixture({ face });
  try {
    await f.panel.ready;
    await f.change("face-region", "hair");
    for (const [key, value] of [
      ["amplitude", "0.2"],
      ["cycles", "3"],
      ["aspectRatio", "0.5"],
    ])
      TestValidator.equals(
        "inherited curl control",
        f.element<HTMLInputElement>(`detail-hair-fibreCurl-${key}`).value,
        value,
      );
    const before = f.panel.snapshot()!.document;
    await f.change("detail-hair-fibreCurl-amplitude", "0.3");
    const expected = structuredClone(before);
    expected.detail = { hair: { fibreCurl: { amplitude: 0.3 } } };
    TestValidator.equals(
      "committed amplitude only",
      f.panel.snapshot()!.document,
      expected,
    );
    await f.click("face-undo");
    TestValidator.equals("undo", f.panel.snapshot()!.document, before);
    await f.click("face-redo");
    TestValidator.equals("redo", f.panel.snapshot()!.document, expected);
    await f.click("face-save");
    TestValidator.equals(
      "saved curl profile",
      JSON.parse(f.downloads[0].bytes as string),
      expected,
    );
  } finally {
    f.dom.window.close();
  }
};
