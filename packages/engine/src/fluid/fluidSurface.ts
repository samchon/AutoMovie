import {
  IAutoMovieFluidDomain,
  IAutoMovieFluidState,
  IAutoMovieFluidSurface,
} from "@automovie/interface";

/**
 * Derive the drawable free surface of one solved fluid state.
 *
 * The engine owns this so the renderer stays a projection of the solve. A
 * viewer that built its own water mesh would be a second opinion about where
 * the water is, and a second opinion can disagree with the depth field that the
 * mass balance was proven against.
 *
 * One vertex per cell, at the cell centre, at world height `origin.y + bed +
 * depth`; vertex order is the row-major cell order, so a vertex index and a
 * cell index are the same number. A quad is triangulated only when all four of
 * its corner cells are wet (`depth > solver.dryDepth`) and none is solid, which
 * is what makes a drained basin draw nothing at all rather than a flat sheet
 * lying on its floor. Triangles wind counter-clockwise seen from above, so the
 * surface faces `+y`.
 *
 * Normals come from the central difference of the free surface, `n = normalize(
 * −∂η/∂x, 1, −∂η/∂z )`, degenerating to forward and backward differences at the
 * lattice edge and to exactly `(0, 1, 0)` on a single-cell axis: still water is
 * numerically exactly flat, which is the visual counterpart of the solver's
 * lake-at-rest property.
 *
 * {@link IAutoMovieFluidSurface.flow} is the cell-centred average of the four
 * surrounding face velocities. A renderer scrolls ripples along it and never
 * re-derives it.
 *
 * Throws when the state was not solved from this domain. Two water features
 * over two lattices is the ordinary case, so handing the second one's state to
 * the first one's grid is the ordinary mistake, and a lattice reading depths
 * that were never indexed for it emits `NaN` positions a renderer draws as
 * nothing at all — a silent empty pond in place of a named refusal.
 *
 * @author Samchon
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Derives the declared bounded fluid tier's drawable surface and flow field.
 * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Projects one solved shallow-water state without a second renderer-side solve.
 */
export const fluidSurfaceGeometry = (props: {
  domain: IAutoMovieFluidDomain;
  state: IAutoMovieFluidState;
}): IAutoMovieFluidSurface => {
  const { domain, state } = props;
  if (state.domain !== domain.id)
    throw new Error(
      `fluid domain "${domain.id}" cannot draw a surface from a state of "${state.domain}"`,
    );
  const columns = domain.grid.columns;
  const rows = domain.grid.rows;
  const dx = domain.grid.cellX;
  const dz = domain.grid.cellZ;
  const origin = domain.grid.origin;
  const dry = domain.solver.dryDepth;

  const elevation = new Float64Array(columns * rows);
  for (let cell = 0; cell < elevation.length; ++cell)
    elevation[cell] = domain.bed[cell] + state.depth[cell];

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const flow: number[] = [];
  for (let row = 0; row < rows; ++row)
    for (let column = 0; column < columns; ++column) {
      const cell = row * columns + column;
      positions.push(
        origin.x + (column + 0.5) * dx,
        origin.y + elevation[cell],
        origin.z + (row + 0.5) * dz,
      );
      const west = column > 0 ? column - 1 : column;
      const east = column < columns - 1 ? column + 1 : column;
      const south = row > 0 ? row - 1 : row;
      const north = row < rows - 1 ? row + 1 : row;
      const slopeX =
        east === west
          ? 0
          : (elevation[row * columns + east] -
              elevation[row * columns + west]) /
            ((east - west) * dx);
      const slopeZ =
        north === south
          ? 0
          : (elevation[north * columns + column] -
              elevation[south * columns + column]) /
            ((north - south) * dz);
      const length = Math.sqrt(slopeX * slopeX + 1 + slopeZ * slopeZ);
      normals.push(-slopeX / length, 1 / length, -slopeZ / length);
      uvs.push(
        columns > 1 ? column / (columns - 1) : 0,
        rows > 1 ? row / (rows - 1) : 0,
      );
      const westFace = row * (columns + 1) + column;
      const southFace = row * columns + column;
      flow.push(
        (state.velocityX[westFace] + state.velocityX[westFace + 1]) / 2,
        (state.velocityZ[southFace] + state.velocityZ[southFace + columns]) / 2,
      );
    }

  const drawable = (cell: number): boolean =>
    domain.solid[cell] === false && state.depth[cell] > dry;
  const indices: number[] = [];
  for (let row = 0; row + 1 < rows; ++row)
    for (let column = 0; column + 1 < columns; ++column) {
      const here = row * columns + column;
      const ahead = here + columns;
      if (
        drawable(here) === false ||
        drawable(here + 1) === false ||
        drawable(ahead) === false ||
        drawable(ahead + 1) === false
      )
        continue;
      indices.push(here, ahead, here + 1, here + 1, ahead, ahead + 1);
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
    flow,
  };
};
