import { TestValidator } from "@nestia/e2e";

import { blendPortraitSkin } from "../../subjects/blendPortraitSkin";
import { applyPortraitFinalSurfaces } from "../../subjects/portraitFinalSurface";
import { createPortraitMeshPatchComponent } from "../../subjects/portraitMeshPatch";
import { assertPortraitSkinTopology } from "../../subjects/portraitSkinTopology";
import { subdivideControlMesh } from "../../subjects/subdivideControlMesh";
import { nclose } from "../internal/predicates";

/**
 * The patch group feeds source-surface targets into actual shared skin adaptation.
 *
 * Scenarios:
 * 1. A source plane at z=2 extends beyond a radius-three host boundary and
 *    contains the smaller donor patch. The fitted boundary reaches z=2, its
 *    remote pole is fixed with reach zero, and the assembled surface is closed.
 * 2. Later caller changes cannot replace the group's owned attachment settings
 *    or the fitted ray used by its deferred final-surface provider.
 * 3. After subdivision, a planar neighbourhood with a one-mm join-interior
 *    displacement returns to that plane. Core, boundary and remote skin stay
 *    exact; shared topology is preserved.
 *    A host without join faces yields no final proposal.
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
  const attached = plan.attach(cage, positions, (id) =>
    id === "plane" ? 1 : 2,
  );
  assertPortraitSkinTopology(cage, []);
  const refined = subdivideControlMesh(cage, 2);
  const join = new Set<number>();
  const fixed = new Set<number>();
  for (let face = 0; face < refined.groups.length; face++)
    if (refined.groups[face] === 2)
      refined.indices.slice(face * 3, face * 3 + 3).forEach((v) => join.add(v));
    else
      refined.indices
        .slice(face * 3, face * 3 + 3)
        .forEach((v) => fixed.add(v));
  for (const id of fixed) join.delete(id);
  TestValidator.predicate("new join samples exist", join.size > 8);
  refined.positions = refined.positions.map((p, id) => [
    p[0],
    p[1],
    join.has(id) ? 3 : 2,
  ]);
  // The final provider must retain its fitted frame even if the caller later
  // repurposes the mutable host record for another arrangement.
  host.viewRay[0] = 1;
  host.viewRay[2] = 0;
  const final = applyPortraitFinalSurfaces(refined, [
    { id: "plane", propose: attached.finalSurface! },
  ]);
  for (let id = 0; id < final.positions.length; id++)
    if (join.has(id))
      TestValidator.predicate(
        "refined join reaches plane",
        nclose(final.positions[id][2], 2),
      );
    else
      TestValidator.equals(
        "core and remote positions retained",
        final.positions[id],
        refined.positions[id],
      );
  assertPortraitSkinTopology(final, []);
  TestValidator.equals(
    "input remains displaced",
    [...join].map((id) => refined.positions[id][2]),
    [...join].map(() => 3),
  );
  TestValidator.equals(
    "no resident join is neutral",
    attached.finalSurface!({
      positions: [],
      indices: [],
      groups: [],
      normals: [],
    }),
    [],
  );
};
