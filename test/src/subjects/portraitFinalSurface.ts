import { portraitNormals } from "./geometry";
import type { IControlMesh } from "./subdivideControlMesh";

/** Immutable common surface after subdivision and the anatomical field layers. */
export interface IPortraitFinalSurfaceHost {
  /** Shared XYZ positions in construction millimetres. */
  positions: readonly (readonly number[])[];
  /** Resident oriented triangle indices, unchanged by a final surface proposal. */
  indices: readonly number[];
  /** One material-region identity per triangle, inherited through refinement. */
  groups: readonly number[];
  /** Common area-weighted normal directions on this unmodified input basis. */
  normals: readonly number[];
}

/** One component's requested final positions; shared attachments use the same IDs. */
export type IPortraitFinalSurface = (
  host: IPortraitFinalSurfaceHost,
) => readonly {
  /** Existing shared vertex identity; final shaping never adds topology here. */
  vertex: number;
  /** Requested XYZ in the host's millimetre frame. */
  target: readonly number[];
}[];

/**
 * Collect final component surfaces before applying any of their positions.
 * Every provider reads the same deeply immutable snapshot, so reordering two
 * independent parts cannot make one fit against the other's edited surface.
 * Each returned proposal is copied before the next provider runs. Matching
 * requests may share an attachment; incompatible ownership of one vertex is
 * refused instead of selecting a winner by component order.
 *
 * This operation preserves vertex/triangle/material identities and leaves
 * normals to the assembler's one common recomputation afterward. Empty providers
 * or empty proposals retain the original mesh. It owns composition and numeric
 * admission, while each part owns its section geometry and boundary derivatives.
 */
export function applyPortraitFinalSurfaces(
  mesh: IControlMesh,
  surfaces: readonly { id: string; propose: IPortraitFinalSurface }[],
): IControlMesh {
  if (surfaces.length === 0) return mesh;
  if (
    surfaces.some((surface) => surface.id.trim().length === 0) ||
    new Set(surfaces.map((surface) => surface.id)).size !== surfaces.length
  )
    throw new Error("Final surface providers need unique nonempty identities.");
  const host: IPortraitFinalSurfaceHost = Object.freeze({
    positions: Object.freeze(
      mesh.positions.map((point) => Object.freeze([...point])),
    ),
    indices: Object.freeze([...mesh.indices]),
    groups: Object.freeze([...mesh.groups]),
    normals: Object.freeze(
      portraitNormals(mesh.positions.flat(), mesh.indices),
    ),
  });
  const proposals = surfaces.map((surface) => ({
    id: surface.id,
    vertices: surface
      .propose(host)
      .map(({ vertex, target }) => ({ vertex, target: [...target] })),
  }));
  const targets = new Map<number, { owner: string; point: number[] }>();
  for (const proposal of proposals)
    for (const { vertex, target } of proposal.vertices) {
      if (
        !Number.isInteger(vertex) ||
        vertex < 0 ||
        vertex >= mesh.positions.length ||
        target.length !== 3 ||
        !target.every(Number.isFinite)
      )
        throw new Error(
          "A final surface proposal needs a resident vertex and finite XYZ.",
        );
      const previous = targets.get(vertex);
      if (
        previous !== undefined &&
        previous.point.some((value, axis) => value !== target[axis])
      )
        throw new Error(
          `Incompatible final surface ownership at vertex ${vertex}: ${previous.owner}/${proposal.id}.`,
        );
      targets.set(vertex, { owner: proposal.id, point: target });
    }
  if (targets.size === 0) return mesh;
  return {
    positions: mesh.positions.map(
      (point, id) => targets.get(id)?.point ?? [...point],
    ),
    indices: mesh.indices,
    groups: mesh.groups,
  };
}
