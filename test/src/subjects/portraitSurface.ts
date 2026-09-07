import {
  compareCodeUnits,
  createAutoMovieMeshDeformer,
} from "@automovie/engine";
import type { IAutoMovieMeshDeformationField } from "@automovie/interface";

import { portraitNormals, portraitPart } from "./geometry";
import type { IControlMesh } from "./subdivideControlMesh";

/**
 * The final connected skin before surface detail. Positions use construction
 * millimetres and normals are unit vectors. Bindings retain original vertex
 * identities after subdivision, while newly inserted vertices resolve detail.
 *
 * @author Samchon
 */
export interface IPortraitSurfaceHost {
  /** Final shared skin positions; readers must not mutate them. */
  positions: readonly (readonly number[])[];
  /** Oriented shared triangle indices. */
  indices: readonly number[];
  /** Flat XYZ normal buffer over the complete shared surface. */
  normals: readonly number[];
}

/**
 * A replaceable anatomical surface layer, such as cheek volume or a facial
 * crease. Fields use the engine's metre frame and are evaluated together on
 * the same unmodified surface. A layer changes skin, not a detached overlay.
 *
 * @author Samchon
 */
export interface IPortraitSurfaceLayer {
  /** Unique stable identity, used for deterministic composition order. */
  id: string;
  /** Derive metric fields from this instance's actual surface attachments. */
  fields: (host: IPortraitSurfaceHost) => IAutoMovieMeshDeformationField[];
}

/**
 * Apply anatomical layers after refinement and before shared normals/material
 * regions are extracted. Open eye, mouth and crop boundaries remain exact;
 * a quintic fade reaches full influence over the declared geodesic distance.
 * Unreferenced gaze markers remain unchanged. Zero layers/fields are identity.
 *
 * attachmentFade and the returned cage use millimetres. Layer factories emit
 * metre-valued engine fields. Convert only at the deformer boundary, then add
 * its displacement back to the original millimetre coordinates. This avoids
 * rescaling vertices that have zero influence.
 *
 * Every layer reads the same host; stable ID sorting fixes summation order.
 * The host has already passed topology validation. This helper preserves its
 * triangles and material groups, and the caller recomputes shared normals after
 * the boundary fade, whose spatial gradient also changes the surface slope.
 */
export function applyPortraitSurfaceLayers(
  mesh: IControlMesh,
  layers: readonly IPortraitSurfaceLayer[],
  attachmentFade = 3,
): IControlMesh {
  if (!Number.isFinite(attachmentFade) || attachmentFade <= 0)
    throw new Error(
      "A surface attachment fade must be a positive millimetre distance.",
    );
  if (
    layers.some((layer) => layer.id.trim().length === 0) ||
    new Set(layers.map((layer) => layer.id)).size !== layers.length
  )
    throw new Error("Anatomical surface layer identities must be unique.");
  if (layers.length === 0) return mesh;
  const packed = mesh.positions.flat();
  const host = {
    positions: mesh.positions,
    indices: mesh.indices,
    normals: portraitNormals(packed, mesh.indices),
  };
  const fields = [...layers]
    .sort((a, b) => compareCodeUnits(a.id, b.id))
    .flatMap((layer) => layer.fields(host));
  if (fields.length === 0) return mesh;
  const metric = portraitPart(
    "surface-basis",
    {
      positions: packed,
      indices: mesh.indices,
      normals: null,
      uvs: null,
      skin: null,
    },
    "skin",
  ).geometry.mesh;
  const changed = createAutoMovieMeshDeformer(fields)(metric);

  // Count undirected edges on the complete skin, before material separation.
  // A one-face edge is an intentional free rim, so colour seams do not become
  // artificial deformation barriers. Edge lengths use construction millimetres.
  const edges = new Map<
    string,
    { a: number; b: number; count: number; length: number }
  >();
  for (let i = 0; i < mesh.indices.length; i += 3)
    for (let corner = 0; corner < 3; corner++) {
      const a = mesh.indices[i + corner],
        b = mesh.indices[i + ((corner + 1) % 3)],
        key = a < b ? `${a}/${b}` : `${b}/${a}`;
      const edge = edges.get(key);
      if (edge !== undefined) edge.count++;
      else
        edges.set(key, {
          a,
          b,
          count: 1,
          length: Math.hypot(
            ...mesh.positions[a].map(
              (value, axis) => value - mesh.positions[b][axis],
            ),
          ),
        });
    }
  const neighbours = mesh.positions.map(
    () => [] as { vertex: number; length: number }[],
  );
  const distances = new Float64Array(mesh.positions.length).fill(Infinity);
  const queued = new Uint8Array(mesh.positions.length),
    queue: number[] = [];
  for (const edge of edges.values()) {
    neighbours[edge.a].push({ vertex: edge.b, length: edge.length });
    neighbours[edge.b].push({ vertex: edge.a, length: edge.length });
    if (edge.count === 1)
      for (const id of [edge.a, edge.b])
        if (distances[id] !== 0) {
          distances[id] = 0;
          queued[id] = 1;
          queue.push(id);
        }
  }
  // Positive edge lengths and a bounded reach make queue relaxation local to
  // the openings. It avoids scanning the whole dense skin for each next node.
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor];
    queued[id] = 0;
    for (const near of neighbours[id]) {
      const distance = distances[id] + near.length;
      if (distance >= attachmentFade || distance >= distances[near.vertex])
        continue;
      distances[near.vertex] = distance;
      if (queued[near.vertex] === 0) {
        queued[near.vertex] = 1;
        queue.push(near.vertex);
      }
    }
  }
  // Smoothstep has zero first and second derivatives at both ends. Isolated
  // gaze markers receive zero influence; closed components outside every rim's
  // reachable neighbourhood receive full influence. Only positions are replaced.
  return {
    ...mesh,
    positions: mesh.positions.map((point, id) => {
      const t =
        neighbours[id].length === 0
          ? 0
          : Math.min(1, distances[id] / attachmentFade);
      const influence = t * t * t * (10 + t * (-15 + 6 * t));
      return point.map(
        (value, axis) =>
          value +
          influence *
            (changed.positions[3 * id + axis] -
              metric.positions[3 * id + axis]) *
            1000,
      );
    }),
  };
}
