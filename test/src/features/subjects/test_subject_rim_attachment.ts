import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { portraitNormals } from "../../subjects/geometry";
import { replacePortraitRimAttachment } from "../../subjects/replacePortraitRim";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Final aperture replacement owns a complete cavity and its shared skin edge,
 * while the other side and the position-fixed outer ring remain independent.
 *
 * Scenarios:
 * 1. Two square cavities have three concentric skin rings. Replacing either
 *    cavity by a 0.4 mm translated target moves only its lining and 1.5 mm skin
 *    collar. Shared normals agree, unit length holds, and the position-fixed
 *    outer ring receives only the incident-face normal change.
 * 2. A neutral replacement retains all input buffers exactly. Target normals
 *    cannot select the result's lighting basis; neither input is mutated.
 * 3. Missing/malformed buffers, changed lineage, a midline-crossing cavity,
 *    missing/ambiguous skin correspondence, a mismatched target rim and a broken
 *    original normal seam refuse instead of silently welding another surface.
 */
export const test_subject_rim_attachment = (): void => {
  const blank = (): IAutoMovieMesh => ({
    positions: [],
    indices: [],
    normals: [],
    uvs: null,
    skin: null,
  });
  const skin = blank(),
    lining = blank();
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const side of [-1, 1]) {
    const skinStart = skin.positions.length / 3,
      liningStart = lining.positions.length / 3;
    for (const radius of [1, 2, 3])
      for (const [x, y] of corners)
        skin.positions.push(
          (side * 5 + x * radius) / 1000,
          (y * radius) / 1000,
          0,
        );
    for (let ring = 0; ring < 2; ring++)
      for (let corner = 0; corner < 4; corner++) {
        const a = skinStart + ring * 4 + corner,
          b = skinStart + ring * 4 + ((corner + 1) % 4);
        skin.indices!.push(a, a + 4, b, b, a + 4, b + 4);
      }
    for (const [x, y] of corners)
      lining.positions.push((side * 5 + x) / 1000, y / 1000, 0);
    lining.positions.push(side * 0.005, 0, -0.002);
    for (let corner = 0; corner < 4; corner++)
      lining.indices!.push(
        liningStart + corner,
        liningStart + ((corner + 1) % 4),
        liningStart + 4,
      );
  }
  // Independent fixture assembly: each cone's four rim vertices reuse its
  // annulus' inner ring, so the original normal field has exactly one owner.
  const joined = [
    ...skin.positions,
    ...lining.positions.slice(12, 15),
    ...lining.positions.slice(27, 30),
  ];
  const map = [0, 1, 2, 3, 24, 12, 13, 14, 15, 25];
  const normals = portraitNormals(joined, [
    ...skin.indices!,
    ...lining.indices!.map((id) => map[id]),
  ]);
  skin.normals = normals.slice(0, skin.positions.length);
  lining.normals = map.flatMap((id) => normals.slice(id * 3, id * 3 + 3));
  const input = { skin, lining },
    before = structuredClone(input);
  const target = structuredClone(input);
  for (const offset of [0, 12])
    for (let id = offset; id < offset + 4; id++)
      target.skin.positions[id * 3 + 2] += 0.0004;
  for (let id = 0; id < 10; id++) target.lining.positions[id * 3 + 2] += 0.0004;
  for (const side of [-1, 1] as const) {
    const result = replacePortraitRimAttachment(input, target, side, 1.5);
    const start = side === -1 ? 0 : 12,
      other = side === -1 ? 12 : 0;
    const cavity = side === -1 ? 0 : 5,
      otherCavity = side === -1 ? 5 : 0;
    TestValidator.equals("four final rim pins", result.rim, [
      start,
      start + 1,
      start + 2,
      start + 3,
    ]);
    TestValidator.equals("only the next square ring is free", result.collar, [
      start + 4,
      start + 5,
      start + 6,
      start + 7,
    ]);
    TestValidator.equals(
      "other skin positions stay exact",
      result.skin.positions.slice(other * 3, (other + 12) * 3),
      skin.positions.slice(other * 3, (other + 12) * 3),
    );
    TestValidator.equals(
      "other skin normals stay exact",
      result.skin.normals!.slice(other * 3, (other + 12) * 3),
      skin.normals!.slice(other * 3, (other + 12) * 3),
    );
    TestValidator.equals(
      "other lining positions stay exact",
      result.lining.positions.slice(otherCavity * 3, (otherCavity + 5) * 3),
      lining.positions.slice(otherCavity * 3, (otherCavity + 5) * 3),
    );
    TestValidator.equals(
      "outer ring position is fixed",
      result.skin.positions.slice((start + 8) * 3, (start + 12) * 3),
      skin.positions.slice((start + 8) * 3, (start + 12) * 3),
    );
    TestValidator.predicate(
      "outer ring normal feels its moved incident triangles",
      [0, 1, 2, 3].some((id) =>
        result.skin
          .normals!.slice((start + 8 + id) * 3, (start + 9 + id) * 3)
          .some((v, axis) => v !== skin.normals![(start + 8 + id) * 3 + axis]),
      ),
    );
    for (let id = 0; id < 4; id++) {
      TestValidator.equals(
        "target final Float32 rim is exact",
        result.skin.positions
          .slice((start + id) * 3, (start + id + 1) * 3)
          .map(Math.fround),
        target.lining.positions
          .slice((cavity + id) * 3, (cavity + id + 1) * 3)
          .map(Math.fround),
      );
      TestValidator.equals(
        "lining and skin share their new normal",
        result.skin.normals!.slice((start + id) * 3, (start + id + 1) * 3),
        result.lining.normals!.slice((cavity + id) * 3, (cavity + id + 1) * 3),
      );
    }
    TestValidator.predicate(
      "changed normals stay unit directions",
      result.affectedNormals.every((id) => {
        const n =
          id < 24
            ? result.skin.normals!.slice(id * 3, id * 3 + 3)
            : result.lining.normals!.slice(
                result.liningIds.indexOf(id) * 3,
                result.liningIds.indexOf(id) * 3 + 3,
              );
        return nclose(Math.hypot(...n), 1, 1e-12);
      }),
    );
    const relit = structuredClone(target);
    relit.lining.normals!.fill(7);
    TestValidator.equals(
      "target normals do not author a second lighting field",
      replacePortraitRimAttachment(input, relit, side, 1.5),
      result,
    );
  }
  const neutral = replacePortraitRimAttachment(input, input, 1, 1.5);
  TestValidator.equals(
    "neutral meshes are exact",
    { skin: neutral.skin, lining: neutral.lining },
    input,
  );
  TestValidator.equals(
    "neutral has no changed normal population",
    neutral.affectedNormals,
    [],
  );
  TestValidator.equals("inputs remain unchanged", input, before);
  for (const change of [
    (p: typeof input) => {
      p.skin.indices = null;
    },
    (p: typeof input) => {
      p.lining.normals = null;
    },
    (p: typeof input) => {
      p.skin.positions.push(0);
    },
    (p: typeof input) => {
      p.skin.normals!.pop();
    },
    (p: typeof input) => {
      p.lining.positions[0] = 1e100;
    },
    (p: typeof input) => {
      p.skin.indices!.pop();
    },
    (p: typeof input) => {
      p.skin.indices![0] = 999;
    },
    (p: typeof input) => {
      p.skin.indices![0] = -1;
    },
    (p: typeof input) => {
      p.skin.indices![0] = 0.5;
    },
  ]) {
    const invalid = structuredClone(input);
    change(invalid);
    TestValidator.predicate(
      "malformed resident buffers refuse",
      throwsError(
        () => replacePortraitRimAttachment(invalid, target, 1, 1.5),
        "mesh buffers",
      ),
    );
  }
  for (const change of [
    (p: typeof input) => {
      p.skin.positions.push(0, 0, 0);
      p.skin.normals!.push(0, 0, 1);
    },
    (p: typeof input) => {
      p.skin.indices!.push(0, 1, 2);
    },
    (p: typeof input) => {
      p.lining.indices![0] = 1;
    },
  ]) {
    const invalid = structuredClone(target);
    change(invalid);
    TestValidator.predicate(
      "changed lineage refuses",
      throwsError(
        () => replacePortraitRimAttachment(input, invalid, 1, 1.5),
        "lineage",
      ),
    );
  }
  for (const x of [0, 0.001]) {
    const invalid = structuredClone(input);
    invalid.lining.positions[0] = x;
    TestValidator.predicate(
      "crossing or touching midline refuses",
      throwsError(
        () => replacePortraitRimAttachment(invalid, target, 1, 1.5),
        "midline",
      ),
    );
  }
  for (const change of [
    (p: typeof input) => {
      p.skin.positions[0] += 0.0001;
    },
    (p: typeof input) => {
      p.skin.positions.splice(12, 3, ...p.skin.positions.slice(0, 3));
    },
  ]) {
    const invalid = structuredClone(input);
    change(invalid);
    TestValidator.predicate(
      "missing or ambiguous shared point refuses",
      throwsError(
        () => replacePortraitRimAttachment(invalid, target, 1, 1.5),
        "shared skin vertex",
      ),
    );
  }
  const mismatch = structuredClone(target);
  mismatch.lining.positions[2] += 0.0001;
  TestValidator.predicate(
    "target seam mismatch refuses",
    throwsError(
      () => replacePortraitRimAttachment(input, mismatch, 1, 1.5),
      "shared skin vertex",
    ),
  );
  const seam = structuredClone(input);
  seam.lining.normals![0] += 0.1;
  TestValidator.predicate(
    "input normal seam refuses",
    throwsError(
      () => replacePortraitRimAttachment(seam, target, 1, 1.5),
      "normal field",
    ),
  );
};
