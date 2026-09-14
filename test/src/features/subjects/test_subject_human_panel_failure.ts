import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";
import { nclose } from "../internal/predicates";

/**
 * A failed numerical build is visible without replacing the committed document.
 *
 * Scenarios:
 * 1. A trait one value outside its range is refused by the actual document interpreter.
 * 2. A valid retry clears the error and commits through the same panel operation.
 */
export const test_subject_human_panel_failure = async (): Promise<void> => {
  const face = humanFaceFixture("valid");
  face.controls = { eyeWidth: 0.1 };
  const f = createHumanPanelFixture({ face });
  await f.panel.ready;
  await f.change("trait-eyeWidth", "999");
  TestValidator.predicate(
    "failed build retains value",
    nclose(f.panel.snapshot()!.document.controls!.eyeWidth!, 0.1),
  );
  TestValidator.equals(
    "failed build visible",
    f.panel.snapshot()!.status,
    "error",
  );
  await f.change("trait-eyeWidth", ".2");
  TestValidator.predicate(
    "retry commits",
    nclose(f.panel.snapshot()!.document.controls!.eyeWidth!, 0.2),
  );
  TestValidator.equals("retry clears failure", f.panel.snapshot()!.error, null);
  f.dom.window.close();
};
