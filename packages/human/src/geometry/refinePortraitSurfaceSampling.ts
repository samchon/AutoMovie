import { Vector3 } from "@automovie/engine";
import type { IAutoMovieMeshDeformationField } from "@automovie/interface";

import { portraitNormals } from "./geometry";
import type { IControlMesh } from "./subdivideControlMesh";

/**
 * Insert shared tangent-guided samples around compact surface fields without
 * moving existing vertices. Outside pending contact, an intersecting face is
 * refined until its edges fit the requested millimetre spacing; neighbours share every inserted
 * midpoint, so a refined region cannot leave a T-junction at its boundary.
 * Original vertex identities and per-face material labels are retained.
 *
 * Input topology and fields are already admitted by the surface assembler.
 * Field boxes use metres. Box intersection is deliberately conservative rather
 * than missing a thin crease between the vertices of a coarse triangle.
 * Interior edge samples follow the two endpoint normal planes with the cubic
 * point-normal midpoint rule. Open edges stay linear, preserving their exact
 * rim. This interpolates existing curvature, not recovered anatomical detail.
 * Exactly coincident free-rim samples are pending tissue contact. Their
 * incident faces retain sampling until the assembler welds the seam, avoiding
 * unmatched subdivisions and differently curved opposed commissural folds.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-skin-condition Resolves narrow anatomical surface fields on connected skin rather than hiding them between coarse samples.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-skin-condition Adds conforming tangent-guided samples while retaining original vertices, open rims and material-region ownership.
 */
export function refinePortraitSurfaceSampling(
  input: IControlMesh,
  fields: readonly IAutoMovieMeshDeformationField[],
  spacing: number,
): IControlMesh {
  if (!Number.isFinite(spacing) || spacing <= 0)
    throw new Error(
      "Surface sample spacing must be positive finite millimetres.",
    );
  const boxes = fields.map((f) => ({
    min: [
      f.center.x - f.radius.x,
      f.center.y - f.radius.y,
      f.center.z - f.radius.z,
    ].map((x) => x * 1000),
    max: [
      f.center.x + f.radius.x,
      f.center.y + f.radius.y,
      f.center.z + f.radius.z,
    ].map((x) => x * 1000),
  }));
  const key = (a: number, b: number) => (a < b ? `${a}/${b}` : `${b}/${a}`);
  const packedNormals = portraitNormals(input.positions.flat(), input.indices);
  const normals = input.positions.map((_, i) =>
    packedNormals.slice(i * 3, i * 3 + 3),
  );
  let mesh = input;
  for (;;) {
    const split = new Map<string, number>();
    const positions = [...mesh.positions];
    const reference = mesh.reference?.map((p) => [...p]);
    const colors = mesh.colors?.map((p) => [...p]);
    const incidences = new Map<string, number>();
    for (let face = 0; face < mesh.indices.length; face += 3)
      for (let edge = 0; edge < 3; edge++) {
        const id = key(
          mesh.indices[face + edge],
          mesh.indices[face + ((edge + 1) % 3)],
        );
        incidences.set(id, (incidences.get(id) ?? 0) + 1);
      }
    const boundary = new Set<number>();
    for (const [id, count] of incidences)
      if (count === 1)
        for (const vertex of id.split("/").map(Number)) boundary.add(vertex);
    const coordinates = new Map<string, number>();
    const contact = new Set<number>();
    for (const vertex of boundary) {
      const coordinate = mesh.positions[vertex].join("/");
      const previous = coordinates.get(coordinate);
      if (previous === undefined) coordinates.set(coordinate, vertex);
      else {
        contact.add(previous);
        contact.add(vertex);
      }
    }
    for (let face = 0; face < mesh.indices.length; face += 3) {
      const ids = mesh.indices.slice(face, face + 3),
        points = ids.map((i) => mesh.positions[i]);
      if (ids.some((id) => contact.has(id))) continue;
      const min = [0, 1, 2].map((axis) =>
        Math.min(...points.map((p) => p[axis])),
      );
      const max = [0, 1, 2].map((axis) =>
        Math.max(...points.map((p) => p[axis])),
      );
      if (
        !boxes.some((box) =>
          [0, 1, 2].every(
            (axis) => min[axis] <= box.max[axis] && max[axis] >= box.min[axis],
          ),
        )
      )
        continue;
      for (let edge = 0; edge < 3; edge++) {
        const a = ids[edge],
          b = ids[(edge + 1) % 3],
          pa = mesh.positions[a],
          pb = mesh.positions[b],
          id = key(a, b);
        if (
          split.has(id) ||
          Math.hypot(...pa.map((p, axis) => p - pb[axis])) <= spacing
        )
          continue;
        const delta = pa.map((p, axis) => pb[axis] - p),
          na = normals[a],
          nb = normals[b];
        const dotA = delta.reduce((s, p, axis) => s + p * na[axis], 0),
          dotB = delta.reduce((s, p, axis) => s + p * nb[axis], 0);
        const midpoint = pa.map(
          (p, axis) =>
            p / 2 +
            pb[axis] / 2 +
            (incidences.get(id) === 2
              ? (dotB * nb[axis] - dotA * na[axis]) / 8
              : 0),
        );
        if (
          midpoint.every((p, axis) => p === pa[axis]) ||
          midpoint.every((p, axis) => p === pb[axis])
        )
          throw new Error(
            "Surface sample spacing is below representable coordinate precision.",
          );
        split.set(id, positions.push(midpoint) - 1);
        for (const attribute of [reference, colors])
          if (attribute !== undefined)
            attribute.push(
              attribute[a].map(
                (value, axis) => (value + attribute[b][axis]) / 2,
              ),
            );
        const normal = Vector3.normalize({
          x: na[0] + nb[0],
          y: na[1] + nb[1],
          z: na[2] + nb[2],
        });
        normals.push([normal.x, normal.y, normal.z]);
      }
    }
    if (split.size === 0) return mesh;
    const indices: number[] = [],
      groups: number[] = [];
    for (let face = 0; face < mesh.indices.length; face += 3) {
      const v = mesh.indices.slice(face, face + 3),
        m = v.map((a, i) => split.get(key(a, v[(i + 1) % 3])));
      const count = m.filter((x) => x !== undefined).length;
      const emit = (...ids: number[]) => {
        indices.push(...ids);
        for (let n = 0; n < ids.length; n += 3)
          groups.push(mesh.groups[face / 3]);
      };
      if (count === 0) emit(...v);
      else if (count === 3)
        emit(
          v[0],
          m[0]!,
          m[2]!,
          m[0]!,
          v[1],
          m[1]!,
          m[2]!,
          m[1]!,
          v[2],
          m[0]!,
          m[1]!,
          m[2]!,
        );
      else {
        // Rotate to the only split edge, or to the first of two adjacent splits.
        const start =
          count === 1
            ? m.findIndex((x) => x !== undefined)
            : m.findIndex(
                (x, i) => x !== undefined && m[(i + 1) % 3] !== undefined,
              );
        const [a, b, c] = [0, 1, 2].map((i) => v[(start + i) % 3]),
          ab = m[start]!;
        if (count === 1) emit(a, ab, c, ab, b, c);
        else {
          const bc = m[(start + 1) % 3]!;
          emit(ab, b, bc, a, ab, c, ab, bc, c);
        }
      }
    }
    mesh = {
      positions,
      indices,
      groups,
      ...(reference === undefined ? {} : { reference }),
      ...(colors === undefined ? {} : { colors }),
    };
  }
}
