import { IAutoMovieSurface, IAutoMovieVector3 } from "@automovie/interface";

import { footprintConvexPieces, surfaceFootprint } from "../space/footprint";
import { surfaceHeightAt } from "../space/surfaces";
import { ITessellation } from "./tessellate";

const CLIP_EPSILON = 1e-10;

/**
 * Tessellate exactly the support surface that engine height queries read.
 *
 * The footprint is taken as the convex pieces whose union is the region itself,
 * so an L-shaped plate keeps its notch and a slab with an atrium void is drawn
 * with the void open. Drawing the hull instead would put floor under a camera
 * looking down the atrium while `surfaceContains` said there was none, which is
 * the same disagreement between the drawn ground and the queried ground that
 * this function was written to end.
 *
 * Level and planar patches fan each piece. Heightfields split the footprint at
 * every lattice coordinate, clip each lattice cell against each piece, and
 * evaluate every resulting vertex through {@link surfaceHeightAt}. The viewer
 * therefore draws internal relief from the same bilinear rule that feet and
 * placement queries obey.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Tessellates a declared support surface into renderer-ready geometry.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Preserves footprint holes and heightfield boundaries in the emitted topology.
 */
export const tessellateSurface = (
  surface: IAutoMovieSurface,
): ITessellation | null => {
  const footprint = surfaceFootprint(surface);
  const pieces = footprintConvexPieces(footprint);
  if (pieces.length === 0) return null;
  if (surface.height?.kind !== "heightfield")
    return tessellatePolygons(surface, pieces);

  const plan = footprint.outer.points;
  const minX = Math.min(...plan.map((point) => point.x));
  const maxX = Math.max(...plan.map((point) => point.x));
  const minZ = Math.min(...plan.map((point) => point.z));
  const maxZ = Math.max(...plan.map((point) => point.z));
  const rule = surface.height;
  const xs = latticeCuts(minX, maxX, rule.originX, rule.spacingX, rule.columns);
  const zs = latticeCuts(minZ, maxZ, rule.originZ, rule.spacingZ, rule.rows);
  const cells: IAutoMovieVector3[][] = [];
  for (const piece of pieces)
    for (let x = 0; x + 1 < xs.length; ++x)
      for (let z = 0; z + 1 < zs.length; ++z) {
        const clipped = clipConvexPolygon(
          [
            { x: xs[x]!, y: 0, z: zs[z]! },
            { x: xs[x + 1]!, y: 0, z: zs[z]! },
            { x: xs[x + 1]!, y: 0, z: zs[z + 1]! },
            { x: xs[x]!, y: 0, z: zs[z + 1]! },
          ],
          piece,
        );
        if (clipped.length >= 3) cells.push(clipped);
      }
  return tessellatePolygons(surface, cells);
};

const latticeCuts = (
  min: number,
  max: number,
  origin: number,
  spacing: number,
  count: number,
): number[] => {
  const values = [min, max];
  for (let index = 0; index < count; ++index) {
    const value = origin + index * spacing;
    if (value > min + CLIP_EPSILON && value < max - CLIP_EPSILON)
      values.push(value);
  }
  return [...new Set(values)].sort((left, right) => left - right);
};

const clipConvexPolygon = (
  subject: IAutoMovieVector3[],
  clip: IAutoMovieVector3[],
): IAutoMovieVector3[] => {
  let output = subject;
  for (let edge = 0; edge < clip.length; ++edge) {
    const from = clip[edge]!;
    const to = clip[(edge + 1) % clip.length]!;
    const input = output;
    output = [];
    if (input.length === 0) break;
    for (let index = 0; index < input.length; ++index) {
      const current = input[index]!;
      const previous = input[(index + input.length - 1) % input.length]!;
      const currentDistance = edgeDistance(from, to, current);
      const previousDistance = edgeDistance(from, to, previous);
      const currentInside = currentDistance >= -CLIP_EPSILON;
      const previousInside = previousDistance >= -CLIP_EPSILON;
      if (currentInside !== previousInside) {
        const progress =
          previousDistance / (previousDistance - currentDistance);
        output.push({
          x: previous.x + (current.x - previous.x) * progress,
          y: 0,
          z: previous.z + (current.z - previous.z) * progress,
        });
      }
      if (currentInside) output.push(current);
    }
  }
  return output;
};

const edgeDistance = (
  from: IAutoMovieVector3,
  to: IAutoMovieVector3,
  point: IAutoMovieVector3,
): number =>
  (to.x - from.x) * (point.z - from.z) - (to.z - from.z) * (point.x - from.x);

const tessellatePolygons = (
  surface: IAutoMovieSurface,
  polygons: IAutoMovieVector3[][],
): ITessellation => {
  const positions: number[] = [];
  const indices: number[] = [];
  const vertexByPlan = new Map<string, number>();
  const vertexOf = (point: IAutoMovieVector3): number => {
    const key = `${point.x}/${point.z}`;
    const existing = vertexByPlan.get(key);
    if (existing !== undefined) return existing;
    const index = positions.length / 3;
    positions.push(
      point.x,
      surfaceHeightAt(surface, point.x, point.z),
      point.z,
    );
    vertexByPlan.set(key, index);
    return index;
  };
  for (const polygon of polygons) {
    const vertices = polygon.map(vertexOf);
    for (let index = 1; index + 1 < vertices.length; ++index)
      indices.push(vertices[0]!, vertices[index + 1]!, vertices[index]!);
  }
  return { positions, normals: vertexNormals(positions, indices), indices };
};

const vertexNormals = (positions: number[], indices: number[]): number[] => {
  const normals = new Array<number>(positions.length).fill(0);
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index]! * 3;
    const b = indices[index + 1]! * 3;
    const c = indices[index + 2]! * 3;
    const abx = positions[b]! - positions[a]!;
    const aby = positions[b + 1]! - positions[a + 1]!;
    const abz = positions[b + 2]! - positions[a + 2]!;
    const acx = positions[c]! - positions[a]!;
    const acy = positions[c + 1]! - positions[a + 1]!;
    const acz = positions[c + 2]! - positions[a + 2]!;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const offset of [a, b, c]) {
      normals[offset] += nx;
      normals[offset + 1] += ny;
      normals[offset + 2] += nz;
    }
  }
  for (let index = 0; index < normals.length; index += 3) {
    const length = Math.hypot(
      normals[index]!,
      normals[index + 1]!,
      normals[index + 2]!,
    );
    normals[index] /= length;
    normals[index + 1] /= length;
    normals[index + 2] /= length;
  }
  return normals;
};
