import {
  serializeHumanFaceDocument,
  setHumanFaceDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { portraitEyelashFixture } from "../internal/portraitEyelashFixture";

/**
 * Each lash slider writes the portable document through the shared detail
 * operation. DOM presentation and file delivery are separate panel concerns.
 *
 * Scenarios:
 * 1. Editing each of the seven common axes changes only that scalar, leaves
 *    the caller-owned document intact and survives JSON serialization.
 */
export const test_subject_human_lash_edit = (): void => {
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
    const edited = setHumanFaceDetail(face, id, edits[key]);
    const expected = structuredClone(face);
    expected.detail!.eye!.upperLashProfile![key] = edits[key];
    TestValidator.equals(`${key} changes only its scalar`, edited, expected);
    TestValidator.equals(
      `${key} portable JSON`,
      JSON.parse(serializeHumanFaceDocument(edited)),
      expected,
    );
  }
  TestValidator.equals("caller retains its document", face, untouched);
};
