import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";
import { skinColourRegion } from "../internal/skinColourFixture";

/**
 * The existing whole-profile editor publishes and saves numerical pigmentation.
 *
 * Scenarios:
 * 1. Selecting skinColour exposes no invented profile; applying a valid array
 *    commits only that owner and survives undo/redo and JSON download.
 * 2. A malformed profile does not publish. Empty selection and inheritance
 *    retain the document's existing array replacement semantics.
 */
export const test_subject_human_panel_skin_colour = async (): Promise<void> => {
  const face = humanFaceFixture(),
    f = createHumanPanelFixture({ face });
  try {
    await f.panel.ready;
    await f.change("face-region", "skinColour");
    const editor = f.element<HTMLTextAreaElement>("region-json");
    TestValidator.equals("absent profile", editor.value, "null");
    editor.value = JSON.stringify([skinColourRegion()]);
    await f.click("region-apply");
    const coloured = f.panel.snapshot()!.document;
    TestValidator.equals("committed pigment", coloured.detail?.skinColour, [
      skinColourRegion(),
    ]);
    TestValidator.equals("basis not changed", coloured.basis, face.basis);
    await f.click("face-undo");
    TestValidator.equals("undo pigment", f.panel.snapshot()!.document, face);
    await f.click("face-redo");
    TestValidator.equals(
      "redo pigment",
      f.panel.snapshot()!.document,
      coloured,
    );
    editor.value = JSON.stringify([{ ...skinColourRegion(), unknown: true }]);
    await f.click("region-apply");
    TestValidator.equals(
      "invalid profile not published",
      f.panel.snapshot()!.document,
      coloured,
    );
    TestValidator.equals(
      "invalid profile reported",
      f.element("face-status").dataset.state,
      "error",
    );
    await f.click("face-save");
    TestValidator.equals(
      "download numerical pigment",
      JSON.parse(f.downloads[0].bytes as string),
      coloured,
    );
    editor.value = "[]";
    await f.click("region-apply");
    TestValidator.equals(
      "clear pigment",
      f.panel.snapshot()!.document.detail?.skinColour,
      [],
    );
    await f.click("region-inherit");
    TestValidator.equals(
      "inherit absent population",
      f.panel.snapshot()!.document.detail?.skinColour,
      undefined,
    );
  } finally {
    f.dom.window.close();
  }
};
