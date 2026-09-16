import {
  buildPortraitHead,
  buildPortraitMouth,
  createPortraitMouthComponent,
  portraitMeshBuffers,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import {
  portraitMouthShape,
  portraitMouthSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The mouth finisher consumes the actual subdivided lip group's free boundary.
 *
 * Scenarios:
 * 1. Selected lining changes only the interior, with every refined rim vertex
 *    copied in metric output, including vertices absent from the original socket.
 * 2. A fully closed performed mouth omits the lining; invalid wall dimensions
 *    still refuse. An open direct build without final lip triangles refuses.
 * 3. Component creation owns the scalar wall choice independently of later edits.
 */
export const test_subject_mouth_lining_component = (): void => {
  const shape = { ...portraitMouthShape, crowns: [], cavityWall: 0.75 };
  const component = createPortraitMouthComponent(portraitMouthSocket, shape);
  shape.cavityWall = -1;
  const head = buildPortraitHead(referenceControlNet, [component], 1);
  const baseline = buildPortraitHead(
    referenceControlNet,
    [
      createPortraitMouthComponent(portraitMouthSocket, {
        ...portraitMouthShape,
        crowns: [],
      }),
    ],
    1,
  );
  TestValidator.equals(
    "lining does not reshape external skin",
    head.parts.filter((p) => p.id !== "oral-cavity"),
    baseline.parts.filter((p) => p.id !== "oral-cavity"),
  );
  const cavity = head.parts.find((p) => p.id === "oral-cavity")!;
  if (cavity.geometry.type !== "mesh")
    throw new Error("Expected an oral mesh.");
  const mesh = cavity.geometry.mesh,
    count = (mesh.positions.length / 3 - 1) / 24;
  TestValidator.predicate(
    "includes refined rim vertices",
    count >
      portraitMouthSocket.upper.length + portraitMouthSocket.lower.length - 2,
  );
  const free = new Map<string, { a: number; b: number; count: number }>();
  for (let i = 0; i < head.refined.indices.length; i += 3) {
    if (head.refined.groups[i / 3] !== 1) continue;
    const face = head.refined.indices.slice(i, i + 3);
    for (let j = 0; j < 3; j++) {
      const a = face[j],
        b = face[(j + 1) % 3],
        key = `${Math.min(a, b)}/${Math.max(a, b)}`;
      const found = free.get(key);
      if (found) found.count++;
      else free.set(key, { a, b, count: 1 });
    }
  }
  const successors = new Map(
    [...free.values()].filter((e) => e.count === 1).map((e) => [e.a, e.b]),
  );
  let id = portraitMouthSocket.upper[0];
  for (let i = 0; i < count; i++) {
    TestValidator.predicate(
      "exact final rim in metres",
      head.refined.positions[id].every((v, axis) =>
        nclose(mesh.positions[3 * i + axis], v / 1000, 1e-15),
      ),
    );
    id = successors.get(id)!;
  }
  TestValidator.equals("same seeded cycle", id, portraitMouthSocket.upper[0]);
  portraitMeshBuffers(mesh);
  const closed = buildPortraitHead(
    referenceControlNet,
    [
      createPortraitMouthComponent(
        portraitMouthSocket,
        { ...shape, cavityWall: 0.75 },
        { lipPart: 0, observedLipPart: 10 },
      ),
    ],
    1,
  );
  TestValidator.predicate(
    "closed cavity omitted",
    !closed.parts.some((p) => p.id === "oral-cavity"),
  );
  TestValidator.predicate(
    "closed bad wall refuses",
    throwsError(
      () =>
        createPortraitMouthComponent(portraitMouthSocket, shape, {
          lipPart: 0,
          observedLipPart: 10,
        }),
      "fraction",
    ),
  );
  TestValidator.predicate(
    "direct bad wall refuses",
    throwsError(
      () =>
        buildPortraitMouth(
          referenceControlNet.positions,
          portraitMouthSocket,
          shape,
        ),
      "fraction",
    ),
  );
  TestValidator.predicate(
    "actual connectivity required",
    throwsError(
      () =>
        buildPortraitMouth(referenceControlNet.positions, portraitMouthSocket, {
          ...shape,
          cavityWall: 0.75,
        }),
      "refined lip triangles",
    ),
  );
};
