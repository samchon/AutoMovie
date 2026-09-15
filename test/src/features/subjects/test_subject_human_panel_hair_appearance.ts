import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanHairAppearanceFixture } from "../internal/humanHairAppearanceFixture";

/**
 * Hair colour editing follows the finish named by the applied groom, not a
 * fixed palette name, while geometry and unrelated appearance stay authored.
 *
 * Scenarios:
 * 1. An inherited groom exposes its custom finish's linear RGB and surface entries;
 *    an unused finish remains absent from the appearance controls.
 * 2. Editing its red component preserves green, blue, mask settings and guides,
 *    and saved JSON retains the complete committed document.
 */
export const test_subject_human_panel_hair_appearance =
  async (): Promise<void> => {
    const face = humanHairAppearanceFixture();
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
    await f.click("face-save");
    TestValidator.equals(
      "save retains selected finish",
      JSON.parse(f.downloads[0].bytes as string),
      after,
    );
    f.dom.window.close();
  };
