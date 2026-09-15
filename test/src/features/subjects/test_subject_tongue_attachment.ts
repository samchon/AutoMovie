import { createPortraitTongueComponent } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitTongueFixture } from "../internal/portraitTongueFixture";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Lingual attachment reads the observed oral frame, not moving lip margins.
 *
 * Scenarios:
 * 1. A non-cutting component follows hand-calculated full/half/zero jaw
 *    weights at its tip, middle and posterior end, with metric output.
 * 2. Equal observed/current jaw and tongue values preserve shape; lip-only
 *    performance cannot carry the tongue. Returned and captured data are owned.
 * 3. Invalid sockets and a nonfinite hinge refuse before publishing anatomy.
 */
export const test_subject_tongue_attachment = (): void => {
  const socket = { rightCorner: 0, leftCorner: 1, lowerLipMiddle: 2 },
    shape = portraitTongueFixture();
  const hinge = { x: 0, y: 0, z: -40 };
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
  const component = createPortraitTongueComponent(socket, shape, hinge, {}, {}),
    plan = component.fit(host),
    attached = plan.attach(refined, host.positions, () => 0);
  const neutral = attached.finish(refined)[0].geometry;
  if (neutral.type !== "mesh") throw new Error("Expected lingual mesh.");
  TestValidator.equals(
    "non-cutting interior",
    [plan.constraints, plan.cutFaces, attached.openings],
    [[], [], []],
  );
  const moving = createPortraitTongueComponent(
    socket,
    shape,
    hinge,
    {},
    { jawOpen: 20 },
  )
    .fit(host)
    .attach(refined, host.positions, () => 0)
    .finish(refined)[0].geometry;
  if (moving.type !== "mesh") throw new Error("Expected moving lingual mesh.");
  for (const [i, degrees] of [
    [0, 20],
    [(1 + 15 * 48 + 12) * 3, 10],
    [neutral.mesh.positions.length - 3, 0],
  ]) {
    const [x, y, z] = neutral.mesh.positions.slice(i, i + 3),
      a = (degrees * Math.PI) / 180;
    TestValidator.predicate(
      "independent weighted rotation",
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
  const observed = { jawOpen: 7, tongueRaise: 3, tongueAdvance: 2 };
  const unchanged = createPortraitTongueComponent(
    socket,
    shape,
    hinge,
    observed,
    { ...observed, lipPart: 12, smile: { left: 4 }, pucker: 2 },
  )
    .fit(host)
    .attach(refined, host.positions, () => 0)
    .finish(refined)[0].geometry;
  TestValidator.equals("only independent performance acts", unchanged, neutral);
  host.positions[2][1] = 100;
  shape.dorsumRise = 10;
  hinge.z = -80;
  socket.lowerLipMiddle = -1;
  TestValidator.equals(
    "captured buffers owned",
    attached.finish(refined)[0].geometry,
    neutral,
  );
  neutral.mesh.positions[0] = 999;
  const fresh = attached.finish(refined)[0].geometry;
  if (fresh.type !== "mesh") throw new Error("Expected owned lingual mesh.");
  TestValidator.predicate(
    "returned buffers owned",
    fresh.mesh.positions[0] !== 999,
  );
  for (const id of [-1, 3, 0.5])
    TestValidator.predicate(
      "resident socket required",
      throwsError(
        () =>
          createPortraitTongueComponent(
            { ...socket, lowerLipMiddle: id },
            shape,
            hinge,
            {},
            {},
          ).fit(host),
        "sockets",
      ),
    );
  TestValidator.predicate(
    "finite hinge required",
    throwsError(() =>
      createPortraitTongueComponent(
        socket,
        shape,
        { ...hinge, x: NaN },
        {},
        {},
      ),
    ),
  );
};
