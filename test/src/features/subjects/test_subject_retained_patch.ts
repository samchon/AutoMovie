import { TestValidator } from "@nestia/e2e";

import { blendPortraitSkin } from "../../subjects/blendPortraitSkin";
import { applyPortraitFinalSurfaces } from "../../subjects/portraitFinalSurface";
import { createPortraitMeshPatchComponent } from "../../subjects/portraitMeshPatch";
import { applyPortraitRegionReplacements } from "../../subjects/portraitRegionReplacement";
import { assertPortraitSkinTopology } from "../../subjects/portraitSkinTopology";
import { subdivideControlMesh } from "../../subjects/subdivideControlMesh";
import { nclose, throwsError } from "../internal/predicates";

/**
 * A prebuilt source surface retains its coordinates through host refinement.
 *
 * Scenarios:
 * 1. A two-triangle plane replaces the marked half of a refined octahedron.
 *    Its four vertices remain exactly authored, both loops stay shared, and
 *    only the annulus gains interior edge/face samples before final fairing.
 * 2. Omitted, zero and maximum joining rounds are distinct. Caller mutation
 *    cannot change the copied source/mode. Claimed skin and invalid modes refuse.
 */
export const test_subject_retained_patch = (): void => {
  const host = {
    positions: [
      [10, 0, 0],
      [0, 10, 0],
      [-10, 0, 0],
      [0, -10, 0],
      [0, 0, 10],
      [0, 0, -10],
    ],
    indices: [
      4, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 5, 1, 0, 5, 2, 1, 5, 3, 2, 5, 0, 3,
    ],
    viewRay: [0, 0, 1],
  };
  const source = {
    positions: [
      [-20, -20, 2],
      [20, -20, 2],
      [20, 20, 2],
      [-20, 20, 2],
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
  const provide = () => ({ mesh: source, boundary: [4, 5, 6, 7] });
  TestValidator.equals(
    "explicit false retains coarse cut",
    createPortraitMeshPatchComponent("control", [0, 1, 2, 3], provide, {
      reach: 0,
      travel: 4,
      preserveSource: false,
      boundaryContinuity: "position",
    }).fit(host).cutFaces,
    [0, 1, 2, 3],
  );
  for (const rounds of [undefined, 0, 4]) {
    const shape = {
      reach: 0,
      travel: 4,
      preserveSource: true,
      joinSubdivisionRounds: rounds,
      boundaryContinuity:
        rounds === undefined ? ("tangent" as const) : undefined,
    };
    const component = createPortraitMeshPatchComponent(
      "source",
      [0, 1, 2, 3],
      provide,
      shape,
    );
    shape.preserveSource = false;
    const plan = component.fit(host);
    TestValidator.equals(
      "coarse region retained until refinement",
      plan.cutFaces,
      [],
    );
    const positions = blendPortraitSkin(
      host.positions,
      host.indices,
      plan.constraints,
    );
    const cage = {
      positions,
      indices: [...host.indices],
      groups: new Array(8).fill(0),
    };
    const attached = plan.attach(cage, positions, (id) =>
      id === "source" ? 1 : 2,
    );
    TestValidator.equals(
      "reserved original faces",
      cage.groups.filter((g) => g === 2).length,
      4,
    );
    const refined = subdivideControlMesh(cage, 2, attached.curves),
      before = structuredClone(refined);
    const differentInterior = structuredClone(cage);
    differentInterior.positions[4][2] = 100;
    const twin = subdivideControlMesh(differentInterior, 2, attached.curves);
    const outside = [
      ...new Set(
        refined.groups.flatMap((g, f) =>
          g === 0 ? refined.indices.slice(f * 3, f * 3 + 3) : [],
        ),
      ),
    ];
    TestValidator.equals(
      "discarded interior cannot shape surviving skin",
      outside.map((id) => twin.positions[id]),
      outside.map((id) => refined.positions[id]),
    );
    const replaced = applyPortraitRegionReplacements(
      refined,
      attached.replacements!,
    );
    TestValidator.equals("input retained", refined, before);
    TestValidator.equals(
      "source vertices exact",
      replaced.positions.slice(
        refined.positions.length,
        refined.positions.length + 4,
      ),
      source.positions.slice(4),
    );
    TestValidator.equals(
      "native triangles not subdivided",
      replaced.groups.filter((g) => g === 1).length,
      2,
    );
    // With B fixed boundary edges, interior edges I=(3F-B)/2. One face-centre
    // fan adds 3F triangles and splitting shared interior edges adds 2I more.
    let expectedFaces = 20;
    for (let i = 0; i < (rounds ?? 2); i++)
      expectedFaces = 6 * expectedFaces - 20;
    TestValidator.equals(
      "annular interior sampling",
      replaced.groups.filter((g) => g === 2).length,
      expectedFaces,
    );
    assertPortraitSkinTopology(replaced, []);
    if (rounds === undefined) {
      const final = applyPortraitFinalSurfaces(replaced, [
        { id: "source", propose: attached.finalSurface! },
      ]);
      TestValidator.equals(
        "fairing leaves native source exact",
        final.positions.slice(
          refined.positions.length,
          refined.positions.length + 4,
        ),
        source.positions.slice(4),
      );
      const native = new Set(
        [0, 1, 2, 3].map((v) => refined.positions.length + v),
      );
      const firstRow = final.groups.flatMap((g, f) => {
        const tri = final.indices.slice(f * 3, f * 3 + 3);
        return g === 2 && tri.filter((v) => native.has(v)).length === 2
          ? tri.filter((v) => !native.has(v))
          : [];
      });
      TestValidator.equals(
        "four native boundary neighbours",
        firstRow.length,
        4,
      );
      TestValidator.predicate(
        "tangent row remains on native plane after fairing",
        firstRow.every((v) => nclose(final.positions[v][2], 2)),
      );
      assertPortraitSkinTopology(final, []);
    } else if (rounds === 0) {
      TestValidator.equals(
        "coarse positional join has no free interior",
        attached.finalSurface!({ ...replaced, normals: [] }),
        [],
      );
    }
    TestValidator.equals(
      "no separate interior meshes",
      attached.finish(replaced),
      [],
    );
  }
  const component = createPortraitMeshPatchComponent(
    "owned",
    [0, 1, 2, 3],
    provide,
    { reach: 0, travel: 4, preserveSource: true },
  );
  const plan = component.fit(host);
  source.positions[4][2] = 99;
  const cage = {
    positions: host.positions.map((p) => [...p]),
    indices: [...host.indices],
    groups: new Array(8).fill(0),
  };
  const attached = plan.attach(cage, cage.positions, (id) =>
    id === "owned" ? 1 : 2,
  );
  const replaced = applyPortraitRegionReplacements(
    cage,
    attached.replacements!,
  );
  TestValidator.equals(
    "source captured at fit",
    replaced.positions[host.positions.length],
    [-1, -1, 2],
  );
  const claimed = {
    positions: host.positions.map((p) => [...p]),
    indices: [...host.indices],
    groups: [9, 0, 0, 0, 0, 0, 0, 0],
  };
  TestValidator.predicate(
    "claimed region refused",
    throwsError(() => plan.attach(claimed, claimed.positions, () => 1)),
  );
  for (const shape of [
    { reach: 0, travel: 4, boundaryContinuity: "invalid" as never },
    { reach: 0, travel: 4, boundaryContinuity: "tangent" as const },
    {
      reach: 0,
      travel: 4,
      preserveSource: true,
      joinSubdivisionRounds: 1,
      boundaryContinuity: "tangent" as const,
    },
    { reach: 0, travel: 4, preserveSource: "yes" as never },
    { reach: 0, travel: 4, joinSubdivisionRounds: 1 },
    ...[-1, 0.5, 5, NaN].map((joinSubdivisionRounds) => ({
      reach: 0,
      travel: 4,
      preserveSource: true,
      joinSubdivisionRounds,
    })),
  ])
    TestValidator.predicate(
      "invalid preservation settings",
      throwsError(() =>
        createPortraitMeshPatchComponent(
          "invalid",
          [0, 1, 2, 3],
          provide,
          shape,
        ),
      ),
    );
};
