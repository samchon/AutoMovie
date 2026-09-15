import { createPortraitEyeComponent } from "@automovie/human/components/eyes";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { portraitEyelashEyeFixture } from "../internal/portraitEyelashFixture";
import { throwsError } from "../internal/predicates";

/**
 * The selected sphere fit reaches real lid rows and optical finishers while
 * omission retains the existing component, independent of caller mutation.
 *
 * Scenarios:
 * 1. Explicit aperture-plane fitting equals omission through the complete
 *    attachment/finisher; observation-ray fitting changes actual optical positions.
 * 2. A retained observation-ray component ignores later input edits and permits
 *    half closure with gaze while keeping all emitted coordinates finite.
 * 3. An unknown identity mode refuses immediately, beside both admitted modes.
 */
export const test_subject_eye_sphere_alignment_component = (): void => {
  const host = { ...referenceControlNet, viewRay: [0, 0, 1] };
  const base = {
    ...portraitEyeShape,
    skinAttachment: undefined,
    skinBridge: undefined,
    browFibres: 0,
    upperLashes: 1,
    sampling: { eyeColumns: 8, eyeRows: 4, irisColumns: 8, irisRows: 2 },
  };
  const build = (sphereFit?: "aperture-plane" | "observation-ray") =>
    portraitEyelashEyeFixture(
      createPortraitEyeComponent(portraitEyeSockets[0], { ...base, sphereFit }),
      host,
    );
  const old = build();
  TestValidator.equals(
    "explicit default component exact",
    build("aperture-plane"),
    old,
  );
  const shape = { ...base, sphereFit: "observation-ray" as const };
  const component = createPortraitEyeComponent(portraitEyeSockets[0], shape);
  Object.assign(shape, { sphereFit: "invalid" });
  const observed = portraitEyelashEyeFixture(component, host);
  TestValidator.equals(
    "selected fit owned",
    observed,
    build("observation-ray"),
  );
  const sclera = (result: typeof old) =>
    result.parts.find((p) => p.id === "right-sclera")!;
  const a = sclera(old).geometry,
    b = sclera(observed).geometry;
  TestValidator.predicate(
    "real optical geometry changes",
    a.type === "mesh" &&
      b.type === "mesh" &&
      a.mesh.positions.length === b.mesh.positions.length &&
      a.mesh.positions.some(
        (value, i) => Math.abs(value - b.mesh.positions[i]) > 1e-7,
      ),
  );
  const performed = portraitEyelashEyeFixture(
    createPortraitEyeComponent(
      portraitEyeSockets[0],
      { ...base, sphereFit: "observation-ray" },
      { blink: 0.5, observedBlink: 0, yaw: 2, pitch: 1 },
    ),
    host,
  );
  TestValidator.predicate(
    "selected optics and tissue perform finitely",
    performed.parts.length > 0 &&
      performed.parts.every(
        (p) =>
          p.geometry.type === "mesh" &&
          p.geometry.mesh.positions.length > 0 &&
          p.geometry.mesh.positions.every(Number.isFinite),
      ),
  );
  TestValidator.predicate(
    "unknown mode refuses at component admission",
    throwsError(
      () =>
        createPortraitEyeComponent(portraitEyeSockets[0], {
          ...base,
          sphereFit: "invalid" as "observation-ray",
        }),
      "dimensions",
    ),
  );
};
