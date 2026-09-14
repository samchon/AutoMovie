import { createPortraitMaterials } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";

/**
 * Surface coefficients are editable without first supplying a custom palette.
 *
 * Scenarios:
 * 1. Default skin roughness and omitted lip clearcoat appear with their applied
 *    values, without materializing appearance merely by opening the panel.
 * 2. Editing clearcoat to one changes only that field;
 *    the fallback palette and complete numerical face survive saved JSON.
 */
export const test_subject_human_panel_surface_defaults =
  async (): Promise<void> => {
    const f = createHumanPanelFixture();
    await f.panel.ready;
    TestValidator.predicate(
      "surface controls are present",
      f.element("material-skin-roughness") !== null &&
        f.element("material-lips-clearcoat") !== null,
    );
    TestValidator.equals(
      "absent clearcoat displays zero",
      f.element<HTMLInputElement>("material-lips-clearcoat").value,
      "0",
    );
    const before = f.panel.snapshot()!.document;
    TestValidator.equals(
      "view preserves omission",
      before.appearance,
      undefined,
    );
    await f.change("material-lips-clearcoat", "1");
    const expected = structuredClone(before);
    expected.appearance = createPortraitMaterials();
    expected.appearance.find((m) => m.id === "lips")!.clearcoat = 1;
    TestValidator.equals(
      "only selected coefficients change",
      f.panel.snapshot()!.document,
      expected,
    );
    await f.click("face-save");
    TestValidator.equals(
      "save retains coefficient boundaries",
      JSON.parse(f.downloads[0].bytes as string),
      expected,
    );
    f.dom.window.close();
  };
