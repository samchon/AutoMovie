import { createPortraitNasalEnvelope } from "@automovie/human/components/nasalEnvelope";
import { applyPortraitRegionReplacements } from "@automovie/human/geometry/portraitRegionReplacement";
import { subdivideControlMesh } from "@automovie/human/geometry/subdivideControlMesh";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * A rolled nasal envelope survives host refinement as authored geometry.
 *
 * Scenarios:
 * 1. A radius-two planar aperture has radius-three attachment, a 0.3-mm crest
 *    at radius 2.5, and a common floor at z=-2. Host refinement cannot shrink
 *    the original aperture samples; outside vertices are not moved by append.
 * 2. Circumferential width and crest vary independently, including the periodic
 *    last-to-first interval. Construction owns its input and supports translation.
 * 3. Invalid sections, normals, travel, lineage and material groups refuse.
 */
export const test_subject_nasal_envelope = (): void => {
  const points = [
    [2, 0, 0],
    [0, 2, 0],
    [-2, 0, 0],
    [0, -2, 0],
  ];
  const normals = points.map(() => [0, 0, 1]);
  const profile = {
    segments: 4,
    sections: [{ at: 0, width: 1, crest: 0.3, crestPosition: 0.5, roll: 90 }],
  };
  const envelope = createPortraitNasalEnvelope(
    points,
    normals,
    profile,
    [0, 0, -2],
    0.5,
  );
  TestValidator.equals("metric outer attachment", envelope.outer, [
    [3, 0, 0],
    [0, 3, 0],
    [-3, 0, 0],
    [0, -3, 0],
  ]);
  const cage = {
    positions: [
      ...envelope.outer.map((p) => [...p]),
      [5, 0, 0],
      [0, 5, 0],
      [-5, 0, 0],
      [0, -5, 0],
      [0, 0, -2],
    ],
    indices: [] as number[],
    groups: [] as number[],
  };
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    cage.indices.push(i + 4, j + 4, i, j + 4, j, i, i, j, 8);
    cage.groups.push(0, 0, 1);
  }
  profile.sections[0].crest = 99;
  points[0][0] = 99;
  for (const rounds of [0, 1, 2]) {
    const refined = subdivideControlMesh(cage, rounds);
    const saved = structuredClone(refined);
    const output = applyPortraitRegionReplacements(refined, [
      {
        group: 1,
        append: (mesh, boundary) =>
          envelope.append(mesh, boundary, [0, 1, 2, 3], 0, 2),
      },
    ]);
    TestValidator.equals("input mesh ownership", refined, saved);
    TestValidator.equals(
      "all retained attachment coordinates",
      output.positions.slice(0, refined.positions.length),
      refined.positions,
    );
    for (const expected of [
      [2, 0, 0],
      [0, 2, 0],
      [-2, 0, 0],
      [0, -2, 0],
      [2.5, 0, 0.3],
      [0, 0, -2],
    ])
      TestValidator.predicate(
        "analytic rim crest and floor survive refinement",
        output.positions
          .slice(refined.positions.length)
          .some((p) => p.every((v, axis) => nclose(v, expected[axis]))),
      );
    const edges = new Map<string, number>();
    for (let i = 0; i < output.indices.length; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = output.indices[i + j],
          b = output.indices[i + ((j + 1) % 3)],
          key = [Math.min(a, b), Math.max(a, b)].join("/");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    TestValidator.predicate(
      "one connected surface without interior free edges",
      [...edges.values()].every((n) => n === 1 || n === 2) &&
        [...edges.values()].filter((n) => n === 1).length === 4 * 2 ** rounds,
    );
    TestValidator.predicate("lining is present", output.groups.includes(2));
  }
  const base = [
    [2, 0, 0],
    [0, 2, 0],
    [-2, 0, 0],
    [0, -2, 0],
  ];
  const section = { at: 0, width: 1, crest: 0, crestPosition: 0.5, roll: 0 };
  const liningAt = (skinNormals: number[][]) => {
    const fitted = createPortraitNasalEnvelope(
      base,
      skinNormals,
      { segments: 4, sections: [section] },
      [0, 0, -2],
      0.5,
    );
    const local = {
      positions: [
        ...fitted.outer,
        [5, 0, 0],
        [0, 5, 0],
        [-5, 0, 0],
        [0, -5, 0],
      ],
      indices: [] as number[],
      groups: [] as number[],
    };
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      local.indices.push(i + 4, j + 4, i, j + 4, j, i);
      local.groups.push(0, 0);
    }
    fitted.append(local, [0, 1, 2, 3], [0, 1, 2, 3], 0, 2);
    return local.groups.flatMap((g, i) =>
      g === 2
        ? local.indices.slice(3 * i, 3 * i + 3).map((id) => local.positions[id])
        : [],
    );
  };
  TestValidator.equals(
    "cavity frame is independent of exterior normals",
    liningAt(normals),
    liningAt(base.map(() => [0, 0.8, 0.6])),
  );
  TestValidator.predicate(
    "unrepresentable positive width",
    throwsError(() =>
      createPortraitNasalEnvelope(
        base,
        normals,
        { segments: 2, sections: [{ ...section, width: 1e-300 }] },
        [0, 0, -2],
        0.5,
      ),
    ),
  );
  TestValidator.predicate(
    "empty aperture",
    throwsError(() =>
      createPortraitNasalEnvelope(
        [],
        [],
        { segments: 2, sections: [section] },
        [0, 0, -2],
        0.5,
      ),
    ),
  );
  const varying = createPortraitNasalEnvelope(
    base,
    normals,
    {
      segments: 2,
      sections: [section, { ...section, at: 0.5, width: 3, crest: 1 }],
    },
    [0, 0, -2],
    0.5,
  );
  TestValidator.equals("independent periodic widths", varying.outer, [
    [3, 0, 0],
    [0, 4, 0],
    [-5, 0, 0],
    [0, -4, 0],
  ]);
  const translated = createPortraitNasalEnvelope(
    base.map((p) => p.map((v, axis) => v + [10, 20, 30][axis])),
    normals,
    { segments: 2, sections: [section] },
    [0, 0, -2],
    0.5,
  );
  TestValidator.equals("translation", translated.outer[0], [13, 20, 30]);
  for (const segments of [1, 65, 2.5, NaN])
    TestValidator.predicate(
      "sampling admission",
      throwsError(() =>
        createPortraitNasalEnvelope(
          base,
          normals,
          { segments, sections: [section] },
          [0, 0, -2],
          0.5,
        ),
      ),
    );
  for (const sections of [
    [],
    [{ ...section, at: 0.1 }],
    [section, section],
    [section, { ...section, at: 1 }],
    [{ ...section, width: 0 }],
    [{ ...section, crest: NaN }],
    [{ ...section, crestPosition: 0 }],
    [{ ...section, crestPosition: 1 }],
  ])
    TestValidator.predicate(
      "section admission",
      throwsError(() =>
        createPortraitNasalEnvelope(
          base,
          normals,
          { segments: 2, sections },
          [0, 0, -2],
          0.5,
        ),
      ),
    );
  for (const values of [
    [],
    [[0, 0, 1]],
    base.map(() => [0, 0, 0]),
    base.map(() => [0, 0]),
    base.map(() => [NaN, 0, 1]),
  ])
    TestValidator.predicate(
      "normal admission",
      throwsError(() =>
        createPortraitNasalEnvelope(
          base,
          values,
          { segments: 2, sections: [section] },
          [0, 0, -2],
          0.5,
        ),
      ),
    );
  for (const offset of [
    [0, 0, 0],
    [0, 0],
    [NaN, 0, 0],
    [Number.MAX_VALUE, Number.MAX_VALUE, 0],
  ])
    TestValidator.predicate(
      "travel admission",
      throwsError(() =>
        createPortraitNasalEnvelope(
          base,
          normals,
          { segments: 2, sections: [section] },
          offset,
          0.5,
        ),
      ),
    );
  for (const contraction of [0, 1, NaN])
    TestValidator.predicate(
      "contraction admission",
      throwsError(() =>
        createPortraitNasalEnvelope(
          base,
          normals,
          { segments: 2, sections: [section] },
          [0, 0, -2],
          contraction,
        ),
      ),
    );
  for (const boundary of [
    [],
    [0, 1, 2],
    [0, 1, 2, 99],
    [0, 1, 2, 2],
    [0, 3, 2, 1],
  ])
    TestValidator.predicate(
      "lineage admission",
      throwsError(() => envelope.append(cage, boundary, [0, 1, 2, 3], 0, 2)),
    );
  for (const seeds of [[], [0, 1, 2, 2], [0, 1, 2, 4]])
    TestValidator.predicate(
      "seed admission",
      throwsError(() => envelope.append(cage, [0, 1, 2, 3], seeds, 0, 2)),
    );
  for (const group of [-1, 0.5, NaN])
    TestValidator.predicate(
      "group admission",
      throwsError(() =>
        envelope.append(cage, [0, 1, 2, 3], [0, 1, 2, 3], group, 2),
      ),
    );
};
