import { createPortraitMaterials } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Surface editing preserves the custom palette and uses ordinary face history.
 *
 * Scenarios:
 * 1. Authored skin roughness and clearcoat remain visible until explicitly edited.
 * 2. Explicit zero roughness and clearcoat retain every other field and finish.
 * 3. Undo and redo restore the complete document, including the explicit zero.
 */
export const test_subject_human_panel_surface_history =
  async (): Promise<void> => {
    const face = humanFaceFixture();
    face.appearance = createPortraitMaterials();
    const skin = face.appearance.find((m) => m.id === "skin")!;
    skin.roughness = 0.25;
    skin.clearcoat = 0.5;
    const f = createHumanPanelFixture({ face });
    await f.panel.ready;
    TestValidator.equals(
      "authored roughness",
      f.element<HTMLInputElement>("material-skin-roughness").value,
      "0.25",
    );
    TestValidator.equals(
      "authored clearcoat",
      f.element<HTMLInputElement>("material-skin-clearcoat").value,
      "0.5",
    );
    await f.change("material-skin-roughness", "0");
    const intermediate = f.panel.snapshot()!.document;
    await f.change("material-skin-clearcoat", "0");
    const expected = structuredClone(face);
    expected.appearance!.find((m) => m.id === "skin")!.roughness = 0;
    expected.appearance!.find((m) => m.id === "skin")!.clearcoat = 0;
    TestValidator.equals(
      "coefficient-only change",
      f.panel.snapshot()!.document,
      expected,
    );
    await f.click("face-undo");
    TestValidator.equals(
      "undo restores previous finish",
      f.panel.snapshot()!.document,
      intermediate,
    );
    await f.click("face-redo");
    TestValidator.equals(
      "redo preserves explicit zero",
      f.panel.snapshot()!.document,
      expected,
    );
    f.dom.window.close();
  };
