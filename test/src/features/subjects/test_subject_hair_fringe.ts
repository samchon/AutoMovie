import { TestValidator } from "@nestia/e2e";

import { buildPortraitHairProxy } from "../../subjects/generated-korean-girl-01/hairProxy";
import { throwsError } from "../internal/predicates";

/**
 * The coarse fringe must follow actual head depth, not occupy a guessed plane.
 * A planar host gives a clearance oracle independent of the portrait surface.
 * Scenarios:
 * 1. The fringe and cap form one connected surface that follows a live plane;
 *    posterior/temporal points and the supplied head buffers stay unchanged.
 * 2. Missing support and an unrepresentable construction depth refuse.
 */
export const test_subject_hair_fringe = (): void => {
  const forehead = {
    positions: [-0.1, 0, 0.08, 0.1, 0, 0.08, 0.1, 0.2, 0.08, -0.1, 0.2, 0.08],
    indices: [0, 1, 2, 0, 2, 3],
    normals: null,
    uvs: null,
    skin: null,
  };
  const saved = structuredClone(forehead);
  const base = buildPortraitHairProxy()[0].geometry;
  const fitted = buildPortraitHairProxy(undefined, forehead)[0].geometry;
  if (base.type !== "mesh" || fitted.type !== "mesh")
    throw new Error("Expected hair meshes.");
  TestValidator.equals(
    "the fringe shares the cap topology",
    fitted.mesh.indices,
    base.mesh.indices,
  );
  const visited = new Set<number>([fitted.mesh.indices![0]]);
  for (let pass = 0; pass < fitted.mesh.positions.length / 3; pass++) {
    const before = visited.size;
    for (let i = 0; i < fitted.mesh.indices!.length; i += 3) {
      const face = fitted.mesh.indices!.slice(i, i + 3);
      if (face.some((id) => visited.has(id)))
        for (const id of face) visited.add(id);
    }
    if (visited.size === before) break;
  }
  TestValidator.equals(
    "no detached fringe insert remains",
    visited.size,
    new Set(fitted.mesh.indices!).size,
  );
  for (let i = 0; i < base.mesh.positions.length; i += 3)
    if (
      base.mesh.positions[i + 2] < -0.05 ||
      Math.abs(base.mesh.positions[i]) > 0.06
    )
      TestValidator.equals(
        "posterior and temporal context stays exact",
        fitted.mesh.positions.slice(i, i + 3),
        base.mesh.positions.slice(i, i + 3),
      );
  const tips: { y: number; z: number }[] = [];
  for (let i = 0; i < fitted.mesh.positions.length; i += 3)
    if (
      Math.abs(fitted.mesh.positions[i]) < 0.001 &&
      fitted.mesh.positions[i + 2] > 0
    )
      tips.push({
        y: fitted.mesh.positions[i + 1],
        z: fitted.mesh.positions[i + 2],
      });
  tips.sort((a, b) => a.y - b.y);
  TestValidator.predicate(
    "fringe clears actual support",
    tips.length > 0 && tips[0].z >= 0.0812 - 1e-12,
  );
  TestValidator.equals("forehead ownership", forehead, saved);
  const nearHead = {
    ...forehead,
    positions: forehead.positions.map((v, i) => (i % 3 === 2 ? 0.04 : v)),
  };
  const near = buildPortraitHairProxy(undefined, nearHead)[0].geometry;
  if (near.type !== "mesh") throw new Error("Expected fringe mesh.");
  const lowerDepths: { y: number; z: number }[] = [];
  for (let i = 0; i < near.mesh.positions.length; i += 3)
    if (
      Math.abs(near.mesh.positions[i]) < 0.001 &&
      near.mesh.positions[i + 2] > 0
    )
      lowerDepths.push({
        y: near.mesh.positions[i + 1],
        z: near.mesh.positions[i + 2],
      });
  lowerDepths.sort((a, b) => a.y - b.y);
  TestValidator.predicate(
    "lower fringe follows the forehead rather than a virtual cap",
    lowerDepths.length > 0 &&
      lowerDepths[0].z >= 0.0412 - 1e-12 &&
      lowerDepths[0].z < 0.044,
  );
  const absent = {
    ...forehead,
    positions: forehead.positions.map((v, i) => (i % 3 === 0 ? v + 2 : v)),
  };
  TestValidator.predicate(
    "missing foreground refuses",
    throwsError(
      () => buildPortraitHairProxy(undefined, absent),
      "supporting forehead",
    ),
  );
  const distant = {
    ...forehead,
    positions: forehead.positions.map((v, i) => (i % 3 === 2 ? 1e306 : v)),
  };
  TestValidator.predicate(
    "construction overflow refuses",
    throwsError(
      () => buildPortraitHairProxy(undefined, distant),
      "construction-millimetre",
    ),
  );
};
