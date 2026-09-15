import { createPortraitEyeComponent } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";
import {
  portraitEyelashEyeFixture,
  portraitEyelashFixture,
} from "../internal/portraitEyelashFixture";
import { throwsError } from "../internal/predicates";

/**
 * A fitted eye owns its selected lash profile across deferred construction.
 *
 * Scenarios:
 * 1. Mutating the caller's profile after eye creation cannot change the later
 *    strand or cause a previously admitted component to reject.
 * 2. A fresh component created after that mutation rejects the invalid value.
 */
export const test_subject_lash_ownership = (): void => {
  const doc = coarseHumanFaceFixture("lash-ownership");
  const shape = {
    ...doc.basis.recipe.eye,
    upperLashProfile: portraitEyelashFixture(),
  };
  const socket = doc.basis.bindings.eyes.right;
  const control = createPortraitEyeComponent(socket, shape);
  const retained = createPortraitEyeComponent(socket, shape);
  const expected = portraitEyelashEyeFixture(control, doc.basis.host);
  shape.upperLashProfile.length = 21;
  const actual = portraitEyelashEyeFixture(retained, doc.basis.host);
  TestValidator.equals("deferred component owns profile", actual, expected);
  TestValidator.predicate(
    "fresh invalid shape refuses",
    throwsError(() => createPortraitEyeComponent(socket, shape), "length"),
  );
};
