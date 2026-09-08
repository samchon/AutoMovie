import { TestValidator } from "@nestia/e2e";

import {
  type IPortraitMeshPatch,
  createPortraitMeshPatchComponent,
} from "../../subjects/portraitMeshPatch";
import { assertPortraitSkinTopology } from "../../subjects/portraitSkinTopology";
import { subdivideControlMesh } from "../../subjects/subdivideControlMesh";
import { throwsError } from "../internal/predicates";

/**
 * A complete source patch replaces one host region through shared topology.
 *
 * Scenarios:
 * 1. A square patch replaces one half of an octahedron; donor and annulus close
 *    against the unchanged half and retain shared vertices through subdivision.
 * 2. A triangular donor checks unequal counts; a highly nonplanar pentagon
 *    keeps all bridge triangles positive in XY without flattening its depth.
 * 3. Reversed matching windings remain closed; mismatched or nonnested rings
 *    refuse before mutation. Bad identities, positions and edge lengths refuse.
 */
export const test_subject_mesh_patch = (): void => {
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
  const source: IPortraitMeshPatch = {
    mesh: {
      positions: [
        [1, 0, 0],
        [0, 1, 0],
        [-1, 0, 0],
        [0, -1, 0],
        [0, 0, 1],
      ],
      indices: [4, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0],
      groups: [0, 0, 0, 0],
    },
    boundary: [0, 1, 2, 3],
  };
  const boundary = [0, 1, 2, 3];
  const component = createPortraitMeshPatchComponent(
    "replacement",
    boundary,
    () => source,
  );
  boundary.reverse();
  const plan = component.fit(host);
  TestValidator.equals("selected original patch", plan.cutFaces, [0, 1, 2, 3]);
  TestValidator.equals("outer positions are not guessed", plan.constraints, []);
  const cage = {
    positions: host.positions.map((p) => [...p]),
    indices: host.indices.slice(12),
    groups: [0, 0, 0, 0],
  };
  source.mesh.positions[4][2] = 99;
  const attached = plan.attach(cage, cage.positions, () => 1);
  TestValidator.equals(
    "donor plus annulus",
    cage.groups.filter((g) => g === 1).length,
    12,
  );
  TestValidator.predicate(
    "source owned at fit",
    cage.positions.some((p) => p[0] === 0 && p[1] === 0 && p[2] === 1),
  );
  TestValidator.equals(
    "old host preserved",
    cage.positions.slice(0, 6),
    host.positions,
  );
  assertPortraitSkinTopology(cage, []);
  const refined = subdivideControlMesh(cage, 1);
  assertPortraitSkinTopology(refined, []);
  TestValidator.equals("finished shared patch", attached.finish(refined), []);
  const triangle: IPortraitMeshPatch = {
    mesh: {
      positions: [
        [1, 0, 0],
        [-0.5, 1, 0],
        [-0.5, -1, 0],
      ],
      indices: [0, 1, 2],
      groups: [0],
    },
    boundary: [0, 1, 2],
  };
  const alternate = createPortraitMeshPatchComponent(
    "triangle",
    [0, 1, 2, 3],
    () => triangle,
  ).fit(host);
  const second = {
    positions: host.positions.map((p) => [...p]),
    indices: host.indices.slice(12),
    groups: [0, 0, 0, 0],
  };
  alternate.attach(second, second.positions, () => 1);
  TestValidator.equals(
    "unequal annulus population",
    second.groups.filter((g) => g === 1).length,
    8,
  );
  assertPortraitSkinTopology(second, []);
  const irregular: IPortraitMeshPatch = {
    mesh: {
      positions: [0, 0.1, 1.4, 3.2, 4.4]
        .map((angle, i) => [
          Math.cos(angle),
          Math.sin(angle),
          i === 1 ? 100 : 0,
        ])
        .concat([[0, 0, 1]]),
      indices: Array.from({ length: 5 }, (_, i) => [5, i, (i + 1) % 5]).flat(),
      groups: new Array(5).fill(0),
    },
    boundary: [0, 1, 2, 3, 4],
  };
  const third = {
    positions: host.positions.map((p) => [...p]),
    indices: host.indices.slice(12),
    groups: [0, 0, 0, 0],
  };
  createPortraitMeshPatchComponent("irregular", [0, 1, 2, 3], () => irregular)
    .fit(host)
    .attach(third, third.positions, () => 1);
  const bridge = third.indices.slice(12 + irregular.mesh.indices.length);
  TestValidator.predicate(
    "bridge keeps positive XY area",
    Array.from({ length: bridge.length / 3 }, (_, i) =>
      bridge.slice(i * 3, i * 3 + 3).map((id) => third.positions[id]),
    ).every(
      ([a, b, c]) =>
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0,
    ),
  );
  TestValidator.predicate(
    "original boundary depth retained",
    third.positions.some((p) => p[2] === 100),
  );
  assertPortraitSkinTopology(third, []);
  const flip = (indices: number[]) =>
    Array.from({ length: indices.length / 3 }, (_, i) => [
      indices[i * 3],
      indices[i * 3 + 2],
      indices[i * 3 + 1],
    ]).flat();
  const clockwise = {
    ...triangle,
    mesh: { ...triangle.mesh, indices: flip(triangle.mesh.indices) },
    boundary: [...triangle.boundary].reverse(),
  };
  const reverseHost = { ...host, indices: flip(host.indices) };
  const reversed = {
    positions: host.positions.map((p) => [...p]),
    indices: reverseHost.indices.slice(12),
    groups: [0, 0, 0, 0],
  };
  createPortraitMeshPatchComponent("reverse", [3, 2, 1, 0], () => clockwise)
    .fit(reverseHost)
    .attach(reversed, reversed.positions, () => 1);
  assertPortraitSkinTopology(reversed, []);
  for (const donor of [
    clockwise,
    {
      ...triangle,
      mesh: {
        ...triangle.mesh,
        positions: triangle.mesh.positions.map((p) => [p[0] + 4, p[1], p[2]]),
      },
    },
  ]) {
    const rejected = {
      positions: host.positions.map((p) => [...p]),
      indices: host.indices.slice(12),
      groups: [0, 0, 0, 0],
    };
    const before = structuredClone(rejected);
    const invalid = createPortraitMeshPatchComponent(
      "invalid",
      [0, 1, 2, 3],
      () => donor,
    ).fit(host);
    TestValidator.predicate(
      "projected join refuses",
      throwsError(() => invalid.attach(rejected, rejected.positions, () => 1)),
    );
    TestValidator.equals("failed admission is nonmutating", rejected, before);
  }
  for (const bad of [[], [0, 1], [0, 1, 1], [0, 1, -1], [0, 1, 0.5]])
    TestValidator.predicate(
      "bad boundary",
      throwsError(() =>
        createPortraitMeshPatchComponent("patch", bad, () => source),
      ),
    );
  TestValidator.predicate(
    "empty identity",
    throwsError(() =>
      createPortraitMeshPatchComponent(" ", [0, 1, 2], () => source),
    ),
  );
  TestValidator.predicate(
    "missing host position",
    throwsError(() =>
      createPortraitMeshPatchComponent(
        "patch",
        [0, 1, 2, 3],
        () => triangle,
      ).fit({ ...host, positions: [] }),
    ),
  );
  for (const points of [[], [[NaN, 0, 0]], [[0, 0]]])
    TestValidator.predicate(
      "missing source position",
      throwsError(() =>
        createPortraitMeshPatchComponent("patch", [0, 1, 2, 3], () => ({
          ...triangle,
          mesh: { ...triangle.mesh, positions: points },
        })).fit(host),
      ),
    );
  const duplicate = { ...host, positions: host.positions.map((p) => [...p]) };
  duplicate.positions[1] = [...duplicate.positions[0]];
  TestValidator.predicate(
    "zero boundary edge",
    throwsError(() =>
      createPortraitMeshPatchComponent(
        "patch",
        [0, 1, 2, 3],
        () => triangle,
      ).fit(duplicate),
    ),
  );
  const extreme = {
    ...host,
    positions: host.positions.map((p) =>
      p.map((v) => v * (Number.MAX_VALUE / 4)),
    ),
  };
  TestValidator.predicate(
    "finite perimeter-overflow input",
    extreme.positions.flat().every(Number.isFinite),
  );
  TestValidator.predicate(
    "overflowing boundary",
    throwsError(() =>
      createPortraitMeshPatchComponent(
        "patch",
        [0, 1, 2, 3],
        () => triangle,
      ).fit(extreme),
    ),
  );
};
