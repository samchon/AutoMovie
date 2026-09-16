import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * The existing region editor selects internal room and then exposes its three
 * scalar controls without making absent chamber values look like zero.
 *
 * Scenarios:
 * 1. Import a complete wall/chamber profile through region JSON and independently
 *    change each numerical field. A bad transition leaves the document intact.
 */
export const test_subject_human_panel_oral_chamber =
  async (): Promise<void> => {
    const f = createHumanPanelFixture({ face: humanFaceFixture() });
    try {
      await f.panel.ready;
      await f.change("face-region", "mouth");
      TestValidator.equals(
        "initially absent",
        f.element<HTMLInputElement>(
          "detail-mouth-cavityChamber-horizontalExpansion",
        ),
        null,
      );
      f.element<HTMLTextAreaElement>("region-json").value = JSON.stringify({
        cavityWall: 0.75,
        cavityChamber: {
          horizontalExpansion: 5,
          verticalExpansion: 10,
          transitionDepth: 5,
        },
      });
      await f.click("region-apply");
      for (const [key, before, after] of [
        ["horizontalExpansion", 5, 6],
        ["verticalExpansion", 10, 12],
        ["transitionDepth", 5, 7],
      ] as const) {
        const id = `detail-mouth-cavityChamber-${key}`;
        TestValidator.equals(
          "selected scalar",
          f.element<HTMLInputElement>(id).value,
          String(before),
        );
        await f.change(id, String(after));
        TestValidator.equals(
          "edited scalar",
          f.panel.snapshot()!.document.detail?.mouth?.cavityChamber?.[key],
          after,
        );
      }
      const saved = f.panel.snapshot()!.document;
      await f.change("detail-mouth-cavityChamber-transitionDepth", "0");
      TestValidator.equals(
        "invalid edit retained",
        f.panel.snapshot()!.document,
        saved,
      );
    } finally {
      f.dom.window.close();
    }
  };
