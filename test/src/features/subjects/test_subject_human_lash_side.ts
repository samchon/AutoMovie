import { humanFaceDetailValue, setHumanFaceDetail } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { portraitEyelashFixture } from "../internal/portraitEyelashFixture";

/**
 * Anatomical lash overrides do not mirror an edit onto the unselected eye.
 *
 * Scenarios:
 * 1. Each of the seven right-eye detail edits resolves to its requested value
 *    while the left eye retains the common profile.
 * 2. The caller-owned document remains unchanged after all edits.
 */
export const test_subject_human_lash_side = (): void => {
  const face = humanFaceFixture();
  face.detail = { eye: { upperLashProfile: portraitEyelashFixture() } };
  const untouched = structuredClone(face);
  const edits = {
    length: 7,
    elevation: -15,
    curl: 60,
    fan: 40,
    radius: 0.08,
    taper: 0.7,
    variation: 0.3,
  };
  for (const key of Object.keys(edits) as (keyof typeof edits)[]) {
    const id = `eye.upperLashProfile.${key}`;
    const side = setHumanFaceDetail(face, id, edits[key], "right");
    TestValidator.equals(
      `${key} selected side`,
      humanFaceDetailValue(side, id, "right"),
      edits[key],
    );
    TestValidator.equals(
      `${key} other side inherits`,
      humanFaceDetailValue(side, id, "left"),
      portraitEyelashFixture()[key],
    );
  }
  TestValidator.equals("caller retains its document", face, untouched);
};
