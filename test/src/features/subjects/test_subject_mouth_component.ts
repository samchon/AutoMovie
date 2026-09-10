import { TestValidator } from "@nestia/e2e";

import {
  portraitMouthShape,
  portraitMouthSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import {
  buildPortraitMouth,
  createPortraitMouthComponent,
} from "../../subjects/generated-korean-girl-01/mouth";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Mouth replacement owns its lip attachments and finishes against the actual
 * refined opening. Dental dimensions are independent of anatomical width.
 *
 * Scenarios:
 * 1. Replace the width, opening, corner elevation and upper/lower projection.
 *    Original cut identities stay fixed while both lip bands receive the edit.
 * 2. Mutating the caller's socket or crown array cannot change an existing part.
 *    A finisher follows translated refined vertices, not the original host.
 * 3. One crown on a flat arch has independently calculated metric bounds;
 *    an empty dental row retains the cavity without inventing crowns.
 * 4. Invalid scale, depth, gap, projection and crown dimensions are refused,
 *    while zero offsets/reach/gap and an empty row remain valid.
 */
export const test_subject_mouth_component = (): void => {
  const host = referenceControlNet;
  const baseline = createPortraitMouthComponent(
    portraitMouthSocket,
    portraitMouthShape,
  ).fit(host);
  const replacement = createPortraitMouthComponent(portraitMouthSocket, {
    ...portraitMouthShape,
    widthScale: 1.1,
    openingScale: 0.8,
    cornerLift: 1,
    upperLipProjection: 2,
    lowerLipProjection: -1,
  }).fit(host);
  TestValidator.equals(
    "oral cuts remain attached",
    replacement.cutFaces,
    baseline.cutFaces,
  );
  const points = [
    ...portraitMouthSocket.upper,
    ...portraitMouthSocket.lower,
  ].map((id) => host.positions[id]);
  const centerX =
    (Math.min(...points.map((p) => p[0])) +
      Math.max(...points.map((p) => p[0]))) /
    2;
  TestValidator.predicate(
    "width follows the socket centre",
    replacement.constraints.every((c) =>
      nclose(
        c.target[0] - centerX,
        (host.positions[c.vertex][0] - centerX) * 1.1,
      ),
    ),
  );
  TestValidator.predicate(
    "both lip bands change",
    replacement.constraints.some(
      (c) => c.target[2] > host.positions[c.vertex][2],
    ) &&
      replacement.constraints.some(
        (c) => c.target[2] < host.positions[c.vertex][2],
      ),
  );

  const shape = { ...portraitMouthShape, crowns: [{ width: 4, height: 6 }] };
  const socket = {
    ...portraitMouthSocket,
    upper: [...portraitMouthSocket.upper],
  };
  const component = createPortraitMouthComponent(socket, shape);
  const before = component.fit(host);
  shape.crowns[0].width = 40;
  socket.upper.reverse();
  TestValidator.equals(
    "component owns its inputs",
    component.fit(host).constraints,
    before.constraints,
  );
  const removed = new Set(before.cutFaces);
  const cage = {
    positions: host.positions.map((p) => [...p]),
    indices: host.indices.filter((_v, i) => !removed.has(Math.floor(i / 3))),
    groups: [] as number[],
  };
  cage.groups = new Array(cage.indices.length / 3).fill(0);
  const attached = before.attach(cage, cage.positions, () => 1);
  TestValidator.predicate(
    "lip region is painted on shared skin",
    cage.groups.includes(1) && cage.groups.includes(0),
  );
  const original = attached.finish(cage);
  const moved = attached.finish({
    ...cage,
    positions: cage.positions.map((p) => [p[0], p[1] + 10, p[2] + 5]),
  });
  TestValidator.equals("one cavity and one crown", original.length, 2);
  for (let i = 0; i < original.length; i++) {
    const a = original[i].geometry,
      b = moved[i].geometry;
    if (a.type !== "mesh" || b.type !== "mesh")
      throw new Error("Mouth must produce resident meshes.");
    TestValidator.predicate(
      "interior follows the refined aperture",
      a.mesh.positions.every(
        (v, j) =>
          Math.abs(b.mesh.positions[j] - v - [0, 0.01, 0.005][j % 3]) < 1e-10,
      ),
    );
  }
  const flatSocket = {
    outer: [],
    upper: [0, 1, 2],
    lower: [0, 3, 2],
    lipSeed: 0,
  };
  const flat = [
    [-10, 0, 0],
    [0, 2, 0],
    [10, 0, 0],
    [0, -2, 0],
  ];
  const dental = {
    ...portraitMouthShape,
    dentalOffset: 0,
    dentalDrop: 2,
    dentalRecess: 3,
    dentalDepth: 1,
    toothGap: 0,
    crowns: [{ width: 4, height: 6 }],
  };
  const tooth = buildPortraitMouth(flat, flatSocket, dental)[1].geometry;
  if (tooth.type !== "mesh") throw new Error("Crown must be a resident mesh.");
  for (let axis = 0; axis < 3; axis++) {
    const values = tooth.mesh.positions.filter((_v, i) => i % 3 === axis);
    TestValidator.predicate(
      "independent crown bounds",
      Math.abs(Math.min(...values) - [-0.002, -0.003, -0.004][axis]) < 1e-7 &&
        Math.abs(Math.max(...values) - [0.002, 0.003, -0.002][axis]) < 1e-7,
    );
  }
  TestValidator.equals(
    "empty dental row",
    buildPortraitMouth(flat, flatSocket, { ...dental, crowns: [] }).length,
    1,
  );
  createPortraitMouthComponent(portraitMouthSocket, {
    ...dental,
    blendReach: 0,
    dentalDrop: 0,
    dentalRecess: 0,
    crowns: [],
  });
  createPortraitMouthComponent(portraitMouthSocket, {
    ...dental,
    toothGap: 4,
    crowns: [{ width: 4, height: 6 }],
  });
  for (const change of [
    { widthScale: 0 },
    { openingScale: -1 },
    { cavityDepth: NaN },
    { dentalDepth: 0 },
    { blendReach: -1 },
    { toothGap: -1 },
    { dentalDrop: -1 },
    { dentalRecess: -1 },
    { cornerLift: NaN },
    { upperLipProjection: Infinity },
    { lowerLipProjection: NaN },
    { dentalOffset: NaN },
    { crowns: [{ width: NaN, height: 2 }] },
    { crowns: [{ width: 0, height: 2 }] },
    { crowns: [{ width: 2, height: 0 }] },
    { crowns: [{ width: 2, height: NaN }] },
  ])
    TestValidator.predicate(
      "invalid mouth dimension refused",
      throwsError(() =>
        createPortraitMouthComponent(portraitMouthSocket, {
          ...portraitMouthShape,
          ...change,
        }),
      ),
    );
};
