import { IAutoMovieMesh } from "@automovie/interface";

import {
  IAutoMovieProfilePoint,
  triangulateAutoMovieRegion,
} from "./proceduralMesh";

/**
 * Build one open planar region facing local positive Z.
 *
 * This is the authored-surface counterpart to the region extruder. It carries
 * one visible side, not a zero-thickness solid with coincident front and back
 * faces, so two independently placed copies may own different materials. That
 * distinction is what lets a window keep a dark exterior pane and a separately
 * lit interior pane without a camera-dependent shader. Rotate a second copy by
 * 180 degrees when the opposite side needs its own response, and separate the
 * copies by a real construction offset rather than leaving coplanar surfaces.
 *
 * Positions and texture coordinates use the authored XY metres. Canonical
 * region winding makes every triangle face positive Z, while malformed rings
 * retain the triangulator's explicit refusal instead of being repaired here.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-geometry-topology Preserves one named face and its orientation as a material-owning surface instead of merging opposite sides into one response.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Materializes a canonical one-sided region whose winding, surface role, and metric coordinates remain explicit.
 * @author Samchon
 */
export const buildAutoMovieRegionFace = (props: {
  /** Boundary of the visible region in local XY metres. */
  outer: readonly IAutoMovieProfilePoint[];
  /** Optional voids cut out of the visible region. */
  holes?: ReadonlyArray<readonly IAutoMovieProfilePoint[]>;
}): IAutoMovieMesh => {
  const region = triangulateAutoMovieRegion(props);
  return {
    positions: region.points.flatMap((point) => [point.x, point.y, 0]),
    normals: region.points.flatMap(() => [0, 0, 1]),
    uvs: region.points.flatMap((point) => [point.x, point.y]),
    indices: region.triangles,
    skin: null,
  };
};
