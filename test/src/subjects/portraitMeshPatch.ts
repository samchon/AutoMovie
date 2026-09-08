import { selectAutoMovieTriangleRegion } from "@automovie/engine";

import type { IPortraitComponent } from "./portraitComponents";
import type { IControlMesh } from "./subdivideControlMesh";

/** A source patch in the host's millimetre frame, with an oriented boundary. */
export interface IPortraitMeshPatch {
  mesh: IControlMesh;
  /** The first sample corresponds to the host boundary's first anatomical site. */
  boundary: readonly number[];
}

/**
 * Replace an entire connected region with a source patch and a shared annulus.
 * Both loops follow the winding of the faces they enclose, with corresponding
 * first samples. Their normalized 3D perimeter distances determine a zipper
 * triangulation with n+m triangles, including both closing edges. No independent
 * overlay, per-vertex placement guess or second normal field is introduced.
 *
 * The source provider runs at fit time and must be deterministic. Its returned
 * mesh is copied before attachment. The caller owns provenance, common-frame
 * placement and a suitable nested boundary arrangement. Connectivity admission
 * does not certify a smooth outer join or absence of geometric intersections;
 * those require actual geometry measurement and rendered inspection.
 */
export function createPortraitMeshPatchComponent(
  id: string,
  inputBoundary: readonly number[],
  provide: () => IPortraitMeshPatch,
): IPortraitComponent {
  const boundary = [...inputBoundary];
  if (
    id.trim().length === 0 ||
    boundary.length < 3 ||
    new Set(boundary).size !== boundary.length ||
    boundary.some((v) => !Number.isInteger(v) || v < 0)
  )
    throw new Error(
      "A patch component needs an identity and a simple host boundary.",
    );
  const progress = (points: readonly (readonly number[])[]): number[] => {
    const lengths = points.map((point, i) =>
      Math.hypot(
        ...point.map((v, k) => v - points[(i + 1) % points.length][k]),
      ),
    );
    const total = lengths.reduce((sum, v) => sum + v, 0);
    if (!Number.isFinite(total) || lengths.some((v) => v <= 0))
      throw new Error("A patch boundary needs finite nonzero edges.");
    const result = [0];
    for (const length of lengths)
      result.push(Math.min(1, result.at(-1)! + length / total));
    result[result.length - 1] = 1;
    return result;
  };
  return {
    id,
    fit: (host) => {
      const source = structuredClone(provide());
      const selected = selectAutoMovieTriangleRegion({
        indices: source.mesh.indices,
        boundary: source.boundary,
      });
      const faces = selected.map((i) =>
        source.mesh.indices.slice(i * 3, i * 3 + 3),
      );
      const used = [...new Set(faces.flat())];
      if (
        [
          ...boundary.map((v) => host.positions[v]),
          ...used.map((v) => source.mesh.positions[v]),
        ].some(
          (p) => p === undefined || p.length !== 3 || !p.every(Number.isFinite),
        )
      )
        throw new Error(
          "A patch needs finite resident source and host positions.",
        );
      const outside = progress(boundary.map((v) => host.positions[v]));
      const inside = progress(
        source.boundary.map((v) => source.mesh.positions[v]),
      );
      return {
        constraints: [],
        cutFaces: selectAutoMovieTriangleRegion({
          indices: host.indices,
          boundary,
        }),
        attach: (cage, _adapted, region) => {
          const group = region(id, "skin");
          const remap = new Map<number, number>();
          for (const vertex of used) {
            remap.set(vertex, cage.positions.length);
            cage.positions.push([...source.mesh.positions[vertex]]);
          }
          for (const face of faces) {
            cage.indices.push(...face.map((v) => remap.get(v)!));
            cage.groups.push(group);
          }
          const inner = source.boundary.map((v) => remap.get(v)!);
          let a = 0,
            b = 0;
          // Equal terminal progress advances the outer loop first. Therefore
          // every outer edge is consumed before the final inner edge closes.
          while (b < inner.length) {
            const outer = boundary[a % boundary.length],
              interior = inner[b % inner.length];
            const outerNext = a < boundary.length ? outside[a + 1] : Infinity;
            const innerNext = inside[b + 1];
            if (outerNext <= innerNext) {
              cage.indices.push(
                outer,
                boundary[(a + 1) % boundary.length],
                interior,
              );
              a++;
            } else {
              cage.indices.push(outer, inner[(b + 1) % inner.length], interior);
              b++;
            }
            cage.groups.push(group);
          }
          return { openings: [], finish: () => [] };
        },
      };
    },
  };
}
