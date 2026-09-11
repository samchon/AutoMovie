import { measureAutoMovieMeshClearance } from "@automovie/engine";
import type { IAutoMovieModelPart } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  applyPortraitOralContact,
  fitPortraitOralContact,
} from "../../subjects/portraitOralContact";
import { throwsError } from "../internal/predicates";

/**
 * The oral assembly resolves surface ordering while retaining a rigid arch.
 * Scenarios:
 * 1. A lip plane at Z=0 and enamel at Z=1 require a 1.2-unit retreat for a
 *    0.2-unit gap. The cavity originally at Z=0 must then finish at Z=-0.4.
 * 2. Already-separated and disjoint inputs preserve enamel placement. Optional
 *    part binding retains unrelated identities and rejects invalid ownership.
 */
export const test_subject_oral_contact = (): void => {
  const mesh = (z: number) => ({
    positions: [-1, -1, z, 1, -1, z, 0, 1, z],
    indices: [0, 1, 2],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    uvs: null,
    skin: null,
  });
  const lip = mesh(0),
    enamel = mesh(1),
    cavity = mesh(0),
    original = structuredClone([lip, enamel, cavity]);
  const result = fitPortraitOralContact(lip, enamel, cavity, 0.2);
  for (let i = 0; i < enamel.positions.length; i++)
    TestValidator.predicate(
      "rigid common retreat",
      Math.abs(
        result.enamel.positions[i] -
          enamel.positions[i] -
          (i % 3 === 2 ? -1.2 : 0),
      ) < 1e-12,
    );
  TestValidator.predicate(
    "cavity posterior plane",
    result.cavity.positions.every(
      (v, i) => i % 3 !== 2 || Math.abs(v + 0.4) < 1e-12,
    ),
  );
  TestValidator.equals(
    "caller buffers unchanged",
    [lip, enamel, cavity],
    original,
  );
  TestValidator.equals(
    "rigid normals retained",
    result.enamel.normals,
    enamel.normals,
  );
  TestValidator.predicate(
    "whole lip clearance",
    measureAutoMovieMeshClearance(lip, result.enamel, "z")[0].minimum >=
      0.2 - 1e-12,
  );
  TestValidator.equals(
    "already clear enamel",
    fitPortraitOralContact(mesh(2), enamel, mesh(-1), 0).enamel,
    enamel,
  );
  TestValidator.equals(
    "empty lip",
    fitPortraitOralContact(
      { ...lip, positions: [], indices: [] },
      enamel,
      mesh(-1),
      0,
    ).enamel,
    enamel,
  );
  const implicit = fitPortraitOralContact(
    lip,
    enamel,
    { ...cavity, indices: null },
    0.2,
  );
  TestValidator.predicate(
    "implicit lining reaches the same posterior plane",
    implicit.cavity.positions.every(
      (v, i) => i % 3 !== 2 || Math.abs(v + 0.4) < 1e-12,
    ),
  );
  for (const gap of [-1, NaN, Infinity])
    TestValidator.predicate(
      "invalid gap refuses",
      throwsError(() => fitPortraitOralContact(lip, enamel, cavity, gap)),
    );
  const part = (id: string, z: number): IAutoMovieModelPart => ({
    id,
    name: id,
    material: "skin",
    attachedBone: null,
    transform: null,
    geometry: { type: "mesh", mesh: mesh(z) },
  });
  const parts = [
    part("lip", 0),
    part("arch", 1),
    part("lining", 0),
    part("other", 4),
  ];
  TestValidator.predicate(
    "omission retains identity",
    applyPortraitOralContact(parts) === parts,
  );
  const ids = { lips: "lip", enamel: "arch", cavity: "lining", clearance: 0.2 };
  const applied = applyPortraitOralContact(parts, ids);
  TestValidator.predicate(
    "ambiguous resident identity refuses",
    throwsError(() => applyPortraitOralContact([...parts, parts[1]], ids)),
  );
  TestValidator.predicate(
    "bone frame refuses",
    throwsError(() =>
      applyPortraitOralContact(
        [parts[0], { ...parts[1], attachedBone: "head" }, parts[2]],
        ids,
      ),
    ),
  );
  TestValidator.predicate(
    "other parts retained",
    applied[0] === parts[0] && applied[3] === parts[3],
  );
  TestValidator.predicate(
    "missing relation refuses",
    throwsError(() =>
      applyPortraitOralContact(parts, { ...ids, enamel: "missing" }),
    ),
  );
  TestValidator.predicate(
    "duplicate relation refuses",
    throwsError(() =>
      applyPortraitOralContact(parts, { ...ids, enamel: "lip" }),
    ),
  );
  const primitive: IAutoMovieModelPart = {
    ...parts[1],
    geometry: {
      type: "primitive",
      shape: { type: "box", width: 1, height: 1, depth: 1 },
    },
  };
  TestValidator.predicate(
    "nonmesh relation refuses",
    throwsError(() =>
      applyPortraitOralContact([parts[0], primitive, parts[2]], ids),
    ),
  );
  const transformed = {
    ...parts[1],
    transform: {
      translation: { x: 1, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
  };
  TestValidator.predicate(
    "foreign frame refuses",
    throwsError(() =>
      applyPortraitOralContact([parts[0], transformed, parts[2]], ids),
    ),
  );
};
