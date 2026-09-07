import { TestValidator } from "@nestia/e2e";

import { buildPortraitHairProxy } from "../../subjects/generated-korean-girl-01/hairProxy";
import { throwsError } from "../internal/predicates";

/**
 * The coarse fringe must follow actual head depth, not occupy a guessed plane.
 * A planar host gives a clearance oracle independent of the portrait surface.
 * Scenarios:
 * 1. Additional panels clear the live foreground plane, preserve the existing
 *    cap/curtain positions and leave the supplied head buffers unchanged.
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
  const boundary = base.mesh.positions.length;
  TestValidator.equals(
    "existing coarse envelope retained",
    fitted.mesh.positions.slice(0, boundary),
    base.mesh.positions,
  );
  TestValidator.predicate(
    "fringe clears actual support",
    fitted.mesh.positions.length > boundary &&
      fitted.mesh.positions
        .slice(boundary)
        .every(
          (v, i) => Number.isFinite(v) && (i % 3 !== 2 || v >= 0.0812 - 1e-12),
        ),
  );
  TestValidator.equals("forehead ownership", forehead, saved);
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
