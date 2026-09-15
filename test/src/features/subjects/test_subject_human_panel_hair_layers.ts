import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";
import { portraitHairShadeFixture } from "../internal/portraitHairShadeFixture";

/**
 * The real panel exposes whole-layer replacement and the resident base finish.
 * Scenarios:
 * 1. An additional layer without legacy hair exposes its separately named finish.
 * 2. Clearing the layer region preserves the basis and removes that finish control.
 * 3. Undo and redo restore exact layer documents; JSON download retains removal.
 */
export const test_subject_human_panel_hair_layers = async (): Promise<void> => {
  const face = humanFaceFixture(),
    { shape, finish } = portraitHairShadeFixture();
  face.appearance = [finish];
  face.basis.recipe.hairLayers = [
    { id: "outer", profile: { ...shape, cards: [] } },
  ];
  const f = createHumanPanelFixture({ face });
  try {
    await f.panel.ready;
    await f.change("face-region", "hairLayers");
    TestValidator.equals(
      "layer profile",
      JSON.parse(f.element<HTMLTextAreaElement>("region-json").value),
      [
        {
          id: "outer",
          profile: {
            ...shape,
            cards: [],
            fibreNormalScale: 0,
            taperStart: 0,
            fibreShadeStrength: 1,
          },
        },
      ],
    );
    TestValidator.predicate(
      "layer base controls",
      f.element("material-" + finish.id + "-r") !== null,
    );
    const before = f.panel.snapshot()!.document;
    f.element<HTMLTextAreaElement>("region-json").value = "[]";
    await f.click("region-apply");
    const after = f.panel.snapshot()!.document;
    TestValidator.equals("empty layer override", after.detail?.hairLayers, []);
    TestValidator.equals(
      "empty selector disabled",
      f.element<HTMLSelectElement>("face-hair-layer").disabled,
      true,
    );
    TestValidator.equals(
      "empty layers have no scalars",
      f.element("detail-hair-widthScale"),
      null,
    );
    TestValidator.equals(
      "no unused base controls",
      f.element("material-" + finish.id + "-r"),
      null,
    );
    await f.click("face-undo");
    TestValidator.equals("undo", f.panel.snapshot()!.document, before);
    await f.click("face-redo");
    TestValidator.equals("redo", f.panel.snapshot()!.document, after);
    await f.click("face-save");
    TestValidator.equals(
      "portable",
      JSON.parse(f.downloads[0].bytes as string),
      after,
    );
  } finally {
    f.dom.window.close();
  }
};
