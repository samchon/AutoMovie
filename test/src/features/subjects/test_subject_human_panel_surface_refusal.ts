import { validateModel } from "@automovie/engine";
import { createPortraitMaterials } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import {
  createHumanPanelFixture,
  humanPanelAsset,
} from "../internal/createHumanPanelFixture";
import { createModel } from "../internal/fixtures";

/**
 * Invalid surface coefficients cannot replace the committed face or its asset.
 *
 * Scenarios:
 * 1. The engine's actual material validator admits the initial palette on one
 *    primitive, without constructing expensive facial geometry.
 * 2. Negative roughness and clearcoat above one fail through the same validator;
 *    each preserves the document, asset, publication count and undo history.
 * 3. A valid clearcoat retry restores ready state and changes only that finish.
 */
export const test_subject_human_panel_surface_refusal =
  async (): Promise<void> => {
    const f = createHumanPanelFixture({
      build: async (document) => {
        const model = createModel(null);
        model.parts[0].material = "skin";
        model.materials = [
          ...(document.appearance ?? createPortraitMaterials()),
        ];
        const validation = validateModel({ model });
        if (!validation.success) throw new Error(JSON.stringify(validation));
        return humanPanelAsset(document.id);
      },
    });
    await f.panel.ready;
    const before = f.panel.snapshot()!;
    TestValidator.equals("valid palette admitted", before.status, "ready");
    for (const [property, value] of [
      ["roughness", "-0.1"],
      ["clearcoat", "1.1"],
    ]) {
      await f.change(`material-skin-${property}`, value);
      const after = f.panel.snapshot()!;
      TestValidator.equals("engine range refusal", after.status, "error");
      TestValidator.predicate(
        "diagnostic names coefficient",
        after.error!.includes(property),
      );
      TestValidator.equals(
        "last document retained",
        after.document,
        before.document,
      );
      TestValidator.equals("last asset retained", after.model, before.model);
      TestValidator.equals(
        "invalid edit adds no history",
        after.canUndo,
        false,
      );
      TestValidator.equals("invalid edit not published", f.published.length, 1);
    }
    await f.change("material-skin-clearcoat", "0");
    TestValidator.equals(
      "retry restores ready",
      f.panel.snapshot()!.status,
      "ready",
    );
    const expected = structuredClone(before.document);
    expected.appearance = createPortraitMaterials();
    expected.appearance.find((m) => m.id === "skin")!.clearcoat = 0;
    TestValidator.equals(
      "retry changes only coefficient",
      f.panel.snapshot()!.document,
      expected,
    );
    f.dom.window.close();
  };
