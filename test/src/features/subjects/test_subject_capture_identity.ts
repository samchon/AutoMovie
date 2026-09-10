import { TestValidator } from "@nestia/e2e";

import { inspectPortraitCapture } from "../../subjects/portraitCaptureDiagnostic";
import { createPortraitCaptureFixture } from "../internal/createPortraitCaptureFixture";
import { throwsError } from "../internal/predicates";

/**
 * A diagnostic binds its complete consumed input set, not just model/profile.
 *
 * Scenarios:
 * 1. An exact-edge source crop and complete receipt admit coherent bytes.
 * 2. Changing each consumed byte population refuses the stale receipt.
 * 3. A different target/frame or missing, duplicate, renamed frame is refused.
 * 4. Nonfinite, empty, negative and out-of-image crop extents are refused.
 */
export const test_subject_capture_identity = (): void => {
  const valid = createPortraitCaptureFixture();
  TestValidator.equals(
    "exact crop edge is admitted",
    inspectPortraitCapture(valid.bytes, valid.expected).profile.reference.crop,
    { x: 10, y: 0, size: 30 },
  );
  for (const key of [
    "input",
    "model",
    "configuration",
    "gltf",
    "profile",
    "reference",
  ] as const) {
    const fixture = createPortraitCaptureFixture();
    fixture.bytes[key] = Buffer.from("changed " + key);
    TestValidator.predicate(
      "changed " + key,
      throwsError(() =>
        inspectPortraitCapture(fixture.bytes, fixture.expected),
      ),
    );
  }
  const refuse = (
    name: string,
    edit: (fixture: ReturnType<typeof createPortraitCaptureFixture>) => void,
  ) => {
    const fixture = createPortraitCaptureFixture();
    edit(fixture);
    fixture.seal();
    TestValidator.predicate(
      name,
      throwsError(() =>
        inspectPortraitCapture(fixture.bytes, fixture.expected),
      ),
    );
  };
  refuse("different target", (f) => {
    f.expected.input = "another source";
  });
  refuse("different frame", (f) => {
    f.profile.measurement.origin[0]++;
  });
  refuse("duplicate planned view", (f) => {
    f.profile.views.push({ name: "front" });
  });
  refuse("missing frame", (f) => {
    f.receipt.captures.pop();
  });
  refuse("duplicate frame with same total", (f) => {
    f.receipt.captures[0] = f.receipt.captures[1];
  });
  refuse("renamed file", (f) => {
    f.receipt.captures[0].file = "elsewhere.png";
  });
  for (const [name, edit] of [
    [
      "nonfinite extent",
      (f) => {
        f.profile.reference.width = Infinity;
      },
    ],
    [
      "empty width",
      (f) => {
        f.profile.reference.width = 0;
      },
    ],
    [
      "empty height",
      (f) => {
        f.profile.reference.height = 0;
      },
    ],
    [
      "negative X",
      (f) => {
        f.profile.reference.crop.x = -1;
      },
    ],
    [
      "negative Y",
      (f) => {
        f.profile.reference.crop.y = -1;
      },
    ],
    [
      "empty crop",
      (f) => {
        f.profile.reference.crop.size = 0;
      },
    ],
    [
      "right overflow",
      (f) => {
        f.profile.reference.crop.x = 11;
      },
    ],
    [
      "bottom overflow",
      (f) => {
        f.profile.reference.crop.y = 1;
      },
    ],
  ] as [string, (f: ReturnType<typeof createPortraitCaptureFixture>) => void][])
    refuse(name, edit);
};
