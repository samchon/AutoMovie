import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanHairAppearanceFixture } from "../internal/humanHairAppearanceFixture";

/**
 * A detailed material override changes the appearance owner without replacing guides.
 * Scenarios:
 * 1. An inherited custom finish is exposed while the unused standard hair finish is hidden.
 * 2. Rebinding hair exposes the new base, hides the old one and preserves the basis.
 */
export const test_subject_human_panel_hair_appearance_owner =
  async (): Promise<void> => {
    const face = humanHairAppearanceFixture(),
      f = createHumanPanelFixture({ face });
    try {
      await f.panel.ready;
      TestValidator.predicate(
        "inherited owner",
        f.element("material-copper-groom-r") !== null,
      );
      TestValidator.equals("unused owner", f.element("material-hair-r"), null);
      await f.change("face-region", "hair");
      f.element<HTMLTextAreaElement>("region-json").value = JSON.stringify({
        material: "hair",
      });
      await f.click("region-apply");
      TestValidator.equals(
        "old owner hidden",
        f.element("material-copper-groom-r"),
        null,
      );
      TestValidator.predicate(
        "new owner exposed",
        f.element("material-hair-r") !== null,
      );
      TestValidator.equals(
        "basis retained",
        f.panel.snapshot()!.document.basis,
        face.basis,
      );
    } finally {
      f.dom.window.close();
    }
  };
