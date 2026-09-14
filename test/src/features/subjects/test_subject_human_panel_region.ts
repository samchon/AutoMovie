import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { nclose } from "../internal/predicates";

/**
 * Unpaired regions clear side selection and reject malformed complete profiles.
 *
 * Scenarios:
 * 1. Nasal editing owns the common profile and disables side controls.
 * 2. Invalid JSON and unknown profile fields leave the successful detail intact.
 * 3. Whole-profile inheritance removes its explicit override.
 */
export const test_subject_human_panel_region = async (): Promise<void> => {
  const f = createHumanPanelFixture();
  await f.panel.ready;
  await f.change("face-region", "nose");
  TestValidator.equals(
    "side unavailable",
    [
      f.element<HTMLSelectElement>("face-side").disabled,
      f.element<HTMLSelectElement>("face-side").value,
    ],
    [true, ""],
  );
  await f.change("detail-nose-widthScale", "1.1");
  for (const text of ["{ broken", '{"unknown":1}']) {
    f.element<HTMLTextAreaElement>("region-json").value = text;
    await f.click("region-apply");
    TestValidator.equals(
      "bad replacement visible",
      f.element("face-status").dataset.state,
      "error",
    );
    TestValidator.predicate(
      "committed value retained",
      nclose(f.panel.snapshot()!.document.detail!.nose!.widthScale!, 1.1),
    );
  }
  await f.click("region-inherit");
  TestValidator.equals(
    "whole profile inherits",
    f.panel.snapshot()!.document.detail!.nose,
    undefined,
  );
  f.dom.window.close();
};
