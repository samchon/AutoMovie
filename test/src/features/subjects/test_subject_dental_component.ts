import { TestValidator } from "@nestia/e2e";

import { createPortraitDentalComponent } from "../../subjects/generated-korean-girl-01/dentalComponent";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The dental interior must read final skin anchors rather than the original
 * measured host. A translated refined host supplies an independent oracle.
 * Scenarios:
 * 1. No skin cut/constraint is introduced; the completed group follows a changed
 *    refined socket by the same metric translation and retains factory ownership.
 * 2. Nonresident sockets and nonfinite placement are refused.
 */
export const test_subject_dental_component = (): void => {
  const row = {
    halfWidth: 24,
    depth: 18,
    gap: 0.1,
    crowns: [
      { width: 8, height: 10, depth: 1.5, cervicalWidth: 0.8, edgeRise: 0.3 },
    ],
  };
  const socket = { rightCorner: 0, leftCorner: 1, upperLipMiddle: 2 },
    placement = { lift: 1, recess: 4 };
  const component = createPortraitDentalComponent(socket, row, placement);
  const host = {
    positions: [
      [-20, 0, 0],
      [20, 0, 0],
      [0, 0, 5],
    ],
    indices: [],
    viewRay: [0, 0, 1],
  };
  const plan = component.fit(host);
  TestValidator.equals(
    "interior does not alter host skin",
    [plan.constraints, plan.cutFaces],
    [[], []],
  );
  const refined = { positions: host.positions, indices: [], groups: [] };
  const attached = plan.attach(refined, host.positions, () => 0);
  TestValidator.equals("interior adds no opening", attached.openings, []);
  const before = attached.finish(refined)[0].geometry;
  socket.upperLipMiddle = 0;
  row.crowns[0].width = 99;
  placement.lift = 99;
  const after = attached.finish({
    ...refined,
    positions: refined.positions.map((p) => p.map((v, a) => v + [5, 8, 10][a])),
  })[0].geometry;
  if (before.type !== "mesh" || after.type !== "mesh")
    throw new Error("Expected resident dental meshes.");
  TestValidator.predicate(
    "group follows refined anchors in metres",
    before.mesh.positions.every((v, i) =>
      nclose(after.mesh.positions[i] - v, [0.005, 0.008, 0.01][i % 3], 1e-9),
    ),
  );
  for (const id of [-1, 3, 1.2]) {
    const invalid = createPortraitDentalComponent(
      { ...socket, rightCorner: id },
      row,
      { lift: 0, recess: 0 },
    );
    TestValidator.predicate(
      "invalid socket refuses",
      throwsError(() => invalid.fit(host), "resident"),
    );
  }
  TestValidator.predicate(
    "invalid placement refuses",
    throwsError(
      () =>
        createPortraitDentalComponent(socket, row, { lift: NaN, recess: 0 }),
      "finite",
    ),
  );
};
