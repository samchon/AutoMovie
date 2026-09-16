import { createPortraitEyeComponent } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitEyeHostFixture } from "../internal/portraitEyeHostFixture";
import { portraitEyeShapeFixture } from "../internal/portraitEyeShapeFixture";
import {
  portraitEyelashEyeFixture,
  portraitEyelashFixture,
} from "../internal/portraitEyelashFixture";
import { throwsError } from "../internal/predicates";

/**
 * An eye on an independent plane owns its selected lash profile across
 * deferred construction; the fixture carries no subject identity data.
 *
 * Scenarios:
 * 1. Mutating the caller's profile after eye creation cannot change the later
 *    strand or cause a previously admitted component to reject.
 * 2. A fresh component created after that mutation rejects the invalid value.
 */
export const test_subject_lash_ownership = (): void => {
  const { host, socket } = portraitEyeHostFixture();
  const shape = {
    ...portraitEyeShapeFixture(),
    upperLashProfile: portraitEyelashFixture(),
  };
  const control = createPortraitEyeComponent(socket, shape);
  const retained = createPortraitEyeComponent(socket, shape);
  const expected = portraitEyelashEyeFixture(control, host);
  shape.upperLashProfile.length = 21;
  const actual = portraitEyelashEyeFixture(retained, host);
  TestValidator.equals("deferred component owns profile", actual, expected);
  TestValidator.predicate(
    "fresh invalid shape refuses",
    throwsError(() => createPortraitEyeComponent(socket, shape), "length"),
  );
};
