import type { IAutoMovieMesh } from "@automovie/interface";

import { blendPortraitSkin } from "./blendPortraitSkin";
import { portraitCutBoundary } from "./generated-korean-girl-01/nose";
import { portraitNormals } from "./geometry";

/**
 * Replace a boundary on an already refined skin mesh without refining it again.
 * All positions, edge lengths and reach use the caller's common millimetre frame.
 * Targets are final positions, not displacements or a new control cage. The
 * caller owns the corresponding lining and recomputes normals across their
 * shared boundary after this operation; this helper changes skin positions only.
 *
 * The existing skin solver runs on a bounded submesh containing the requested
 * geodesic collar and its fixed outer ring. It therefore uses the same positive
 * inverse-edge-length displacement interpolation as a component attachment,
 * without scanning the complete refined head in every solver sweep. Vertices at
 * or beyond reach retain their input positions exactly. A zero reach moves only
 * the explicit boundary; an empty boundary is identity.
 *
 * This is a controlled final-rim experiment, not a promise that an arbitrary
 * replacement fits anatomically or avoids intersection. The assembled result
 * must still pass the normal AutoMovie model and actual Float32 export gates.
 */
export function replacePortraitRim(
  positions: number[][],
  indices: number[],
  rim: number[],
  targets: number[][],
  reach: number,
): { positions: number[][]; collar: number[] } {
  if (
    !Number.isFinite(reach) ||
    reach < 0 ||
    targets.length !== rim.length ||
    new Set(rim).size !== rim.length ||
    rim.some(
      (id) => !Number.isInteger(id) || id < 0 || id >= positions.length,
    ) ||
    targets.some((p) => p.length !== 3 || !p.every(Number.isFinite))
  )
    throw new Error(
      "A final rim needs unique resident vertices, finite XYZ targets and nonnegative reach.",
    );
  const neighbours = positions.map(() => new Map<number, number>());
  for (let i = 0; i < indices.length; i += 3)
    for (let corner = 0; corner < 3; corner++) {
      const a = indices[i + corner],
        b = indices[i + ((corner + 1) % 3)];
      const length = Math.hypot(
        ...positions[a].map((v, axis) => v - positions[b][axis]),
      );
      if (!(length > 0) || !Number.isFinite(length))
        throw new Error(
          "A final skin collar needs finite positive edge lengths.",
        );
      neighbours[a].set(b, length);
      neighbours[b].set(a, length);
    }
  // Positive edge lengths make repeated relaxation converge to shortest paths.
  // Only paths strictly inside reach are queued, so disconnected skin and the
  // outer ring never enter the free displacement population.
  const distance = new Map(rim.map((id) => [id, 0]));
  const queue = [...rim];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor];
    for (const [next, length] of neighbours[id]) {
      const candidate = distance.get(id)! + length;
      if (candidate < reach && candidate < (distance.get(next) ?? Infinity)) {
        distance.set(next, candidate);
        queue.push(next);
      }
    }
  }
  const selected: number[] = [];
  for (let i = 0; i < indices.length; i += 3)
    if (indices.slice(i, i + 3).some((id) => distance.has(id)))
      selected.push(...indices.slice(i, i + 3));
  const ids = [...new Set([...rim, ...selected])];
  const local = new Map(ids.map((id, i) => [id, i]));
  const fixed = new Map(rim.map((id, i) => [id, targets[i]]));
  const adapted = blendPortraitSkin(
    ids.map((id) => positions[id]),
    selected.map((id) => local.get(id)!),
    ids
      .filter((id) => fixed.has(id) || !distance.has(id))
      .map((id) => ({
        vertex: local.get(id)!,
        target: fixed.get(id) ?? positions[id],
        reach: fixed.has(id) ? reach : 0,
      })),
  );
  return {
    positions: positions.map((point, id) =>
      distance.has(id) ? adapted[local.get(id)!] : [...point],
    ),
    collar: [...distance.keys()]
      .filter((id) => !fixed.has(id))
      .sort((a, b) => a - b),
  };
}

/** The already assembled, metre-space skin and its two separate lining patches. */
export interface IPortraitRimMeshes {
  skin: IAutoMovieMesh;
  lining: IAutoMovieMesh;
}

/**
 * Replace one final aperture group while retaining the opposite side and body.
 * The two inputs share triangle/vertex lineage. Their metre-space buffers are
 * sampled at actual Float32 precision before identifying the shared boundary;
 * coincident rim vertices must resolve to exactly one skin vertex on BOTH bases.
 * Side is the sign of head X, with +1 anatomical left. Crossing the midline is
 * refused rather than treating a partial cavity as a replaceable component.
 *
 * Only the selected lining and a skin geodesic collar move. Normals are rebuilt
 * once over the rejoined material boundary, and only vertices incident to moved
 * triangles receive them. The unchanged outer ring may therefore change normal
 * while retaining exact position; returned identities make that distinction
 * inspectable. No Loop pass follows these final constraints. Target normals do
 * not supply a second lighting basis, and the other side retains its own data.
 */
export function replacePortraitRimAttachment(
  input: IPortraitRimMeshes,
  target: IPortraitRimMeshes,
  side: -1 | 1,
  reach: number,
): IPortraitRimMeshes & {
  rim: number[];
  collar: number[];
  changedPositions: number[];
  affectedNormals: number[];
  liningIds: number[];
} {
  for (const pair of [input, target])
    for (const mesh of [pair.skin, pair.lining])
      if (
        mesh.indices === null ||
        mesh.normals === null ||
        mesh.positions.length % 3 !== 0 ||
        mesh.normals.length !== mesh.positions.length ||
        !mesh.positions.every((value) => Number.isFinite(Math.fround(value))) ||
        mesh.indices.length % 3 !== 0 ||
        mesh.indices.some(
          (id) =>
            !Number.isInteger(id) || id < 0 || id >= mesh.positions.length / 3,
        )
      )
        throw new Error(
          "A rim replacement needs resident indexed mesh buffers and aligned normals.",
        );
  for (const name of ["skin", "lining"] as const)
    if (
      input[name].positions.length !== target[name].positions.length ||
      input[name].indices!.length !== target[name].indices!.length ||
      input[name].indices!.some((id, i) => id !== target[name].indices![i])
    )
      throw new Error(
        "A rim replacement needs the same vertex and triangle lineage.",
      );
  const points = (mesh: IAutoMovieMesh) =>
    Array.from({ length: mesh.positions.length / 3 }, (_, id) =>
      mesh.positions
        .slice(id * 3, id * 3 + 3)
        .map((v) => Math.fround(v) * 1000),
    );
  const skinPoints = points(input.skin),
    liningPoints = points(input.lining);
  const targetSkin = points(target.skin),
    targetLining = points(target.lining);
  const key = (p: number[]) => p.join("/");
  const skinIds = new Map<string, number[]>();
  skinPoints.forEach((p, id) =>
    skinIds.set(key(p), [...(skinIds.get(key(p)) ?? []), id]),
  );
  const faces = Array.from(
    { length: input.lining.indices!.length / 3 },
    (_, id) => input.lining.indices!.slice(id * 3, id * 3 + 3),
  );
  for (const face of faces)
    if (
      liningPoints[face[0]][0] === 0 ||
      face.some(
        (id) =>
          Math.sign(liningPoints[id][0]) !==
          Math.sign(liningPoints[face[0]][0]),
      )
    )
      throw new Error(
        "A replaceable lining must stay on one side of the head midline.",
      );
  const selected = faces.filter(
    (face) => Math.sign(liningPoints[face[0]][0]) === side,
  );
  const opposite = faces.filter(
    (face) => Math.sign(liningPoints[face[0]][0]) !== side,
  );
  const selectedRim = portraitCutBoundary(selected).map((edge) => edge.a);
  const otherRim = portraitCutBoundary(opposite).map((edge) => edge.a);
  const shared = new Map<number, number>();
  for (const id of [...selectedRim, ...otherRim]) {
    const resident = skinIds.get(key(liningPoints[id]));
    if (
      resident?.length !== 1 ||
      key(targetSkin[resident[0]]) !== key(targetLining[id])
    )
      throw new Error(
        "A final lining boundary must identify one shared skin vertex on both bases.",
      );
    if (
      [0, 1, 2].some(
        (axis) =>
          Math.fround(input.skin.normals![resident[0] * 3 + axis]) !==
          Math.fround(input.lining.normals![id * 3 + axis]),
      )
    )
      throw new Error("A final input rim must already share one normal field.");
    shared.set(id, resident[0]);
  }
  const rim = selectedRim.map((id) => shared.get(id)!);
  const adapted = replacePortraitRim(
    skinPoints,
    input.skin.indices!,
    rim,
    selectedRim.map((id) => targetLining[id]),
    reach,
  );
  const skin = structuredClone(input.skin),
    lining = structuredClone(input.lining);
  for (const id of [...rim, ...adapted.collar])
    for (let axis = 0; axis < 3; axis++)
      if (
        Math.fround(skin.positions[id * 3 + axis]) !==
        Math.fround(adapted.positions[id][axis] / 1000)
      )
        skin.positions[id * 3 + axis] = adapted.positions[id][axis] / 1000;
  for (const id of new Set(selected.flat()))
    for (let axis = 0; axis < 3; axis++)
      if (
        Math.fround(lining.positions[id * 3 + axis]) !==
        Math.fround(targetLining[id][axis] / 1000)
      )
        lining.positions[id * 3 + axis] = targetLining[id][axis] / 1000;
  const joined = points(skin).map((p) => p.map((v) => v / 1000));
  const previous = skinPoints.map((p) => p.map((v) => v / 1000));
  const liningIds: number[] = [];
  for (let id = 0; id < lining.positions.length / 3; id++) {
    let resident = shared.get(id);
    if (resident === undefined) {
      resident = joined.length;
      joined.push(lining.positions.slice(id * 3, id * 3 + 3).map(Math.fround));
      previous.push(
        input.lining.positions.slice(id * 3, id * 3 + 3).map(Math.fround),
      );
    }
    liningIds.push(resident);
  }
  const commonIndices = [
    ...skin.indices!,
    ...lining.indices!.map((id) => liningIds[id]),
  ];
  const changed = new Set(
    joined.flatMap((p, id) =>
      p.some((v, axis) => v !== previous[id][axis]) ? [id] : [],
    ),
  );
  const affected = new Set<number>();
  for (let i = 0; i < commonIndices.length; i += 3)
    if (commonIndices.slice(i, i + 3).some((id) => changed.has(id)))
      commonIndices.slice(i, i + 3).forEach((id) => affected.add(id));
  const normals = portraitNormals(joined.flat(), commonIndices);
  for (let id = 0; id < skin.positions.length / 3; id++)
    if (affected.has(id))
      for (let axis = 0; axis < 3; axis++)
        skin.normals![id * 3 + axis] = normals[id * 3 + axis];
  for (let id = 0; id < liningIds.length; id++)
    if (affected.has(liningIds[id]))
      for (let axis = 0; axis < 3; axis++)
        lining.normals![id * 3 + axis] = normals[liningIds[id] * 3 + axis];
  return {
    skin,
    lining,
    rim,
    collar: adapted.collar,
    changedPositions: [...changed],
    affectedNormals: [...affected],
    liningIds,
  };
}
