import { createPortraitMaterials } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";
import { nclose } from "../internal/predicates";

/**
 * Performance presets and linear reflectance remain separate from anatomical identity.
 *
 * Scenarios:
 * 1. Scalar and paired expression entries update their exact channel owners.
 * 2. Editing an explicit palette changes one component and keeps the remaining material facts.
 */
export const test_subject_human_panel_expression = async (): Promise<void> => {
  const face = humanFaceFixture("observed");
  face.basis.expression = { lipPart: 6 };
  face.appearance = createPortraitMaterials();
  face.reference = {
    url: null,
    sha256: null,
    author: null,
    license: null,
    decision: "Authored source without a photograph.",
  };
  const f = createHumanPanelFixture({ face });
  await f.panel.ready;
  TestValidator.equals(
    "reference decision displayed",
    f.element("source-note").textContent,
    face.reference.decision,
  );
  await f.change("expression-lipPart-common", "5");
  await f.change("expression-gazeYaw-left", "3");
  TestValidator.equals(
    "independent channel update",
    [
      f.panel.snapshot()!.document.expression!.lipPart,
      f.panel.snapshot()!.document.expression!.gazeYaw,
    ],
    [5, { right: 0, left: 3 }],
  );
  await f.change("material-skin-r", ".4");
  const skin = f.panel
    .snapshot()!
    .document.appearance!.find((material) => material.id === "skin")!;
  TestValidator.predicate(
    "linear reflectance edited",
    nclose(skin.baseColor.r, 0.4),
  );
  TestValidator.equals("hex projection invalidated", skin.baseColor.hex, null);
  TestValidator.equals(
    "anatomical recipe preserved",
    f.panel.snapshot()!.document.basis.recipe,
    face.basis.recipe,
  );
  f.dom.window.close();
};
