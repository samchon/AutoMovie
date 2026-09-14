import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { nclose } from "../internal/predicates";

/**
 * Dragging, committing and refusing a numeric input have different state effects.
 *
 * Scenarios:
 * 1. Slider drag mirrors the entry without committing; change commits the trait.
 * 2. Blank numeric input preserves the committed trait without starting a build.
 */
export const test_subject_human_panel_controls = async (): Promise<void> => {
  const f = createHumanPanelFixture();
  await f.panel.ready;
  const slider = f.element<HTMLInputElement>("trait-eyeWidth-slider");
  slider.value = ".1";
  slider.oninput!.call(slider, new f.dom.window.InputEvent("input"));
  TestValidator.equals(
    "drag mirrors entry",
    f.element<HTMLInputElement>("trait-eyeWidth").value,
    slider.value,
  );
  TestValidator.equals(
    "drag not committed",
    f.panel.snapshot()!.document.controls,
    undefined,
  );
  await slider.onchange!.call(slider, new f.dom.window.Event("change"));
  TestValidator.predicate(
    "trait committed",
    nclose(f.panel.snapshot()!.document.controls!.eyeWidth!, 0.1),
  );
  await f.change("trait-eyeWidth", "");
  TestValidator.predicate(
    "blank refusal",
    f.element("face-status").textContent!.includes("numeric value"),
  );
  TestValidator.predicate(
    "blank retains trait",
    nclose(f.panel.snapshot()!.document.controls!.eyeWidth!, 0.1),
  );
  f.dom.window.close();
};
