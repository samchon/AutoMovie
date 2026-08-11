import {
  IAutoMovieSoftBodyDomain,
  IAutoMovieSoftBodyState,
  IAutoMovieSoftBodySurface,
} from "@automovie/interface";

/**
 * Derive the drawable panel of one solved soft-body state.
 *
 * The engine owns this so the renderer stays a projection of the solve. A
 * viewer that built its own cloth mesh would be a second opinion about where
 * the fabric is, and a second opinion can disagree with the particle field the
 * constraints were proven against.
 *
 * One vertex per particle, in row-major order, so a vertex index and a particle
 * index are the same number; two triangles per lattice quad, wound so the panel
 * faces the side the lattice's `+column × +row` cross product points to. A
 * lattice one particle wide along either axis holds no quad and emits no
 * triangle at all — a single row of particles is a cord, not a surface, and
 * inventing a sliver for it would be inventing geometry.
 *
 * Normals are the **area-weighted** sum of the incident triangle normals: an
 * un-normalized cross product is twice the triangle's area, so summing before
 * normalizing weights each face by how much of the vertex it actually is. A
 * degenerate neighbourhood — every incident triangle collapsed to a line —
 * yields `(0, 1, 0)` rather than a division by zero.
 *
 * UVs are the normalized lattice coordinates, so a fabric pattern is carried by
 * the weave rather than by the panel's momentary shape and does not swim as the
 * cloth folds.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Projects the computed particle state into one drawable cloth surface.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Keeps geometry derived from the same bounded solver transition.
 * @author Samchon
 */
export const softBodySurfaceGeometry = (props: {
  domain: IAutoMovieSoftBodyDomain;
  state: IAutoMovieSoftBodyState;
}): IAutoMovieSoftBodySurface => {
  const { domain, state } = props;
  const columns = domain.lattice.columns;
  const rows = domain.lattice.rows;
  const count = columns * rows;

  const positions = state.positions.slice();
  const uvs: number[] = [];
  for (let row = 0; row < rows; ++row)
    for (let column = 0; column < columns; ++column)
      uvs.push(
        columns > 1 ? column / (columns - 1) : 0,
        rows > 1 ? row / (rows - 1) : 0,
      );

  const indices: number[] = [];
  for (let row = 0; row + 1 < rows; ++row)
    for (let column = 0; column + 1 < columns; ++column) {
      const here = row * columns + column;
      const ahead = here + columns;
      indices.push(here, ahead, here + 1, here + 1, ahead, ahead + 1);
    }

  const accumulated = new Float64Array(count * 3);
  for (let at = 0; at < indices.length; at += 3) {
    const a = indices[at];
    const b = indices[at + 1];
    const c = indices[at + 2];
    const ux = positions[b * 3] - positions[a * 3];
    const uy = positions[b * 3 + 1] - positions[a * 3 + 1];
    const uz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const vx = positions[c * 3] - positions[a * 3];
    const vy = positions[c * 3 + 1] - positions[a * 3 + 1];
    const vz = positions[c * 3 + 2] - positions[a * 3 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const vertex of [a, b, c]) {
      accumulated[vertex * 3] += nx;
      accumulated[vertex * 3 + 1] += ny;
      accumulated[vertex * 3 + 2] += nz;
    }
  }
  const normals: number[] = [];
  for (let vertex = 0; vertex < count; ++vertex) {
    const nx = accumulated[vertex * 3];
    const ny = accumulated[vertex * 3 + 1];
    const nz = accumulated[vertex * 3 + 2];
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (length === 0) normals.push(0, 1, 0);
    else normals.push(nx / length, ny / length, nz / length);
  }

  const low = { x: Infinity, y: Infinity, z: Infinity };
  const high = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const index of indices) {
    const x = positions[index * 3];
    const y = positions[index * 3 + 1];
    const z = positions[index * 3 + 2];
    low.x = Math.min(low.x, x);
    low.y = Math.min(low.y, y);
    low.z = Math.min(low.z, z);
    high.x = Math.max(high.x, x);
    high.y = Math.max(high.y, y);
    high.z = Math.max(high.z, z);
  }

  return {
    domain: domain.id,
    step: state.step,
    mesh: { positions, normals, uvs, indices, skin: null },
    bounds: indices.length === 0 ? null : { min: low, max: high },
  };
};
