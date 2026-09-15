import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Choosing the optional layer region never manufactures a groom.
 * Scenarios:
 * 1. An absent population exposes an empty disabled selector and no scalar rows.
 * 2. Returning to a different region hides the selector without changing the document.
 */
export const test_subject_human_panel_hair_layers_absent =
  async (): Promise<void> => {
    const face = humanFaceFixture();
    face.appearance = [];
    const f = createHumanPanelFixture({ face });
    try {
      await f.panel.ready;
      const before = f.panel.snapshot()!.document;
      await f.change("face-region", "hairLayers");
      const selector = f.element<HTMLSelectElement>("face-hair-layer");
      TestValidator.equals("empty selector", selector.options.length, 0);
      TestValidator.equals("disabled", selector.disabled, true);
      TestValidator.equals(
        "no implicit scalar",
        f.element("detail-hair-coverage"),
        null,
      );
      TestValidator.equals("view only", f.panel.snapshot()!.document, before);
      await f.change("face-region", "nose");
      TestValidator.equals("hidden again", selector.hidden, true);
      TestValidator.equals(
        "no groom authored",
        f.panel.snapshot()!.document,
        before,
      );
    } finally {
      f.dom.window.close();
    }
  };
