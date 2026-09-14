import { validateMeshTopology } from "@automovie/engine";
import { createPortraitMandibularDentition } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * Lower enamel has its own dimensions and follows only the rigid mandible.
 *
 * Scenarios:
 * 1. Mirroring crown growth preserves closed winding and places tips superiorly.
 * 2. Ten degrees of opening obey independent X-rotation math for every vertex.
 * 3. Changed lips and source buffers cannot move or mutate the captured arch.
 * 4. Exact angle/offset limits admit, while adjacent, invalid and nonresident inputs refuse.
 */
export const test_subject_mandibular_dentition = (): void => {
  const socket = { rightCorner: 0, leftCorner: 1, lowerLipMiddle: 2 };
  const row = {
    halfWidth: 24,
    depth: 18,
    gap: 0.1,
    crowns: [
      { width: 5, height: 7, depth: 1.5, cervicalWidth: 0.8, edgeRise: 0.3 },
    ],
  };
  const placement = { drop: 5, recess: 4 },
    jaw = { hinge: { x: 0, y: 0, z: -40 }, observed: 0, current: 0 };
  const host = {
    positions: [
      [-20, 0, 0],
      [20, 0, 0],
      [0, -10, 5],
    ],
    indices: [],
    viewRay: [0, 0, 1],
  };
  const refined = { positions: host.positions, indices: [], groups: [] };
  const component = createPortraitMandibularDentition(
      socket,
      row,
      placement,
      jaw,
    ),
    plan = component.fit(host),
    attached = plan.attach(refined, host.positions, () => 0);
  const geometry = attached.finish(refined)[0].geometry;
  if (geometry.type !== "mesh") throw new Error("Expected resident enamel.");
  TestValidator.equals(
    "no skin cut or deformation",
    [plan.constraints, plan.cutFaces, attached.openings],
    [[], [], []],
  );
  TestValidator.predicate(
    "closed outward geometry",
    validateMeshTopology({ mesh: geometry.mesh, expectClosed: true }).success,
  );
  const heights = geometry.mesh.positions.filter(
    (_value, index) => index % 3 === 1,
  );
  TestValidator.predicate(
    "cervical plane below tip",
    nclose(Math.min(...heights), -0.015) &&
      nclose(Math.max(...heights), -0.008),
  );
  const moving = createPortraitMandibularDentition(socket, row, placement, {
    ...jaw,
    current: 10,
  })
    .fit(host)
    .attach(refined, host.positions, () => 0)
    .finish(refined)[0].geometry;
  if (moving.type !== "mesh") throw new Error("Expected resident enamel.");
  const a = (10 * Math.PI) / 180;
  for (let i = 0; i < geometry.mesh.positions.length; i += 3) {
    const [x, y, z] = geometry.mesh.positions.slice(i, i + 3);
    TestValidator.predicate(
      "rigid mandibular rotation",
      nclose(moving.mesh.positions[i], x) &&
        nclose(
          moving.mesh.positions[i + 1],
          y * Math.cos(a) - (z + 0.04) * Math.sin(a),
        ) &&
        nclose(
          moving.mesh.positions[i + 2],
          -0.04 + y * Math.sin(a) + (z + 0.04) * Math.cos(a),
        ),
    );
  }
  host.positions[2][1] = 100;
  placement.drop = 99;
  row.crowns[0].width = 99;
  jaw.current = 25;
  TestValidator.equals(
    "captured frame ignores moving lips",
    attached.finish(refined)[0].geometry,
    geometry,
  );
  const changed = attached.finish(refined)[0].geometry;
  if (changed.type !== "mesh") throw new Error("Expected mesh.");
  changed.mesh.positions[0] = 999;
  TestValidator.equals(
    "returned geometry ownership",
    attached.finish(refined)[0].geometry,
    geometry,
  );
  const validRow = { ...row, crowns: [{ ...row.crowns[0], width: 5 }] };
  for (const current of [0, 25])
    for (const observed of [0, 25])
      createPortraitMandibularDentition(
        socket,
        validRow,
        { drop: 0, recess: 0 },
        { ...jaw, current, observed },
      );
  for (const value of [-0.001, 25.001, NaN, Infinity])
    for (const key of ["observed", "current"] as const)
      TestValidator.predicate(
        "invalid angle",
        throwsError(() =>
          createPortraitMandibularDentition(
            socket,
            validRow,
            { drop: 0, recess: 0 },
            { ...jaw, [key]: value },
          ),
        ),
      );
  for (const value of [-0.001, NaN, Infinity])
    for (const key of ["drop", "recess"] as const)
      TestValidator.predicate(
        "invalid placement",
        throwsError(() =>
          createPortraitMandibularDentition(
            socket,
            validRow,
            { drop: 0, recess: 0, [key]: value },
            jaw,
          ),
        ),
      );
  TestValidator.predicate(
    "invalid hinge",
    throwsError(() =>
      createPortraitMandibularDentition(
        socket,
        validRow,
        { drop: 0, recess: 0 },
        { ...jaw, hinge: { x: NaN, y: 0, z: 0 } },
      ),
    ),
  );
  for (const id of [-1, 3, 0.5])
    TestValidator.predicate(
      "invalid socket",
      throwsError(() =>
        createPortraitMandibularDentition(
          { ...socket, lowerLipMiddle: id },
          validRow,
          { drop: 0, recess: 0 },
          jaw,
        ).fit(host),
      ),
    );
};
