import { createPortraitEyeComponent } from "@automovie/human/components/eyes";
import { buildPortraitHead } from "@automovie/human/components/head";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { throwsError } from "../internal/predicates";

/**
 * A closed performance retains its complete globe and optical surfaces under the lids.
 *
 * Scenarios:
 * 1. Closed lids with nonzero gaze produce finite resident optics and no exposed wet strip.
 * 2. Mutating the caller's performance cannot corrupt the retained component.
 * 3. Aperture-clipped optics refuse performance before allocation.
 */
export const test_subject_eye_performance_component = (): void => {
  const shape = {
    ...portraitEyeShape,
    browFibres: 0,
    upperLashes: 1,
    sampling: { eyeColumns: 12, eyeRows: 8, irisColumns: 12, irisRows: 3 },
  };
  const performance = { blink: 1, observedBlink: 0.1, yaw: 8, pitch: -3 };
  TestValidator.predicate(
    "clipped optical shape refuses",
    throwsError(() =>
      createPortraitEyeComponent(
        portraitEyeSockets[0],
        { ...shape, cornealBoundary: "aperture" },
        performance,
      ),
    ),
  );
  TestValidator.predicate(
    "missing full-shell contact refuses",
    throwsError(() =>
      createPortraitEyeComponent(
        portraitEyeSockets[0],
        { ...shape, lidContact: "globe" },
        performance,
      ),
    ),
  );
  const component = createPortraitEyeComponent(
    portraitEyeSockets[0],
    shape,
    performance,
  );
  performance.blink = -1;
  const head = buildPortraitHead(referenceControlNet, [component], 0);
  TestValidator.predicate(
    "resident closed optics",
    ["right-sclera", "right-cornea", "right-pupil"].every((id) =>
      head.parts.some((part) => part.id === id),
    ),
  );
  TestValidator.predicate(
    "closed wet strip omitted",
    !head.parts.some((part) => part.id === "right-lower-lid-margin"),
  );
  TestValidator.predicate(
    "finite nonempty closed geometry",
    head.parts.every(
      (part) =>
        part.geometry.type === "mesh" &&
        part.geometry.mesh.positions.length > 0 &&
        part.geometry.mesh.positions.every(Number.isFinite),
    ),
  );
};
