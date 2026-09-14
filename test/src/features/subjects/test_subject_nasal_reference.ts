import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";

import { admitPortraitNasalPatch } from "../../subjects/generated-korean-girl-01/nasalReference";
import { throwsError } from "../internal/predicates";

/**
 * The nasal reference remains bound to its admitted fitted skin and target.
 *
 * Scenarios:
 * 1. An independently hashed triangle is admitted and converted from metres to
 *    millimetres. Subsequent caller mutation cannot alter its copied topology,
 *    boundary or coordinates; no whole anatomical model is built by this unit.
 * 2. Changing only the skin bytes or only the target bytes rejects the binding.
 */
export const test_subject_nasal_reference = (): void => {
  const skin: IAutoMovieMesh = {
    positions: [0, 0, 0, 0.001, 0, 0, 0, 0.002, 0],
    indices: [0, 1, 2],
    normals: null,
    uvs: null,
    skin: null,
  };
  const digest = (bytes: string | Uint8Array) =>
    createHash("sha256").update(bytes).digest("hex");
  const target = new Uint8Array([1, 2, 3]);
  const targetDigest = digest(target);
  const input = {
    sourceSkinSha256: digest(JSON.stringify(skin)),
    sourceBoundary: [0, 1, 2],
  };
  const source = admitPortraitNasalPatch(skin, input, targetDigest, target);
  TestValidator.equals("metres become millimetres", source.mesh.positions, [
    [0, 0, 0],
    [1, 0, 0],
    [0, 2, 0],
  ]);
  TestValidator.equals("one owned region", source.mesh.groups, [0]);
  TestValidator.predicate(
    "changed target refuses",
    throwsError(
      () =>
        admitPortraitNasalPatch(
          skin,
          input,
          targetDigest,
          new Uint8Array([1, 2, 4]),
        ),
      "target control basis",
    ),
  );
  skin.positions[0] = 0.001;
  TestValidator.predicate(
    "changed skin refuses",
    throwsError(
      () => admitPortraitNasalPatch(skin, input, targetDigest, target),
      "source model basis",
    ),
  );
  skin.indices!.reverse();
  input.sourceBoundary.reverse();
  TestValidator.equals("provider owns boundary", source.boundary, [0, 1, 2]);
  TestValidator.equals("provider owns indices", source.mesh.indices, [0, 1, 2]);
  TestValidator.equals(
    "provider owns positions",
    source.mesh.positions[0],
    [0, 0, 0],
  );
  TestValidator.predicate(
    "resident finite boundary",
    source.boundary.every(
      (id) =>
        source.mesh.positions[id]?.length === 3 &&
        source.mesh.positions[id].every(Number.isFinite),
    ),
  );
};
