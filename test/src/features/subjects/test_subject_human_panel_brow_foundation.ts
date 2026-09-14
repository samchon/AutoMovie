import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { nclose } from "../internal/predicates";

/**
 * Brow foundation editing is a bilateral numerical transaction.
 *
 * Scenarios:
 * 1. The frame control authors a signed recession without modifying its basis.
 * 2. An adjacent out-of-range value retains the committed document and model.
 */
export const test_subject_human_panel_brow_foundation =
  async (): Promise<void> => {
    const f = createHumanPanelFixture();
    await f.panel.ready;
    const original = structuredClone(f.panel.snapshot()!.document);
    await f.change("face-region", "frame");
    TestValidator.equals(
      "frame has no side override",
      f.element<HTMLSelectElement>("face-side").disabled,
      true,
    );
    await f.change("detail-frame-browProjection", "-6");
    TestValidator.predicate(
      "signed foundation applied",
      nclose(f.panel.snapshot()!.document.detail!.frame!.browProjection!, -6),
    );
    TestValidator.equals(
      "observation basis retained",
      f.panel.snapshot()!.document.basis,
      original.basis,
    );
    const committed = structuredClone(f.panel.snapshot()!.document);
    const publications = f.published.length;
    await f.change("detail-frame-browProjection", "-8.1");
    TestValidator.equals(
      "invalid value visible",
      f.element("face-status").dataset.state,
      "error",
    );
    TestValidator.equals(
      "invalid value cannot replace document",
      f.panel.snapshot()!.document,
      committed,
    );
    TestValidator.equals(
      "invalid value cannot publish a model",
      f.published.length,
      publications,
    );
    f.dom.window.close();
  };
