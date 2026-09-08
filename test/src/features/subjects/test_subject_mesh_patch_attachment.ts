import { TestValidator } from "@nestia/e2e";

import { blendPortraitSkin } from "../../subjects/blendPortraitSkin";
import { createPortraitMeshPatchComponent } from "../../subjects/portraitMeshPatch";
import { assertPortraitSkinTopology } from "../../subjects/portraitSkinTopology";
import { nclose } from "../internal/predicates";

/**
 * The patch group feeds source-surface targets into actual shared skin adaptation.
 *
 * Scenarios:
 * 1. A source plane at z=2 extends beyond a radius-three host boundary and
 *    contains the smaller donor patch. The fitted boundary reaches z=2, its
 *    remote pole is fixed with reach zero, and the assembled surface is closed.
 * 2. Later caller changes cannot replace the group's owned attachment settings.
 */
export const test_subject_mesh_patch_attachment = (): void => {
  const host = {
    positions: [
      [3, 0, 0],
      [0, 3, 0],
      [-3, 0, 0],
      [0, -3, 0],
      [0, 0, 3],
      [0, 0, -3],
    ],
    indices: [
      4, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 5, 1, 0, 5, 2, 1, 5, 3, 2, 5, 0, 3,
    ],
    viewRay: [0, 0, 1],
  };
  const mesh = {
    positions: [
      [-10, -10, 2],
      [10, -10, 2],
      [10, 10, 2],
      [-10, 10, 2],
      [-1, -1, 2],
      [1, -1, 2],
      [1, 1, 2],
      [-1, 1, 2],
    ],
    indices: [
      0, 1, 4, 1, 5, 4, 1, 2, 5, 2, 6, 5, 2, 3, 6, 3, 7, 6, 3, 0, 7, 0, 4, 7, 4,
      5, 6, 4, 6, 7,
    ],
    groups: new Array(10).fill(0),
  };
  const attachment = { reach: 0, travel: 4 };
  const component = createPortraitMeshPatchComponent(
    "plane",
    [0, 1, 2, 3],
    () => ({ mesh, boundary: [4, 5, 6, 7] }),
    attachment,
  );
  attachment.travel = 1;
  const plan = component.fit(host);
  TestValidator.predicate(
    "owned source targets",
    plan.constraints.length === 4 &&
      plan.constraints.every((c) => nclose(c.target[2], 2)),
  );
  const positions = blendPortraitSkin(
    host.positions,
    host.indices,
    plan.constraints,
  );
  TestValidator.equals("remote pole fixed", positions[5], host.positions[5]);
  const cage = {
    positions,
    indices: host.indices.slice(12),
    groups: [0, 0, 0, 0],
  };
  plan.attach(cage, positions, () => 1);
  assertPortraitSkinTopology(cage, []);
};
