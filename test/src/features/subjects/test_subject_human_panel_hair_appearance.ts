import { createPortraitMaterials } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Hair colour editing follows the finish named by the applied groom, not a
 * fixed palette name, while geometry and unrelated appearance stay authored.
 *
 * Scenarios:
 * 1. An inherited groom exposes its custom finish's linear RGB and surface entries;
 *    an unused finish remains absent from the appearance controls.
 * 2. Editing its red component preserves green, blue, mask settings and guides,
 *    and undo, redo and saved JSON retain the complete committed document.
 * 3. A detailed groom-material override moves the controls to the new owner.
 */
export const test_subject_human_panel_hair_appearance =
  async (): Promise<void> => {
    const face = humanFaceFixture("coloured-groom");
    const palette = createPortraitMaterials();
    const hair = palette.find((m) => m.id === "hair")!;
    face.appearance = [
      ...palette,
      { ...structuredClone(hair), id: "copper-groom", alphaCutoff: 0.25 },
    ];
    face.basis.recipe.hair = {
      material: "copper-groom",
      cards: [
        {
          guide: [
            [0, 120, 0],
            [0, 110, -10],
          ],
          across: [
            [1, 0, 0],
            [1, 0, 0],
          ],
          width: 2,
        },
      ],
      segments: 2,
      widthScale: 1,
      tipWidth: 0.5,
      seed: 0,
      fibres: 2,
      coverage: 0.7,
    };
    const f = createHumanPanelFixture({ face });
    await f.panel.ready;
    for (const component of ["r", "g", "b", "roughness", "clearcoat"])
      TestValidator.predicate(
        "bound finish exposed",
        f.element(`material-copper-groom-${component}`) !== null,
      );
    TestValidator.equals(
      "unused hair finish hidden",
      f.element("material-hair-r"),
      null,
    );
    const before = f.panel.snapshot()!.document;
    await f.change("material-copper-groom-r", "0.25");
    const after = f.panel.snapshot()!.document;
    const expected = structuredClone(before);
    const target = expected.appearance!.find((m) => m.id === "copper-groom")!;
    target.baseColor.r = 0.25;
    target.baseColor.hex = null;
    TestValidator.equals(
      "only selected finish channel changes",
      after,
      expected,
    );
    await f.click("face-undo");
    TestValidator.equals(
      "undo restores full document",
      f.panel.snapshot()!.document,
      before,
    );
    await f.click("face-redo");
    TestValidator.equals(
      "redo restores colour only",
      f.panel.snapshot()!.document,
      after,
    );
    await f.click("face-save");
    TestValidator.equals(
      "save retains selected finish",
      JSON.parse(f.downloads[0].bytes as string),
      after,
    );
    await f.change("face-region", "hair");
    f.element<HTMLTextAreaElement>("region-json").value = JSON.stringify({
      material: "hair",
    });
    await f.click("region-apply");
    TestValidator.equals(
      "previous finish no longer bound",
      f.element("material-copper-groom-r"),
      null,
    );
    TestValidator.predicate(
      "detailed binding exposed",
      f.element("material-hair-r") !== null,
    );
    f.dom.window.close();
  };
