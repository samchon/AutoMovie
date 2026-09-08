import {
  selectAutoMovieTriangleRegion,
  triangulateAutoMovieRegion,
} from "@automovie/engine";

import type { IPortraitComponent } from "./portraitComponents";
import {
  type IPortraitPatchAttachment,
  fitPortraitPatchBoundary,
} from "./portraitPatchAttachment";
import type { IControlMesh } from "./subdivideControlMesh";

/** A source patch in the host's millimetre frame, with an oriented boundary. */
export interface IPortraitMeshPatch {
  mesh: IControlMesh;
  /** The patch boundary must project strictly inside the host boundary in XY. */
  boundary: readonly number[];
}

/**
 * Replace an entire connected region with a source patch and a shared annulus.
 * Both loops follow the winding of the faces they enclose. Their XY projection
 * must define a simple outer ring with the source strictly inside. The engine
 * triangulates that annular region while retaining its exact input coordinates.
 * Those 2D identities address the original 3D vertices, so no depth is flattened
 * and no independent overlay or second normal field is introduced.
 *
 * The source provider runs at fit time and must be deterministic. Its returned
 * mesh is copied before attachment. The caller owns provenance, common-frame
 * placement and a suitable nested boundary arrangement. Connectivity admission
 * does not certify a smooth outer join or absence of geometric intersections;
 * those require actual geometry measurement and rendered inspection.
 * Optional attachment first places the host boundary on the complete source
 * surface along the view ray. Its constraints use the existing host skin blend;
 * omission leaves the original host controls unchanged. The same source surface
 * evaluates the refined annulus after anatomical layers. Merely matching the
 * coarse boundary does not constrain new subdivision samples to that surface.
 * The donor core is excluded from this depth query: its undercuts and cavities
 * must retain native three-dimensional topology, not a frontmost depth sheet.
 */
export function createPortraitMeshPatchComponent(
  id: string,
  inputBoundary: readonly number[],
  provide: () => IPortraitMeshPatch,
  inputAttachment?: IPortraitPatchAttachment,
): IPortraitComponent {
  const boundary = [...inputBoundary];
  const attachment =
    inputAttachment === undefined ? undefined : { ...inputAttachment };
  if (
    id.trim().length === 0 ||
    boundary.length < 3 ||
    new Set(boundary).size !== boundary.length ||
    boundary.some((v) => !Number.isInteger(v) || v < 0)
  )
    throw new Error(
      "A patch component needs an identity and a simple host boundary.",
    );
  const validateEdges = (points: readonly (readonly number[])[]): void => {
    const lengths = points.map((point, i) =>
      Math.hypot(
        ...point.map((v, k) => v - points[(i + 1) % points.length][k]),
      ),
    );
    const total = lengths.reduce((sum, v) => sum + v, 0);
    if (!Number.isFinite(total) || lengths.some((v) => v <= 0))
      throw new Error("A patch boundary needs finite nonzero edges.");
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
      validateEdges(boundary.map((v) => host.positions[v]));
      validateEdges(source.boundary.map((v) => source.mesh.positions[v]));
      return {
        constraints:
          attachment === undefined
            ? []
            : fitPortraitPatchBoundary(host, boundary, source.mesh, attachment),
        cutFaces: selectAutoMovieTriangleRegion({
          indices: host.indices,
          boundary,
        }),
        attach: (cage, _adapted, region) => {
          const remap = new Map(
            used.map((vertex, i) => [vertex, cage.positions.length + i]),
          );
          const inner = source.boundary.map((v) => remap.get(v)!);
          const point = (p: readonly number[]) => ({
            x: p[0] / 1000,
            y: p[1] / 1000,
          });
          const key = (p: { x: number; y: number }) => `${p.x}/${p.y}`;
          const outerPoints = boundary.map((v) => point(cage.positions[v]));
          const innerPoints = source.boundary.map((v) =>
            point(source.mesh.positions[v]),
          );
          const triangulation = triangulateAutoMovieRegion({
            outer: outerPoints,
            holes: [innerPoints],
          });
          const identities = new Map([
            ...outerPoints.map((p, i) => [key(p), boundary[i]] as const),
            ...innerPoints.map((p, i) => [key(p), inner[i]] as const),
          ]);
          const mapped = triangulation.points.map(
            (p) => identities.get(key(p))!,
          );
          // Canonicalization only reverses a ring. Its first identity therefore
          // tells us its input winding without duplicating polygon-area math.
          const reversed = mapped[0] !== boundary[0];
          const innerReversed =
            mapped[triangulation.rings[1].start] !== inner[0];
          if (reversed === innerReversed)
            throw new Error(
              "A source patch and host must have matching projected winding.",
            );
          // Complete admission precedes mutation of the shared cage or groups.
          const group = region(id, "skin");
          const joinGroup =
            attachment === undefined ? group : region(`${id}-join`, "skin");
          for (const vertex of used)
            cage.positions.push([...source.mesh.positions[vertex]]);
          for (const face of faces) {
            cage.indices.push(...face.map((v) => remap.get(v)!));
            cage.groups.push(group);
          }
          for (let i = 0; i < triangulation.triangles.length; i += 3) {
            const tri = triangulation.triangles
              .slice(i, i + 3)
              .map((v) => mapped[v]);
            cage.indices.push(
              tri[0],
              tri[reversed ? 2 : 1],
              tri[reversed ? 1 : 2],
            );
            cage.groups.push(joinGroup);
          }
          return {
            openings: [],
            finalSurface:
              attachment === undefined
                ? undefined
                : (refined) => {
                    // Face ancestry survives subdivision. Shared inner/outer
                    // seam identities are included once, so normals are still
                    // computed on one connected surface by the host assembler.
                    const vertices = new Set<number>();
                    for (let face = 0; face < refined.groups.length; face++)
                      if (refined.groups[face] === joinGroup)
                        for (let corner = 0; corner < 3; corner++)
                          vertices.add(refined.indices[face * 3 + corner]);
                    return fitPortraitPatchBoundary(
                      {
                        positions: refined.positions.map((p) => [...p]),
                        indices: [...refined.indices],
                        viewRay: [...host.viewRay],
                      },
                      [...vertices],
                      source.mesh,
                      attachment,
                    );
                  },
            finish: () => [],
          };
        },
      };
    },
  };
}
