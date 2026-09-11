import type { IAutoMovieMesh } from "@automovie/interface";

import { portraitNormals } from "./geometry";

/**
 * A closed anterior optical shell, in the study's millimetre frame. Angular
 * extents clip it to the visible aperture; they contain one sample per column,
 * without a duplicated closing sample. Front/back surfaces share a joined rim.
 * Curvature is added relative to the underlying spherical globe so the limbus
 * retains one declared lift. This is a rendering approximation of the anterior
 * optical surface, not a complete physiological model of the eye.
 *
 * @author Samchon
 */
export interface IPortraitCornea {
  /** In-plane centre of the iris/corneal aperture; surface supplies its depth. */
  center: { x: number; y: number };
  /** Unclipped aperture radius, in millimetres. */
  radius: number;
  /** Corneal surface curvature radius, greater than the aperture radius. */
  curvature: number;
  /** Underlying spherical curvature radius, at least the corneal curvature. */
  globeRadius: number;
  /** Positive axial separation of the two shell surfaces, in millimetres. */
  thickness: number;
  /** Front-rim lift from the underlying globe, greater than shell thickness. */
  rimLift: number;
  /** Positive visible radial reach at each equally spaced angular column. */
  extents: number[];
  /** Positive integral count of concentric rings on each surface. */
  radialSamples: number;
  /** Underlying globe surface height, in millimetres, at a head-frame X/Y. */
  surface: (x: number, y: number) => number;
}

/**
 * Construct a closed optical shell with a single vertex at each axial pole.
 * Positions remain in millimetres until portraitPart creates model data.
 *
 * At radius r, subtract the globe's sag from the corneal sphere's sag, each
 * measured relative to the declared unclipped aperture radius. Adding that
 * difference to surface(x,y) retains the fitted eye's support and rim lift.
 * Angular clipping shortens the same surface at the eyelid; it does not refit
 * curvature independently for each column.
 *
 * The back surface is an axial offset, not a second physiological curvature.
 * Reverse its triangle winding and join the outer rim so material volume has a
 * manifold boundary. The single centre vertices avoid degenerate pole quads.
 */
export function buildPortraitCornea(input: IPortraitCornea): IAutoMovieMesh {
  if (
    ![
      input.center.x,
      input.center.y,
      input.radius,
      input.curvature,
      input.globeRadius,
      input.thickness,
      input.rimLift,
    ].every(Number.isFinite) ||
    input.radius <= 0 ||
    input.curvature <= input.radius ||
    input.globeRadius < input.curvature ||
    input.thickness <= 0 ||
    input.rimLift <= input.thickness ||
    input.extents.length < 3 ||
    input.extents.some(
      (value) => !Number.isFinite(value) || value <= 0 || value > input.radius,
    ) ||
    !Number.isInteger(input.radialSamples) ||
    input.radialSamples < 1
  )
    throw new Error(
      "Corneal dimensions need a finite aperture, valid curvatures and a positive closed-shell thickness.",
    );
  const columns = input.extents.length,
    positions: number[] = [],
    indices: number[] = [];
  const cornealRim = Math.sqrt(input.curvature ** 2 - input.radius ** 2);
  const globeRim = Math.sqrt(input.globeRadius ** 2 - input.radius ** 2);
  const point = (radius: number, angle: number): void => {
    const x = input.center.x + radius * Math.cos(angle),
      y = input.center.y - radius * Math.sin(angle);
    const sag =
      Math.sqrt(input.curvature ** 2 - radius ** 2) -
      cornealRim -
      (Math.sqrt(input.globeRadius ** 2 - radius ** 2) - globeRim);
    const z = input.surface(x, y) + input.rimLift + sag;
    if (!Number.isFinite(z))
      throw new Error(
        "The corneal support surface must provide a finite height.",
      );
    positions.push(x, y, z);
  };
  point(0, 0);
  for (let row = 1; row <= input.radialSamples; row++)
    for (let column = 0; column < columns; column++)
      point(
        (input.extents[column] * row) / input.radialSamples,
        (2 * Math.PI * column) / columns,
      );
  for (let column = 0; column < columns; column++)
    indices.push(0, 1 + ((column + 1) % columns), 1 + column);
  for (let row = 0; row < input.radialSamples - 1; row++)
    for (let column = 0; column < columns; column++) {
      const a = 1 + row * columns + column,
        b = 1 + row * columns + ((column + 1) % columns),
        c = a + columns,
        d = b + columns;
      indices.push(a, b, c, b, d, c);
    }
  const frontCount = positions.length / 3,
    frontFaces = indices.length;
  for (let i = 0; i < frontCount; i++)
    positions.push(
      positions[3 * i],
      positions[3 * i + 1],
      positions[3 * i + 2] - input.thickness,
    );
  for (let i = 0; i < frontFaces; i += 3)
    indices.push(
      indices[i] + frontCount,
      indices[i + 2] + frontCount,
      indices[i + 1] + frontCount,
    );
  for (let column = 0; column < columns; column++) {
    const a = 1 + (input.radialSamples - 1) * columns + column,
      b = 1 + (input.radialSamples - 1) * columns + ((column + 1) % columns);
    indices.push(a, b, a + frontCount, b, b + frontCount, a + frontCount);
  }
  return {
    positions,
    indices,
    normals: portraitNormals(positions, indices),
    uvs: null,
    skin: null,
  };
}
