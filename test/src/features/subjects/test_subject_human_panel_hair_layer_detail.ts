import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";
import { portraitHairShadeFixture } from "../internal/portraitHairShadeFixture";

/**
 * Layer selection is display state; a numeric edit writes only that named profile.
 * Scenarios:
 * 1. The selector is hidden outside hairLayers; inherited defaults are displayed.
 * 2. Selecting an arbitrary authored id changes no document and exposes no scalar
 *    inheritance button, because layer-array inheritance is a population operation.
 * 3. Editing zero affects only the chosen layer; invalid input preserves that edit.
 * 4. Undo/redo and JSON retain exact documents and selection survives refresh.
 */
export const test_subject_human_panel_hair_layer_detail =
  async (): Promise<void> => {
    const face = humanFaceFixture(),
      { shape } = portraitHairShadeFixture();
    face.appearance = [];
    face.basis.recipe.hair = { ...shape, cards: [] };
    face.basis.recipe.hairLayers = [
      { id: "inner", profile: { ...shape, cards: [] } },
      { id: "outer: <lock>", profile: { ...shape, cards: [] } },
    ];
    const f = createHumanPanelFixture({ face });
    try {
      await f.panel.ready;
      TestValidator.equals(
        "hidden outside layer region",
        f.element<HTMLSelectElement>("face-hair-layer").hidden,
        true,
      );
      await f.change("face-region", "hair");
      TestValidator.predicate(
        "legacy scalar still inherits",
        f
          .element("detail-hair-fibreShadeStrength")
          .closest(".entry")!
          .querySelector("button") !== null,
      );
      await f.change("face-region", "hairLayers");
      const id = "detail-hair-fibreShadeStrength";
      TestValidator.equals(
        "selector visible",
        f.element<HTMLSelectElement>("face-hair-layer").hidden,
        false,
      );
      TestValidator.equals(
        "default first",
        f.element<HTMLSelectElement>("face-hair-layer").value,
        "inner",
      );
      TestValidator.equals(
        "default shade",
        f.element<HTMLInputElement>(id).value,
        "1",
      );
      const before = f.panel.snapshot()!.document;
      await f.change("face-hair-layer", "outer: <lock>");
      TestValidator.equals(
        "selection is view only",
        f.panel.snapshot()!.document,
        before,
      );
      TestValidator.equals(
        "no single scalar inheritance",
        f.element(id).closest(".entry")!.querySelector("button"),
        null,
      );
      await f.change(id, "0");
      const expected = structuredClone(before);
      expected.detail = {
        hairLayers: structuredClone(before.basis.recipe.hairLayers),
      };
      expected.detail.hairLayers![1].profile.fibreShadeStrength = 0;
      TestValidator.equals(
        "only outer shade",
        f.panel.snapshot()!.document,
        expected,
      );
      TestValidator.equals(
        "selected owner retained",
        f.element<HTMLSelectElement>("face-hair-layer").value,
        "outer: <lock>",
      );
      await f.change(id, "1.01");
      TestValidator.equals(
        "invalid retains pair",
        f.panel.snapshot()!.document,
        expected,
      );
      TestValidator.equals(
        "visible refusal",
        f.element("face-status").dataset.state,
        "error",
      );
      await f.click("face-undo");
      TestValidator.equals("undo", f.panel.snapshot()!.document, before);
      await f.click("face-redo");
      TestValidator.equals("redo", f.panel.snapshot()!.document, expected);
      await f.click("face-save");
      TestValidator.equals(
        "portable",
        JSON.parse(f.downloads[0].bytes as string),
        expected,
      );
    } finally {
      f.dom.window.close();
    }
  };
