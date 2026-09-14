import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Neutral and observed are independent choices, even for the same source identity.
 *
 * Scenarios:
 * 1. Observed restores the source's six-millimetre lip separation.
 * 2. Neutral clears the current channels without overwriting the observation.
 */
export const test_subject_human_panel_presets = async (): Promise<void> => {
  const face = humanFaceFixture("observed");
  face.basis.expression = { lipPart: 6 };
  const f = createHumanPanelFixture({ face });
  await f.panel.ready;
  for (const preset of ["observed", "neutral"]) {
    const button = f.app.querySelector<HTMLButtonElement>(
      `[data-expression='${preset}']`,
    )!;
    await button.onclick!.call(button, f.clickEvent());
    TestValidator.equals(
      "chosen expression",
      f.panel.snapshot()!.document.expression,
      preset === "observed" ? { lipPart: 6 } : {},
    );
  }
  TestValidator.equals(
    "observation retained",
    f.panel.snapshot()!.document.basis.expression,
    { lipPart: 6 },
  );
  f.dom.window.close();
};
