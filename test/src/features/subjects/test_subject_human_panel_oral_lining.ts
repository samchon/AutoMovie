import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Region replacement selects an optional wall before its scalar field appears.
 *
 * Scenarios:
 * 1. Select an absent wall through region JSON and edit the exposed scalar.
 *    An out-of-range edit retains the valid document. Generic history and file
 *    routing have independent panel scenarios rather than repeated setup here.
 */
export const test_subject_human_panel_oral_lining = async (): Promise<void> => {
  const f = createHumanPanelFixture({ face: humanFaceFixture() });
  try {
    await f.panel.ready;
    await f.change("face-region", "mouth");
    TestValidator.equals(
      "initially unselected",
      f.element<HTMLInputElement>("detail-mouth-cavityWall"),
      null,
    );
    f.element<HTMLTextAreaElement>("region-json").value = '{"cavityWall":0.75}';
    await f.click("region-apply");
    TestValidator.equals(
      "selected wall field",
      f.element<HTMLInputElement>("detail-mouth-cavityWall").value,
      "0.75",
    );
    await f.change("detail-mouth-cavityWall", "0.5");
    const after = f.panel.snapshot()!.document;
    TestValidator.equals("edited wall", after.detail?.mouth?.cavityWall, 0.5);
    await f.change("detail-mouth-cavityWall", "0.951");
    TestValidator.equals(
      "invalid edit retained",
      f.panel.snapshot()!.document,
      after,
    );
  } finally {
    f.dom.window.close();
  }
};
