import { TestValidator } from "@nestia/e2e";

import { portraitEyeShape } from "../../subjects/generated-korean-girl-01/configuration";
import { createPortraitEyeComponent } from "../../subjects/generated-korean-girl-01/eyes";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The outer lid consumes supporting skin separately from its inner aperture.
 * Scenarios:
 * 1. On z=0.2y, every outer lid constraint remains on that plane.
 * 2. Removing the surrounding skin makes the same expanded attachment refuse.
 */
export const test_subject_eyelid_support = (): void => {
  const positions = [
    [-2, 0],
    [0, 1],
    [2, 0],
    [0, -1],
    [0, 0],
    [-20, -20],
    [20, -20],
    [20, 20],
    [-20, 20],
  ].map(([x, y]) => [x, y, 0.2 * y]);
  const indices = [0, 3, 4, 3, 2, 4, 2, 1, 4, 1, 0, 4];
  const inner = [0, 3, 2, 1],
    outer = [5, 6, 7, 8];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    indices.push(outer[i], outer[j], inner[i], outer[j], inner[j], inner[i]);
  }
  const socket = {
    name: "left" as const,
    top: [0, 1, 2],
    bottom: [0, 3, 2],
    iris: 4,
    browTop: [1],
    browBottom: [1],
  };
  const component = createPortraitEyeComponent(socket, {
    ...portraitEyeShape,
    widthScale: 1,
    openingScale: 1,
    socketLift: 0,
  });
  const host = { positions, indices, viewRay: [0, 0, 1] };
  const plan = component.fit(host);
  TestValidator.predicate(
    "outer seam follows actual skin",
    plan.constraints
      .filter((c) => c.vertex !== 4)
      .every((c) => nclose(c.target[2], 0.2 * c.target[1])),
  );
  TestValidator.predicate(
    "unsupported outer seam refuses",
    throwsError(
      () => component.fit({ ...host, indices: indices.slice(0, 12) }),
      "supporting skin",
    ),
  );
};
