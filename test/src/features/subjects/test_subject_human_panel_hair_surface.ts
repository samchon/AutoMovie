import { createPortraitMaterials } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Hair surface factors follow the applied groom's custom material identity.
 *
 * Scenarios:
 * 1. A custom finish with no clearcoat displays zero without adding that field.
 * 2. Roughness and clearcoat edits change only their named coefficients; colour,
 *    mask settings, guides and every unrelated finish stay exactly authored.
 */
export const test_subject_human_panel_hair_surface =
  async (): Promise<void> => {
    const face = humanFaceFixture();
    face.appearance = createPortraitMaterials();
    const finish = {
      ...face.appearance.find((m) => m.id === "hair")!,
      id: "custom-groom",
      alphaCutoff: 0.25,
    };
    face.appearance = [...face.appearance, finish];
    face.basis.recipe.hair = {
      material: finish.id,
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
    TestValidator.equals(
      "omitted factor displays zero",
      f.element<HTMLInputElement>("material-custom-groom-clearcoat").value,
      "0",
    );
    TestValidator.equals(
      "view preserves complete document",
      f.panel.snapshot()!.document,
      face,
    );
    await f.change("material-custom-groom-roughness", "0.5");
    await f.change("material-custom-groom-clearcoat", "0.25");
    const expected = structuredClone(face);
    const surface = expected.appearance!.find((m) => m.id === finish.id)!;
    surface.roughness = 0.5;
    surface.clearcoat = 0.25;
    TestValidator.equals(
      "only bound hair coefficients change",
      f.panel.snapshot()!.document,
      expected,
    );
    f.dom.window.close();
  };
