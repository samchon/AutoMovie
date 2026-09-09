import {
  selectAutoMovieTriangleRegion,
  triangulateAutoMovieRegion,
} from "@automovie/engine";

import { portraitNormals } from "./geometry";
import type { IPortraitComponent } from "./portraitComponents";
import type { IPortraitFinalSurfaceHost } from "./portraitFinalSurface";
import { fitPortraitJoinBoundary } from "./portraitJoinTangency";
import {
  type IPortraitPatchAttachment,
  fitPortraitPatchBoundary,
} from "./portraitPatchAttachment";
import { fairPortraitSurface } from "./portraitSurfaceFairing";
import { refinePortraitJoin } from "./refinePortraitJoin";
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
 * omission leaves the original host controls unchanged. After refinement and
 * anatomical layers, a bounded fairing solve joins the final neighbouring
 * surfaces with fixed shared boundaries. The donor core and host are fixed;
 * only annulus-interior vertices travel along the recorded view ray. Optional
 * tangent continuity first rotates its boundary-adjacent row in the physical
 * edge frame, then holds that row while all three interior coordinates are solved.
 *
 * preserveSource reserves the coarse host region instead of inserting the
 * sampled source into Loop subdivision. Its actual refined boundary is recovered
 * after host layers, then the source is installed unchanged. Interior edge and
 * face splits add movable join samples; source and host boundaries stay shared.
 * Omission retains the control-cage path and its existing subdivision behavior.
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
  if (
    (attachment?.boundaryContinuity !== undefined &&
      attachment.boundaryContinuity !== "position" &&
      attachment.boundaryContinuity !== "tangent") ||
    (attachment?.boundaryContinuity === "tangent" &&
      (attachment.preserveSource !== true ||
        (attachment.joinSubdivisionRounds ?? 2) < 2)) ||
    (attachment?.preserveSource !== undefined &&
      typeof attachment.preserveSource !== "boolean") ||
    (attachment?.joinSubdivisionRounds !== undefined &&
      (attachment.preserveSource !== true ||
        !Number.isInteger(attachment.joinSubdivisionRounds) ||
        attachment.joinSubdivisionRounds < 0 ||
        attachment.joinSubdivisionRounds > 4))
  )
    throw new Error(
      "Source preservation needs valid mode/refinement settings; tangent continuity requires a retained source and at least two joining rounds.",
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
      // Final refinement uses this fitted frame, not a later caller mutation.
      const viewRay = [...host.viewRay];
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
      const append = (
        cage: IControlMesh,
        boundary: readonly number[],
        region: (id: string, material: string) => number,
        subdivisions: number,
      ) => {
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
        const mapped = triangulation.points.map((p) => identities.get(key(p))!);
        // Canonicalization only reverses a ring. Its first identity therefore
        // tells us its input winding without duplicating polygon-area math.
        const reversed = mapped[0] !== boundary[0];
        const innerReversed = mapped[triangulation.rings[1].start] !== inner[0];
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
        let bridge: number[][] = [];
        for (let i = 0; i < triangulation.triangles.length; i += 3) {
          const tri = triangulation.triangles
            .slice(i, i + 3)
            .map((v) => mapped[v]);
          bridge.push([tri[0], tri[reversed ? 2 : 1], tri[reversed ? 1 : 2]]);
        }
        bridge = refinePortraitJoin(cage, bridge, subdivisions);
        for (const tri of bridge) {
          cage.indices.push(...tri);
          cage.groups.push(joinGroup);
        }
        return {
          openings: [],
          finalSurface:
            attachment === undefined
              ? undefined
              : (refined: IPortraitFinalSurfaceHost) =>
                  fairPortraitSurface(refined, joinGroup, viewRay),
          finish: () => [],
        };
      };
      return {
        constraints:
          attachment === undefined
            ? []
            : fitPortraitPatchBoundary(host, boundary, source.mesh, attachment),
        cutFaces:
          attachment?.preserveSource === true
            ? []
            : selectAutoMovieTriangleRegion({
                indices: host.indices,
                boundary,
              }),
        attach: (cage, _adapted, region) => {
          if (attachment?.preserveSource !== true)
            return append(cage, boundary, region, 0);
          const selected = selectAutoMovieTriangleRegion({
            indices: cage.indices,
            boundary,
          });
          if (selected.some((face) => cage.groups[face] !== 0))
            throw new Error(
              "A retained source patch must reserve unclaimed host skin.",
            );
          const group = region(id, "skin"),
            joinGroup = region(`${id}-join`, "skin");
          for (const face of selected) cage.groups[face] = joinGroup;
          return {
            openings: [],
            // The discarded interior is a placeholder, not a source of seam
            // shape. The shared curve rule isolates both its boundary vertices
            // and split edges from that temporary interior during refinement.
            curves: [boundary],
            replacements: [
              {
                group: joinGroup,
                append: (
                  refined: IControlMesh,
                  refinedBoundary: readonly number[],
                ) => {
                  append(
                    refined,
                    refinedBoundary,
                    (name) => (name === id ? group : joinGroup),
                    attachment.joinSubdivisionRounds ?? 2,
                  );
                },
              },
            ],
            finalSurface: (refined: IPortraitFinalSurfaceHost) => {
              if (attachment.boundaryContinuity !== "tangent")
                return fairPortraitSurface(refined, joinGroup, viewRay);
              const targets = fitPortraitJoinBoundary(refined, joinGroup);
              const byVertex = new Map(
                targets.map((t) => [t.vertex, t.target]),
              );
              const positions = refined.positions.map(
                (p, id) => byVertex.get(id) ?? [...p],
              );
              const basis = {
                ...refined,
                positions,
                normals: portraitNormals(positions.flat(), [
                  ...refined.indices,
                ]),
              };
              const fixed = targets.map((t) => t.vertex);
              // The admitted annulus is one positive XY chart. Only its height
              // remains free; unconstrained XYZ fairing folded this chart even
              // while every boundary triangle matched its neighbour's plane.
              return [
                ...targets,
                ...fairPortraitSurface(
                  basis,
                  joinGroup,
                  [0, 0, 1],
                  undefined,
                  fixed,
                  "xy",
                ),
              ];
            },
            finish: () => [],
          };
        },
      };
    },
  };
}
