import { TestValidator } from "@nestia/e2e";

import { portraitWebReferenceFrame } from "../../../scripts/face-review/web/logic.mjs";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Recorded image framing shares Blender's Y-up pose and image crop calculation.
 * Scenarios:
 * 1. Identity and a hand-authored quarter-turn rotate the 28/60 mm pose offset
 *    into independently calculated crop centres and preserve a 100 mm span.
 * 2. Missing/nonfinite rotation, malformed origin, zero scale and zero crop refuse.
 */
export const test_subject_face_web_reference = (): void => {
  const profile = {
    measurement: {
      rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [10, -20, 0],
      millimetersPerPixel: 1,
    },
    reference: { crop: { x: 10, y: 20, size: 100 } },
  };
  const identity = portraitWebReferenceFrame(profile);
  TestValidator.predicate(
    "identity centre and units",
    nclose(identity.target[0], 0.05) &&
      nclose(identity.target[1], -0.022) &&
      nclose(identity.span, 0.1),
  );
  TestValidator.equals(
    "front orthographic direction",
    identity.position.slice(2),
    [1],
  );
  TestValidator.equals(
    "identity model pose",
    identity.matrix,
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  );
  const quarter = portraitWebReferenceFrame({
    ...profile,
    measurement: {
      ...profile.measurement,
      rotation: [0, -1, 0, 1, 0, 0, 0, 0, 1],
    },
  });
  TestValidator.predicate(
    "quarter-turn centre",
    nclose(quarter.target[0], 0.022) && nclose(quarter.target[1], -0.05),
  );
  TestValidator.equals(
    "direct row-major pose",
    quarter.matrix,
    [0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  );
  for (const patch of [
    { rotation: [] },
    { origin: [0, 0] },
    { millimetersPerPixel: 0 },
    { millimetersPerPixel: Infinity },
  ])
    TestValidator.predicate(
      "invalid reference measurement refuses",
      throwsError(
        () =>
          portraitWebReferenceFrame({
            ...profile,
            measurement: { ...profile.measurement, ...patch },
          }),
        "finite recorded",
      ),
    );
  TestValidator.predicate(
    "empty crop refuses",
    throwsError(
      () =>
        portraitWebReferenceFrame({
          ...profile,
          reference: { crop: { ...profile.reference.crop, size: 0 } },
        }),
      "finite recorded",
    ),
  );
};
