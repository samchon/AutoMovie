import { createPortraitEyeComponent } from "@automovie/human/components/eyes";
import { TestValidator } from "@nestia/e2e";

import { portraitEyeHostFixture } from "../internal/portraitEyeHostFixture";
import { portraitEyeShapeFixture } from "../internal/portraitEyeShapeFixture";
import { portraitEyelashEyeFixture } from "../internal/portraitEyelashFixture";
import { throwsError } from "../internal/predicates";

/**
 * A closed performance retains its complete globe and optical surfaces under the lids.
 * The host is an independent tilted plane with a diamond aperture; its small
 * connected skin patch reaches actual fit, attachment and finish without
 * identity data. Cranial assembly has its own complete-host scenarios.
 *
 * Scenarios:
 * 1. Closed lids with nonzero gaze produce finite resident optics and no exposed wet strip.
 * 2. Mutating the caller's performance cannot corrupt the retained component.
 * 3. Aperture-clipped optics refuse performance before allocation.
 */
export const test_subject_eye_performance_component = (): void => {
  const { host, socket } = portraitEyeHostFixture();
  const shape = {
    ...portraitEyeShapeFixture(),
    browFibres: 0,
    upperLashes: 1,
    sampling: { eyeColumns: 12, eyeRows: 8, irisColumns: 12, irisRows: 3 },
  };
  const performance = { blink: 1, observedBlink: 0.1, yaw: 8, pitch: -3 };
  TestValidator.predicate(
    "clipped optical shape refuses",
    throwsError(() =>
      createPortraitEyeComponent(
        socket,
        { ...shape, cornealBoundary: "aperture" },
        performance,
      ),
    ),
  );
  TestValidator.predicate(
    "missing full-shell contact refuses",
    throwsError(() =>
      createPortraitEyeComponent(
        socket,
        { ...shape, lidContact: "globe" },
        performance,
      ),
    ),
  );
  const component = createPortraitEyeComponent(socket, shape, performance);
  performance.blink = -1;
  const head = portraitEyelashEyeFixture(component, host);
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
