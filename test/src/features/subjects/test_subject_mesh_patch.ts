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
 * 1. A radius-one square patch replaces the positive-Z half of a radius-three
 *    octahedron. Four donor and eight bridge faces close against the untouched
 *    opposite half, sharing exact host vertices through subdivision.
 * 2. A triangular donor exercises unequal ring counts. Source and boundary
 *    inputs are owned; bad identities, resident positions and edge lengths refuse.
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
    "donor plus zipper",
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
    "unequal zipper population",
    second.groups.filter((g) => g === 1).length,
    8,
  );
  assertPortraitSkinTopology(second, []);
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
