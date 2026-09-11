import { createAutoMovieMeshDeformer } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createPortraitCheekLayer } from "../../subjects/generated-korean-girl-01/cheeks";
import { portraitCheekLayersFor } from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { createPortraitCheekFixture } from "../internal/createPortraitCheekFixture";
import { nclose } from "../internal/predicates";

/**
 * Named cheek envelopes use millimetre attachments and metric displacement,
 * retain caller ownership, and refit to the current host on each evaluation.
 *
 * Scenarios:
 * 1. A two-millimetre malar projection gives exactly that movement at its
 *    centre, 27/64 of it halfway across its support, and zero at the boundary.
 * 2. A lift-only envelope, four independent envelopes, neutral relief and the
 *    opposite side retain distinct controls and stable anatomical identities.
 * 3. Caller edits cannot change an existing layer; translating the host moves
 *    attachments without changing the metric dimensions or displacement.
 */
export const test_subject_cheek_volume = (): void => {
  const { socket, shape, host } = createPortraitCheekFixture();
  TestValidator.equals(
    "neutral relief",
    createPortraitCheekLayer(socket, shape).fields(host),
    [],
  );
  shape.malar.projection = 2;
  const layer = createPortraitCheekLayer(socket, shape);
  const before = structuredClone(host);
  const fields = layer.fields(host);
  const result = createAutoMovieMeshDeformer(fields)({
    positions: [0, 0, 0, 0.01, 0, 0, 0.02, 0, 0],
    indices: [],
    normals: null,
    uvs: null,
    skin: null,
  });
  TestValidator.predicate(
    "millimetres become metres",
    nclose(result.positions[2], 0.002),
  );
  TestValidator.predicate(
    "cubic support has independent oracle",
    nclose(result.positions[5], (0.002 * 27) / 64),
  );
  TestValidator.equals(
    "support boundary unchanged",
    result.positions.slice(6),
    [0.02, 0, 0],
  );
  shape.malar.projection = 9;
  socket.malar = 2;
  socket.nasolabial[0] = 999;
  TestValidator.equals(
    "layer owns its configuration",
    layer.fields(host),
    fields,
  );
  const translated = {
    ...host,
    positions: host.positions.map((p) => [p[0] + 30, p[1] - 20, p[2] + 5]),
  };
  const moved = layer.fields(translated)[0];
  TestValidator.equals(
    "refined attachment follows current host",
    moved.center,
    { x: 0.03, y: -0.02, z: 0.005 },
  );
  TestValidator.equals(
    "translation preserves dimensions",
    moved.radius,
    fields[0].radius,
  );
  TestValidator.equals(
    "translation preserves displacement",
    moved.displacement,
    fields[0].displacement,
  );
  TestValidator.equals("host retained", host, before);
  const next = createPortraitCheekFixture();
  next.shape.medial.lift = 3;
  const lift = createPortraitCheekLayer(next.socket, next.shape).fields(
    next.host,
  );
  TestValidator.equals("lift without projection", lift[0].displacement, {
    x: 0,
    y: 0.003,
    z: 0,
  });
  for (const name of ["malar", "medial", "buccal", "modiolus"] as const)
    next.shape[name].projection = 1;
  TestValidator.equals(
    "four named envelopes",
    createPortraitCheekLayer(next.socket, next.shape).fields(next.host).length,
    4,
  );
  TestValidator.equals(
    "anatomical side identity",
    [
      layer.id,
      createPortraitCheekLayer({ ...next.socket, side: "left" }, next.shape).id,
    ],
    ["right-cheek", "left-cheek"],
  );
  const independent = createPortraitCheekFixture();
  independent.shape.malar.projection = 1;
  const left = {
    ...independent.shape,
    malar: { ...independent.shape.malar, projection: 4 },
  };
  const [rightLayer, leftLayer] = portraitCheekLayersFor(
    independent.shape,
    left,
  );
  const basis = { ...referenceControlNet, normals: [] };
  const rightField = rightLayer.fields(basis)[0],
    leftField = leftLayer.fields(basis)[0];
  TestValidator.equals(
    "paired controls retain their own values",
    [rightField.displacement.z, leftField.displacement.z],
    [0.001, 0.004],
  );
  TestValidator.predicate(
    "paired sockets retain anatomical sides",
    rightField.center.x < 0 && leftField.center.x > 0,
  );
};
