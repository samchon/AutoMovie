import {
  createPortraitJawContinuation,
  portraitNeckShape,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * A continuation needs an anchored lower neck and a distinct anterior jaw.
 *
 * Scenarios:
 * 1. A valid hinge and separated attachment envelopes admit a field.
 * 2. Missing/nonfinite hinge, nonfinite anchor, a neck above the face and a hinge
 *    ahead of or below the lower face are refused instead of clipping dimensions.
 * 3. An oral band below every face sample has no lower attachment and refuses.
 */
export const test_subject_jaw_continuation_refusals = (): void => {
  const { host, bindings } = humanFaceFixture().basis;
  bindings.jawHinge = { x: 0, y: 0, z: -45 };
  const make = () =>
    createPortraitJawContinuation(host, bindings, {}, { jawOpen: 25 }, neck);
  const neck = structuredClone(portraitNeckShape);
  TestValidator.predicate("admitted envelope", make() !== undefined);
  bindings.jawHinge.y = -1000;
  TestValidator.predicate("hinge below chin", throwsError(make));
  bindings.jawHinge.y = 0;
  for (const value of [NaN, 100]) {
    neck.lower.y = value;
    TestValidator.predicate("invalid anchor", throwsError(make));
  }
  neck.lower.y = portraitNeckShape.lower.y;
  for (const z of [NaN, 1000]) {
    bindings.jawHinge.z = z;
    TestValidator.predicate("invalid hinge", throwsError(make));
  }
  delete bindings.jawHinge;
  TestValidator.predicate("absent hinge", throwsError(make));
  bindings.jawHinge = { x: 0, y: 0, z: -45 };
  host.positions[
    bindings.mouth.lower[Math.floor(bindings.mouth.lower.length / 2)]
  ][1] = -10000;
  let refusal = "";
  try {
    make();
  } catch (error) {
    refusal = String(error);
  }
  TestValidator.predicate(
    "no lower attachment",
    refusal.includes("Jaw continuation needs lower facial attachments"),
  );
};
