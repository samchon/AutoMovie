import { createPortraitEyeComponent } from "@automovie/human/components/eyes";
import { buildPortraitHead } from "@automovie/human/components/head";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { nclose } from "../internal/predicates";

/**
 * Independent optical depth reaches the assembled optical body and remains
 * identity, not an offset added again when the same eye blinks.
 *
 * Scenarios:
 * 1. A one-millimetre depth change translates the assembled sclera, iris,
 *    pupil and cornea by one normalized view-ray millimetre without scaling.
 * 2. Closing the shifted eye retains the same optical population and geometry.
 * 3. Combined yaw and pitch keep the same translation, proving that gaze uses
 *    the shifted identity centre rather than rotating about the old socket.
 */
export const test_subject_eye_globe_depth_performance = (): void => {
  const shape = {
    ...portraitEyeShape,
    browFibres: 0,
    upperLashes: 1,
    sampling: { eyeColumns: 8, eyeRows: 4, irisColumns: 8, irisRows: 2 },
  };
  const build = (globeLift: number, blink: number, yaw = 0, pitch = 0) =>
    buildPortraitHead(
      referenceControlNet,
      [
        createPortraitEyeComponent(
          portraitEyeSockets[0],
          { ...shape, globeLift },
          { blink, observedBlink: 0, yaw, pitch },
        ),
      ],
      0,
    );
  const optical = (head: ReturnType<typeof build>) =>
    head.parts.filter((p) =>
      /^right-(sclera|iris-\d+|pupil|cornea)$/.test(p.id),
    );
  const base = optical(build(0, 0)),
    shifted = optical(build(1, 0));
  TestValidator.predicate(
    "all optical organs were selected",
    ["right-sclera", "right-pupil", "right-cornea"].every((id) =>
      base.some((p) => p.id === id),
    ) && base.some((p) => p.id.startsWith("right-iris-")),
  );
  TestValidator.equals(
    "depth retains the optical population",
    shifted.map((p) => p.id),
    base.map((p) => p.id),
  );
  const ray = referenceControlNet.viewRay,
    norm = Math.hypot(...ray);
  const translated = (original: typeof base, moved: typeof base): void => {
    TestValidator.equals(
      "same selected organ identities",
      moved.map((p) => p.id),
      original.map((p) => p.id),
    );
    for (let i = 0; i < original.length; i++) {
      const a = original[i],
        b = moved[i];
      TestValidator.equals(
        "unchanged part transform",
        b.transform,
        a.transform,
      );
      TestValidator.predicate(
        "mesh optical body",
        a.geometry.type === "mesh" && b.geometry.type === "mesh",
      );
      const ma = (a.geometry as Extract<typeof a.geometry, { type: "mesh" }>)
        .mesh;
      const mb = (b.geometry as Extract<typeof b.geometry, { type: "mesh" }>)
        .mesh;
      TestValidator.equals(
        "same optical tessellation",
        mb.positions.length,
        ma.positions.length,
      );
      TestValidator.predicate(
        "translation retains optical normals",
        ma.normals !== null &&
          mb.normals !== null &&
          ma.normals.length === mb.normals.length &&
          mb.normals.every((value, j) => nclose(value, ma.normals![j], 1e-10)),
      );
      TestValidator.predicate(
        "one millimetre translation with no scaling",
        mb.positions.every((value, j) =>
          nclose(value - ma.positions[j], ray[j % 3] / norm / 1000, 1e-7),
        ),
      );
    }
  };
  translated(base, shifted);
  TestValidator.equals(
    "blink does not apply depth twice",
    optical(build(1, 1)),
    shifted,
  );
  translated(optical(build(0, 0, 12, -8)), optical(build(1, 0, 12, -8)));
};
