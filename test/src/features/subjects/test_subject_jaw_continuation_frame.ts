import {
  createPortraitJawContinuation,
  portraitNeckShape,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { nclose } from "../internal/predicates";

/**
 * Continuation attachment limits belong to the authored head frame.
 *
 * Scenarios:
 * 1. Translating the host, hinge and cervical frame translates the performed
 *    point by the same independent vector without changing its attachment.
 * 2. A closed observed oral band still gives a finite moving continuation.
 */
export const test_subject_jaw_continuation_frame = (): void => {
  const { host, bindings } = humanFaceFixture().basis;
  bindings.jawHinge = { x: 0, y: 0, z: -45 };
  const neck = structuredClone(portraitNeckShape),
    delta = [17, 23, -11];
  const field = createPortraitJawContinuation(
    host,
    bindings,
    {},
    { jawOpen: 20 },
    neck,
  )!;
  const point = [5, -110, 10],
    expected = field.pose(point);
  host.positions = host.positions.map((p) => p.map((v, i) => v + delta[i]));
  bindings.jawHinge = { x: 17, y: 23, z: -56 };
  neck.lower.y += 23;
  const moved = createPortraitJawContinuation(
    host,
    bindings,
    {},
    { jawOpen: 20 },
    neck,
  )!;
  const actual = moved.pose(point.map((v, i) => v + delta[i]));
  TestValidator.predicate(
    "frame covariance",
    actual.every((v, i) => nclose(v, expected[i] + delta[i])),
  );
  const upper =
      bindings.mouth.upper[Math.floor(bindings.mouth.upper.length / 2)],
    lower = bindings.mouth.lower[Math.floor(bindings.mouth.lower.length / 2)];
  host.positions[lower][1] = host.positions[upper][1];
  const closed = createPortraitJawContinuation(
    host,
    bindings,
    {},
    { jawOpen: 20 },
    neck,
  )!;
  const posed = closed.pose(point.map((v, i) => v + delta[i]));
  TestValidator.predicate(
    "closed reference still moves",
    posed.every(Number.isFinite) &&
      posed.some((v, i) => !nclose(v, point[i] + delta[i])),
  );
};
